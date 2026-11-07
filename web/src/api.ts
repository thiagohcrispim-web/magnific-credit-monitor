export interface Account {
  id: string;
  label: string;
  renewal_day: number | null;
}

export interface Cycle {
  id: number;
  start_at: string;
  end_at: string | null;
  start_spent: number;
  end_spent: number | null;
}

export interface DashboardData {
  cycle: Cycle;
  kpis: {
    spentInCycle: number;
    confidence: number;
    heaviestItem?: { key: string; credits: number };
  };
  pies: {
    byFileType: { key: string; credits: number; count: number }[];
    byTool: { key: string; credits: number; count: number }[];
    byModel: { key: string; credits: number; count: number }[];
    byProject: { key: string; credits: number; count: number }[];
  };
  cumulativeSeries: { takenAt: string; spentInCycle: number }[];
  dailyStacked: { day: string; file_type: string; credits: number }[];
  forecast?: {
    dailyBurnRate: number;
    projectedExhaustionAt?: string;
    willExhaustBeforeRenewal: boolean;
  };
}

// Senha da API (só exigida quando o servidor define API_TOKEN). Fica salva neste navegador.
const TOKEN_KEY = "apiToken";
function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
const nativeFetch = window.fetch.bind(window);
const fetch = (input: string, init: RequestInit = {}) =>
  nativeFetch(input, { ...init, headers: { ...(init.headers as Record<string, string>), ...authHeaders() } });

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    const t = window.prompt("Senha da API do Magnific Monitor:");
    if (t) {
      try {
        localStorage.setItem(TOKEN_KEY, t.trim());
      } catch {}
      window.location.reload();
    }
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface AlertsInfo {
  emails: string[];
  thresholds: number[];
  sentThisCycle: { threshold: number; sent_at: string; recipients: string }[];
  emailConfigured: boolean;
}

export const api = {
  alerts: (accountId: string) => fetch(`/api/alerts?accountId=${encodeURIComponent(accountId)}`).then((r) => json<AlertsInfo>(r)),
  setAlertEmails: (accountId: string, emails: string) =>
    fetch("/api/alerts/emails", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, emails }),
    }).then((r) => json<{ ok: boolean; emails: string[] }>(r)),
  testAlert: (accountId: string) =>
    fetch("/api/alerts/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId }),
    }).then(async (r) => ({ ok: r.ok, ...(await r.json()) }) as { ok: boolean; error?: string }),
  accounts: () => fetch("/api/accounts").then((r) => json<Account[]>(r)),
  cycles: (accountId: string) => fetch(`/api/cycles?accountId=${encodeURIComponent(accountId)}`).then((r) => json<Cycle[]>(r)),
  dashboard: (accountId: string, cycleId: number) =>
    fetch(`/api/dashboard?accountId=${encodeURIComponent(accountId)}&cycleId=${cycleId}`).then((r) => json<DashboardData>(r)),
  creations: (accountId: string, cycleId: number, groupBy: string, key: string) =>
    fetch(
      `/api/creations?accountId=${encodeURIComponent(accountId)}&cycleId=${cycleId}&groupBy=${groupBy}&key=${encodeURIComponent(key)}`
    ).then((r) => json<Record<string, unknown>[]>(r)),
  exportCsvUrl: (accountId: string, cycleId: number) =>
    `/api/export.csv?accountId=${encodeURIComponent(accountId)}&cycleId=${cycleId}` +
    (authHeaders().Authorization ? `&token=${encodeURIComponent(authHeaders().Authorization.slice(7))}` : ""),
  settings: (accountId: string) => fetch(`/api/settings?accountId=${encodeURIComponent(accountId)}`).then((r) => json<Record<string, string>>(r)),
  setSetting: (accountId: string, key: string, value: string) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, key, value }),
    }).then((r) => json<{ ok: boolean }>(r)),
  costTable: () => fetch("/api/cost-table").then((r) => json<{ id: number; scope: string; key: string; credits: number }[]>(r)),
  setCostTable: (scope: string, key: string, credits: number) =>
    fetch("/api/cost-table", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, key, credits }),
    }).then((r) => json<{ ok: boolean }>(r)),
};
