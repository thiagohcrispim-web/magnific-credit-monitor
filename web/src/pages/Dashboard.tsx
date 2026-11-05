import { useEffect, useMemo, useState } from "react";
import { api, type Cycle, type DashboardData } from "../api";
import { PieChart } from "../components/PieChart";
import { LineChart, actualLineColor, idealLineColor } from "../components/LineChart";
import { StackedBar } from "../components/StackedBar";
import { DrillDownModal } from "../components/DrillDownModal";
import { CycleComparison } from "../components/CycleComparison";
import { fileTypeColor, ink } from "../palette";

interface Props {
  accountId: string;
  cycles: Cycle[];
  cycleId: number;
}

export function Dashboard({ accountId, cycles, cycleId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [drillDown, setDrillDown] = useState<{ title: string; groupBy: string; key: string } | null>(null);
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    setData(null);
    api.dashboard(accountId, cycleId).then(setData);
  }, [accountId, cycleId]);

  useEffect(() => {
    if (!drillDown) return;
    api.creations(accountId, cycleId, drillDown.groupBy, drillDown.key).then(setDrillRows);
  }, [drillDown, accountId, cycleId]);

  const idealLine = useMemo(() => {
    if (!data) return [];
    const start = new Date(data.cycle.start_at).getTime();
    const end = new Date(data.cycle.end_at ?? Date.now()).getTime();
    const totalPlan = 300000;
    const totalSpan = end - start || 1;
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({ x: f * totalSpan, y: f * totalPlan }));
  }, [data]);

  if (!data) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Carregando...</div>;

  const alerts: { level: "warning" | "critical"; text: string }[] = [];
  const pct = data.kpis.spentInCycle / 300000;
  if (pct >= 0.95) alerts.push({ level: "critical", text: `Você já usou ${(pct * 100).toFixed(0)}% do plano neste ciclo.` });
  else if (pct >= 0.8) alerts.push({ level: "warning", text: `Você já usou ${(pct * 100).toFixed(0)}% do plano neste ciclo.` });
  if (data.forecast?.willExhaustBeforeRenewal) {
    alerts.push({
      level: "critical",
      text: `No ritmo atual, o saldo deve esgotar em ${new Date(data.forecast.projectedExhaustionAt!).toLocaleDateString("pt-BR")}, antes da renovação.`,
    });
  }

  const cumSeries = data.cumulativeSeries.map((p) => ({
    x: new Date(p.takenAt).getTime() - new Date(data.cycle.start_at).getTime(),
    y: p.spentInCycle,
  }));

  return (
    <div>
      {alerts.map((a, i) => (
        <div key={i} className={`alert-banner ${a.level}`}>
          ⚠ {a.text}
        </div>
      ))}

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="label">Gasto no ciclo</div>
          <div className="value">{Math.round(data.kpis.spentInCycle).toLocaleString("pt-BR")}</div>
          <div className="sub">de 300.000 créditos</div>
        </div>
        <div className="kpi-card">
          <div className="label">Média diária</div>
          <div className="value">{Math.round(data.forecast?.dailyBurnRate ?? 0).toLocaleString("pt-BR")}</div>
          <div className="sub">créditos/dia</div>
        </div>
        <div className="kpi-card">
          <div className="label">Previsão de esgotamento</div>
          <div className="value" style={{ fontSize: 16 }}>
            {data.forecast?.projectedExhaustionAt
              ? new Date(data.forecast.projectedExhaustionAt).toLocaleDateString("pt-BR")
              : "—"}
          </div>
          <div className="sub">{data.forecast?.willExhaustBeforeRenewal ? "antes da renovação" : "dentro do ciclo"}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Item mais pesado</div>
          <div className="value" style={{ fontSize: 16 }}>
            {data.kpis.heaviestItem?.key ?? "—"}
          </div>
          <div className="sub">{Math.round(data.kpis.heaviestItem?.credits ?? 0).toLocaleString("pt-BR")} créditos</div>
        </div>
        <div className="kpi-card">
          <div className="label">Confiança da atribuição</div>
          <div className="value">{(data.kpis.confidence * 100).toFixed(0)}%</div>
          <div className="sub">do gasto real coberto por criações</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Consumo acumulado vs. linha ideal</h3>
          <LineChart
            series={[
              { key: "Real", color: actualLineColor, points: cumSeries },
              { key: "Ideal (distribuído até a renovação)", color: idealLineColor, points: idealLine, dashed: true },
            ]}
          />
        </div>
        <div className="chart-card">
          <h3>Créditos por dia, por tipo</h3>
          <StackedBar rows={data.dailyStacked as any} />
        </div>
        <div className="chart-card">
          <h3>Por tipo de geração</h3>
          <PieChart
            data={data.pies.byFileType}
            colorForKey={(key) => fileTypeColor[key] ?? ink.muted}
            onSliceClick={(key) => setDrillDown({ title: `Tipo: ${key}`, groupBy: "file_type", key })}
          />
        </div>
        <div className="chart-card">
          <h3>Por ferramenta</h3>
          <PieChart data={data.pies.byTool} onSliceClick={(key) => setDrillDown({ title: `Ferramenta: ${key}`, groupBy: "tool", key })} />
        </div>
        <div className="chart-card">
          <h3>Por modelo</h3>
          <PieChart data={data.pies.byModel} onSliceClick={(key) => setDrillDown({ title: `Modelo: ${key}`, groupBy: "model", key })} />
        </div>
        <div className="chart-card">
          <h3>Por projeto</h3>
          <PieChart data={data.pies.byProject} onSliceClick={(key) => setDrillDown({ title: `Projeto: ${key}`, groupBy: "project", key })} />
        </div>
        <div className="chart-card">
          <h3>Comparação entre ciclos</h3>
          <CycleComparison cycles={cycles} activeCycleId={cycleId} />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <a className="link" href={api.exportCsvUrl(accountId, cycleId)}>
          Exportar ciclo em CSV
        </a>
      </div>

      {drillDown && (
        <DrillDownModal title={drillDown.title} rows={drillRows as any} onClose={() => setDrillDown(null)} />
      )}
    </div>
  );
}
