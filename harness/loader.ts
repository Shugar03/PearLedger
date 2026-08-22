import { harness } from './core.js'
import type { Harness, Tool } from './core.js'
import { registerDefaultHooks } from './hooks.js'
import * as pluginInvoiceOps from '../workspace/plugins/plugin-invoice-ops/index.js'
import * as pluginProcurementForecast from '../workspace/plugins/plugin-procurement-forecast/index.js'
import * as pluginWdkSettlement from '../workspace/plugins/plugin-wdk-settlement/index.js'

export interface PluginModule {
  name: string
  register: (h: Harness) => void | Promise<void>
}

const PLUGIN_MODULES: Array<{ id: string; mod: PluginModule }> = [
  { id: 'plugin-invoice-ops', mod: pluginInvoiceOps as unknown as PluginModule },
  {
    id: 'plugin-procurement-forecast',
    mod: pluginProcurementForecast as unknown as PluginModule
  },
  {
    id: 'plugin-wdk-settlement',
    mod: pluginWdkSettlement as unknown as PluginModule
  }
]

const FROZEN_TOOLS: Record<string, string[]> = {
  'plugin-invoice-ops': ['parse_invoice', 'match_purchase_order'],
  'plugin-procurement-forecast': [
    'check_inventory',
    'run_usage_forecast',
    'draft_purchase_order'
  ],
  'plugin-wdk-settlement': [
    'get_wallet_balance',
    'quote_payment',
    'execute_gasless_payment'
  ]
}

let pluginsLoaded = false

export async function loadPlugins(options: { reset?: boolean } = {}): Promise<void> {
  if (options.reset) {
    pluginsLoaded = false
    harness.reset()
  }

  if (pluginsLoaded) return

  registerDefaultHooks(harness)

  for (const { id, mod } of PLUGIN_MODULES) {
    try {
      if (typeof mod.register !== 'function') {
        console.warn(`[harness] skip ${id}: missing register()`)
        continue
      }
      await mod.register(harness)
      console.error(`[harness] loaded plugin: ${mod.name ?? id}`)
    } catch (err) {
      console.warn(`[harness] skip plugin ${id}:`, (err as Error).message)
    }
  }

  pluginsLoaded = true
}

export function registerTools(tools: Omit<Tool, 'plugin'>[], pluginName: string): void {
  for (const t of tools) {
    harness.registerTool({ ...t, plugin: pluginName })
  }
}

export function expectedToolNames(): string[] {
  return Object.values(FROZEN_TOOLS).flat()
}

export { harness, FROZEN_TOOLS }
