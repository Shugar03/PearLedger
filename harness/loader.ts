import { harness } from './core.ts'
import { registerSecurityHooks } from './hooks.ts'

export interface PluginModule {
  name: string
  register: (h: typeof harness) => void | Promise<void>
}

const PLUGINS: Array<() => Promise<PluginModule>> = [
  () => import('../workspace/plugins/plugin-invoice-ops/index.ts'),
  () => import('../workspace/plugins/plugin-procurement-forecast/index.ts'),
  () => import('../workspace/plugins/plugin-wdk-settlement/index.ts'),
]

export async function loadPlugins(): Promise<void> {
  registerSecurityHooks(harness)

  for (const load of PLUGINS) {
    const plugin = await load()
    await plugin.register(harness)
    console.log(`[harness] loaded plugin: ${plugin.name}`)
  }
}

export { harness }
