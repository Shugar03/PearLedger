/**
 * Orquestador del CLI: parsea, despacha a un comando y presenta el resultado.
 *
 * Es la implementación ÚNICA que comparten Bare y Node. Antes existían
 * `cli/routes.mjs` y `cli/routes-node.mjs`, ~200 líneas cada uno y 95%
 * idénticos, que ya habían divergido en el camino crítico de confirmación de
 * pagos.
 */

import process from 'node:process'

import { getConfig } from '@config/index.js'
import { createHarness } from '@core/harness.js'
import { loadPlugins } from '@core/loader.js'
import { ensureWorkspace } from '@shared/bootstrap.js'
import { configureLogger, getLogger } from '@shared/logger.js'
import { META } from '@shared/meta.js'

import { parseCli } from '@cli/program.js'
import { renderBanner, renderHelp, renderResult, renderTools } from '@cli/render.js'
import { createCliHost } from '@cli/host.js'
import type { CliHost, Command, CommandContext } from '@cli/types.js'
import { shutdownQvacRuntime } from '@plugins/invoice-ops/qvac-client.js'

import { balance } from '@cli/commands/balance.js'
import { forecast } from '@cli/commands/forecast.js'
import { ingest } from '@cli/commands/ingest.js'
import { pay } from '@cli/commands/pay.js'
import { tools } from '@cli/commands/tools.js'

/** Registro de comandos: un mapa, no una jerarquía de clases. */
const COMMANDS: Record<string, Command> = {
  tools,
  ingest,
  forecast,
  pay,
  balance
}

export interface RunOptions {
  argv: string[]
  host?: CliHost
  /** Hook para el subcomando `dashboard`, que sólo existe bajo Node. */
  onDashboard?: (options: { port?: number; open: boolean; json: boolean }) => Promise<void>
}

export async function runCli(options: RunOptions): Promise<number> {
  const { argv } = options

  const parsed = parseCli(argv, { name: META.productName, description: META.description })
  if (!parsed) return 1
  if (parsed.help) return 0

  const json = parsed.json
  const config = getConfig()

  // En modo JSON el diagnóstico baja a `error` para no ensuciar la terminal;
  // stdout queda intacto en cualquier caso porque el logger escribe a stderr.
  configureLogger({ level: json ? 'error' : config.logLevel })
  const log = getLogger('cli')

  if (parsed.version) {
    renderResult(json ? { name: META.productName, version: META.version } : `${META.productName} v${META.version}`, {
      json
    })
    return 0
  }

  if (!parsed.name) {
    renderBanner({ json })
    renderHelp({ json })
    return 0
  }

  if (parsed.name === 'dashboard') {
    if (!options.onDashboard) {
      log.error('El dashboard sólo está disponible en el entrypoint de Node (npm run dev).')
      return 1
    }
    // `--port` y `--open` se declaran en el subcomando, así que hay que leerlos
    // de los flags fusionados y no de los del comando raíz.
    const portFlag = parsed.merged.port
    await options.onDashboard({
      port: portFlag === undefined || portFlag === false ? undefined : Number(portFlag),
      open: parsed.merged.open === true,
      json
    })
    return 0
  }

  const command = COMMANDS[parsed.name]
  if (!command) {
    log.error(`Comando desconocido: ${parsed.name}`)
    renderHelp({ json })
    return 1
  }

  // Una instalación limpia no tiene workspace: sin esto, el primer `forecast`
  // de un usuario recién instalado moría con ENOENT.
  ensureWorkspace()

  const harness = await loadPlugins(createHarness(), {
    withDefaultHooks: true,
    seal: true
  })

  const ctx: CommandContext = {
    harness,
    host: options.host ?? createCliHost(),
    json
  }

  try {
    const result = await command({ flags: parsed.flags, args: parsed.args }, ctx)

    // `tools` tiene presentación propia en modo texto; el resto es genérico.
    if (parsed.name === 'tools' && result && typeof result === 'object') {
      renderTools((result as { tools: never[] }).tools, { json })
    } else {
      renderResult(result, { json })
    }
    return 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(message)
    if (json) renderResult({ error: message }, { json })
    return 1
  } finally {
    await shutdownQvacRuntime().catch(() => {})
  }
}

/** Envoltorio para entrypoints: ejecuta y fija el código de salida. */
export async function main(options: RunOptions): Promise<void> {
  const code = await runCli(options)
  if (code !== 0) process.exitCode = code
}
