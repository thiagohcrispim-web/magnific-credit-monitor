import { createClient, type Client } from "@libsql/client";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let client: Client | undefined;

export function getDb(): Client {
  if (client) return client;
  const url = process.env.DATABASE_URL ?? "file:./data/dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  client = createClient({ url, authToken });
  return client;
}

export async function runMigrations(): Promise<void> {
  const db = getDb();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
  );
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = await db.execute("SELECT name FROM _migrations");
  const appliedNames = new Set(applied.rows.map((r) => r.name as string));

  for (const file of files) {
    if (appliedNames.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf-8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await db.execute({ sql: "INSERT INTO _migrations (name) VALUES (?)", args: [file] });
    console.log(`[migrate] aplicado ${file}`);
  }
}
