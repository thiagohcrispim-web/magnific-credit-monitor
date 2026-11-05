import { useState } from "react";
import { ink, categorical } from "../palette";

interface Series {
  key: string;
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
}

interface Props {
  series: Series[];
  width?: number;
  height?: number;
  xLabel?: (v: number) => string;
}

export function LineChart({ series, width = 560, height = 220, xLabel }: Props) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const pad = { l: 48, r: 16, t: 16, b: 28 };
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const minX = Math.min(...allX, 0);
  const maxX = Math.max(...allX, 1);
  const minY = Math.min(0, ...allY);
  const maxY = Math.max(...allY, 1);

  const sx = (x: number) => pad.l + ((x - minX) / (maxX - minX || 1)) * (width - pad.l - pad.r);
  const sy = (y: number) => height - pad.b - ((y - minY) / (maxY - minY || 1)) * (height - pad.t - pad.b);

  const toPath = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ");

  const gridLines = 4;

  return (
    <div style={{ position: "relative" }}>
      <svg
        width={width}
        height={height}
        onMouseMove={(e) => {
          const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
          const relX = e.clientX - rect.left;
          const dataX = minX + ((relX - pad.l) / (width - pad.l - pad.r)) * (maxX - minX);
          setHoverX(dataX);
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = pad.t + (i * (height - pad.t - pad.b)) / gridLines;
          const val = maxY - (i * (maxY - minY)) / gridLines;
          return (
            <g key={i}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={ink.grid} strokeWidth={1} />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fontSize="10" fill={ink.muted}>
                {Math.round(val).toLocaleString("pt-BR")}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <path
            key={s.key}
            d={toPath(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "4 4" : undefined}
          />
        ))}
        {hoverX !== null && (
          <line x1={sx(hoverX)} x2={sx(hoverX)} y1={pad.t} y2={height - pad.b} stroke={ink.baseline} strokeWidth={1} />
        )}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <div key={s.key} className="legend-item">
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.key}
          </div>
        ))}
      </div>
    </div>
  );
}

export const idealLineColor = ink.muted;
export const actualLineColor = categorical[0];
