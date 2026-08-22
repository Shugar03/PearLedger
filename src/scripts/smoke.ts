/**
 * Runner de smoke tests — un solo entrypoint para los cinco escenarios que
 * antes vivían en ocho `.mjs` sueltos bajo `scripts/`.
 *
 * Cada escenario informa por stderr (logger) qué está haciendo y devuelve un
 * objeto resultado; el runner imprime UN resumen final por stdout, así que la
 * salida es parseable con `jq`.
 *
 * Uso:
 *   node --env-file=.env dist/scripts/smoke.js                # lista escenarios
 *   node --env-file=.env dist/scripts/smoke.js forecast       # corre uno
 *   node --env-file=.env dist/scripts/smoke.js wdk rag        # corre varios
 *   node --env-file=.env dist/scripts/smoke.js --all
 *
 * Escenarios que dependen de red se saltan (no fallan) cuando falta la seed,
 * la API key o los modelos QVAC. Un escenario "skipped" no pone exit code 1.
 *
 * `live-pay` NUNCA mueve dinero por defecto: exige DOS confirmaciones
 * independientes (variable de entorno + flag de CLI). Ver `livePayGate()`.
 */

import process from 'node:process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { GTE_LARGE_FP16, OCR_LATIN, OCR_3B_MULTIMODAL_Q4_0, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk'

import { createHarness, type Harness } from '@core/harness.js'
import { loadPlugins } from '@core/loader.js'
import { getConfig } from '@config/index.js'
import { getLogger, writeOut, type Logger } from '@shared/logger.js'
import { workspaceDir } from '@shared/paths.js'
import type { Invoice } from '@plugins/invoice-ops/index.js'

const log = getLogger('smoke')

/** Dirección de destino por defecto: no es de nadie, sirve de sumidero. */
const DEFAULT_VENDOR = '0x0000000000000000000000000000000000000001'
const DEFAULT_AMOUNT = 1
/** Umbral del hook de confirmación humana en los fixtures por defecto. */
const OVER_THRESHOLD_AMOUNT = 1500

export type ScenarioStatus = 'ok' | 'skipped' | 'failed'

export interface ScenarioResult {
  scenario: string
  status: ScenarioStatus
  ms: number
  reason?: string
  detail?: Record<string, unknown>
}

export interface SmokeOptions {
  /** Destinatario de los pagos de prueba. */
  to: string
  /** Importe en USDt de los escenarios de pago. */
  amount: number
  /** Factura a usar en `ingest`. */
  invoicePath: string
  /** Segunda confirmación de `live-pay` (flag `--confirm-live-pay`). */
  confirmLivePayFlag: boolean
}

interface ScenarioContext {
  harness: Harness
  options: SmokeOptions
  log: Logger
}

interface Scenario {
  name: string
  summary: string
  run(ctx: ScenarioContext): Promise<Record<string, unknown>>
}

/** Señal de "no se puede correr aquí": el runner la reporta como `skipped`. */
class SkipSignal extends Error {}

function skip(reason: string): never {
  throw new SkipSignal(reason)
}

function fail(reason: string): never {
  throw new Error(reason)
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function exists(target: string): boolean {
  try {
    return fs.existsSync(target)
  } catch {
    return false
  }
}

/**
 * Los pesos QVAC son ~5 GB y no se versionan. Si faltan, el SDK los descarga
 * en silencio a mitad del escenario: media hora de espera disfrazada de test
 * colgado. Mejor comprobar la cache y saltar con un mensaje accionable.
 *
 * Los archivos de la cache llevan un prefijo de hash, así que se busca por
 * sufijo del `modelId` del registry.
 */
function cachedQvacModels(): Set<string> {
  const home = getConfig().qvac.home || path.join(os.homedir(), '.qvac')
  try {
    return new Set(fs.readdirSync(path.join(home, 'models')).filter((f) => f.endsWith('.gguf')))
  } catch {
    return new Set()
  }
}

function hasCachedModel(cache: ReadonlySet<string>, modelId: string): boolean {
  for (const file of cache) if (file.endsWith(modelId)) return true
  return false
}

/** OCR (cualquiera de los dos caminos) + el LLM que arma el schema. */
function requireIngestModels(): void {
  const cache = cachedQvacModels()
  const missing: string[] = []

  if (
    !hasCachedModel(cache, OCR_3B_MULTIMODAL_Q4_0.modelId) &&
    !hasCachedModel(cache, OCR_LATIN.modelId)
  ) {
    missing.push('OCR (unlimited-ocr Q4_0 o latin_g2)')
  }
  if (!hasCachedModel(cache, QWEN3_1_7B_INST_Q4.modelId)) {
    missing.push('LLM (Qwen3-1.7B Q4_0)')
  }

  if (missing.length > 0) {
    skip(
      `faltan modelos QVAC en cache: ${missing.join(', ')} — ` +
        'corré `node dist/scripts/download-models.js`'
    )
  }
}

function requireWallet(): void {
  const { wdk, security } = getConfig()
  if (!wdk.seedPhrase && !security.allowTestSeed) {
    skip('sin seed WDK — definí WDK_SEED_PHRASE en .env (o WDK_ALLOW_TEST_SEED=1 en Sepolia)')
  }
}

/** `status` del plugin WDK que significan "el entorno no da", no "está roto". */
function skipIfUnreachable(label: string, result: Record<string, unknown>): void {
  const status = String(result.status ?? '')
  if (status === 'config_error' || status === 'rpc_unavailable' || status === 'mainnet_needs_api_key') {
    skip(`${label}: ${status}${result.hint ? ` — ${String(result.hint)}` : ''}`)
  }
}

function resolveWdkMcpBin(): string | null {
  try {
    const pkgUrl = import.meta.resolve('@tetherto/wdk-cli/package.json')
    return path.join(path.dirname(fileURLToPath(pkgUrl)), 'bin', 'wdk-mcp.mjs')
  } catch {
    return null
  }
}

/** Factura sintética equivalente a `workspace/purchase-orders/PO-2026-001.json`. */
function syntheticInvoice(): Invoice {
  return {
    vendor: 'Proveedor Demo S.A.',
    invoiceNumber: 'INV-001',
    date: '2026-08-22',
    lineItems: [
      { description: 'Material de oficina', quantity: 1, unitPrice: 100, total: 100 }
    ],
    subtotal: 100,
    tax: 0,
    total: 100,
    currency: 'USD'
  }
}

// ── Escenarios ──────────────────────────────────────────────────────────────

/** P1: inventario → forecast → borrador de orden de compra. Sin red ni modelos. */
const forecastScenario: Scenario = {
  name: 'forecast',
  summary: 'inventario → forecast → draft PO (local, sin red ni modelos)',
  async run({ harness, log: scoped }) {
    scoped.info('▸ check_inventory')
    const inventory = await harness.execute('check_inventory', {})
    const skus = Array.isArray(inventory) ? inventory.length : 0
    if (skus === 0) skip('workspace/inventory/stock.json vacío o ausente')

    scoped.info('▸ run_usage_forecast (30 días)')
    const forecasts = await harness.execute('run_usage_forecast', { days: 30 })
    const rows = Array.isArray(forecasts) ? forecasts.map(asRecord) : []

    const atRisk = rows.filter((row) => row.belowThreshold === true)
    scoped.info(`SKUs en riesgo: ${atRisk.length}`)
    if (atRisk.length === 0) {
      fail('se esperaba al menos un SKU belowThreshold (SKU-RISK / MAT-003)')
    }

    const target = atRisk.find((row) => row.sku === 'SKU-RISK') ?? atRisk[0]!
    const sku = String(target.sku ?? '')

    scoped.info(`▸ draft_purchase_order (${sku})`)
    const draft = await harness.execute('draft_purchase_order', { forecast: target })

    if (typeof draft !== 'string' || !draft.includes('DRAFT') || !draft.includes(sku)) {
      fail('draft PO inválido: no contiene "DRAFT" ni el SKU en riesgo')
    }

    return {
      skus,
      atRisk: atRisk.map((row) => row.sku),
      target: sku,
      draftFirstLine: draft.split('\n')[0] ?? ''
    }
  }
}

/** 3-way match sobre factura sintética. No hace OCR; cae a filesystem sin RAG. */
const ragScenario: Scenario = {
  name: 'rag',
  summary: '3-way match con factura sintética, sin OCR (RAG o fallback filesystem)',
  async run({ harness, log: scoped }) {
    // Sin los embeddings en cache, `ensurePurchaseOrderIndex` no falla: se
    // pone a descargar 670 MB y el escenario parece colgado.
    if (!hasCachedModel(cachedQvacModels(), GTE_LARGE_FP16.modelId)) {
      skip(
        'faltan los embeddings GTE_LARGE_FP16 en cache — ' +
          'corré `node dist/scripts/download-models.js`'
      )
    }

    const invoice = syntheticInvoice()

    scoped.info('▸ match_purchase_order (invoice sintético INV-001)')
    const match = asRecord(
      await harness.execute('match_purchase_order', {
        invoiceId: invoice.invoiceNumber,
        invoice
      })
    )

    const status = String(match.status ?? '')
    if (status === 'no_po_candidates') {
      skip('no hay órdenes de compra en workspace/purchase-orders — corré seed-fixtures')
    }

    if (match.purchaseOrderId !== 'PO-2026-001') {
      fail(`esperaba PO-2026-001, obtuve ${String(match.purchaseOrderId)} (status=${status})`)
    }

    scoped.info(`match OK — status=${status} confidence=${String(match.confidence)}`)
    return {
      purchaseOrderId: match.purchaseOrderId,
      matched: match.matched,
      status,
      confidence: match.confidence,
      vendorSimilarity: match.vendorSimilarity,
      ragScore: match.ragScore ?? null
    }
  }
}

/** Ingesta real: OCR QVAC sobre una factura del workspace + conciliación. */
const ingestScenario: Scenario = {
  name: 'ingest',
  summary: 'parse_invoice con OCR real (QVAC) + match_purchase_order',
  async run({ harness, options, log: scoped }) {
    if (!exists(options.invoicePath)) {
      skip(`falta la factura ${options.invoicePath} — corré seed-fixtures`)
    }
    requireIngestModels()

    scoped.info(`▸ parse_invoice (${options.invoicePath})`)
    let parsed: Record<string, unknown>
    try {
      parsed = asRecord(await harness.execute('parse_invoice', { filePath: options.invoicePath }))
    } catch (err) {
      skip(`OCR no disponible: ${describe(err)}`)
    }

    const invoice = parsed.invoice as Invoice | undefined
    if (!invoice) fail('parse_invoice no devolvió `invoice`')

    const quality = asRecord(parsed.quality)
    scoped.info(
      `factura extraída: ${invoice.vendor} / ${invoice.invoiceNumber} / total=${invoice.total}` +
        ` (quality.ok=${String(quality.ok)})`
    )

    scoped.info('▸ match_purchase_order')
    const match = asRecord(
      await harness.execute('match_purchase_order', {
        invoiceId: invoice.invoiceNumber,
        invoice
      })
    )

    const status = String(match.status ?? '')
    if (status === 'no_po_candidates') {
      skip('no hay órdenes de compra en workspace/purchase-orders — corré seed-fixtures')
    }
    if (!match.purchaseOrderId) {
      fail(`match sin candidato — status=${status}`)
    }

    return {
      invoice: {
        vendor: invoice.vendor,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total
      },
      qualityOk: quality.ok,
      match: {
        purchaseOrderId: match.purchaseOrderId,
        matched: match.matched,
        status,
        confidence: match.confidence
      }
    }
  }
}

/** P2 WDK en Sepolia: balance + quote + dryRun + guarda de confirmación humana. */
const wdkScenario: Scenario = {
  name: 'wdk',
  summary: 'WDK Sepolia: balance + quote + dryRun + hook de confirmación',
  async run({ harness, options, log: scoped }) {
    requireWallet()
    const { wdk } = getConfig()
    scoped.info(`PIMLICO_API_KEY: ${wdk.pimlicoApiKey ? 'SET' : 'MISSING'}`)

    scoped.info('▸ get_wallet_balance (sepolia)')
    const balance = asRecord(await harness.execute('get_wallet_balance', { network: 'sepolia' }))
    skipIfUnreachable('get_wallet_balance', balance)
    if (balance.status !== 'ok') fail(`get_wallet_balance status=${String(balance.status)}`)
    scoped.info(`saldo: ${String(balance.usdt)} USDt en ${String(balance.address)}`)

    scoped.info(`▸ quote_payment (${options.amount} USDt)`)
    const quote = asRecord(
      await harness.execute('quote_payment', {
        to: options.to,
        amount: options.amount,
        network: 'sepolia'
      })
    )
    skipIfUnreachable('quote_payment', quote)
    const quoteStatus = String(quote.status ?? '')
    if (quoteStatus !== 'ok' && quoteStatus !== 'quote_skipped_no_api_key') {
      fail(`quote_payment status=${quoteStatus}`)
    }
    if (quoteStatus === 'quote_skipped_no_api_key') {
      scoped.warn('sin PIMLICO_API_KEY: la cotización no es real (fee=null)')
    }

    scoped.info('▸ execute_gasless_payment (dryRun por defecto)')
    const dry = asRecord(
      await harness.execute('execute_gasless_payment', {
        to: options.to,
        amount: options.amount,
        network: 'sepolia'
      })
    )
    if (dry.dryRun !== true) fail('execute_gasless_payment sin dryRun:false debe simular')

    scoped.info(`▸ hook: pago de ${OVER_THRESHOLD_AMOUNT} USDt sin confirmación debe bloquearse`)
    const blocked = asRecord(
      await harness.execute('execute_gasless_payment', {
        to: options.to,
        amount: OVER_THRESHOLD_AMOUNT,
        network: 'sepolia',
        dryRun: false
      })
    )
    if (blocked.blocked !== true) {
      fail('el hook de confirmación humana NO bloqueó un pago sobre el umbral')
    }

    const mcpBin = resolveWdkMcpBin()
    if (!mcpBin) fail('@tetherto/wdk-cli no encontrado — npm install')
    scoped.info(`wdk-mcp bin: ${mcpBin}`)

    return {
      balance: { usdt: balance.usdt, native: balance.native, address: balance.address },
      quoteStatus,
      dryRunStatus: dry.status ?? 'dry_run',
      hookBlocked: true,
      mcpBin
    }
  }
}

/**
 * Doble confirmación para mover dinero de verdad.
 *
 * Los dos cerrojos son deliberadamente de naturaleza distinta —uno en el
 * entorno del shell, otro en la línea de comandos— para que ningún alias,
 * script de CI o `.env` heredado pueda disparar una transferencia por su
 * cuenta. Faltando cualquiera de los dos, el escenario hace dry-run y lo dice.
 */
function livePayGate(confirmFlag: boolean): { live: boolean; missing: string[] } {
  // CONFIRM_LIVE_PAY es un cerrojo de seguridad, no configuración de la app:
  // a propósito NO vive en `@config` para que no pueda colarse en `getConfig()`
  // ni ser sustituido por `setConfig()` desde un test.
  const envConfirmed = process.env.CONFIRM_LIVE_PAY === '1' // conventions:allow

  const missing: string[] = []
  if (!envConfirmed) missing.push('CONFIRM_LIVE_PAY=1 (variable de entorno)')
  if (!confirmFlag) missing.push('--confirm-live-pay (flag de CLI)')

  return { live: missing.length === 0, missing }
}

/** Transferencia real en Sepolia. Requiere las DOS confirmaciones. */
const livePayScenario: Scenario = {
  name: 'live-pay',
  summary: 'transferencia REAL en Sepolia (requiere doble confirmación explícita)',
  async run({ harness, options, log: scoped }) {
    requireWallet()
    const gate = livePayGate(options.confirmLivePayFlag)

    scoped.warn(
      gate.live
        ? '⚠ DOBLE CONFIRMACIÓN PRESENTE — este escenario VA A MOVER FONDOS REALES'
        : 'modo seguro (dry-run): faltan confirmaciones → ' + gate.missing.join(' y ')
    )
    scoped.info(`destino=${options.to} importe=${options.amount} USDt red=sepolia`)

    scoped.info('▸ 1/4 get_wallet_balance')
    const balance = asRecord(await harness.execute('get_wallet_balance', { network: 'sepolia' }))
    skipIfUnreachable('get_wallet_balance', balance)
    if (balance.status !== 'ok') fail(`get_wallet_balance status=${String(balance.status)}`)

    const usdt = Number.parseFloat(String(balance.usdt ?? '0'))
    if (!(usdt >= options.amount)) {
      skip(
        `MOCK USDt insuficiente (${String(balance.usdt)} < ${options.amount}). ` +
          `Fondeá ${String(balance.address)} vía faucet Pimlico/Candide — docs/WDK-SEPOLIA-LIVE-PAY.md`
      )
    }

    scoped.info('▸ 2/4 quote_payment')
    const quote = asRecord(
      await harness.execute('quote_payment', {
        to: options.to,
        amount: options.amount,
        network: 'sepolia'
      })
    )
    skipIfUnreachable('quote_payment', quote)
    const quoteStatus = String(quote.status ?? '')
    if (quoteStatus !== 'ok' && quoteStatus !== 'quote_skipped_no_api_key') {
      fail(`quote_payment status=${quoteStatus}`)
    }

    scoped.info('▸ 3/4 execute_gasless_payment dryRun (preview)')
    const dry = asRecord(
      await harness.execute('execute_gasless_payment', {
        to: options.to,
        amount: options.amount,
        network: 'sepolia',
        dryRun: true
      })
    )
    if (dry.dryRun !== true) fail('el preview no vino marcado como dryRun')

    if (!gate.live) {
      scoped.info(
        [
          '',
          '✅ Preflight OK — wallet fondeada, quote y dry-run correctos.',
          '   NO se transfirió nada: falta la doble confirmación.',
          '',
          '   Para enviar una transferencia REAL de MOCK USDt en Sepolia hacen',
          '   falta LAS DOS cosas, en la misma invocación:',
          '',
          `     CONFIRM_LIVE_PAY=1 node --use-system-ca --env-file=.env \\`,
          `       dist/scripts/smoke.js live-pay --confirm-live-pay`,
          '',
          '   Guía: docs/WDK-SEPOLIA-LIVE-PAY.md',
          ''
        ].join('\n')
      )
      return {
        live: false,
        dryRun: true,
        missingConfirmations: gate.missing,
        balance: { usdt: balance.usdt, address: balance.address },
        quoteStatus
      }
    }

    scoped.warn('▸ 4/4 execute_gasless_payment dryRun:false — TRANSFERENCIA REAL')
    const result = asRecord(
      await harness.execute('execute_gasless_payment', {
        to: options.to,
        amount: options.amount,
        network: 'sepolia',
        dryRun: false
      })
    )

    if (result.blocked === true) {
      fail(`bloqueado por hook: ${String(result.reason)}`)
    }
    if (result.status !== 'ok' || !result.txHash) {
      fail(`live pay falló — status=${String(result.status)} ${String(result.error ?? '')}`)
    }

    const txHash = String(result.txHash)
    scoped.info(`✅ txHash: ${txHash}`)
    scoped.info(`   https://sepolia.etherscan.io/tx/${txHash}`)

    return {
      live: true,
      dryRun: false,
      txHash,
      explorer: `https://sepolia.etherscan.io/tx/${txHash}`,
      fee: result.fee ?? null,
      sponsored: result.sponsored ?? null
    }
  }
}

export const SCENARIOS: readonly Scenario[] = [
  forecastScenario,
  ragScenario,
  ingestScenario,
  wdkScenario,
  livePayScenario
]

// ── Runner ──────────────────────────────────────────────────────────────────

export interface SmokeRun {
  results: ScenarioResult[]
  ok: number
  failed: number
  skipped: number
}

export async function runScenarios(
  names: readonly string[],
  options: SmokeOptions
): Promise<SmokeRun> {
  const harness = await loadPlugins(createHarness(), { withDefaultHooks: true })
  const results: ScenarioResult[] = []

  for (const name of names) {
    const scenario = SCENARIOS.find((candidate) => candidate.name === name)
    if (!scenario) {
      results.push({ scenario: name, status: 'failed', ms: 0, reason: 'escenario desconocido' })
      continue
    }

    const scoped = log.child(scenario.name)
    scoped.info(`── ${scenario.name}: ${scenario.summary}`)
    const started = Date.now()

    try {
      const detail = await scenario.run({ harness, options, log: scoped })
      const ms = Date.now() - started
      scoped.info(`✅ ok (${ms} ms)`)
      results.push({ scenario: scenario.name, status: 'ok', ms, detail })
    } catch (err) {
      const ms = Date.now() - started
      const reason = describe(err)
      if (err instanceof SkipSignal) {
        scoped.warn(`⏭ saltado: ${reason}`)
        results.push({ scenario: scenario.name, status: 'skipped', ms, reason })
      } else {
        scoped.error(`✖ falló: ${reason}`)
        results.push({ scenario: scenario.name, status: 'failed', ms, reason })
      }
    }
  }

  return {
    results,
    ok: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length
  }
}

interface ParsedArgs {
  names: string[]
  all: boolean
  options: SmokeOptions
}

function numericFlag(argv: readonly string[], name: string, fallback: number): number {
  const prefix = `--${name}=`
  const hit = argv.find((arg) => arg.startsWith(prefix))
  if (!hit) return fallback
  const value = Number(hit.slice(prefix.length))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function stringFlag(argv: readonly string[], name: string, fallback: string): string {
  const prefix = `--${name}=`
  const hit = argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  return {
    names: argv.filter((arg) => !arg.startsWith('-')),
    all: argv.includes('--all'),
    options: {
      to: stringFlag(argv, 'to', DEFAULT_VENDOR),
      amount: numericFlag(argv, 'amount', DEFAULT_AMOUNT),
      invoicePath: stringFlag(argv, 'invoice', workspaceDir('invoices', 'sample.png')),
      confirmLivePayFlag: argv.includes('--confirm-live-pay')
    }
  }
}

function renderCatalogue(): string {
  const rows = SCENARIOS.map((s) => `  ${s.name.padEnd(10)} ${s.summary}`).join('\n')
  return [
    '🍐 PearLedger — smoke scenarios',
    '',
    rows,
    '',
    'Uso:',
    '  node --env-file=.env dist/scripts/smoke.js <escenario> [...]',
    '  node --env-file=.env dist/scripts/smoke.js --all',
    '',
    'Flags:',
    '  --all                 corre todos los escenarios',
    '  --amount=<n>          importe USDt de los escenarios de pago (default 1)',
    '  --to=<0x...>          destinatario de los pagos de prueba',
    '  --invoice=<ruta>      factura para el escenario `ingest`',
    '  --confirm-live-pay    segunda confirmación de `live-pay` (la primera es',
    '                        la variable de entorno CONFIRM_LIVE_PAY=1)',
    ''
  ].join('\n')
}

export async function main(argv: readonly string[]): Promise<number> {
  const { names, all, options } = parseArgs(argv)

  if (!all && names.length === 0) {
    writeOut(renderCatalogue())
    return 0
  }

  const selected = all ? SCENARIOS.map((s) => s.name) : names
  const unknown = selected.filter((name) => !SCENARIOS.some((s) => s.name === name))
  if (unknown.length > 0) {
    log.error(`escenario(s) desconocido(s): ${unknown.join(', ')}`)
    writeOut(renderCatalogue())
    return 1
  }

  const run = await runScenarios(selected, options)

  writeOut(
    JSON.stringify(
      {
        ok: run.ok,
        failed: run.failed,
        skipped: run.skipped,
        total: run.results.length,
        scenarios: run.results
      },
      null,
      2
    )
  )

  return run.failed > 0 ? 1 : 0
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  return Boolean(entry) && import.meta.url === pathToFileURL(entry!).href
}

if (isMainModule()) {
  process.exitCode = await main(process.argv.slice(2))
}
