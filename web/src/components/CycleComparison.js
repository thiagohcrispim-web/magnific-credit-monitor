import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { categorical } from "../palette";
export function CycleComparison({ cycles, activeCycleId }) {
    const totals = cycles.map((c) => ({
        id: c.id,
        label: `${new Date(c.start_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`,
        total: (c.end_spent ?? c.start_spent) - c.start_spent,
    }));
    const max = Math.max(1, ...totals.map((t) => t.total));
    return (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: totals.map((t) => (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [_jsx("div", { style: { width: 70, fontSize: 12, color: "var(--text-secondary)" }, children: t.label }), _jsx("div", { style: { flex: 1, background: "var(--grid)", borderRadius: 4, height: 16, position: "relative" }, children: _jsx("div", { style: {
                            width: `${(t.total / max) * 100}%`,
                            height: "100%",
                            borderRadius: 4,
                            background: t.id === activeCycleId ? categorical[0] : "var(--text-muted)",
                        } }) }), _jsx("div", { style: { width: 90, fontSize: 12, textAlign: "right" }, children: Math.round(t.total).toLocaleString("pt-BR") })] }, t.id))) }));
}
