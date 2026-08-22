import { harness } from './core.js'
import type { Tool } from './core.js'

export interface PluginModule {
  name: string
  register: (h: typeof harness) => void | Promise<void>
}

const PLUGIN_PATHS = [
  '../workspace/plugins/plugin-invoice-ops/index.js',
  '../workspace/plugins/plugin-procurement-forecast/index.js',
  '../workspace/plugins/plugin-wdk-settlement/index.js'
]

export async function loadPlugins(): Promise<void> {
  for (const specifier of PLUGIN_PATHS) {
    try {
      const mod = (await import(specifier)) as PluginModule
      await mod.register(harness)
      console.log(`[harness] loaded plugin: ${mod.name}`)
    } catch (err) {
      console.warn(`[harness] skip plugin ${specifier}:`, (err as Error).message)
    }
  }
}

export function registerTools(tools: Omit<Tool, 'plugin'>[], pluginName: string): void {
  for (const t of tools) {
    harness.registerTool({ ...t, plugin: pluginName })
  }
}

export { harness }
