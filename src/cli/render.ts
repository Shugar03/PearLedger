/**
 * Capa de presentación: el ÚNICO módulo del proyecto que escribe en stdout.
 *
 * En modo `--json` emite exactamente un documento JSON y nada más, para que
 * `pearledger ingest f.pdf --json | jq .` y la UI puedan parsear la salida.
 * Antes esto no se cumplía: el pipeline de OCR escribía con `console.log` y
 * `routePay` imprimía el resultado dos veces, produciendo JSON inválido.
 */

import { writeOut } from '@shared/logger.js'
import type { ToolDescriptor } from '@core/types.js'

export const ACCENT = '\x1b[38;2;196;245;60m'
export const RESET = '\x1b[0m'
export const DIM = '\x1b[2m'

export interface RenderOptions {
  json: boolean
  color?: boolean
}

function paint(text: string, code: string, enabled: boolean): string {
  return enabled ? `${code}${text}${RESET}` : text
}

export function renderBanner(options: RenderOptions): void {
  if (options.json) return
  const color = options.color !== false
  writeOut(
    `${paint('🍐 PearLedger', ACCENT, color)} ${paint(
      '— Local-first · Gasless · P2P',
      DIM,
      color
    )}\n`
  )
}

/** Emite el resultado final del comando. Se llama UNA sola vez por ejecución. */
export function renderResult(result: unknown, options: RenderOptions): void {
  if (options.json) {
    writeOut(JSON.stringify(result ?? null, null, 2))
    return
  }

  if (typeof result === 'string') {
    writeOut(result)
    return
  }

  writeOut(JSON.stringify(result ?? null, null, 2))
}

export function renderTools(tools: ToolDescriptor[], options: RenderOptions): void {
  if (options.json) {
    writeOut(JSON.stringify({ tools }, null, 2))
    return
  }
  for (const tool of tools) {
    writeOut(`- ${tool.name} (${tool.plugin}): ${tool.description}`)
  }
}

export function renderHelp(options: RenderOptions): void {
  if (options.json) return
  writeOut(
    [
      'Comandos disponibles:',
      '  ingest <archivo>          OCR local + conciliación 3-way de una factura',
      '  forecast [--sku SKU]      Proyección de inventario y borrador de pedido',
      '  pay --vendor --amount     Pago gasless en USDt (dry-run por defecto)',
      '  balance [--network]       Saldo de la wallet WDK',
      '  tools                     Tools registradas en el harness',
      '  dashboard [--port]        Dev server con dashboard en vivo',
      '',
      'Flags globales: --json  --network sepolia|mainnet  --version'
    ].join('\n')
  )
}
