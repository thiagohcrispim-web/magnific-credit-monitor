import { useState } from "react";
import { fileTypeColor, ink } from "../palette";

interface DayRow {
  day: string;
  file_type: string;
  credits: number;
}

interface Props {
  rows: DayRow[];
  width?: number;
  height?: number;
}

const TYPES = ["image", "video", "audio"];
const TYPE_LABEL: Record<string, string> = { image: "Imagem", video: "Vídeo", audio: "Áudio" };

export function StackedBar({ rows, width = 560, height = 220 }: Props) {
  const [hover, setHover] = useState<{ day: string; x: number; y: number } | null>(null);
  const pad = { l: 44, r: 12, t: 12, b: 28 };

  const days = [...new Set(rows.map((r) => r.day))].sort();
  const byDay: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    byDay[r.day] ??= {};
    byDay[r.day][r.file_type] = r.credits;
  }
  const maxTotal = Math.max(1, ...days.map((d) => TYPES.reduce((s, t) => s + (byDay[d]?.[t] ?? 0), 0)));

  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const barW = Math.max(2, innerW / days.length - 2);

  return (
    <div style={{ position: "relative" }}>
      <svg width={width} height={height}>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + innerH * (1 - f)}
            y2={pad.t + innerH * (1 - f)}
            stroke={ink.grid}
            strokeWidth={1}
          />
        ))}
        {days.map((day, i) => {
          const x = pad.l + i * (innerW / days.length);
          let yCursor = pad.t + innerH;
          return (
            <g
              key={day}
              onMouseEnter={(e) => setHover({ day, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover({ day, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
            >
              {TYPES.map((t) => {
                const v = byDay[day]?.[t] ?? 0;
                const h = (v / maxTotal) * innerH;
                yCursor -= h;
                if (v <= 0) return null;
                return (
                  <rect
                    key={t}
                    x={x}
                    y={yCursor}
                    width={barW}
                    height={Math.max(0, h - 1)}
                    fill={fileTypeColor[t]}
                    opacity={hover && hover.day !== day ? 0.5 : 1}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="tooltip" style={{ position: "fixed", left: hover.x + 12, top: hover.y + 12 }}>
          <strong>{hover.day}</strong>
          <br />
          {TYPES.map((t) => (
            <div key={t}>
              {TYPE_LABEL[t]}: {Math.round(byDay[hover.day]?.[t] ?? 0).toLocaleString("pt-BR")}
            </div>
          ))}
        </div>
      )}
      <div className="legend">
        {TYPES.map((t) => (
          <div key={t} className="legend-item">
            <span className="legend-swatch" style={{ background: fileTypeColor[t] }} />
            {TYPE_LABEL[t]}
          </div>
        ))}
      </div>
    </div>
  );
}
