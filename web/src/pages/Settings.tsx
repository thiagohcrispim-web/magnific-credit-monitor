import { useEffect, useState } from "react";
import { api, type AlertsInfo } from "../api";

interface Props {
  accountId: string;
}

export function Settings({ accountId }: Props) {
  const [snapshotInterval, setSnapshotInterval] = useState("15");
  const [renewalDay, setRenewalDay] = useState("6");
  const [costRows, setCostRows] = useState<{ id: number; scope: string; key: string; credits: number }[]>([]);
  const [saved, setSaved] = useState(false);
  const [alerts, setAlerts] = useState<AlertsInfo | null>(null);
  const [emailsText, setEmailsText] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  useEffect(() => {
    api.settings(accountId).then((s) => {
      if (s.snapshotIntervalMinutes) setSnapshotInterval(s.snapshotIntervalMinutes);
      if (s.renewalDay) setRenewalDay(s.renewalDay);
    });
    api.costTable().then(setCostRows);
    api.alerts(accountId).then((a) => {
      setAlerts(a);
      setEmailsText(a.emails.join("\n"));
    });
  }, [accountId]);

  async function save() {
    await api.setSetting(accountId, "snapshotIntervalMinutes", snapshotInterval);
    await api.setSetting(accountId, "renewalDay", renewalDay);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function saveEmails() {
    const res = await api.setAlertEmails(accountId, emailsText);
    setEmailsText(res.emails.join("\n"));
    setAlertMsg(`Salvo: ${res.emails.length} e-mail(s).`);
  }

  async function testEmail() {
    setAlertMsg("Enviando teste...");
    const res = await api.testAlert(accountId);
    setAlertMsg(res.ok ? "E-mail de teste enviado." : `Falhou: ${res.error}`);
  }

  async function updateCost(row: { scope: string; key: string }, credits: number) {
    await api.setCostTable(row.scope, row.key, credits);
    setCostRows((rows) => rows.map((r) => (r.scope === row.scope && r.key === row.key ? { ...r, credits } : r)));
  }

  return (
    <div>
      <div className="settings-section">
        <h3>Coleta</h3>
        <div className="settings-row">
          <span>Intervalo de snapshot de saldo (minutos)</span>
          <input
            type="number"
            style={{ width: 100 }}
            value={snapshotInterval}
            onChange={(e) => setSnapshotInterval(e.target.value)}
          />
        </div>
        <div className="settings-row">
          <span>Dia de renovação do ciclo</span>
          <input type="number" style={{ width: 100 }} value={renewalDay} onChange={(e) => setRenewalDay(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={save}>
          Salvar
        </button>
        {saved && <span style={{ marginLeft: 10, color: "var(--text-secondary)" }}>Salvo.</span>}
      </div>

      <div className="settings-section">
        <h3>Alertas por e-mail</h3>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>
          Aviso enviado uma vez por ciclo quando restarem {alerts?.thresholds.join("% e ") ?? "30% e 10"}% dos créditos.
          {alerts && !alerts.emailConfigured && " ⚠ RESEND_API_KEY ainda não configurada no .env — nenhum e-mail sairá."}
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start" }}>
          <span>Destinatários (um por linha)</span>
          <textarea
            rows={4}
            style={{ width: 280 }}
            value={emailsText}
            placeholder="alguem@empresa.com"
            onChange={(e) => setEmailsText(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={saveEmails}>
          Salvar e-mails
        </button>{" "}
        <button onClick={testEmail}>Enviar teste</button>
        {alertMsg && <span style={{ marginLeft: 10, color: "var(--text-secondary)" }}>{alertMsg}</span>}
        {alerts && alerts.sentThisCycle.length > 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
            Já enviados neste ciclo:{" "}
            {alerts.sentThisCycle.map((s) => `${s.threshold}% (${new Date(s.sent_at).toLocaleString("pt-BR")})`).join(", ")}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Tabela de custo manual (camada 2 — usada quando simulate_cost falha)</h3>
        {costRows.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Nenhuma linha customizada ainda. Os valores padrão (código) seguem valendo até você sobrescrever aqui.
          </div>
        )}
        {costRows.map((row) => (
          <div className="settings-row" key={row.id}>
            <span>
              [{row.scope}] {row.key}
            </span>
            <input
              type="number"
              style={{ width: 100 }}
              defaultValue={row.credits}
              onBlur={(e) => updateCost(row, Number(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
