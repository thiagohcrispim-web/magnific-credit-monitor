export interface SnapshotPoint {
  takenAt: string;
  spent: number;
}

export interface DetectedCycle {
  startAt: string;
  endAt?: string;
  startSpent: number;
  endSpent?: number;
  detectedBy: "renewal_day" | "spent_drop";
}

/**
 * Detecta ciclos a partir de uma série de snapshots de `spent`.
 * - Se `renewalDay` for informado, um novo ciclo começa no primeiro snapshot
 *   de cada mês em que `taken_at.getUTCDate() >= renewalDay` E o ciclo anterior
 *   ainda não tiver começado nesse mês civil.
 * - Sempre: uma queda de `spent` (renovação cobrando antes do fim do mês, ou
 *   plano resetado) fecha o ciclo atual e abre um novo, mesmo sem bater o dia.
 */
export function detectCycles(
  snapshots: SnapshotPoint[],
  renewalDay?: number
): DetectedCycle[] {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()
  );
  if (sorted.length === 0) return [];

  const cycles: DetectedCycle[] = [];
  let current: DetectedCycle = {
    startAt: sorted[0].takenAt,
    startSpent: sorted[0].spent,
    detectedBy: "renewal_day",
  };
  let lastSpent = sorted[0].spent;
  let lastCycleStartMonthKey = monthKey(sorted[0].takenAt);

  for (let i = 1; i < sorted.length; i++) {
    const point = sorted[i];
    const droppedSpent = point.spent < lastSpent;
    const monthK = monthKey(point.takenAt);
    const hitsRenewalDay =
      renewalDay !== undefined &&
      new Date(point.takenAt).getUTCDate() >= renewalDay &&
      monthK !== lastCycleStartMonthKey;

    if (droppedSpent || hitsRenewalDay) {
      current.endAt = point.takenAt;
      current.endSpent = lastSpent;
      cycles.push(current);
      current = {
        startAt: point.takenAt,
        startSpent: point.spent,
        detectedBy: droppedSpent ? "spent_drop" : "renewal_day",
      };
      lastCycleStartMonthKey = monthK;
    }
    lastSpent = point.spent;
  }

  current.endSpent = lastSpent;
  cycles.push(current);
  return cycles;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}
