import type { FastifyInstance } from "fastify";
import { getDb } from "../db/client.js";
import { forecastExhaustion } from "../calc/forecast.js";

export function registerDashboardRoutes(app: FastifyInstance): void {
  const db = getDb();

  app.get("/api/accounts", async () => {
    const res = await db.execute("SELECT id, label, renewal_day FROM accounts ORDER BY label");
    return res.rows;
  });

  app.get<{ Querystring: { accountId: string } }>("/api/cycles", async (req) => {
    const { accountId } = req.query;
    const res = await db.execute({
      sql: `SELECT id, start_at, end_at, start_spent, end_spent FROM cycles
            WHERE account_id = ? ORDER BY start_at DESC`,
      args: [accountId],
    });
    return res.rows;
  });

  app.get<{ Querystring: { accountId: string; cycleId: string } }>(
    "/api/dashboard",
    async (req, reply) => {
      const { accountId, cycleId } = req.query;
      const cycleRes = await db.execute({
        sql: "SELECT * FROM cycles WHERE id = ? AND account_id = ?",
        args: [cycleId, accountId],
      });
      const cycle = cycleRes.rows[0];
      if (!cycle) return reply.code(404).send({ error: "ciclo não encontrado" });

      const creationsRes = await db.execute({
        sql: `SELECT c.*, p.name as project_name FROM creations c
              LEFT JOIN projects p ON p.reference = c.project_reference
              WHERE c.account_id = ? AND c.created_at >= ? AND c.created_at <= ?`,
        args: [accountId, cycle.start_at as string, cycle.end_at as string],
      });
      const creations = creationsRes.rows;

      const byFileType = groupSum(creations, (c) => c.file_type as string);
      const byTool = groupSum(creations, (c) => (c.tool_name as string) ?? "desconhecida");
      const byModel = groupSum(creations, (c) => (c.model as string) ?? "desconhecido");
      const byProject = groupSum(creations, (c) => (c.project_name as string) ?? "sem projeto");

      const totalAttributed = creations.reduce((s, c) => s + ((c.attributed_cost as number) ?? 0), 0);
      const realSpentInCycle = (cycle.end_spent as number) - (cycle.start_spent as number);
      const confidence = realSpentInCycle > 0 ? Math.min(1, totalAttributed / realSpentInCycle) : 1;

      const heaviest = [...byModel].sort((a, b) => b.credits - a.credits)[0];

      const snapshotsRes = await db.execute({
        sql: `SELECT taken_at, spent FROM snapshots WHERE account_id = ? AND taken_at >= ? AND taken_at <= ? ORDER BY taken_at`,
        args: [accountId, cycle.start_at as string, cycle.end_at as string],
      });
      const cumulativeSeries = snapshotsRes.rows.map((r) => ({
        takenAt: r.taken_at as string,
        spentInCycle: (r.spent as number) - (cycle.start_spent as number),
      }));

      const latestSnapshot = snapshotsRes.rows[snapshotsRes.rows.length - 1];
      const forecast = latestSnapshot
        ? forecastExhaustion({
            cycleStartAt: cycle.start_at as string,
            now: latestSnapshot.taken_at as string,
            cycleStartSpent: cycle.start_spent as number,
            currentSpent: latestSnapshot.spent as number,
            totalPlan: (cycle as Record<string, unknown>).total_plan as number ?? 300000,
            renewalAt: cycle.end_at as string | undefined,
          })
        : undefined;

      const dailyRes = await db.execute({
        sql: `SELECT substr(created_at,1,10) as day, file_type, SUM(attributed_cost) as credits
              FROM creations WHERE account_id = ? AND created_at >= ? AND created_at <= ?
              GROUP BY day, file_type ORDER BY day`,
        args: [accountId, cycle.start_at as string, cycle.end_at as string],
      });

      return {
        cycle,
        kpis: {
          spentInCycle: realSpentInCycle,
          confidence,
          heaviestItem: heaviest ? { key: heaviest.key, credits: heaviest.credits } : undefined,
        },
        pies: { byFileType, byTool, byModel, byProject },
        cumulativeSeries,
        dailyStacked: dailyRes.rows,
        forecast,
      };
    }
  );

  app.get<{ Querystring: { accountId: string; cycleId: string; groupBy: string; key: string } }>(
    "/api/creations",
    async (req) => {
      const { accountId, cycleId, groupBy, key } = req.query;
      const cycleRes = await db.execute({
        sql: "SELECT start_at, end_at FROM cycles WHERE id = ? AND account_id = ?",
        args: [cycleId, accountId],
      });
      const cycle = cycleRes.rows[0];
      if (!cycle) return [];
      const column =
        groupBy === "model" ? "model" : groupBy === "tool" ? "tool_name" : groupBy === "project" ? "project_reference" : "file_type";
      const res = await db.execute({
        sql: `SELECT c.id, c.created_at, c.model, c.tool_name, c.file_type, c.attributed_cost, c.web_url, p.name as project_name
              FROM creations c LEFT JOIN projects p ON p.reference = c.project_reference
              WHERE c.account_id = ? AND c.created_at >= ? AND c.created_at <= ?
              AND (${column === "project_reference" ? "p.name" : "c." + column}) = ?
              ORDER BY c.created_at DESC LIMIT 200`,
        args: [accountId, cycle.start_at as string, cycle.end_at as string, key],
      });
      return res.rows;
    }
  );

  app.get<{ Querystring: { accountId: string; cycleId: string } }>("/api/export.csv", async (req, reply) => {
    const { accountId, cycleId } = req.query;
    const cycleRes = await db.execute({
      sql: "SELECT start_at, end_at FROM cycles WHERE id = ? AND account_id = ?",
      args: [cycleId, accountId],
    });
    const cycle = cycleRes.rows[0];
    if (!cycle) return reply.code(404).send({ error: "ciclo não encontrado" });
    const res = await db.execute({
      sql: `SELECT c.created_at, c.file_type, c.tool_name, c.model, p.name as project_name,
                   c.attributed_cost, c.confidence, c.web_url
            FROM creations c LEFT JOIN projects p ON p.reference = c.project_reference
            WHERE c.account_id = ? AND c.created_at >= ? AND c.created_at <= ?
            ORDER BY c.created_at`,
      args: [accountId, cycle.start_at as string, cycle.end_at as string],
    });
    const header = "created_at,file_type,tool,model,project,attributed_cost,confidence,web_url";
    const lines = res.rows.map((r) =>
      [r.created_at, r.file_type, r.tool_name, r.model, r.project_name, r.attributed_cost, r.confidence, r.web_url]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="ciclo-${cycleId}.csv"`);
    return [header, ...lines].join("\n");
  });
}

function groupSum(
  rows: Record<string, unknown>[],
  keyFn: (row: Record<string, unknown>) => string
): { key: string; credits: number; count: number }[] {
  const map = new Map<string, { credits: number; count: number }>();
  for (const row of rows) {
    const key = keyFn(row);
    const entry = map.get(key) ?? { credits: 0, count: 0 };
    entry.credits += (row.attributed_cost as number) ?? 0;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.credits - a.credits);
}
