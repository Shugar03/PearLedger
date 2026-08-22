/**
 * plugin-procurement-forecast — Inventario, forecast y draft PO.
 * Permalink jurado QVAC Pipeline: workspace/plugins/plugin-procurement-forecast/
 */

import { registerTools } from '../../../harness/loader.js'
import {
  checkInventory,
  draftPurchaseOrder,
  runUsageForecast,
  type ForecastResult
} from './algorithm.js'

export const name = 'plugin-procurement-forecast'

export async function register() {
  registerTools(
    [
      {
        name: 'check_inventory',
        description: 'Consulta stock actual por SKU',
        handler: async ({ sku }: { sku?: string }) => checkInventory(sku)
      },
      {
        name: 'run_usage_forecast',
        description: 'Proyecta consumo y fecha de quiebre de stock',
        handler: async ({ sku, days = 30 }: { sku?: string; days?: number }) =>
          runUsageForecast(sku, days)
      },
      {
        name: 'draft_purchase_order',
        description: 'Redacta propuesta de pedido si stock < umbral',
        handler: async (params: {
          forecast?: ForecastResult
          sku?: string
          days?: number
        }) => {
          let forecast = params.forecast
          if (!forecast) {
            const results = await runUsageForecast(params.sku, params.days ?? 30)
            forecast = results[0]
          }
          if (!forecast) {
            throw new Error('draft_purchase_order requires forecast or sku')
          }
          return draftPurchaseOrder(forecast)
        }
      }
    ],
    name
  )
}
