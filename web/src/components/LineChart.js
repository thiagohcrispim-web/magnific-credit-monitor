import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ink, categorical } from "../palette";
export function LineChart({ series, width = 560, height = 220, xLabel }) {
    const [hoverX, setHoverX] = useState(null);
    const pad = { l: 48, r: 16, t: 16, b: 28 };
    const allX = series.flatMap((s) => s.points.map((p) => p.x));
    const allY = series.flatMap((s) => s.points.map((p) => p.y));
    const minX = Math.min(...allX, 0);
    const maxX = Math.max(...allX, 1);
    const minY = Math.min(0, ...allY);
    const maxY = Math.max(...allY, 1);
    const sx = (x) => pad.l + ((x - minX) / (maxX - minX || 1)) * (width - pad.l - pad.r);
    const sy = (y) => height - pad.b - ((y - minY) / (maxY - minY || 1)) * (height - pad.t - pad.b);
    const toPath = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ");
    const gridLines = 4;
    return (_jsxs("div", { style: { position: "relative" }, children: [_jsxs("svg", { width: width, height: height, onMouseMove: (e) => {
                    const rect = e.target.closest("svg").getBoundingClientRect();
                    const relX = e.clientX - rect.left;
                    const dataX = minX + ((relX - pad.l) / (width - pad.l - pad.r)) * (maxX - minX);
                    setHoverX(dataX);
                }, onMouseLeave: () => setHoverX(null), children: [Array.from({ length: gridLines + 1 }).map((_, i) => {
                        const y = pad.t + (i * (height - pad.t - pad.b)) / gridLines;
                        const val = maxY - (i * (maxY - minY)) / gridLines;
                        return (_jsxs("g", { children: [_jsx("line", { x1: pad.l, x2: width - pad.r, y1: y, y2: y, stroke: ink.grid, strokeWidth: 1 }), _jsx("text", { x: pad.l - 8, y: y + 3, textAnchor: "end", fontSize: "10", fill: ink.muted, children: Math.round(val).toLocaleString("pt-BR") })] }, i));
                    }), series.map((s) => (_jsx("path", { d: toPath(s.points), fill: "none", stroke: s.color, strokeWidth: 2, strokeDasharray: s.dashed ? "4 4" : undefined }, s.key))), hoverX !== null && (_jsx("line", { x1: sx(hoverX), x2: sx(hoverX), y1: pad.t, y2: height - pad.b, stroke: ink.baseline, strokeWidth: 1 }))] }), _jsx("div", { className: "legend", children: series.map((s) => (_jsxs("div", { className: "legend-item", children: [_jsx("span", { className: "legend-swatch", style: { background: s.color } }), s.key] }, s.key))) })] }));
}
export const idealLineColor = ink.muted;
export const actualLineColor = categorical[0];
