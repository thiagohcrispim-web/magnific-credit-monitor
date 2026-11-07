import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { PieChart } from "../components/PieChart";
import { LineChart, actualLineColor, idealLineColor } from "../components/LineChart";
import { StackedBar } from "../components/StackedBar";
import { DrillDownModal } from "../components/DrillDownModal";
import { CycleComparison } from "../components/CycleComparison";
import { fileTypeColor, ink } from "../palette";
export function Dashboard({ accountId, cycles, cycleId }) {
    const [data, setData] = useState(null);
    const [drillDown, setDrillDown] = useState(null);
    const [drillRows, setDrillRows] = useState([]);
    useEffect(() => {
        setData(null);
        api.dashboard(accountId, cycleId).then(setData);
    }, [accountId, cycleId]);
    useEffect(() => {
        if (!drillDown)
            return;
        api.creations(accountId, cycleId, drillDown.groupBy, drillDown.key).then(setDrillRows);
    }, [drillDown, accountId, cycleId]);
    const idealLine = useMemo(() => {
        if (!data)
            return [];
        const start = new Date(data.cycle.start_at).getTime();
        const end = new Date(data.cycle.end_at ?? Date.now()).getTime();
        const totalPlan = 300000;
        const totalSpan = end - start || 1;
        return [0, 0.25, 0.5, 0.75, 1].map((f) => ({ x: f * totalSpan, y: f * totalPlan }));
    }, [data]);
    if (!data)
        return _jsx("div", { style: { padding: 40, color: "var(--text-muted)" }, children: "Carregando..." });
    const alerts = [];
    const pct = data.kpis.spentInCycle / 300000;
    if (pct >= 0.95)
        alerts.push({ level: "critical", text: `Você já usou ${(pct * 100).toFixed(0)}% do plano neste ciclo.` });
    else if (pct >= 0.8)
        alerts.push({ level: "warning", text: `Você já usou ${(pct * 100).toFixed(0)}% do plano neste ciclo.` });
    if (data.forecast?.willExhaustBeforeRenewal) {
        alerts.push({
            level: "critical",
            text: `No ritmo atual, o saldo deve esgotar em ${new Date(data.forecast.projectedExhaustionAt).toLocaleDateString("pt-BR")}, antes da renovação.`,
        });
    }
    const cumSeries = data.cumulativeSeries.map((p) => ({
        x: new Date(p.takenAt).getTime() - new Date(data.cycle.start_at).getTime(),
        y: p.spentInCycle,
    }));
    return (_jsxs("div", { children: [alerts.map((a, i) => (_jsxs("div", { className: `alert-banner ${a.level}`, children: ["\u26A0 ", a.text] }, i))), _jsxs("div", { className: "kpi-row", children: [_jsxs("div", { className: "kpi-card", children: [_jsx("div", { className: "label", children: "Gasto no ciclo" }), _jsx("div", { className: "value", children: Math.round(data.kpis.spentInCycle).toLocaleString("pt-BR") }), _jsx("div", { className: "sub", children: "de 300.000 cr\u00E9ditos" })] }), _jsxs("div", { className: "kpi-card", children: [_jsx("div", { className: "label", children: "M\u00E9dia di\u00E1ria" }), _jsx("div", { className: "value", children: Math.round(data.forecast?.dailyBurnRate ?? 0).toLocaleString("pt-BR") }), _jsx("div", { className: "sub", children: "cr\u00E9ditos/dia" })] }), _jsxs("div", { className: "kpi-card", children: [_jsx("div", { className: "label", children: "Previs\u00E3o de esgotamento" }), _jsx("div", { className: "value", style: { fontSize: 16 }, children: data.forecast?.projectedExhaustionAt
                                    ? new Date(data.forecast.projectedExhaustionAt).toLocaleDateString("pt-BR")
                                    : "—" }), _jsx("div", { className: "sub", children: data.forecast?.willExhaustBeforeRenewal ? "antes da renovação" : "dentro do ciclo" })] }), _jsxs("div", { className: "kpi-card", children: [_jsx("div", { className: "label", children: "Item mais pesado" }), _jsx("div", { className: "value", style: { fontSize: 16 }, children: data.kpis.heaviestItem?.key ?? "—" }), _jsxs("div", { className: "sub", children: [Math.round(data.kpis.heaviestItem?.credits ?? 0).toLocaleString("pt-BR"), " cr\u00E9ditos"] })] }), _jsxs("div", { className: "kpi-card", children: [_jsx("div", { className: "label", children: "Confian\u00E7a da atribui\u00E7\u00E3o" }), _jsxs("div", { className: "value", children: [(data.kpis.confidence * 100).toFixed(0), "%"] }), _jsx("div", { className: "sub", children: "do gasto real coberto por cria\u00E7\u00F5es" })] })] }), _jsxs("div", { className: "charts-grid", children: [_jsxs("div", { className: "chart-card", children: [_jsx("h3", { children: "Consumo acumulado vs. linha ideal" }), _jsx(LineChart, { series: [
                                    { key: "Real", color: actualLineColor, points: cumSeries },
                                    { key: "Ideal (distribuído até a renovação)", color: idealLineColor, points: idealLine, dashed: true },
                                ] })] }), _jsxs("div", { className: "chart-card", children: [_jsx("h3", { children: "Cr\u00E9ditos por dia, por tipo" }), _jsx(StackedBar, { rows: data.dailyStacked })] }), _jsxs("div", { className: "chart-card", children: [_jsx("h3", { children: "Por tipo de gera\u00E7\u00E3o" }), _jsx(PieChart, { data: data.pies.byFileType, colorForKey: (key) => fileTypeColor[key] ?? ink.muted, onSliceClick: (key) => setDrillDown({ title: `Tipo: ${key}`, groupBy: "file_type", key }) })] }), _jsxs("div", { className: "chart-card", children: [_jsx("h3", { children: "Por ferramenta" }), _jsx(PieChart, { data: data.pies.byTool, onSliceClick: (key) => setDrillDown({ title: `Ferramenta: ${key}`, groupBy: "tool", key }) })] }), _jsxs("div", { className: "chart-card", children: [_jsx("h3", { children: "Por modelo" }), _jsx(PieChart, { data: data.pies.byModel, onSliceClick: (key) => setDrillDown({ title: `Modelo: ${key}`, groupBy: "model", key }) })] }), _jsxs("div", { className: "chart-card", children: [_jsx("h3", { children: "Por projeto" }), _jsx(PieChart, { data: data.pies.byProject, onSliceClick: (key) => setDrillDown({ title: `Projeto: ${key}`, groupBy: "project", key }) })] }), _jsxs("div", { className: "chart-card", children: [_jsx("h3", { children: "Compara\u00E7\u00E3o entre ciclos" }), _jsx(CycleComparison, { cycles: cycles, activeCycleId: cycleId })] })] }), _jsx("div", { style: { marginTop: 20 }, children: _jsx("a", { className: "link", href: api.exportCsvUrl(accountId, cycleId), children: "Exportar ciclo em CSV" }) }), drillDown && (_jsx(DrillDownModal, { title: drillDown.title, rows: drillRows, onClose: () => setDrillDown(null) }))] }));
}
