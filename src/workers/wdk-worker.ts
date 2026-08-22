/**
 * Worker de liquidación: expone el MCP server oficial `wdk-mcp` de
 * `@tetherto/wdk-cli` (pista 1 del track WDK).
 *
 * Corre siempre bajo Node: es un servidor MCP sobre stdio, no forma parte del
 * binario Bare ni del grafo de `bin.ts`.
 *
 * Uso:
 *   node dist/workers/wdk-worker.js            arranca wdk-mcp (JSON-RPC stdio)
 *   node dist/workers/wdk-worker.js --status   health check sin bloquear
 *   node dist/workers/wdk-worker.js --setup    imprime la guía de configuración
 */

import process from 'node:process'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { getConfig } from '@config/index.js'
import { appRoot } from '@shared/paths.js'
import { getLogger, writeOut } from '@shared/logger.js'

const log = getLogger('wdk-worker')

/**
 * Localiza el binario de wdk-mcp dentro del paquete instalado.
 * `import.meta.resolve` evita `createRequire`, que no existe bajo Bare.
 */
function resolveWdkMcpBin(): string | null {
  try {
    const pkgUrl = import.meta.resolve('@tetherto/wdk-cli/package.json')
    return path.join(path.dirname(fileURLToPath(pkgUrl)), 'bin', 'wdk-mcp.mjs')
  } catch {
    return null
  }
}

function printSetupGuide(): void {
  const self = path.join(appRoot(), 'dist', 'workers', 'wdk-worker.js')
  log.info(
    [
      'Configuración MCP para Claude Desktop / Claude Code:',
      '',
      '  npx @tetherto/wdk-cli mcp setup --ai claude-desktop',
      '',
      '  O apuntá la configuración MCP a:',
      `    node ${self}`,
      '',
      '  Tools WDK oficiales vía daemon, más las de liquidación de PearLedger:',
      '    get_wallet_balance / quote_payment / execute_gasless_payment'
    ].join('\n')
  )
}

function printStatus(): void {
  const mcpBin = resolveWdkMcpBin()
  const { wdk } = getConfig()

  writeOut(
    JSON.stringify(
      {
        ready: Boolean(mcpBin),
        worker: 'wdk-worker',
        track: 'WDK MCP',
        mcpBin,
        safeModulesVersion: wdk.safeModulesVersion,
        hasPaymasterKey: Boolean(wdk.pimlicoApiKey ?? wdk.candideApiKey),
        hasSeed: Boolean(wdk.seedPhrase),
        hint: mcpBin
          ? 'Ejecutá sin flags para arrancar wdk-mcp sobre stdio'
          : 'npm install @tetherto/wdk-cli'
      },
      null,
      2
    )
  )
}

function startOfficialWdkMcp(): void {
  const mcpBin = resolveWdkMcpBin()
  if (!mcpBin) {
    log.error('@tetherto/wdk-cli no encontrado — ejecutá npm install')
    process.exit(1)
  }

  log.info(`arrancando wdk-mcp oficial → ${mcpBin}`)
  const child = spawn(process.execPath, [mcpBin], {
    cwd: appRoot(),
    stdio: 'inherit',
    env: process.env // conventions:allow env — se reenvía el entorno al hijo
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      log.error(`wdk-mcp terminado por ${signal}`)
      process.exit(1)
    }
    process.exit(code ?? 0)
  })
}

/** Sólo actúa si se ejecuta directamente; importarlo no debe arrancar nada. */
function isMainModule(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

if (isMainModule()) {
  const args = process.argv.slice(2)
  if (args.includes('--setup') || args.includes('setup')) printSetupGuide()
  else if (args.includes('--status') || args.includes('status')) printStatus()
  else startOfficialWdkMcp()
}

export { resolveWdkMcpBin, startOfficialWdkMcp, printStatus }
