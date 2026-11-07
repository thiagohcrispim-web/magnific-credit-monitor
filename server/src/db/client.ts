import { createClient, type Client } from "@libsql/client";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let client: Client | undefined;

export function getDb(): Client {
  if (client) return client;
  // Padrão: <raiz do repo>/data/dev.db (mesma pasta do token), independente de onde o comando roda.
  let url = process.env.DATABASE_URL;
  if (!url) {
    const dataDir = join(__dirname, "..", "..", "..", "data");
    mkdirSync(dataDir, { recursive: true });
    url = pathToFileURL(join(dataDir, "dev.db")).href;
  }
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
