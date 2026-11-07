import "./env.js";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import cron from "node-cron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { getDb, runMigrations } from "./db/client.js";
import { seedMockData } from "./mock/generate.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerAlertRoutes } from "./routes/alerts.js";
import { registerSecurity } from "./http/security.js";
import { registerAuthRoutes } from "./http/auth.js";
import { MagnificProvider } from "./providers/magnific/magnificProvider.js";
import { collectBalanceSnapshot, syncCreations } from "./collectors/collector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const db = getDb();
  await runMigrations();

  if (config.mock) {
    const existing = await db.execute("SELECT COUNT(*) as n FROM accounts");
    if (Number(existing.rows[0].n) === 0) {
      console.log("[mock] semeando dados simulados...");
      await seedMockData(db);
    }
  } else {
    for (const account of config.accounts) {
      await db.execute({
        sql: `INSERT INTO accounts (id, label, provider, renewal_day) VALUES (?, ?, 'magnific', ?)
              ON CONFLICT(id) DO UPDATE SET label = excluded.label, renewal_day = excluded.renewal_day`,
        args: [account.id, account.label, account.renewalDay ?? null],
      });
    }
  }

  const app = Fastify({ logger: true });
  registerSecurity(app);
  registerAuthRoutes(app);
  registerDashboardRoutes(app);
  registerSettingsRoutes(app);
  registerAlertRoutes(app);

  const webDist = join(__dirname, "..", "..", "web", "dist");
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api")) return reply.code(404).send({ error: "not found" });
      return reply.sendFile("index.html");
    });
  }

  if (!config.mock) {
    for (const account of config.accounts) {
      const provider = new MagnificProvider(account.id);
      const runCollection = async () => {
        try {
          await collectBalanceSnapshot(db, account.id, provider);
          await syncCreations(db, account.id, provider);
        } catch (err) {
          app.log.error({ err, accountId: account.id }, "falha na coleta");
        }
      };
      await runCollection(); // coleta ao abrir
      const cronExpr = `*/${config.snapshotIntervalMinutes} * * * *`;
      cron.schedule(cronExpr, runCollection);
      app.log.info(`[collector] agendado para ${account.id} a cada ${config.snapshotIntervalMinutes}min`);
    }
  }

  await app.listen({ host: "0.0.0.0", port: config.port });
  console.log(`\nMagnific Credit Monitor rodando em http://localhost:${config.port} (modo ${config.mock ? "MOCK" : "real"})\n`);
}

main().catch((err) => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});
