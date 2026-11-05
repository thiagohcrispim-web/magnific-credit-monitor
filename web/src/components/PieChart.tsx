import { useState } from "react";
import { colorFor, ink } from "../palette";

export interface PieSlice {
  key: string;
  credits: number;
  count: number;
}

interface Props {
  data: PieSlice[];
  onSliceClick?: (key: string) => void;
  maxSlices?: number;
  valueLabel?: string;
  /** Cor fixa por chave (ex.: tipo de arquivo) em vez de cor por posição no ranking. */
  colorForKey?: (key: string) => string;
}

const SIZE = 180;
const RADIUS = 76;
const INNER = 42;
const CENTER = SIZE / 2;

function arcPath(startAngle: number, endAngle: number): string {
  const toXY = (angle: number, r: number) => [
    CENTER + r * Math.cos(angle - Math.PI / 2),
    CENTER + r * Math.sin(angle - Math.PI / 2),
  ];
  const [x1, y1] = toXY(startAngle, RADIUS);
  const [x2, y2] = toXY(endAngle, RADIUS);
  const [x3, y3] = toXY(endAngle, INNER);
  const [x4, y4] = toXY(startAngle, INNER);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER} ${INNER} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

/** Donut com fatias finas (gap de 2px), legenda sempre visível e tooltip por fatia. */
export function PieChart({ data, onSliceClick, maxSlices = 8, valueLabel = "créditos", colorForKey }: Props) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);

  const sorted = [...data].sort((a, b) => b.credits - a.credits);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const restSum = rest.reduce((s, r) => s + r.credits, 0);
  const slices: PieSlice[] = restSum > 0 ? [...top, { key: "Outros", credits: restSum, count: rest.length }] : top;

  const total = slices.reduce((s, d) => s + d.credits, 0);
  let angle = 0;
  const gap = 0.02; // rad, gap de superfície entre fatias

  return (
    <div style={{ position: "relative" }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {total === 0 ? (
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={ink.grid} strokeWidth={2} />
        ) : (
          slices.map((slice, i) => {
            const frac = slice.credits / total;
            const start = angle + gap / 2;
            const end = angle + frac * Math.PI * 2 - gap / 2;
            angle += frac * Math.PI * 2;
            const isOther = slice.key === "Outros";
            const color = isOther ? ink.muted : colorForKey ? colorForKey(slice.key) : colorFor(i);
            return (
              <path
                key={slice.key}
                d={arcPath(Math.max(start, 0), Math.max(end, start + 0.001))}
                fill={color}
                opacity={hover && hover.key !== slice.key ? 0.45 : 1}
                style={{ cursor: onSliceClick && !isOther ? "pointer" : "default", transition: "opacity 120ms" }}
                onMouseEnter={(e) => setHover({ key: slice.key, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ key: slice.key, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                onClick={() => !isOther && onSliceClick?.(slice.key)}
              />
            );
          })
        )}
        <text x={CENTER} y={CENTER - 4} textAnchor="middle" fill={ink.primary} fontSize="14" fontWeight={600}>
          {Math.round(total).toLocaleString("pt-BR")}
        </text>
        <text x={CENTER} y={CENTER + 14} textAnchor="middle" fill={ink.muted} fontSize="10">
          {valueLabel}
        </text>
      </svg>
      {hover &&
        (() => {
          const s = slices.find((x) => x.key === hover.key);
          if (!s) return null;
          const pct = total > 0 ? ((s.credits / total) * 100).toFixed(1) : "0";
          return (
            <div className="tooltip" style={{ position: "fixed", left: hover.x + 12, top: hover.y + 12 }}>
              <strong>{s.key}</strong>
              <br />
              {Math.round(s.credits).toLocaleString("pt-BR")} créditos ({pct}%) · {s.count} itens
            </div>
          );
        })()}
      <div className="legend">
        {slices.map((s, i) => (
          <div key={s.key} className="legend-item" onClick={() => s.key !== "Outros" && onSliceClick?.(s.key)}>
            <span
              className="legend-swatch"
              style={{ background: s.key === "Outros" ? ink.muted : colorForKey ? colorForKey(s.key) : colorFor(i) }}
            />
            {s.key}
          </div>
        ))}
      </div>
    </div>
  );
}
