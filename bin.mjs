import paparam from 'paparam'
import './bootstrap-process.mjs'
import { persistent } from 'bare-storage'
import process from 'bare-process'
import os from 'bare-os'
import { isWindows } from 'which-runtime'
import path from 'bare-path'
import FileLog from 'bare-file-logger'
import Console from 'bare-console'
import pkg from './package.json'
import App from './app.js'
import {
  routeBalance,
  routeForecast,
  routeIngest,
  routePay,
  routeTools
} from './cli/routes.mjs'

const { command, flag, summary, arg } = paparam

const ACCENT = '\x1b[38;2;196;245;60m'
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

const appName = pkg.productName || pkg.name
const isDev = path.basename(Bare.argv[0], path.extname(Bare.argv[0])) === 'bare'

function banner() {
  console.log(`${ACCENT}🍐 PearLedger${RESET} ${DIM}— Local-first · Gasless · P2P${RESET}\n`)
}

const style = { accent: ACCENT, dim: DIM, reset: RESET }

const ingestCmd = command(
  'ingest',
  summary('Ingesta y concilia una factura PDF (OCR local + 3-Way Match)'),
  arg('<file>', 'Ruta al PDF de la factura')
)

const forecastCmd = command(
  'forecast',
  summary('Proyecta quiebre de stock y redacta propuesta de pedido'),
  flag('--sku <sku>', 'SKU específico a analizar')
)

const payCmd = command(
  'pay',
  summary('Ejecuta pago gasless en USDt vía WDK'),
  flag('--vendor <address>', 'Dirección del proveedor (0x...)'),
  flag('--amount <usdt>', 'Monto en USDt'),
  flag('--usdt', 'Usar USDt como token de pago'),
  flag('--dry-run [value]', 'Simular sin ejecutar (default). Usar --dry-run=false para ejecutar')
)

const balanceCmd = command(
  'balance',
  summary('Consulta saldo de wallet WDK')
)

const toolsCmd = command(
  'tools',
  summary('Lista tools registradas en el harness')
)

const cmd = command(
  appName,
  summary(pkg.description),
  flag('--version|-v', 'Imprimir versión'),
  flag('--json', 'Salida JSON (para UI / IPC)'),
  flag('--storage <dir>', 'Directorio de almacenamiento personalizado'),
  flag('--no-updates', 'Desactivar OTA para esta ejecución'),
  flag('--update-window <ms>', 'Ventana de espera del updater (ms); usar 0 en demos'),
  flag('--updater', 'Ejecutar daemon updater').hide(),
  ingestCmd,
  forecastCmd,
  payCmd,
  balanceCmd,
  toolsCmd
)

const leaf = cmd.parse(Bare.argv.slice(isDev ? 2 : 1))
if (!leaf) Bare.exit(1)
if (leaf.flags.help) Bare.exit()
if (leaf.flags.version || cmd.flags.version) {
  console.log(`${appName} v${pkg.version}`)
  Bare.exit()
}

const json = cmd.flags.json === true || leaf.flags.json === true
const updates = cmd.flags.updates
const storage = cmd.flags.storage || leaf.flags.storage || (isDev ? null : path.join(persistent(), appName))
const dir = storage || path.join(os.tmpdir(), 'pear', appName)
let wait
try {
  wait = updateWindow(cmd.flags.updateWindow ?? leaf.flags.updateWindow)
} catch (err) {
  console.error('[app:error]', err.message)
  Bare.exit(1)
}

if (leaf.flags.updater || cmd.flags.updater) {
  await runUpdater(dir, wait)
  Bare.exit()
}

if (!json) {
  banner()
  console.log(`Updates: ${updates === false ? 'disabled' : 'enabled'}`)
}

if (updates !== false) {
  try {
    App.spawnUpdater(dir, os.execPath(), isDev ? Bare.argv[1] : null, wait)
  } catch (err) {
    console.error('[app:error]', err)
    Bare.exit(1)
  }
}

const sub = leaf.name !== appName ? leaf.name : undefined
const routeOpts = { json, ...style }

try {
  if (sub === 'ingest') {
    const file = leaf.args.file ?? leaf.positionals[0]
    if (!file) {
      console.error('Uso: pearledger ingest <file.pdf>')
      Bare.exit(1)
    }
    await routeIngest(file, routeOpts)
  } else if (sub === 'forecast') {
    await routeForecast(leaf.flags.sku, routeOpts)
  } else if (sub === 'pay') {
    let dryRunVal = leaf.flags.dryRun
    if (dryRunVal === 'false' || dryRunVal === false) dryRunVal = false
    else if (dryRunVal === 'true' || dryRunVal === true) dryRunVal = true
    else if (dryRunVal === undefined) dryRunVal = true
    await routePay({ ...leaf.flags, dryRun: dryRunVal, dryRunFlag: dryRunVal }, routeOpts)
  } else if (sub === 'balance') {
    await routeBalance(routeOpts)
  } else if (sub === 'tools') {
    await routeTools(routeOpts)
  } else if (!json) {
    console.log('Comandos disponibles:')
    console.log('  ingest <file.pdf>   — OCR + conciliación de factura')
    console.log('  forecast [--sku]    — Proyección de inventario')
    console.log('  pay --vendor --amount  — Pago gasless')
    console.log('  balance             — Saldo de wallet')
    console.log('  tools               — Tools del harness')
  }
} catch (err) {
  console.error('[pearledger]', err.message)
  Bare.exit(1)
}

async function runUpdater(dir, wait) {
  const app = new App({
    dir,
    app: isDev ? null : os.execPath(),
    updates: true,
    version: pkg.version,
    upgrade: pkg.upgrade,
    name: isWindows ? appName + '.exe' : appName
  })
  const output = new FileLog(path.join(dir, 'updates.log'), { maxSize: 1024 * 1024 })
  const log = new Console(output)

  app.on('updating', () => log.log('[updater] getting new update'))
  app.on('updating-delta', (delta) => log.log('[updater]', delta))
  app.on('updated', () => log.log('[updater] update complete... applying'))
  app.on('update-applied', () => log.log('[updater] applied update, restart to run latest version'))
  app.on('error', (err) => log.error('[app:error]', err))

  process.on('SIGHUP', () => app.exit(129))
  process.on('SIGINT', () => app.exit(130))
  process.on('SIGQUIT', () => app.exit(131))
  process.on('SIGTERM', () => app.exit(143))

  let code = 0
  try {
    await app.updater(wait)
  } catch (err) {
    log.error('[app:error]', err)
    code = 1
  }
  code = Bare.exitCode || code
  try {
    await app.exit(code)
  } finally {
    output.close()
  }
}

function updateWindow(value) {
  if (value === undefined) return undefined
  const wait = Number(value)
  if (Number.isSafeInteger(wait) === false || wait < 0) {
    throw new Error('--update-window must be a non-negative integer')
  }
  return wait
}
