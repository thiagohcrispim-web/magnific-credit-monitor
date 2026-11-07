import PQueue from "p-queue";
import type { Client } from "@libsql/client";
import type { Provider } from "../providers/types.js";
import { checkCreditAlerts } from "../alerts/alerts.js";
import { detectCycles } from "../calc/cycles.js";
import { attributeByInterval, type CreationForAttribution, type SnapshotRow } from "../calc/attribute.js";

const queue = new PQueue({ concurrency: 2 });

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        console.error(`[collector] ${label} falhou após ${attempt} tentativas:`, err);
        throw err;
      }
      const delayMs = Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 500;
      console.warn(`[collector] ${label} falhou (tentativa ${attempt}), retry em ${Math.round(delayMs)}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function collectBalanceSnapshot(db: Client, accountId: string, provider: Provider): Promise<void> {
  await queue.add(async () => {
    const snapshot = await withRetry(() => provider.getBalance(), `account_balance(${accountId})`);
    await db.execute({
      sql: `INSERT INTO snapshots (account_id, taken_at, spent, available, total_plan) VALUES (?, ?, ?, ?, ?)`,
      args: [accountId, snapshot.takenAt, snapshot.spent, snapshot.available, snapshot.totalPlan],
    });
    await db.execute({
      sql: `INSERT INTO sync_state (account_id, last_snapshot_at) VALUES (?, ?)
            ON CONFLICT(account_id) DO UPDATE SET last_snapshot_at = excluded.last_snapshot_at`,
      args: [accountId, snapshot.takenAt],
    });
    await recomputeCycles(db, accountId);
    await checkCreditAlerts(db, accountId);
  });
}

export async function syncCreations(db: Client, accountId: string, provider: Provider): Promise<void> {
  await queue.add(async () => {
    const stateRes = await db.execute({
      sql: "SELECT last_creation_synced_at FROM sync_state WHERE account_id = ?",
      args: [accountId],
    });
    const since = stateRes.rows[0]?.last_creation_synced_at as string | undefined;

    const creations = await withRetry(
      () => provider.listCreationsSince(since),
      `creations_search(${accountId})`
    );

    let maxCreatedAt = since;
    for (const creation of creations) {
      const estimate = await withRetry(
        () => provider.estimateCost(creation),
        `simulate_cost(${accountId},${creation.id})`,
        3
      );
      await db.execute({
        sql: `INSERT INTO creations (
                id, account_id, created_at, file_type, tool_name, model, project_reference,
                resolution, duration_seconds, web_url, raw_metadata, estimated_cost, cost_layer
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                estimated_cost = excluded.estimated_cost, cost_layer = excluded.cost_layer`,
        args: [
          creation.id,
          accountId,
          creation.createdAt,
          creation.fileType,
          creation.toolName ?? null,
          creation.model ?? null,
          creation.projectReference ?? null,
          creation.resolution ?? null,
          creation.durationSeconds ?? null,
          creation.webUrl ?? null,
          JSON.stringify(creation.raw),
          estimate?.credits ?? null,
          estimate?.layer ?? null,
        ],
      });
      if (!maxCreatedAt || creation.createdAt > maxCreatedAt) maxCreatedAt = creation.createdAt;
    }

    if (maxCreatedAt) {
      await db.execute({
        sql: `INSERT INTO sync_state (account_id, last_creation_synced_at) VALUES (?, ?)
              ON CONFLICT(account_id) DO UPDATE SET last_creation_synced_at = excluded.last_creation_synced_at`,
        args: [accountId, maxCreatedAt],
      });
    }

    await recomputeAttribution(db, accountId);
  });
}

async function recomputeCycles(db: Client, accountId: string): Promise<void> {
  const accountRes = await db.execute({ sql: "SELECT renewal_day FROM accounts WHERE id = ?", args: [accountId] });
  const renewalDay = accountRes.rows[0]?.renewal_day as number | undefined;

  const snapshotsRes = await db.execute({
    sql: "SELECT taken_at, spent FROM snapshots WHERE account_id = ? ORDER BY taken_at",
    args: [accountId],
  });
  const points = snapshotsRes.rows.map((r) => ({ takenAt: r.taken_at as string, spent: r.spent as number }));
  const detected = detectCycles(points, renewalDay);

  await db.execute({ sql: "DELETE FROM cycles WHERE account_id = ?", args: [accountId] });
  for (const cycle of detected) {
    await db.execute({
      sql: `INSERT INTO cycles (account_id, start_at, end_at, start_spent, end_spent, detected_by) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [accountId, cycle.startAt, cycle.endAt ?? null, cycle.startSpent, cycle.endSpent ?? null, cycle.detectedBy],
    });
  }
}

async function recomputeAttribution(db: Client, accountId: string): Promise<void> {
  const snapshotsRes = await db.execute({
    sql: "SELECT id, taken_at, spent FROM snapshots WHERE account_id = ? ORDER BY taken_at",
    args: [accountId],
  });
  const snapshots = snapshotsRes.rows as unknown as SnapshotRow[];

  const creationsRes = await db.execute({
    sql: "SELECT id, created_at, estimated_cost FROM creations WHERE account_id = ?",
    args: [accountId],
  });
  const creations = creationsRes.rows as unknown as CreationForAttribution[];

  const { results } = attributeByInterval(snapshots, creations);
  for (const r of results) {
    await db.execute({
      sql: `UPDATE creations SET attributed_cost = ?, confidence = ?, snapshot_from_id = ?, snapshot_to_id = ? WHERE id = ?`,
      args: [r.attributedCost, r.confidence, r.snapshotFromId, r.snapshotToId, r.creationId],
    });
  }
}
