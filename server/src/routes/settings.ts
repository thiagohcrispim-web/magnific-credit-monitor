import type { FastifyInstance } from "fastify";
import { getDb } from "../db/client.js";

export function registerSettingsRoutes(app: FastifyInstance): void {
  const db = getDb();

  app.get<{ Querystring: { accountId: string } }>("/api/settings", async (req) => {
    const res = await db.execute({
      sql: "SELECT key, value FROM settings WHERE account_id = ?",
      args: [req.query.accountId],
    });
    const settings: Record<string, string> = {};
    for (const row of res.rows) settings[row.key as string] = row.value as string;
    return settings;
  });

  app.put<{ Body: { accountId: string; key: string; value: string } }>("/api/settings", async (req) => {
    const { accountId, key, value } = req.body;
    await db.execute({
      sql: `INSERT INTO settings (account_id, key, value) VALUES (?, ?, ?)
            ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value`,
      args: [accountId, key, value],
    });
    return { ok: true };
  });

  app.get("/api/cost-table", async () => {
    const res = await db.execute("SELECT id, scope, key, credits FROM cost_table ORDER BY scope, key");
    return res.rows;
  });

  app.put<{ Body: { scope: string; key: string; credits: number } }>("/api/cost-table", async (req) => {
    const { scope, key, credits } = req.body;
    await db.execute({
      sql: `INSERT INTO cost_table (scope, key, credits) VALUES (?, ?, ?)
            ON CONFLICT(scope, key) DO UPDATE SET credits = excluded.credits`,
      args: [scope, key, credits],
    });
    return { ok: true };
  });

  app.put<{ Body: { reference: string; name: string } }>("/api/projects/:reference", async (req) => {
    const { reference, name } = req.body;
    await db.execute({
      sql: "UPDATE projects SET name = ? WHERE reference = ?",
      args: [name, reference],
    });
    return { ok: true };
  });
}
