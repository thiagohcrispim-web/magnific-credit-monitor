export interface SnapshotRow {
  id: number;
  taken_at: string;
  spent: number;
}

export interface CreationForAttribution {
  id: string;
  created_at: string;
  estimated_cost: number | null;
}

export interface AttributionResult {
  creationId: string;
  attributedCost: number;
  confidence: number;
  snapshotFromId: number;
  snapshotToId: number;
}

export interface IntervalSummary {
  snapshotFromId: number;
  snapshotToId: number;
  realDelta: number;
  estimatedTotal: number;
  attributedTotal: number;
  unattributed: number;
  creationCount: number;
}

/**
 * Rateia o gasto real (diferença de `spent` entre snapshots consecutivos) entre as
 * criações daquele intervalo, proporcional ao custo estimado de cada uma.
 * Intervalos com gasto real e sem criações (ou cujo total estimado é 0) ficam
 * marcados como "não atribuído" em `unattributed`, nunca descartados.
 */
export function attributeByInterval(
  snapshots: SnapshotRow[],
  creations: CreationForAttribution[]
): { results: AttributionResult[]; intervals: IntervalSummary[] } {
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
  );
  const sortedCreations = [...creations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const results: AttributionResult[] = [];
  const intervals: IntervalSummary[] = [];
  let cursor = 0;

  for (let i = 0; i < sortedSnapshots.length - 1; i++) {
    const from = sortedSnapshots[i];
    const to = sortedSnapshots[i + 1];
    const fromTime = new Date(from.taken_at).getTime();
    const toTime = new Date(to.taken_at).getTime();
    const realDelta = Math.max(0, to.spent - from.spent);

    const bucket: CreationForAttribution[] = [];
    while (cursor < sortedCreations.length) {
      const c = sortedCreations[cursor];
      const t = new Date(c.created_at).getTime();
      if (t <= fromTime) {
        cursor++;
        continue;
      }
      if (t > toTime) break;
      bucket.push(c);
      cursor++;
    }

    const estimatedTotal = bucket.reduce((sum, c) => sum + (c.estimated_cost ?? 0), 0);

    let attributedTotal = 0;
    if (realDelta > 0 && estimatedTotal > 0) {
      for (const c of bucket) {
        const share = (c.estimated_cost ?? 0) / estimatedTotal;
        const attributedCost = realDelta * share;
        attributedTotal += attributedCost;
        results.push({
          creationId: c.id,
          attributedCost,
          confidence: 1,
          snapshotFromId: from.id,
          snapshotToId: to.id,
        });
      }
    } else if (bucket.length > 0) {
      // Há criações mas nada para ratear (sem gasto real registrado no intervalo):
      // cada uma fica com custo estimado como fallback e confiança 0.
      for (const c of bucket) {
        results.push({
          creationId: c.id,
          attributedCost: c.estimated_cost ?? 0,
          confidence: 0,
          snapshotFromId: from.id,
          snapshotToId: to.id,
        });
      }
    }

    intervals.push({
      snapshotFromId: from.id,
      snapshotToId: to.id,
      realDelta,
      estimatedTotal,
      attributedTotal,
      unattributed: Math.max(0, realDelta - attributedTotal),
      creationCount: bucket.length,
    });
  }

  return { results, intervals };
}
