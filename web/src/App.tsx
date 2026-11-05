import { useEffect, useState } from "react";
import { api, type Account, type Cycle } from "./api";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";

export function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [tab, setTab] = useState<"dashboard" | "settings">("dashboard");

  useEffect(() => {
    api.accounts().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setAccountId(accs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!accountId) return;
    api.cycles(accountId).then((cs) => {
      setCycles(cs);
      if (cs.length > 0) setCycleId(cs[0].id);
    });
  }, [accountId]);

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand">
          Magnific Credit Monitor
          <small>monitoramento de créditos</small>
        </div>

        <div className="select-group">
          <label>Conta</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="select-group">
          <label>Ciclo</label>
          <select value={cycleId ?? ""} onChange={(e) => setCycleId(Number(e.target.value))}>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {new Date(c.start_at).toLocaleDateString("pt-BR")} —{" "}
                {c.end_at ? new Date(c.end_at).toLocaleDateString("pt-BR") : "atual"}
              </option>
            ))}
          </select>
        </div>

        <div className="nav-tabs">
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
            Configurações
          </button>
        </div>
      </div>

      <div className="main">
        {!accountId || cycleId === null ? (
          <div style={{ color: "var(--text-muted)" }}>Carregando...</div>
        ) : tab === "dashboard" ? (
          <Dashboard accountId={accountId} cycles={cycles} cycleId={cycleId} />
        ) : (
          <Settings accountId={accountId} />
        )}
      </div>
    </div>
  );
}
