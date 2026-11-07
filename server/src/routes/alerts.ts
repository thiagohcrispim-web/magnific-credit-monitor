import type { FastifyInstance } from "fastify";
import { getDb } from "../db/client.js";
import { ALERT_EMAILS_KEY, ALERT_THRESHOLDS, getAlertEmails, parseEmails, sendEmail } from "../alerts/alerts.js";

export function registerAlertRoutes(app: FastifyInstance): void {
  const db = getDb();

  // Configuração atual dos alertas: e-mails, limiares e quais já foram enviados no ciclo aberto.
  app.get<{ Querystring: { accountId: string } }>("/api/alerts", async (req) => {
    const { accountId } = req.query;
    const cycleRes = await db.execute({
      sql: "SELECT start_at FROM cycles WHERE account_id = ? AND end_at IS NULL ORDER BY start_at DESC LIMIT 1",
      args: [accountId],
    });
    const cycleStart = cycleRes.rows[0]?.start_at as string | undefined;
    const sent = cycleStart
      ? (
          await db.execute({
            sql: "SELECT threshold, sent_at, recipients FROM alerts_sent WHERE account_id = ? AND cycle_start_at = ?",
            args: [accountId, cycleStart],
          })
        ).rows
      : [];
    return {
      emails: await getAlertEmails(db, accountId),
      thresholds: ALERT_THRESHOLDS,
      sentThisCycle: sent,
      emailConfigured: Boolean(process.env.RESEND_API_KEY),
    };
  });

  app.put<{ Body: { accountId: string; emails: string[] | string } }>("/api/alerts/emails", async (req, reply) => {
    const { accountId } = req.body;
    const raw = Array.isArray(req.body.emails) ? req.body.emails.join(",") : req.body.emails;
    const emails = parseEmails(raw);
    await db.execute({
      sql: `INSERT INTO settings (account_id, key, value) VALUES (?, ?, ?)
            ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value`,
      args: [accountId, ALERT_EMAILS_KEY, emails.join(",")],
    });
    return reply.send({ ok: true, emails });
  });

  app.post<{ Body: { accountId: string } }>("/api/alerts/test", async (req, reply) => {
    const emails = await getAlertEmails(db, req.body.accountId);
    if (!emails.length) return reply.code(400).send({ error: "Nenhum e-mail de alerta configurado" });
    try {
      await sendEmail({
        to: emails,
        subject: "[Magnific] E-mail de teste dos alertas",
        html: "<p>Os alertas de créditos do Magnific Credit Monitor estão funcionando. Você será avisado quando restarem 30% e 10% dos créditos do ciclo.</p>",
      });
      return { ok: true, emails };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });
}
