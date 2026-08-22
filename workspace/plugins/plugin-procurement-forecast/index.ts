import type { Harness } from '../../../harness/core.ts'
import { checkInventory, runUsageForecast, draftPurchaseOrder } from './algorithm.ts'

export const name = 'plugin-procurement-forecast'

export async function register(h: Harness): Promise<void> {
  h.registerTool({
    name: 'check_inventory',
    description: 'Consulta inventario interno por SKU',
    plugin: name,
    handler: async ({ sku }) => checkInventory(sku ? String(sku) : undefined),
  })

  h.registerTool({
    name: 'run_usage_forecast',
    description: 'Proyección de quiebre de stock (QWEN3_1_7B tool calling)',
    plugin: name,
    handler: async ({ sku }) => runUsageForecast(sku ? String(sku) : undefined),
  })

  h.registerTool({
    name: 'draft_purchase_order',
    description: 'Redacta propuesta de pedido si stock < umbral',
    plugin: name,
    handler: async ({ forecast }) =>
      draftPurchaseOrder(forecast as Parameters<typeof draftPurchaseOrder>[0]),
  })
}
