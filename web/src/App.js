import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
export function App() {
    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState("");
    const [cycles, setCycles] = useState([]);
    const [cycleId, setCycleId] = useState(null);
    const [tab, setTab] = useState("dashboard");
    useEffect(() => {
        api.accounts().then((accs) => {
            setAccounts(accs);
            if (accs.length > 0)
                setAccountId(accs[0].id);
        });
    }, []);
    useEffect(() => {
        if (!accountId)
            return;
        api.cycles(accountId).then((cs) => {
            setCycles(cs);
            if (cs.length > 0)
                setCycleId(cs[0].id);
        });
    }, [accountId]);
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("div", { className: "sidebar", children: [_jsxs("div", { className: "brand", children: ["Magnific Credit Monitor", _jsx("small", { children: "monitoramento de cr\u00E9ditos" })] }), _jsxs("div", { className: "select-group", children: [_jsx("label", { children: "Conta" }), _jsx("select", { value: accountId, onChange: (e) => setAccountId(e.target.value), children: accounts.map((a) => (_jsx("option", { value: a.id, children: a.label }, a.id))) })] }), _jsxs("div", { className: "select-group", children: [_jsx("label", { children: "Ciclo" }), _jsx("select", { value: cycleId ?? "", onChange: (e) => setCycleId(Number(e.target.value)), children: cycles.map((c) => (_jsxs("option", { value: c.id, children: [new Date(c.start_at).toLocaleDateString("pt-BR"), " \u2014", " ", c.end_at ? new Date(c.end_at).toLocaleDateString("pt-BR") : "atual"] }, c.id))) })] }), _jsxs("div", { className: "nav-tabs", children: [_jsx("button", { className: tab === "dashboard" ? "active" : "", onClick: () => setTab("dashboard"), children: "Dashboard" }), _jsx("button", { className: tab === "settings" ? "active" : "", onClick: () => setTab("settings"), children: "Configura\u00E7\u00F5es" })] })] }), _jsx("div", { className: "main", children: !accountId || cycleId === null ? (_jsx("div", { style: { color: "var(--text-muted)" }, children: "Carregando..." })) : tab === "dashboard" ? (_jsx(Dashboard, { accountId: accountId, cycles: cycles, cycleId: cycleId })) : (_jsx(Settings, { accountId: accountId })) })] }));
}
