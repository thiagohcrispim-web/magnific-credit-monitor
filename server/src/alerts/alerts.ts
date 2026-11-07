import type { Client } from "@libsql/client";

/** Limiares de crédito RESTANTE (em %) que disparam alerta, do mais alto para o mais baixo. */
export const ALERT_THRESHOLDS = [30, 10] as const;

export const ALERT_EMAILS_KEY = "alertEmails";

export function parseEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    ),
  ];
}

/** Limiares já cruzados (ex.: restando 8% → [30, 10]). */
export function crossedThresholds(remainingPct: number): number[] {
  return ALERT_THRESHOLDS.filter((t) => remainingPct <= t);
}

export async function getAlertEmails(db: Client, accountId: string): Promise<string[]> {
  const res = await db.execute({
    sql: "SELECT value FROM settings WHERE account_id = ? AND key = ?",
    args: [accountId, ALERT_EMAILS_KEY],
  });
  const fromDb = parseEmails(res.rows[0]?.value as string | undefined);
  return fromDb.length ? fromDb : parseEmails(process.env.ALERT_EMAILS);
}

interface EmailInput {
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada no arquivo .env");
  const from = process.env.ALERT_FROM ?? "Magnific Monitor <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend respondeu ${res.status}: ${await res.text()}`);
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function buildAlertEmail(opts: {
  accountLabel: string;
  threshold: number;
  remainingPct: number;
  available: number;
  totalPlan: number;
}): { subject: string; html: string } {
  const { accountLabel, threshold, remainingPct, available, totalPlan } = opts;
  const pct = remainingPct.toFixed(1).replace(".", ",");
  return {
    subject: `[Magnific] ${accountLabel}: restam ${pct}% dos créditos`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#222">
  <h2 style="margin:0 0 12px">Créditos abaixo de ${threshold}%</h2>
  <p>A conta <b>${accountLabel}</b> tem <b>${fmt(available)}</b> de ${fmt(totalPlan)} créditos disponíveis no ciclo atual (<b>${pct}%</b>).</p>
  <p style="color:#666;font-size:13px">Alerta automático do Magnific Credit Monitor. Você recebe um aviso por limiar (30% e 10%) a cada ciclo.</p>
</div>`,
  };
}

/**
 * Verifica o snapshot mais recente e envia os alertas de limiar ainda não enviados neste ciclo.
 * Nunca lança erro: falhas de e-mail são só registradas no log, para não derrubar a coleta.
 */
export async function checkCreditAlerts(db: Client, accountId: string): Promise<void> {
  try {
    const snapRes = await db.execute({
      sql: "SELECT available, total_plan FROM snapshots WHERE account_id = ? ORDER BY taken_at DESC LIMIT 1",
      args: [accountId],
    });
    const snap = snapRes.rows[0];
    if (!snap) return;
    const available = Number(snap.available);
    const totalPlan = Number(snap.total_plan);
    if (!(totalPlan > 0)) return;
    const remainingPct = (available / totalPlan) * 100;

    const crossed = crossedThresholds(remainingPct);
    if (!crossed.length) return;

    const cycleRes = await db.execute({
      sql: "SELECT start_at FROM cycles WHERE account_id = ? AND end_at IS NULL ORDER BY start_at DESC LIMIT 1",
      args: [accountId],
    });
    const cycleStart = cycleRes.rows[0]?.start_at as string | undefined;
    if (!cycleStart) return;

    const sentRes = await db.execute({
      sql: "SELECT threshold FROM alerts_sent WHERE account_id = ? AND cycle_start_at = ?",
      args: [accountId, cycleStart],
    });
    const alreadySent = new Set(sentRes.rows.map((r) => Number(r.threshold)));
    const pending = crossed.filter((t) => !alreadySent.has(t));
    if (!pending.length) return;

    const recipients = await getAlertEmails(db, accountId);
    if (!recipients.length) {
      console.warn(`[alerts] ${accountId}: restam ${remainingPct.toFixed(1)}%, mas nenhum e-mail de alerta configurado`);
      return;
    }

    const labelRes = await db.execute({ sql: "SELECT label FROM accounts WHERE id = ?", args: [accountId] });
    const accountLabel = (labelRes.rows[0]?.label as string) ?? accountId;

    // Se cruzou 30% e 10% de uma vez, manda um e-mail só (o mais grave) e marca os dois.
    const threshold = Math.min(...pending);
    const email = buildAlertEmail({ accountLabel, threshold, remainingPct, available, totalPlan });
    await sendEmail({ to: recipients, ...email });
    for (const t of pending) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO alerts_sent (account_id, cycle_start_at, threshold, recipients) VALUES (?, ?, ?, ?)",
        args: [accountId, cycleStart, t, recipients.join(",")],
      });
    }
    console.log(`[alerts] ${accountId}: alerta de ${threshold}% enviado para ${recipients.join(", ")}`);
  } catch (err) {
    console.error(`[alerts] falha ao verificar/enviar alerta de ${accountId}:`, err);
  }
}
