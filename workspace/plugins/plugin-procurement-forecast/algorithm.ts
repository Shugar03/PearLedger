/**
 * Forecast de consumo + quiebre de stock.
 * Permalink QVAC Pipeline: workspace/plugins/plugin-procurement-forecast/
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

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
  breakDate: string | null
  belowThreshold: boolean
  recommendedOrderQty: number
  vendor?: string
  unitPrice?: number
  daysHorizon: number
}

const INVENTORY_PATH = path.join(process.cwd(), 'workspace', 'inventory', 'stock.json')

let cachedInventory: InventoryItem[] | null = null

export async function loadInventory(): Promise<InventoryItem[]> {
  if (cachedInventory) return cachedInventory
  const raw = await readFile(INVENTORY_PATH, 'utf8')
  cachedInventory = JSON.parse(raw) as InventoryItem[]
  return cachedInventory
}

export async function checkInventory(sku?: string): Promise<InventoryItem[]> {
  const items = await loadInventory()
  if (!sku || sku === 'ALL') return items
  return items.filter((item) => item.sku.toLowerCase() === sku.toLowerCase())
}

export function forecastItem(item: InventoryItem, days: number): ForecastResult {
  const projectedConsumption = Number((item.dailyUsage * days).toFixed(2))
  const daysUntilBreak =
    item.dailyUsage > 0 ? item.stock / item.dailyUsage : Number.POSITIVE_INFINITY
  const remaining = item.stock - projectedConsumption
  const belowThreshold =
    remaining < item.safetyThreshold || daysUntilBreak < days

  const breakDate =
    item.dailyUsage > 0 && item.stock > 0
      ? new Date(Date.now() + daysUntilBreak * 86_400_000).toISOString().slice(0, 10)
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

export async function runUsageForecast(
  sku?: string,
  days = 30
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
  return items.map((item) => forecastItem(item, days))
}

/** Redacta texto de PO a partir de un forecast (contrato: returns string). */
export function draftPurchaseOrder(forecast: ForecastResult): string {
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
  const today = new Date().toISOString().slice(0, 10)
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
