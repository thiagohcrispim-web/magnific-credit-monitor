export interface ForecastInput {
  cycleStartAt: string;
  now: string;
  cycleStartSpent: number;
  currentSpent: number;
  totalPlan: number;
  renewalAt?: string;
}

export interface ForecastResult {
  dailyBurnRate: number;
  projectedExhaustionAt?: string;
  willExhaustBeforeRenewal: boolean;
  daysElapsed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Previsão simples por ritmo médio de consumo desde o início do ciclo. */
export function forecastExhaustion(input: ForecastInput): ForecastResult {
  const start = new Date(input.cycleStartAt).getTime();
  const now = new Date(input.now).getTime();
  const daysElapsed = Math.max((now - start) / DAY_MS, 1 / 24);

  const spentInCycle = Math.max(0, input.currentSpent - input.cycleStartSpent);
  const dailyBurnRate = spentInCycle / daysElapsed;

  const available = Math.max(0, input.totalPlan - input.currentSpent);

  if (dailyBurnRate <= 0) {
    return { dailyBurnRate: 0, willExhaustBeforeRenewal: false, daysElapsed };
  }

  const daysUntilExhaustion = available / dailyBurnRate;
  const projectedExhaustionAt = new Date(now + daysUntilExhaustion * DAY_MS).toISOString();

  let willExhaustBeforeRenewal = false;
  if (input.renewalAt) {
    willExhaustBeforeRenewal = new Date(projectedExhaustionAt).getTime() < new Date(input.renewalAt).getTime();
  }

  return { dailyBurnRate, projectedExhaustionAt, willExhaustBeforeRenewal, daysElapsed };
}
