import type { Cycle } from "../api";
import { categorical } from "../palette";

interface Props {
  cycles: Cycle[];
  activeCycleId: number;
}

export function CycleComparison({ cycles, activeCycleId }: Props) {
  const totals = cycles.map((c) => ({
    id: c.id,
    label: `${new Date(c.start_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`,
    total: (c.end_spent ?? c.start_spent) - c.start_spent,
  }));
  const max = Math.max(1, ...totals.map((t) => t.total));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {totals.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 70, fontSize: 12, color: "var(--text-secondary)" }}>{t.label}</div>
          <div style={{ flex: 1, background: "var(--grid)", borderRadius: 4, height: 16, position: "relative" }}>
            <div
              style={{
                width: `${(t.total / max) * 100}%`,
                height: "100%",
                borderRadius: 4,
                background: t.id === activeCycleId ? categorical[0] : "var(--text-muted)",
              }}
            />
          </div>
          <div style={{ width: 90, fontSize: 12, textAlign: "right" }}>{Math.round(t.total).toLocaleString("pt-BR")}</div>
        </div>
      ))}
    </div>
  );
}
