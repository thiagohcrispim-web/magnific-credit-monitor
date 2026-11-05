import { describe, expect, it } from "vitest";
import { attributeByInterval } from "./attribute.js";

describe("attributeByInterval", () => {
  it("rateia o gasto real proporcionalmente ao custo estimado de cada criação", () => {
    const snapshots = [
      { id: 1, taken_at: "2026-01-01T00:00:00Z", spent: 0 },
      { id: 2, taken_at: "2026-01-01T12:00:00Z", spent: 100 },
    ];
    const creations = [
      { id: "a", created_at: "2026-01-01T06:00:00Z", estimated_cost: 30 },
      { id: "b", created_at: "2026-01-01T08:00:00Z", estimated_cost: 10 },
    ];
    const { results, intervals } = attributeByInterval(snapshots, creations);

    expect(results).toHaveLength(2);
    const a = results.find((r) => r.creationId === "a")!;
    const b = results.find((r) => r.creationId === "b")!;
    // 30/40 e 10/40 do total real de 100
    expect(a.attributedCost).toBeCloseTo(75, 5);
    expect(b.attributedCost).toBeCloseTo(25, 5);
    expect(a.attributedCost + b.attributedCost).toBeCloseTo(100, 5);

    expect(intervals).toHaveLength(1);
    expect(intervals[0].realDelta).toBe(100);
    expect(intervals[0].unattributed).toBeCloseTo(0, 5);
  });

  it("marca como não atribuído quando há gasto real mas nenhuma criação no intervalo", () => {
    const snapshots = [
      { id: 1, taken_at: "2026-01-01T00:00:00Z", spent: 0 },
      { id: 2, taken_at: "2026-01-01T12:00:00Z", spent: 50 },
    ];
    const { results, intervals } = attributeByInterval(snapshots, []);
    expect(results).toHaveLength(0);
    expect(intervals[0].unattributed).toBe(50);
    expect(intervals[0].creationCount).toBe(0);
  });

  it("não descarta criações quando o intervalo não tem gasto real registrado (confiança 0)", () => {
    const snapshots = [
      { id: 1, taken_at: "2026-01-01T00:00:00Z", spent: 100 },
      { id: 2, taken_at: "2026-01-01T12:00:00Z", spent: 100 },
    ];
    const creations = [{ id: "a", created_at: "2026-01-01T06:00:00Z", estimated_cost: 40 }];
    const { results } = attributeByInterval(snapshots, creations);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0);
    expect(results[0].attributedCost).toBe(40);
  });

  it("ignora criações fora do range de snapshots (antes do primeiro ou depois do último)", () => {
    const snapshots = [
      { id: 1, taken_at: "2026-01-01T00:00:00Z", spent: 0 },
      { id: 2, taken_at: "2026-01-01T12:00:00Z", spent: 100 },
    ];
    const creations = [
      { id: "before", created_at: "2025-12-31T00:00:00Z", estimated_cost: 10 },
      { id: "inside", created_at: "2026-01-01T06:00:00Z", estimated_cost: 10 },
      { id: "after", created_at: "2026-01-02T00:00:00Z", estimated_cost: 10 },
    ];
    const { results } = attributeByInterval(snapshots, creations);
    expect(results.map((r) => r.creationId)).toEqual(["inside"]);
  });
});
