/**
 * Contratos del plugin de compras.
 *
 * `ForecastResult` es el formato que consumen el CLI, el dashboard y el puente
 * IPC: sus claves son contrato público y no se renombran.
 */

export interface InventoryItem {
  sku: string
  description: string
  stock: number
  unit: string
  dailyUsage: number
  safetyThreshold: number
  vendor: string
  unitPrice: number
}

export interface ForecastResult {
  sku: string
  description?: string
  currentStock: number
  projectedConsumption: number
  /** `null` cuando no hay quiebre proyectado dentro del horizonte. */
  breakDate: string | null
  belowThreshold: boolean
  recommendedOrderQty: number
  vendor?: string
  unitPrice?: number
  daysHorizon: number
}
