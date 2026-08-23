/**
 * plugin-procurement-forecast — inventario, forecast de consumo y borrador de
 * orden de compra.
 *
 * El plugin no toca el harness global: recibe su `PluginHost` y registra contra
 * él, de modo que un test puede cargarlo en un harness aislado.
 */

import { registerTools } from '@core/loader.js'
import type { PluginHost, ToolParams } from '@core/types.js'

import { draftPurchaseOrder, runUsageForecast } from './algorithm.js'
import { checkInventory } from './inventory.js'
import type { ForecastResult } from './types.js'

export const name = 'plugin-procurement-forecast'

const DEFAULT_HORIZON_DAYS = 30

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function horizonDays(value: unknown): number {
  const days = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_HORIZON_DAYS
}

function optionalForecast(value: unknown): ForecastResult | undefined {
  return typeof value === 'object' && value !== null ? (value as ForecastResult) : undefined
}

export function register(host: PluginHost): void {
  registerTools(host, name, [
    {
      name: 'check_inventory',
      description: 'Consulta stock actual por SKU',
      handler: async (params: ToolParams) => checkInventory(optionalString(params.sku))
    },
    {
      name: 'run_usage_forecast',
      description: 'Proyecta consumo y fecha de quiebre de stock',
      handler: async (params: ToolParams) =>
        runUsageForecast(optionalString(params.sku), horizonDays(params.days))
    },
    {
      name: 'draft_purchase_order',
      description: 'Redacta propuesta de pedido si stock < umbral',
      handler: async (params: ToolParams) => {
        let forecast = optionalForecast(params.forecast)

        if (!forecast) {
          const results = await runUsageForecast(
            optionalString(params.sku),
            horizonDays(params.days)
          )
          forecast = results[0]
        }

        if (!forecast) {
          throw new Error('draft_purchase_order requiere `forecast` o `sku`')
        }

        return draftPurchaseOrder(forecast)
      }
    }
  ])
}

export { checkInventory, loadInventory, resetInventoryCache } from './inventory.js'
export { draftPurchaseOrder, forecastItem, runUsageForecast } from './algorithm.js'
export type { ForecastResult, InventoryItem } from './types.js'
