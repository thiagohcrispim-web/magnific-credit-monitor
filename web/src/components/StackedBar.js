import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { fileTypeColor, ink } from "../palette";
const TYPES = ["image", "video", "audio"];
const TYPE_LABEL = { image: "Imagem", video: "Vídeo", audio: "Áudio" };
export function StackedBar({ rows, width = 560, height = 220 }) {
    const [hover, setHover] = useState(null);
    const pad = { l: 44, r: 12, t: 12, b: 28 };
    const days = [...new Set(rows.map((r) => r.day))].sort();
    const byDay = {};
    for (const r of rows) {
        byDay[r.day] ??= {};
        byDay[r.day][r.file_type] = r.credits;
    }
    const maxTotal = Math.max(1, ...days.map((d) => TYPES.reduce((s, t) => s + (byDay[d]?.[t] ?? 0), 0)));
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const barW = Math.max(2, innerW / days.length - 2);
    return (_jsxs("div", { style: { position: "relative" }, children: [_jsxs("svg", { width: width, height: height, children: [[0, 0.5, 1].map((f) => (_jsx("line", { x1: pad.l, x2: width - pad.r, y1: pad.t + innerH * (1 - f), y2: pad.t + innerH * (1 - f), stroke: ink.grid, strokeWidth: 1 }, f))), days.map((day, i) => {
                        const x = pad.l + i * (innerW / days.length);
                        let yCursor = pad.t + innerH;
                        return (_jsx("g", { onMouseEnter: (e) => setHover({ day, x: e.clientX, y: e.clientY }), onMouseMove: (e) => setHover({ day, x: e.clientX, y: e.clientY }), onMouseLeave: () => setHover(null), children: TYPES.map((t) => {
                                const v = byDay[day]?.[t] ?? 0;
                                const h = (v / maxTotal) * innerH;
                                yCursor -= h;
                                if (v <= 0)
                                    return null;
                                return (_jsx("rect", { x: x, y: yCursor, width: barW, height: Math.max(0, h - 1), fill: fileTypeColor[t], opacity: hover && hover.day !== day ? 0.5 : 1 }, t));
                            }) }, day));
                    })] }), hover && (_jsxs("div", { className: "tooltip", style: { position: "fixed", left: hover.x + 12, top: hover.y + 12 }, children: [_jsx("strong", { children: hover.day }), _jsx("br", {}), TYPES.map((t) => (_jsxs("div", { children: [TYPE_LABEL[t], ": ", Math.round(byDay[hover.day]?.[t] ?? 0).toLocaleString("pt-BR")] }, t)))] })), _jsx("div", { className: "legend", children: TYPES.map((t) => (_jsxs("div", { className: "legend-item", children: [_jsx("span", { className: "legend-swatch", style: { background: fileTypeColor[t] } }), TYPE_LABEL[t]] }, t))) })] }));
}
