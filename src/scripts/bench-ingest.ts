/**
 * Bench E2E de ingesta de facturas, con dos estrategias de ejecución.
 *
 * Consolida los dos benchmarks que antes vivían separados en `scripts/`:
 *
 *  - **in-process** (por defecto) — recorre las etapas del pipeline dentro de
 *    este proceso (`resolve_image → OCR Path B → OCR Path A → schema LLM →
 *    match PO`) y cronometra cada una con su huella de memoria. Da la
 *    trazabilidad más fina, pero un crash del worker QVAC tumba la corrida.
 *  - **`--isolated`** — un proceso `dist/dev.js ingest … --json` por factura.
 *    Mide el coste real del CLI y sobrevive a un `ACCESS_VIOLATION` del worker:
 *    muere el hijo, el siguiente arranca limpio.
 *
 * Uso:
 *   node --env-file=.env dist/scripts/bench-ingest.js
 *   node --env-file=.env dist/scripts/bench-ingest.js --isolated
 *   node --env-file=.env dist/scripts/bench-ingest.js --timeout=180000 f1.png f2.png
 *
 * Deja `bench-ingest[-isolated].json` y `.md` en `agent-tools/`.
 */

import process from 'node:process'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { completion, loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'

import { getLogger, writeOut } from '@shared/logger.js'
import { appRoot, workspaceDir } from '@shared/paths.js'
import { matchPurchaseOrder, parseInvoiceSchema, resolveInvoiceImagePath } from '@plugins/invoice-ops/index.js'
import { resetQvacModelCache, getOcrModelId } from '@plugins/invoice-ops/qvac-client.js'
import type { Invoice, MatchResult } from '@plugins/invoice-ops/index.js'

const log = getLogger('bench-ingest')

const DEFAULT_TIMEOUT_MS = 150_000
const SLOW_SCHEMA_MS = 30_000
const RAW_PREVIEW_CHARS = 280

// ── Tipos del informe ───────────────────────────────────────────────────────

export interface MemorySample {
  rssMb: number
  heapUsedMb: number
  externalMb: number
}

export interface StageTrace {
  ok: boolean
  ms: number
  memBefore?: MemorySample
  memAfter?: MemorySample
  error?: string
  path?: string
}

export type OcrPath = 'B_multimodal' | 'A_latin_fallback' | null

export interface BenchRow {
  index: number
  file: string
  bytes: number
  stages: Record<string, StageTrace>
  ocrPath: OcrPath
  rawTextLen: number
  rawTextPreview?: string
  invoice: Invoice | null
  match: MatchResult | null
  totalMs: number
  error?: string
  /** Sólo en modo aislado. */
  exitCode?: number
  timedOut?: boolean
  pathBMs?: number | null
  ocrChars?: number | null
  latinBlocks?: number | null
  pathBError?: string | null
  schemaRejected?: string | null
  stderrTail?: string
}

export interface BenchReport {
  generatedAt: string
  mode: 'in-process' | 'process-isolated'
  host: { platform: string; arch: string; node: string }
  wallMs: number
  summary: Record<string, unknown>
  runs: BenchRow[]
  notes: string[]
}

// ── Utilidades ──────────────────────────────────────────────────────────────

function mem(): MemorySample {
  const m = process.memoryUsage()
  return {
    rssMb: +(m.rss / 1024 / 1024).toFixed(1),
    heapUsedMb: +(m.heapUsed / 1024 / 1024).toFixed(1),
    externalMb: +(m.external / 1024 / 1024).toFixed(1)
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface Timed<T> {
  ok: boolean
  ms: number
  memBefore: MemorySample
  memAfter: MemorySample
  result?: T
  error?: string
}

async function timed<T>(fn: () => Promise<T>): Promise<Timed<T>> {
  const t0 = Date.now()
  const memBefore = mem()
  try {
    const result = await fn()
    return { ok: true, ms: Date.now() - t0, memBefore, memAfter: mem(), result }
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      memBefore,
      memAfter: mem(),
      error: describe(err)
    }
  }
}

function traceOf(entry: Timed<unknown>): StageTrace {
  const trace: StageTrace = {
    ok: entry.ok,
    ms: entry.ms,
    memBefore: entry.memBefore,
    memAfter: entry.memAfter
  }
  if (entry.error) trace.error = entry.error
  return trace
}

const avg = (values: readonly number[]): number | null =>
  values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null

const max = (values: readonly number[]): number | null =>
  values.length ? Math.max(...values) : null

// ── Estrategia in-process ───────────────────────────────────────────────────

/** Path B: OCR multimodal sobre el modelo cargado por `qvac-client`. */
async function ocrPathB(imagePath: string): Promise<string> {
  const modelId = await getOcrModelId()
  const run = completion({
    modelId,
    stream: false,
    history: [
      {
        role: 'user',
        content:
          'Extract all visible text from this invoice document. Return plain text only, ' +
          'preserving line breaks and numbers exactly as shown.',
        attachments: [{ path: imagePath }]
      }
    ]
  })
  const final = await run.final
  return (final.contentText ?? '').trim()
}

/**
 * Path A: OCR_LATIN. Se carga sólo tras fallar Path B y se libera al terminar,
 * para no competir por VRAM con el multimodal ni con el LLM del schema.
 */
async function ocrPathA(imagePath: string): Promise<string> {
  const modelId = await loadModel({ modelSrc: OCR_LATIN })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    return result
      .map((block) => block.text)
      .join('\n')
      .trim()
  } finally {
    try {
      await unloadModel({ modelId, clearStorage: false })
    } catch {
      await unloadModel({ modelId })
    }
  }
}

async function runInProcess(file: string, index: number): Promise<BenchRow> {
  const fileStat = await stat(file)
  const row: BenchRow = {
    index,
    file,
    bytes: fileStat.size,
    stages: {},
    ocrPath: null,
    rawTextLen: 0,
    invoice: null,
    match: null,
    totalMs: 0
  }

  const wall0 = Date.now()
  const finish = (): BenchRow => {
    row.totalMs = Date.now() - wall0
    return row
  }

  const resolved = await timed(() => resolveInvoiceImagePath(file))
  row.stages.resolve_image = { ...traceOf(resolved), path: resolved.result }
  if (!resolved.ok || !resolved.result) {
    row.error = resolved.error ?? 'no se pudo resolver la imagen'
    return finish()
  }
  const imagePath = resolved.result

  const pathB = await timed(() => ocrPathB(imagePath))
  row.stages.ocr_path_b = traceOf(pathB)

  let rawText: string
  if (pathB.ok && pathB.result) {
    rawText = pathB.result
    row.ocrPath = 'B_multimodal'
  } else {
    const pathA = await timed(() => ocrPathA(imagePath))
    row.stages.ocr_path_a = traceOf(pathA)
    if (!pathA.ok || !pathA.result) {
      row.error = pathA.error ?? pathB.error ?? 'OCR vacío'
      return finish()
    }
    rawText = pathA.result
    row.ocrPath = 'A_latin_fallback'
  }

  row.rawTextLen = rawText.length
  row.rawTextPreview = rawText.slice(0, RAW_PREVIEW_CHARS)

  const schema = await timed(() => parseInvoiceSchema(rawText))
  row.stages.schema_llm = traceOf(schema)
  if (!schema.ok || !schema.result) {
    row.error = schema.error ?? 'schema vacío'
    return finish()
  }
  row.invoice = schema.result

  const invoice = schema.result
  const match = await timed(() =>
    matchPurchaseOrder({ invoiceId: invoice.invoiceNumber || 'unknown', invoice })
  )
  row.stages.match_po = traceOf(match)
  if (match.ok && match.result) row.match = match.result

  return finish()
}

function summarizeInProcess(rows: readonly BenchRow[]): Record<string, unknown> {
  const stageMs = (key: string): number[] =>
    rows.map((r) => r.stages[key]?.ms).filter((n): n is number => typeof n === 'number')

  const bMs = stageMs('ocr_path_b')
  const sMs = stageMs('schema_llm')
  const mMs = stageMs('match_po')

  const bottlenecks: Array<Record<string, unknown>> = []
  const bAvg = avg(bMs) ?? 0
  if (bAvg > (avg(sMs) ?? 0) && bAvg > (avg(mMs) ?? 0)) {
    bottlenecks.push({
      stage: 'ocr_path_b_multimodal',
      why: 'Mayor tiempo medio de las etapas de inferencia',
      avgMs: bAvg
    })
  }
  if ((avg(sMs) ?? 0) > SLOW_SCHEMA_MS) {
    bottlenecks.push({
      stage: 'schema_llm',
      why: 'Structured output LLM lento (>30s avg)',
      avgMs: avg(sMs)
    })
  }
  const pathBFailures = rows.filter((r) => r.stages.ocr_path_b && !r.stages.ocr_path_b.ok)
  if (pathBFailures.length > 0) {
    bottlenecks.push({
      stage: 'ocr_path_b failures',
      why: 'Path B falló en al menos una factura',
      samples: pathBFailures.map((r) => ({
        file: r.file,
        error: r.stages.ocr_path_b?.error,
        ms: r.stages.ocr_path_b?.ms
      }))
    })
  }
  if (rows.some((r) => /ggml_gallocr|alloc/.test(r.error ?? ''))) {
    bottlenecks.push({
      stage: 'memory_alloc',
      why: 'ggml_gallocr_alloc_graph — presión de VRAM/RAM con varios modelos vivos'
    })
  }
  if (rows.length > 0 && rows.every((r) => r.match && !r.match.matched)) {
    bottlenecks.push({
      stage: 'match_po',
      why: '0 matches — workspace/purchase-orders sin candidatos (RAG/filesystem)'
    })
  }

  const totals = rows.map((r) => r.totalMs)

  return {
    count: rows.length,
    okCount: rows.filter((r) => r.invoice).length,
    pathBCount: rows.filter((r) => r.ocrPath === 'B_multimodal').length,
    pathAFallbackCount: rows.filter((r) => r.ocrPath === 'A_latin_fallback').length,
    totalsMs: { avg: avg(totals), max: max(totals), sum: totals.reduce((a, b) => a + b, 0) },
    stagesAvgMs: {
      resolve_image: avg(stageMs('resolve_image')),
      ocr_path_b: avg(bMs),
      ocr_path_a: avg(stageMs('ocr_path_a')),
      schema_llm: avg(sMs),
      match_po: avg(mMs)
    },
    stagesMaxMs: { ocr_path_b: max(bMs), schema_llm: max(sMs), match_po: max(mMs) },
    coldVsWarm: {
      coldTotalMs: rows[0]?.totalMs ?? null,
      warmAvgTotalMs: avg(rows.slice(1).map((r) => r.totalMs))
    },
    bottlenecks
  }
}

const IN_PROCESS_NOTES = [
  'Cada factura recarga OCR→LLM→(embeddings) porque QVAC suele desalojar el modelo anterior.',
  'PNG de alta resolución / muchos tokens de imagen → ctx 4096 overflow en Path B.',
  'match_po sin POs JSON → status no_po_candidates (esperado hasta cargar OCs).',
  'schema_llm es una segunda pasada de Qwen: coste fijo por factura aunque el OCR sea rápido.',
  'No precargar OCR+LLM juntos: cache de modelId stale + OOM ggml_gallocr.'
]

// ── Estrategia aislada (un proceso por factura) ─────────────────────────────

function killTree(pid: number | undefined): void {
  if (!pid) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // el proceso ya murió
  }
}

interface CliPayload {
  parsed?: { invoice?: Invoice; quality?: unknown; rawTextPreview?: string }
  invoice?: Invoice
  match?: MatchResult
}

function parseCliJson(stdout: string): CliPayload | null {
  const start = stdout.indexOf('{')
  if (start < 0) return null
  try {
    return JSON.parse(stdout.slice(start)) as CliPayload
  } catch {
    return null
  }
}

function runIsolated(file: string, index: number, timeoutMs: number): Promise<BenchRow> {
  return new Promise((resolve) => {
    void (async () => {
      const t0 = Date.now()
      const bytes = (await stat(file)).size
      const cli = path.join(appRoot(), 'dist', 'dev.js')

      // Sin `env`: el hijo hereda el entorno del padre y `dist/dev.js` carga
      // `.env` por su cuenta. Así este módulo no toca `process.env`.
      const child = spawn(process.execPath, ['--use-system-ca', cli, 'ingest', file, '--json'], {
        cwd: appRoot(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        killTree(child.pid)
      }, timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        const ms = Date.now() - t0
        const payload = parseCliJson(stdout)
        const combined = `${stderr}\n${stdout}`

        // El CLI no expone tiempos por etapa: se reconstruyen de sus trazas.
        const fatal = /Path B fatal \(([^)]+)\)/.exec(combined)
        const discarded = /Path B descartado tras (\d+)ms \(([^)]+)\)/.exec(combined)
        const pathBOk = /Path B ok en (\d+)ms, (\d+) chars/.exec(combined)
        const latinBlocks = /Path A — (\d+) bloques, (\d+) chars/.exec(combined)
        const schemaReject = /Extracción inválida[^\n]*/.exec(combined)
        const usedLatin = /fallback OCR_LATIN/.test(combined)

        const invoice = payload?.parsed?.invoice ?? payload?.invoice ?? null

        resolve({
          index,
          file,
          bytes,
          stages: {
            ingest_cli: {
              ok: !timedOut && code === 0,
              ms,
              ...(timedOut ? { error: `timeout ${timeoutMs}ms` } : {})
            }
          },
          ocrPath: pathBOk ? 'B_multimodal' : usedLatin ? 'A_latin_fallback' : null,
          rawTextLen: payload?.parsed?.rawTextPreview?.length ?? 0,
          rawTextPreview: payload?.parsed?.rawTextPreview ?? '',
          invoice,
          match: payload?.match ?? null,
          totalMs: ms,
          exitCode: timedOut ? -1 : (code ?? -1),
          timedOut,
          pathBMs: pathBOk?.[1] ? Number(pathBOk[1]) : discarded?.[1] ? Number(discarded[1]) : null,
          ocrChars: pathBOk?.[2]
            ? Number(pathBOk[2])
            : latinBlocks?.[2]
              ? Number(latinBlocks[2])
              : null,
          latinBlocks: latinBlocks?.[1] ? Number(latinBlocks[1]) : null,
          pathBError: fatal?.[1] ?? discarded?.[2] ?? (timedOut ? `timeout ${timeoutMs}ms` : null),
          schemaRejected: schemaReject?.[0] ?? null,
          stderrTail: stderr.slice(-800),
          ...(invoice ? {} : { error: `sin invoice (exit=${String(code)})` })
        })
      })
    })()
  })
}

function summarizeIsolated(rows: readonly BenchRow[]): Record<string, unknown> {
  const totals = rows.map((r) => r.totalMs)
  const pathBMs = rows.map((r) => r.pathBMs).filter((n): n is number => typeof n === 'number')
  return {
    count: rows.length,
    okCount: rows.filter((r) => r.invoice).length,
    pathBCount: rows.filter((r) => r.ocrPath === 'B_multimodal').length,
    pathAFallbackCount: rows.filter((r) => r.ocrPath === 'A_latin_fallback').length,
    timedOutCount: rows.filter((r) => r.timedOut).length,
    totalsMs: { avg: avg(totals), max: max(totals), sum: totals.reduce((a, b) => a + b, 0) },
    stagesAvgMs: { ingest_cli: avg(totals), ocr_path_b: avg(pathBMs) },
    stagesMaxMs: { ocr_path_b: max(pathBMs) },
    coldVsWarm: {
      coldTotalMs: rows[0]?.totalMs ?? null,
      warmAvgTotalMs: avg(rows.slice(1).map((r) => r.totalMs))
    },
    bottlenecks: rows
      .filter((r) => r.pathBError)
      .map((r) => ({ stage: 'ocr_path_b', file: r.file, why: r.pathBError }))
  }
}

const ISOLATED_NOTES = [
  'Aislamiento por proceso: cada ingest carga y descarga modelos — mide el coste real del CLI.',
  'Si Path B tumba el worker (0xC0000005) muere el hijo; el siguiente arranca limpio.',
  'Cuello típico: carga del OCR multimodal + inferencia sobre la imagen (~20–40 s en frío).',
  'Segundo cuello: el LLM del schema (Qwen) tras el OCR.',
  'match_po sin OCs → no_po_candidates (3-way match incompleto).'
]

// ── Informe ─────────────────────────────────────────────────────────────────

function renderMarkdown(report: BenchReport, jsonPath: string): string {
  const s = report.summary as {
    count: number
    okCount: number
    pathBCount: number
    pathAFallbackCount: number
    totalsMs: { avg: number | null; max: number | null; sum: number }
    stagesAvgMs: Record<string, number | null>
    stagesMaxMs: Record<string, number | null>
    coldVsWarm: { coldTotalMs: number | null; warmAvgTotalMs: number | null }
    bottlenecks: Array<Record<string, unknown>>
  }

  const stageRows = Object.entries(s.stagesAvgMs)
    .map(([stage, value]) => `| ${stage} | ${value ?? '—'} | ${s.stagesMaxMs[stage] ?? '—'} |`)
    .join('\n')

  const perFile = report.runs
    .map((r) => {
      const stages = Object.entries(r.stages)
        .map(([key, trace]) => `${key}=${trace.ms}ms${trace.ok ? '' : ' FAIL'}`)
        .join(', ')
      const invoice = r.invoice
        ? `${r.invoice.vendor} / ${r.invoice.invoiceNumber} / total=${r.invoice.total}`
        : '—'
      return [
        `### ${path.basename(r.file)}`,
        `- **total**: ${r.totalMs} ms · OCR path: \`${r.ocrPath ?? '—'}\` · bytes: ${r.bytes}`,
        `- stages: ${stages || '—'}`,
        `- invoice: ${invoice}`,
        `- match: ${r.match?.status ?? r.error ?? '—'}`,
        r.pathBError ? `- pathBError: ${r.pathBError}` : '',
        r.schemaRejected ? `- schemaRejected: ${r.schemaRejected}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const bottlenecks =
    s.bottlenecks
      .map(
        (b) =>
          `- **${String(b.stage)}**: ${String(b.why)}` +
          (b.avgMs != null ? ` (avg ${String(b.avgMs)} ms)` : '')
      )
      .join('\n') || '- (ninguno detectado automáticamente)'

  return `# Bench ingest — ${report.mode}

Generado: ${report.generatedAt}
Wall total: **${report.wallMs} ms** · ${report.host.platform}/${report.host.arch} · Node ${report.host.node}

## Resumen

| Métrica | Valor |
|---------|-------|
| OK / total | ${s.okCount}/${s.count} |
| Path B (multimodal) | ${s.pathBCount} |
| Fallback OCR_LATIN | ${s.pathAFallbackCount} |
| Total avg / max / sum | ${s.totalsMs.avg} / ${s.totalsMs.max} / ${s.totalsMs.sum} ms |
| Cold (1ª) | ${s.coldVsWarm.coldTotalMs} ms |
| Warm avg (resto) | ${s.coldVsWarm.warmAvgTotalMs} ms |

## Etapas

| Etapa | Avg ms | Max ms |
|-------|--------|--------|
${stageRows}

## Por factura

${perFile}

## Cuellos de botella

${bottlenecks}

## Notas

${report.notes.map((n) => `- ${n}`).join('\n')}

Raw JSON: \`${jsonPath}\`
`
}

// ── Entrypoint ──────────────────────────────────────────────────────────────

export interface BenchOptions {
  isolated: boolean
  timeoutMs: number
  files: string[]
}

function defaultFiles(): string[] {
  const series = [1, 2, 3, 4]
    .map((n) => workspaceDir('invoices', `factura-test-${n}.png`))
    .filter((file) => fs.existsSync(file))
  if (series.length > 0) return series

  const sample = workspaceDir('invoices', 'sample.png')
  return fs.existsSync(sample) ? [sample] : []
}

export function parseArgs(argv: readonly string[]): BenchOptions {
  const positional = argv.filter((arg) => !arg.startsWith('-'))
  const timeoutFlag = argv.find((arg) => arg.startsWith('--timeout='))
  const parsedTimeout = timeoutFlag ? Number(timeoutFlag.slice('--timeout='.length)) : NaN

  const requested = positional.length > 0 ? positional.map((f) => path.resolve(f)) : defaultFiles()
  const files = requested.filter((file) => {
    if (fs.existsSync(file)) return true
    log.warn(`omitida (no existe): ${file}`)
    return false
  })

  return {
    isolated: argv.includes('--isolated'),
    timeoutMs:
      Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS,
    files
  }
}

export async function runBench(options: BenchOptions): Promise<BenchReport> {
  const wall0 = Date.now()
  const rows: BenchRow[] = []

  for (const [i, file] of options.files.entries()) {
    log.info(`── [${i + 1}/${options.files.length}] ${path.basename(file)}`)
    let row: BenchRow
    if (options.isolated) {
      row = await runIsolated(file, i + 1, options.timeoutMs)
    } else {
      // El runtime puede haber desalojado los modelos entre facturas: un
      // `modelId` stale produce fallos opacos mucho más tarde.
      resetQvacModelCache()
      row = await runInProcess(file, i + 1)
    }
    rows.push(row)
    log.info(
      `${row.totalMs} ms · path=${row.ocrPath ?? '—'} · ` +
        `invoice=${row.invoice ? row.invoice.invoiceNumber : '—'} · ` +
        `match=${row.match?.status ?? row.error ?? '—'}`
    )
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: options.isolated ? 'process-isolated' : 'in-process',
    host: { platform: process.platform, arch: process.arch, node: process.version },
    wallMs: Date.now() - wall0,
    summary: options.isolated ? summarizeIsolated(rows) : summarizeInProcess(rows),
    runs: rows,
    notes: options.isolated ? ISOLATED_NOTES : IN_PROCESS_NOTES
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const options = parseArgs(argv)

  if (options.files.length === 0) {
    log.error(
      'no hay facturas que medir — pasá rutas como argumentos o poné ' +
        `factura-test-N.png en ${workspaceDir('invoices')}`
    )
    return 1
  }

  log.info(`🍐 Bench ingest ×${options.files.length} — modo ${options.isolated ? 'aislado (1 proceso por factura)' : 'in-process (trazabilidad por etapa)'}`)

  const report = await runBench(options)

  const outDir = path.join(appRoot(), 'agent-tools')
  await mkdir(outDir, { recursive: true })
  const base = options.isolated ? 'bench-ingest-isolated' : 'bench-ingest'
  const jsonPath = path.join(outDir, `${base}.json`)
  const mdPath = path.join(outDir, `${base}.md`)

  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(mdPath, renderMarkdown(report, jsonPath), 'utf8')

  writeOut(JSON.stringify({ jsonPath, mdPath, summary: report.summary }, null, 2))

  const okCount = Number(report.summary.okCount ?? 0)
  return okCount > 0 ? 0 : 1
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  return Boolean(entry) && import.meta.url === pathToFileURL(entry!).href
}

if (isMainModule()) {
  process.exitCode = await main(process.argv.slice(2))
}
