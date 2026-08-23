/**
 * Forecast de consumo y quiebre de stock, y redacción del borrador de orden.
 *
 * Todo aquí es puro salvo `runUsageForecast()`, que necesita el inventario del
 * disco y delega esa lectura en `./inventory.js`. El instante actual se pasa
 * como parámetro (`now`) en lugar de leerse con `Date.now()` dentro de la
 * función: con la fecha inyectada el cálculo de `breakDate` y el identificador
 * del PO son deterministas y comparables en un test.
 */

import { checkInventory } from './inventory.js'
import type { ForecastResult, InventoryItem } from './types.js'

const MS_PER_DAY = 86_400_000

/** Proyección de consumo de un ítem sobre un horizonte de `days` días. */
export function forecastItem(
  item: InventoryItem,
  days: number,
  now: number = Date.now()
): ForecastResult {
  const projectedConsumption = Number((item.dailyUsage * days).toFixed(2))
  const daysUntilBreak =
    item.dailyUsage > 0 ? item.stock / item.dailyUsage : Number.POSITIVE_INFINITY
  const remaining = item.stock - projectedConsumption
  const belowThreshold = remaining < item.safetyThreshold || daysUntilBreak < days

  const breakDate =
    item.dailyUsage > 0 && item.stock > 0
      ? new Date(now + daysUntilBreak * MS_PER_DAY).toISOString().slice(0, 10)
      : null

  const recommendedOrderQty = belowThreshold
    ? Math.max(
        Math.ceil(item.safetyThreshold * 3 - Math.max(remaining, 0)),
        Math.ceil(item.dailyUsage * 14)
      )
    : 0

  return {
    sku: item.sku,
    description: item.description,
    currentStock: item.stock,
    projectedConsumption,
    breakDate: belowThreshold ? breakDate : null,
    belowThreshold,
    recommendedOrderQty,
    vendor: item.vendor,
    unitPrice: item.unitPrice,
    daysHorizon: days
  }
}

/**
 * Forecast de uno o todos los SKUs. Devuelve siempre un array.
 *
 * Si se pide un SKU que no existe en el inventario se devuelve un ítem
 * sintético con `belowThreshold: true`: el consumidor debe ver el SKU pedido
 * marcado como problemático, no un array vacío que parezca "todo en orden".
 */
export async function runUsageForecast(
  sku?: string,
  days = 30,
  now: number = Date.now()
): Promise<ForecastResult[]> {
  const items = await checkInventory(sku)

  if (!items.length && sku) {
    return [
      {
        sku,
        currentStock: 0,
        projectedConsumption: 0,
        breakDate: null,
        belowThreshold: true,
        recommendedOrderQty: 0,
        daysHorizon: days
      }
    ]
  }

  return items.map((item) => forecastItem(item, days, now))
}

/** Redacta el texto del PO a partir de un forecast. Contrato: devuelve string. */
export function draftPurchaseOrder(forecast: ForecastResult, now: number = Date.now()): string {
  if (!forecast.belowThreshold || forecast.recommendedOrderQty <= 0) {
    return [
      `DRAFT PO — ${forecast.sku}`,
      `Status: no order needed`,
      `Current stock: ${forecast.currentStock}`,
      `Horizon: ${forecast.daysHorizon} days`,
      `Projected consumption: ${forecast.projectedConsumption}`,
      `Recommendation: maintain current inventory`
    ].join('\n')
  }

  const unitPrice = forecast.unitPrice ?? 0
  const lineTotal = Number((forecast.recommendedOrderQty * unitPrice).toFixed(2))
  const today = new Date(now).toISOString().slice(0, 10)
  const poId = `PO-DRAFT-${forecast.sku}-${today.replace(/-/g, '')}`

  return [
    `DRAFT PURCHASE ORDER ${poId}`,
    `Date: ${today}`,
    `Vendor: ${forecast.vendor ?? 'TBD'}`,
    `Currency: USD`,
    ``,
    `Reason: projected stockout / below safety threshold`,
    `SKU at risk: ${forecast.sku}${forecast.description ? ` — ${forecast.description}` : ''}`,
    `Current stock: ${forecast.currentStock}`,
    `Projected consumption (${forecast.daysHorizon}d): ${forecast.projectedConsumption}`,
    `Estimated break date: ${forecast.breakDate ?? 'n/a'}`,
    ``,
    `Line items:`,
    `- SKU ${forecast.sku} | Qty ${forecast.recommendedOrderQty} | Unit $${unitPrice} | Total $${lineTotal}`,
    ``,
    `Subtotal: $${lineTotal}`,
    `Tax: $0.00`,
    `Total: $${lineTotal}`,
    `Status: draft — pending human approval`
  ].join('\n')
}
