import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api";
export function Settings({ accountId }) {
    const [snapshotInterval, setSnapshotInterval] = useState("15");
    const [renewalDay, setRenewalDay] = useState("6");
    const [costRows, setCostRows] = useState([]);
    const [saved, setSaved] = useState(false);
    const [alerts, setAlerts] = useState(null);
    const [emailsText, setEmailsText] = useState("");
    const [alertMsg, setAlertMsg] = useState("");
    useEffect(() => {
        api.settings(accountId).then((s) => {
            if (s.snapshotIntervalMinutes)
                setSnapshotInterval(s.snapshotIntervalMinutes);
            if (s.renewalDay)
                setRenewalDay(s.renewalDay);
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
    async function updateCost(row, credits) {
        await api.setCostTable(row.scope, row.key, credits);
        setCostRows((rows) => rows.map((r) => (r.scope === row.scope && r.key === row.key ? { ...r, credits } : r)));
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "settings-section", children: [_jsx("h3", { children: "Coleta" }), _jsxs("div", { className: "settings-row", children: [_jsx("span", { children: "Intervalo de snapshot de saldo (minutos)" }), _jsx("input", { type: "number", style: { width: 100 }, value: snapshotInterval, onChange: (e) => setSnapshotInterval(e.target.value) })] }), _jsxs("div", { className: "settings-row", children: [_jsx("span", { children: "Dia de renova\u00E7\u00E3o do ciclo" }), _jsx("input", { type: "number", style: { width: 100 }, value: renewalDay, onChange: (e) => setRenewalDay(e.target.value) })] }), _jsx("button", { className: "btn-primary", onClick: save, children: "Salvar" }), saved && _jsx("span", { style: { marginLeft: 10, color: "var(--text-secondary)" }, children: "Salvo." })] }), _jsxs("div", { className: "settings-section", children: [_jsx("h3", { children: "Alertas por e-mail" }), _jsxs("div", { style: { color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }, children: ["Aviso enviado uma vez por ciclo quando restarem ", alerts?.thresholds.join("% e ") ?? "30% e 10", "% dos cr\u00E9ditos.", alerts && !alerts.emailConfigured && " ⚠ RESEND_API_KEY ainda não configurada no .env — nenhum e-mail sairá."] }), _jsxs("div", { className: "settings-row", style: { alignItems: "flex-start" }, children: [_jsx("span", { children: "Destinat\u00E1rios (um por linha)" }), _jsx("textarea", { rows: 4, style: { width: 280 }, value: emailsText, placeholder: "alguem@empresa.com", onChange: (e) => setEmailsText(e.target.value) })] }), _jsx("button", { className: "btn-primary", onClick: saveEmails, children: "Salvar e-mails" }), " ", _jsx("button", { onClick: testEmail, children: "Enviar teste" }), alertMsg && _jsx("span", { style: { marginLeft: 10, color: "var(--text-secondary)" }, children: alertMsg }), alerts && alerts.sentThisCycle.length > 0 && (_jsxs("div", { style: { color: "var(--text-muted)", fontSize: 13, marginTop: 8 }, children: ["J\u00E1 enviados neste ciclo:", " ", alerts.sentThisCycle.map((s) => `${s.threshold}% (${new Date(s.sent_at).toLocaleString("pt-BR")})`).join(", ")] }))] }), _jsxs("div", { className: "settings-section", children: [_jsx("h3", { children: "Tabela de custo manual (camada 2 \u2014 usada quando simulate_cost falha)" }), costRows.length === 0 && (_jsx("div", { style: { color: "var(--text-muted)", fontSize: 13 }, children: "Nenhuma linha customizada ainda. Os valores padr\u00E3o (c\u00F3digo) seguem valendo at\u00E9 voc\u00EA sobrescrever aqui." })), costRows.map((row) => (_jsxs("div", { className: "settings-row", children: [_jsxs("span", { children: ["[", row.scope, "] ", row.key] }), _jsx("input", { type: "number", style: { width: 100 }, defaultValue: row.credits, onBlur: (e) => updateCost(row, Number(e.target.value)) })] }, row.id)))] })] }));
}
