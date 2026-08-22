/**
 * Definición del CLI con paparam — un único parser para Bare y para Node.
 *
 * Antes había dos gramáticas distintas: `bin.mjs` usaba paparam y `cli/dev.mjs`
 * un parser artesanal más permisivo. El resultado era que `pearledger tools
 * --json` funcionaba en dev y fallaba en producción con
 * `BAIL: UNKNOWN_FLAG: json`, porque los flags globales sólo estaban declarados
 * en el comando raíz y paparam no los hereda.
 *
 * La corrección es declarar los flags comunes en **cada** subcomando, de modo
 * que ambos órdenes sean válidos:
 *   pearledger --json tools
 *   pearledger tools --json
 */

import paparam from 'paparam'
import type { CommandFlags } from '@cli/types.js'

const { command, flag, arg, summary, rest } = paparam

/** Flags aceptados en todos los niveles. */
function commonFlags(): unknown[] {
  return [
    flag('--json', 'Salida JSON en una sola línea de documento (para UI e IPC)'),
    flag('--network <network>', 'Red: sepolia (por defecto) | mainnet')
  ]
}

export interface ParsedCli {
  /** Nombre del subcomando, o undefined si no se indicó ninguno. */
  name?: string
  json: boolean
  help: boolean
  version: boolean
  flags: CommandFlags
  args: string[]
  /** Flags crudos del comando raíz, para el arranque de Bare. */
  root: Record<string, unknown>
  /** Flags del raíz y del subcomando ya fusionados. */
  merged: Record<string, unknown>
}

interface PaparamLeaf {
  name?: string
  flags?: Record<string, unknown>
  args?: Record<string, unknown>
  positionals?: string[]
  rest?: string[]
}

function buildProgram(appName: string, appDescription: string): unknown {
  const ingestCmd = command(
    'ingest',
    summary('Ingesta y concilia una factura (OCR local + 3-way match)'),
    arg('<file>', 'Ruta al archivo de la factura (PDF o imagen)'),
    ...commonFlags()
  )

  const forecastCmd = command(
    'forecast',
    summary('Proyecta el quiebre de stock y redacta una propuesta de pedido'),
    flag('--sku <sku>', 'SKU concreto a analizar'),
    ...commonFlags()
  )

  const payCmd = command(
    'pay',
    summary('Ejecuta un pago gasless en USDt vía WDK'),
    flag('--vendor <address>', 'Dirección del proveedor (0x…)'),
    flag('--amount <usdt>', 'Monto en USDt'),
    flag('--dry-run [value]', 'Simular sin ejecutar (por defecto). --dry-run=false ejecuta'),
    flag('--purchase-order <id>', 'Orden de compra conciliada que respalda el pago'),
    flag('--payout-address <address>', 'Dirección de cobro declarada en la orden'),
    ...commonFlags()
  )

  const balanceCmd = command(
    'balance',
    summary('Consulta el saldo de la wallet WDK'),
    ...commonFlags()
  )

  const toolsCmd = command(
    'tools',
    summary('Lista las tools registradas en el harness'),
    ...commonFlags()
  )

  const dashboardCmd = command(
    'dashboard',
    summary('Levanta el dev server con el dashboard en vivo'),
    flag('--port <port>', 'Puerto de escucha (por defecto 7331)'),
    flag('--open', 'Abre el navegador al arrancar'),
    ...commonFlags()
  )

  return command(
    appName,
    summary(appDescription),
    flag('--version|-v', 'Imprime la versión'),
    flag('--storage <dir>', 'Directorio de almacenamiento personalizado'),
    flag('--no-updates', 'Desactiva el OTA en esta ejecución'),
    flag('--update-window <ms>', 'Ventana de espera del updater en ms; 0 en demos'),
    flag('--updater', 'Ejecuta el daemon updater').hide(),
    ...commonFlags(),
    rest('...'),
    ingestCmd,
    forecastCmd,
    payCmd,
    balanceCmd,
    toolsCmd,
    dashboardCmd
  )
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Normaliza `--dry-run`, que acepta forma booleana y `=true|false`. */
function parseDryRun(value: unknown): boolean | undefined {
  if (value === undefined) return undefined
  if (value === false || value === 'false') return false
  if (value === true || value === 'true') return true
  return undefined
}

export function parseCli(
  argv: string[],
  meta: { name: string; description: string }
): ParsedCli | null {
  const program = buildProgram(meta.name, meta.description) as {
    parse: (argv: string[]) => PaparamLeaf | null
    flags: Record<string, unknown>
  }

  let leaf: PaparamLeaf | null
  try {
    leaf = program.parse(argv)
  } catch (err) {
    throw new Error(`Argumentos inválidos: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!leaf) return null

  const root = program.flags ?? {}
  const leafFlags = leaf.flags ?? {}

  // Los flags comunes se declaran en el raíz y en cada subcomando para que
  // ambos órdenes sean válidos, pero paparam rellena los no pasados con
  // `false`. Un spread ingenuo haría que ese `false` por defecto del leaf
  // pisara el `true` real del raíz, y `--json tools` imprimiría texto.
  const merged: Record<string, unknown> = { ...root }
  for (const [key, value] of Object.entries(leafFlags)) {
    if (value === undefined) continue
    if (value === false && root[key] === true) continue
    merged[key] = value
  }

  const name = leaf.name && leaf.name !== meta.name ? leaf.name : undefined

  const positional: string[] = []
  if (leaf.args) {
    for (const value of Object.values(leaf.args)) {
      if (typeof value === 'string') positional.push(value)
    }
  }
  if (positional.length === 0 && Array.isArray(leaf.positionals)) {
    positional.push(...leaf.positionals.filter((v): v is string => typeof v === 'string'))
  }

  return {
    name,
    json: merged.json === true,
    help: merged.help === true,
    version: merged.version === true,
    root,
    merged,
    args: positional,
    flags: {
      sku: asString(merged.sku),
      vendor: asString(merged.vendor),
      amount: asString(merged.amount),
      network: asString(merged.network),
      dryRun: parseDryRun(merged.dryRun),
      purchaseOrderId: asString(merged.purchaseOrder),
      payoutAddress: asString(merged.payoutAddress)
    }
  }
}
