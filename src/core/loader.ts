/**
 * Carga de plugins.
 *
 * Los imports son **estáticos a propósito**: `bare-pack` sólo sigue
 * especificadores literales, así que un loader dinámico por filesystem dejaría
 * los plugins fuera del binario standalone.
 *
 * Antes existía un ciclo `loader → plugin → loader.registerTools`. Ahora cada
 * plugin recibe su host y registra contra él, así que la dependencia va en un
 * solo sentido.
 */

import { registerDefaultHooks } from '@core/hooks.js'
import type { Harness } from '@core/harness.js'
import type { PluginModule, PluginHost, Tool } from '@core/types.js'
import { getLogger } from '@shared/logger.js'

import * as invoiceOps from '@plugins/invoice-ops/index.js'
import * as procurementForecast from '@plugins/procurement-forecast/index.js'
import * as wdkSettlement from '@plugins/wdk-settlement/index.js'

const PLUGINS: readonly PluginModule[] = [
  invoiceOps as unknown as PluginModule,
  procurementForecast as unknown as PluginModule,
  wdkSettlement as unknown as PluginModule
]

export interface LoadPluginsOptions {
  /** Registra los hooks por defecto (confirmación de pago, saneado). */
  withDefaultHooks?: boolean
  /** Sella el harness tras cargar, impidiendo hooks posteriores. */
  seal?: boolean
}

/**
 * Registra todos los plugins en el harness dado.
 *
 * Un plugin que falle al registrarse no derriba la app, pero sí queda avisado:
 * la ausencia silenciosa de una tool es peor que un arranque ruidoso.
 */
export async function loadPlugins(
  harness: Harness,
  options: LoadPluginsOptions = {}
): Promise<Harness> {
  const { withDefaultHooks = true, seal = false } = options
  const log = getLogger('harness')

  if (withDefaultHooks) registerDefaultHooks(harness)

  for (const plugin of PLUGINS) {
    const id = plugin?.name ?? '(anónimo)'
    try {
      if (typeof plugin?.register !== 'function') {
        log.warn(`plugin ${id} omitido: no exporta register()`)
        continue
      }
      await plugin.register(harness as PluginHost)
      log.debug(`plugin cargado: ${id}`)
    } catch (err) {
      log.warn(`plugin ${id} omitido: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (seal) harness.seal()
  return harness
}

/** Helper para plugins: registra un lote de tools atribuyéndolas al plugin. */
export function registerTools(
  host: PluginHost,
  pluginName: string,
  tools: ReadonlyArray<Omit<Tool, 'plugin'>>
): void {
  for (const tool of tools) {
    host.registerTool({ ...tool, plugin: pluginName })
  }
}
