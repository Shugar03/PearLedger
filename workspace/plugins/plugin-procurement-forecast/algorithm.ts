export interface ForecastResult {
  sku: string
  currentStock: number
  projectedConsumption: number
  breakDate: string | null
  belowThreshold: boolean
  recommendedOrderQty: number
}

const SAFETY_THRESHOLD = 10

export function runUsageForecast(sku: string, days: number): ForecastResult {
  const currentStock = 42
  const dailyUsage = 2
  const projectedConsumption = dailyUsage * days
  const remaining = currentStock - projectedConsumption
  const belowThreshold = remaining < SAFETY_THRESHOLD

  return {
    sku,
    currentStock,
    projectedConsumption,
    breakDate: belowThreshold
      ? new Date(Date.now() + (currentStock / dailyUsage) * 86400000).toISOString().slice(0, 10)
      : null,
    belowThreshold,
    recommendedOrderQty: belowThreshold ? SAFETY_THRESHOLD * 3 : 0
  }
}
