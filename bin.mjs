import { command, flag, rest, summary, positional } from 'paparam'
import { persistent } from 'bare-storage'
import process from 'bare-process'
import os from 'bare-os'
import { isWindows } from 'which-runtime'
import path from 'bare-path'
import FileLog from 'bare-file-logger'
import Console from 'bare-console'
import pkg from './package.json' with { type: 'json' }
import App from './app.js'

const ACCENT = '\x1b[38;2;196;245;60m'
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

const appName = pkg.productName || pkg.name
const isDev = path.basename(Bare.argv[0], path.extname(Bare.argv[0])) === 'bare'

function banner() {
  console.log(`${ACCENT}🍐 PearLedger${RESET} ${DIM}— Local-first · Gasless · P2P${RESET}\n`)
}

// ─── Subcomandos ─────────────────────────────────────────────

const ingestCmd = command(
  'ingest',
  summary('Ingesta y concilia una factura PDF (OCR local + 3-Way Match)'),
  positional('<file>', 'Ruta al PDF de la factura')
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
  flag('--dry-run', 'Simular sin ejecutar (default WDK)')
)

const balanceCmd = command(
  'balance',
  summary('Consulta saldo de wallet WDK')
)

// ─── CLI raíz ────────────────────────────────────────────────

const cmd = command(
  appName,
  summary(pkg.description),
  flag('--version|-v', 'Imprimir versión'),
  flag('--storage <dir>', 'Directorio de almacenamiento personalizado'),
  flag('--no-updates', 'Desactivar OTA para esta ejecución'),
  flag('--update-window <ms>', 'Ventana de espera del updater (ms); usar 0 en demos'),
  flag('--updater', 'Ejecutar daemon updater').hide(),
  ingestCmd,
  forecastCmd,
  payCmd,
  balanceCmd
)

cmd.parse(Bare.argv.slice(isDev ? 2 : 1))
if (cmd.flags.help) Bare.exit()
if (cmd.flags.version) {
  console.log(`${appName} v${pkg.version}`)
  Bare.exit()
}

const updates = cmd.flags.updates
const storage = cmd.flags.storage || (isDev ? null : path.join(persistent(), appName))
const dir = storage || path.join(os.tmpdir(), 'pear', appName)
let wait
try {
  wait = updateWindow(cmd.flags.updateWindow)
} catch (err) {
  console.error('[app:error]', err.message)
  Bare.exit(1)
}

if (cmd.flags.updater) {
  await runUpdater(dir, wait)
  Bare.exit()
}

banner()
console.log(`Updates: ${updates === false ? 'disabled' : 'enabled'}`)

if (updates !== false) {
  try {
    App.spawnUpdater(dir, os.execPath(), isDev ? Bare.argv[1] : null, wait)
  } catch (err) {
    console.error('[app:error]', err)
    Bare.exit(1)
  }
}

// ─── Routing de subcomandos ──────────────────────────────────

const sub = cmd.args.subcommand

if (sub === 'ingest') {
  const file = cmd.args.ingest?.[0]
  if (!file) {
    console.error('Uso: pearledger ingest <file.pdf>')
    Bare.exit(1)
  }
  await routeIngest(file)
} else if (sub === 'forecast') {
  await routeForecast(cmd.args.forecast?.sku)
} else if (sub === 'pay') {
  await routePay(cmd.args.pay)
} else if (sub === 'balance') {
  await routeBalance()
} else {
  console.log('Comandos disponibles:')
  console.log('  ingest <file.pdf>   — OCR + conciliación de factura')
  console.log('  forecast [--sku]    — Proyección de inventario')
  console.log('  pay --vendor --amount --usdt  — Pago gasless')
  console.log('  balance             — Saldo de wallet')
}

async function routeIngest(file) {
  console.log(`${ACCENT}▸${RESET} Ingesta: ${file}`)
  console.log(`${DIM}  → plugin-invoice-ops: qvac.ocr() + ragSearch()${RESET}`)
  // TODO: importar harness y ejecutar plugin-invoice-ops
  console.log(`${ACCENT}✓${RESET} Stub listo — implementar en workspace/plugins/plugin-invoice-ops/`)
}

async function routeForecast(sku) {
  console.log(`${ACCENT}▸${RESET} Forecast${sku ? `: ${sku}` : ' (todos los SKUs)'}`)
  console.log(`${DIM}  → plugin-procurement-forecast${RESET}`)
  console.log(`${ACCENT}✓${RESET} Stub listo — implementar en workspace/plugins/plugin-procurement-forecast/`)
}

async function routePay(flags) {
  const { vendor, amount, dryRun } = flags || {}
  if (!vendor || !amount) {
    console.error('Uso: pearledger pay --vendor 0x.. --amount 250 --usdt')
    Bare.exit(1)
  }
  console.log(`${ACCENT}▸${RESET} Pago gasless: ${amount} USDt → ${vendor}`)
  if (dryRun !== false) {
    console.log(`${DIM}  Modo dry-run (WDK default). Usar --dry-run=false para ejecutar.${RESET}`)
  }
  const threshold = Number(process.env.HUMAN_CONFIRM_THRESHOLD_USDT || 1000)
  if (Number(amount) > threshold) {
    console.log(`${ACCENT}⚠${RESET} Monto > $${threshold} — requiere confirmación humana`)
  }
  console.log(`${DIM}  → plugin-wdk-settlement: execute_gasless_payment${RESET}`)
}

async function routeBalance() {
  console.log(`${ACCENT}▸${RESET} Consultando saldo WDK...`)
  console.log(`${DIM}  → plugin-wdk-settlement: get_wallet_balance${RESET}`)
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
