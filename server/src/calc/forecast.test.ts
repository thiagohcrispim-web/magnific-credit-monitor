import { describe, expect, it } from "vitest";
import { forecastExhaustion } from "./forecast.js";

describe("forecastExhaustion", () => {
  it("calcula o ritmo médio e prevê esgotamento antes da renovação", () => {
    const result = forecastExhaustion({
      cycleStartAt: "2026-10-06T00:00:00Z",
      now: "2026-10-16T00:00:00Z", // 10 dias passados
      cycleStartSpent: 0,
      currentSpent: 200000, // 20.000/dia
      totalPlan: 300000,
      renewalAt: "2026-11-05T00:00:00Z", // 20 dias restantes
    });
    expect(result.dailyBurnRate).toBeCloseTo(20000, 5);
    // saldo restante 100.000 / 20.000 por dia = 5 dias -> esgota bem antes da renovação
    expect(result.willExhaustBeforeRenewal).toBe(true);
    expect(result.projectedExhaustionAt).toBeDefined();
  });

  it("não prevê esgotamento antes da renovação quando o ritmo é baixo", () => {
    const result = forecastExhaustion({
      cycleStartAt: "2026-10-06T00:00:00Z",
      now: "2026-10-16T00:00:00Z",
      cycleStartSpent: 0,
      currentSpent: 5000, // 500/dia
      totalPlan: 300000,
      renewalAt: "2026-11-05T00:00:00Z",
    });
    expect(result.willExhaustBeforeRenewal).toBe(false);
  });

  it("ritmo zero não gera previsão de esgotamento", () => {
    const result = forecastExhaustion({
      cycleStartAt: "2026-10-06T00:00:00Z",
      now: "2026-10-16T00:00:00Z",
      cycleStartSpent: 1000,
      currentSpent: 1000,
      totalPlan: 300000,
    });
    expect(result.dailyBurnRate).toBe(0);
    expect(result.projectedExhaustionAt).toBeUndefined();
    expect(result.willExhaustBeforeRenewal).toBe(false);
  });
});
