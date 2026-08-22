/**
 * Worker gasless: Pimlico/Candide + WDK settlement.
 * Expone MCP server wdk-mcp (Pista 1 del track WDK) vía @tetherto/wdk-cli.
 *
 * Permalink jurado WDK MCP: workers/wdk-worker.js
 *
 * Uso:
 *   node workers/wdk-worker.js              # spawnea wdk-mcp (stdio JSON-RPC)
 *   node workers/wdk-worker.js --status     # health check sin bloquear
 *   node workers/wdk-worker.js --setup      # imprime guía wdk mcp setup
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const require = createRequire(path.join(root, 'package.json'))

function resolveWdkMcpBin() {
  try {
    const pkgJson = require.resolve('@tetherto/wdk-cli/package.json')
    return path.join(path.dirname(pkgJson), 'bin', 'wdk-mcp.mjs')
  } catch {
    return null
  }
}

function printSetupGuide() {
  console.error(`[worker:wdk] Setup MCP para Claude Desktop/Code:

  npx @tetherto/wdk-cli mcp setup --ai claude-desktop

  O apuntar MCP config a:
    node ${path.join(root, 'workers', 'wdk-worker.js')}

  Tools WDK oficiales vía daemon + tools PearLedger settlement:
    get_wallet_balance / quote_payment / execute_gasless_payment
    (plugin-wdk-settlement → harness.execute)
`)
}

async function printStatus() {
  const mcpBin = resolveWdkMcpBin()
  console.log(
    JSON.stringify(
      {
        ready: Boolean(mcpBin),
        worker: 'wdk-worker',
        track: 'WDK MCP',
        mcpBin,
        safeModulesVersion: process.env.WDK_SAFE_MODULES_VERSION || '0.3.0',
        hasPimlicoKey: Boolean(process.env.PIMLICO_API_KEY?.trim()),
        hint: mcpBin
          ? 'Run without flags to start wdk-mcp on stdio'
          : 'npm install @tetherto/wdk-cli'
      },
      null,
      2
    )
  )
}

function startOfficialWdkMcp() {
  const mcpBin = resolveWdkMcpBin()
  if (!mcpBin) {
    console.error('[worker:wdk] @tetherto/wdk-cli no encontrado — npm install')
    process.exit(1)
  }

  console.error(`[worker:wdk] starting official wdk-mcp → ${mcpBin}`)
  const child = spawn(process.execPath, [mcpBin], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[worker:wdk] wdk-mcp killed by ${signal}`)
      process.exit(1)
    }
    process.exit(code ?? 0)
  })
}

const args = process.argv.slice(2)

if (args.includes('--setup') || args.includes('setup')) {
  printSetupGuide()
} else if (args.includes('--status') || args.includes('status')) {
  await printStatus()
} else if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startOfficialWdkMcp()
}

export const ready = true
export { resolveWdkMcpBin, startOfficialWdkMcp, printStatus }
