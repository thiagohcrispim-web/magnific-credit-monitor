import { describe, expect, it } from "vitest";
import { detectCycles } from "./cycles.js";

describe("detectCycles", () => {
  it("detecta um novo ciclo quando bate o dia de renovação configurado", () => {
    const snapshots = [
      { takenAt: "2026-09-10T00:00:00Z", spent: 1000 },
      { takenAt: "2026-09-20T00:00:00Z", spent: 50000 },
      // renova no dia 6, mas o saldo gasto só é lido depois — sem queda, só o dia bate
      { takenAt: "2026-10-06T00:00:00Z", spent: 60000 },
      { takenAt: "2026-10-15T00:00:00Z", spent: 90000 },
    ];
    const cycles = detectCycles(snapshots, 6);
    expect(cycles).toHaveLength(2);
    expect(cycles[0].startAt).toBe("2026-09-10T00:00:00Z");
    expect(cycles[1].startAt).toBe("2026-10-06T00:00:00Z");
    expect(cycles[1].detectedBy).toBe("renewal_day");
  });

  it("detecta renovação por queda de spent mesmo sem bater o dia configurado", () => {
    const snapshots = [
      { takenAt: "2026-09-10T00:00:00Z", spent: 1000 },
      { takenAt: "2026-09-25T00:00:00Z", spent: 299000 },
      { takenAt: "2026-09-26T00:00:00Z", spent: 50 }, // renovou antecipado
    ];
    const cycles = detectCycles(snapshots, 6);
    expect(cycles).toHaveLength(2);
    expect(cycles[1].detectedBy).toBe("spent_drop");
    expect(cycles[1].startSpent).toBe(50);
  });

  it("sem renewalDay, só detecta por queda de spent", () => {
    const snapshots = [
      { takenAt: "2026-09-10T00:00:00Z", spent: 1000 },
      { takenAt: "2026-10-10T00:00:00Z", spent: 2000 },
    ];
    const cycles = detectCycles(snapshots);
    expect(cycles).toHaveLength(1);
  });

  it("lista vazia retorna nenhum ciclo", () => {
    expect(detectCycles([])).toEqual([]);
  });
});
