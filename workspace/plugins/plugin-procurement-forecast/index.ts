import { registerTools } from '../../../harness/loader.js'
import { runUsageForecast } from './algorithm.js'

export const name = 'plugin-procurement-forecast'

export async function register() {
  registerTools(
    [
      {
        name: 'check_inventory',
        description: 'Consulta stock actual por SKU',
        handler: async ({ sku }: { sku?: string }) => ({
          sku: sku ?? 'ALL',
          stock: 42,
          unit: 'units'
        })
      },
      {
        name: 'run_usage_forecast',
        description: 'Proyecta consumo y fecha de quiebre de stock',
        handler: async ({ sku, days = 30 }: { sku?: string; days?: number }) =>
          runUsageForecast(sku ?? 'DEFAULT', days)
      },
      {
        name: 'draft_purchase_order',
        description: 'Redacta propuesta de pedido si stock < umbral',
        handler: async ({ sku }: { sku?: string }) => ({
          sku,
          action: 'draft_po',
          status: 'pending_implementation'
        })
      }
    ],
    name
  )
}
