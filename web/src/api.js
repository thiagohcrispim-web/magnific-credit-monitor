async function json(res) {
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
export const api = {
    alerts: (accountId) => fetch(`/api/alerts?accountId=${encodeURIComponent(accountId)}`).then((r) => json(r)),
    setAlertEmails: (accountId, emails) => fetch("/api/alerts/emails", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, emails }),
    }).then((r) => json(r)),
    testAlert: (accountId) => fetch("/api/alerts/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId }),
    }).then(async (r) => ({ ok: r.ok, ...(await r.json()) })),
    accounts: () => fetch("/api/accounts").then((r) => json(r)),
    cycles: (accountId) => fetch(`/api/cycles?accountId=${encodeURIComponent(accountId)}`).then((r) => json(r)),
    dashboard: (accountId, cycleId) => fetch(`/api/dashboard?accountId=${encodeURIComponent(accountId)}&cycleId=${cycleId}`).then((r) => json(r)),
    creations: (accountId, cycleId, groupBy, key) => fetch(`/api/creations?accountId=${encodeURIComponent(accountId)}&cycleId=${cycleId}&groupBy=${groupBy}&key=${encodeURIComponent(key)}`).then((r) => json(r)),
    exportCsvUrl: (accountId, cycleId) => `/api/export.csv?accountId=${encodeURIComponent(accountId)}&cycleId=${cycleId}`,
    settings: (accountId) => fetch(`/api/settings?accountId=${encodeURIComponent(accountId)}`).then((r) => json(r)),
    setSetting: (accountId, key, value) => fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, key, value }),
    }).then((r) => json(r)),
    costTable: () => fetch("/api/cost-table").then((r) => json(r)),
    setCostTable: (scope, key, credits) => fetch("/api/cost-table", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, key, credits }),
    }).then((r) => json(r)),
};
