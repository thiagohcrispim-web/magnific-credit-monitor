import { useEffect, useState } from "react";
import { api } from "../api";

interface Props {
  accountId: string;
}

export function Settings({ accountId }: Props) {
  const [snapshotInterval, setSnapshotInterval] = useState("15");
  const [renewalDay, setRenewalDay] = useState("6");
  const [costRows, setCostRows] = useState<{ id: number; scope: string; key: string; credits: number }[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.settings(accountId).then((s) => {
      if (s.snapshotIntervalMinutes) setSnapshotInterval(s.snapshotIntervalMinutes);
      if (s.renewalDay) setRenewalDay(s.renewalDay);
    });
    api.costTable().then(setCostRows);
  }, [accountId]);

  async function save() {
    await api.setSetting(accountId, "snapshotIntervalMinutes", snapshotInterval);
    await api.setSetting(accountId, "renewalDay", renewalDay);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
