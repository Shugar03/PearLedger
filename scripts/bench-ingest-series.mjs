#!/usr/bin/env node
/**
 * Bench E2E: 4 facturas en serie con trazabilidad por etapa.
 * Uso: node --env-file=.env scripts/bench-ingest-series.mjs
 */
import { writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { completion, loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'
import { resolveInvoiceImagePath } from '../dist/workspace/plugins/plugin-invoice-ops/image-input.js'
import { getOcrModelId, getLlmModelId, resetQvacModelCache } from '../dist/workspace/plugins/plugin-invoice-ops/qvac-client.js'
import { parseInvoiceSchema } from '../dist/workspace/plugins/plugin-invoice-ops/schema.js'
import { matchPurchaseOrder } from '../dist/workspace/plugins/plugin-invoice-ops/matcher.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'agent-tools')

const FILES = [
  'workspace/invoices/factura-test-1.png',
  'workspace/invoices/factura-test-2.png',
  'workspace/invoices/factura-test-3.png',
  'workspace/invoices/factura-test-4.png'
]

function mem() {
  const m = process.memoryUsage()
  return {
    rssMb: +(m.rss / 1024 / 1024).toFixed(1),
    heapUsedMb: +(m.heapUsed / 1024 / 1024).toFixed(1),
    externalMb: +(m.external / 1024 / 1024).toFixed(1)
  }
}

async function timed(label, fn) {
  const t0 = performance.now()
  const memBefore = mem()
  try {
    const result = await fn()
    return {
      label,
      ok: true,
      ms: +(performance.now() - t0).toFixed(1),
      memBefore,
      memAfter: mem(),
      result
    }
  } catch (err) {
    return {
      label,
      ok: false,
      ms: +(performance.now() - t0).toFixed(1),
      memBefore,
      memAfter: mem(),
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

async function ocrPathB(imagePath) {
  const modelId = await getOcrModelId()
  const run = completion({
    modelId,
    stream: false,
    history: [
      {
        role: 'user',
        content:
          'Extract all visible text from this invoice document. Return plain text only, preserving line breaks and numbers exactly as shown.',
        attachments: [{ path: imagePath }]
      }
    ]
  })
  const final = await run.final
  return (final.contentText ?? '').trim()
}

async function ocrPathA(imagePath) {
  // Cargar LATIN solo tras fallar Path B; liberar al terminar para no competir con multimodal/LLM
  const modelId = await loadModel({ modelSrc: OCR_LATIN })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    return result.map((block) => block.text).join('\n').trim()
  } finally {
    try {
      await unloadModel({ modelId, clearStorage: false })
    } catch {
      await unloadModel({ modelId })
    }
  }
}

async function runOne(relPath, index) {
  const absHint = path.join(root, relPath)
  const fileStat = await stat(absHint)
  const row = {
    index,
    file: relPath,
    bytes: fileStat.size,
    stages: {},
    ocrPath: null,
    rawTextLen: 0,
    invoice: null,
    match: null,
    totalMs: 0,
    coldStart: false
  }

  const wall0 = performance.now()

  const resolveStage = await timed('resolve_image', () => resolveInvoiceImagePath(absHint))
  row.stages.resolve_image = {
    ok: resolveStage.ok,
    ms: resolveStage.ms,
    path: resolveStage.result
  }
  if (!resolveStage.ok) {
    row.error = resolveStage.error
    row.totalMs = +(performance.now() - wall0).toFixed(1)
    return row
  }
  const imagePath = resolveStage.result

  const pathB = await timed('ocr_path_b_multimodal', () => ocrPathB(imagePath))
  row.stages.ocr_path_b = {
    ok: pathB.ok,
    ms: pathB.ms,
    memBefore: pathB.memBefore,
    memAfter: pathB.memAfter,
    error: pathB.error
  }

  let rawText = ''
  if (pathB.ok && pathB.result) {
    rawText = pathB.result
    row.ocrPath = 'B_multimodal'
  } else {
    const pathA = await timed('ocr_path_a_latin', () => ocrPathA(imagePath))
    row.stages.ocr_path_a = {
      ok: pathA.ok,
      ms: pathA.ms,
      memBefore: pathA.memBefore,
      memAfter: pathA.memAfter,
      error: pathA.error
    }
    if (!pathA.ok || !pathA.result) {
      row.error = pathA.error || pathB.error || 'OCR vacío'
      row.totalMs = +(performance.now() - wall0).toFixed(1)
      return row
    }
    rawText = pathA.result
    row.ocrPath = 'A_latin_fallback'
  }

  row.rawTextLen = rawText.length
  row.rawTextPreview = rawText.slice(0, 280)

  const schema = await timed('schema_llm', () => parseInvoiceSchema(rawText))
  row.stages.schema_llm = {
    ok: schema.ok,
    ms: schema.ms,
    memBefore: schema.memBefore,
    memAfter: schema.memAfter,
    error: schema.error
  }
  if (schema.ok) {
    row.invoice = schema.result
  } else {
    row.error = schema.error
    row.totalMs = +(performance.now() - wall0).toFixed(1)
    return row
  }

  const invoiceId = schema.result.invoiceNumber || 'unknown'
  const match = await timed('match_po', () =>
    matchPurchaseOrder({ invoiceId, invoice: schema.result })
  )
  row.stages.match_po = {
    ok: match.ok,
    ms: match.ms,
    memBefore: match.memBefore,
    memAfter: match.memAfter,
    error: match.error
  }
  if (match.ok) row.match = match.result

  row.totalMs = +(performance.now() - wall0).toFixed(1)
  return row
}

function summarize(rows) {
  const ok = rows.filter((r) => r.invoice)
  const pathB = rows.filter((r) => r.ocrPath === 'B_multimodal')
  const pathA = rows.filter((r) => r.ocrPath === 'A_latin_fallback')

  const stageMs = (key) =>
    rows
      .map((r) => r.stages[key]?.ms)
      .filter((n) => typeof n === 'number')

  const avg = (arr) =>
    arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null
  const max = (arr) => (arr.length ? Math.max(...arr) : null)

  const bottlenecks = []
  const bMs = stageMs('ocr_path_b')
  const sMs = stageMs('schema_llm')
  const mMs = stageMs('match_po')
  if (avg(bMs) > avg(sMs) && avg(bMs) > avg(mMs)) {
    bottlenecks.push({
      stage: 'ocr_path_b_multimodal',
      why: 'Mayor tiempo medio de las etapas de inferencia',
      avgMs: avg(bMs)
    })
  }
  if (avg(sMs) > 30_000) {
    bottlenecks.push({
      stage: 'schema_llm',
      why: 'Structured output LLM lento (>30s avg)',
      avgMs: avg(sMs)
    })
  }
  if (rows.some((r) => r.stages.ocr_path_b && !r.stages.ocr_path_b.ok)) {
    bottlenecks.push({
      stage: 'ocr_path_b failures',
      why: 'Path B falló en al menos una factura',
      samples: rows
        .filter((r) => r.stages.ocr_path_b && !r.stages.ocr_path_b.ok)
        .map((r) => ({ file: r.file, error: r.stages.ocr_path_b.error, ms: r.stages.ocr_path_b.ms }))
    })
  }
  if (rows.some((r) => (r.error || '').includes('ggml_gallocr') || (r.error || '').includes('alloc'))) {
    bottlenecks.push({
      stage: 'memory_alloc',
      why: 'ggml_gallocr_alloc_graph — presión de VRAM/RAM al tener varios modelos vivos'
    })
  }
  if (rows.every((r) => r.match && !r.match.matched)) {
    bottlenecks.push({
      stage: 'match_po',
      why: '0 matches — workspace/purchase-orders sin candidatos (RAG/filesystem)'
    })
  }

  return {
    count: rows.length,
    okCount: ok.length,
    pathBCount: pathB.length,
    pathAFallbackCount: pathA.length,
    totalsMs: {
      avg: avg(rows.map((r) => r.totalMs)),
      max: max(rows.map((r) => r.totalMs)),
      sum: +rows.reduce((a, r) => a + r.totalMs, 0).toFixed(1)
    },
    stagesAvgMs: {
      resolve_image: avg(stageMs('resolve_image')),
      ocr_path_b: avg(bMs),
      ocr_path_a: avg(stageMs('ocr_path_a')),
      schema_llm: avg(sMs),
      match_po: avg(mMs)
    },
    stagesMaxMs: {
      ocr_path_b: max(bMs),
      schema_llm: max(sMs),
      match_po: max(mMs)
    },
    coldVsWarm: {
      coldTotalMs: rows[0]?.totalMs ?? null,
      warmAvgTotalMs: avg(rows.slice(1).map((r) => r.totalMs))
    },
    bottlenecks,
    productNotes: [
      'Cada factura recarga OCR→LLM→(embeddings) porque QVAC suele desalojar el modelo anterior.',
      'PNG alta resolución / muchos tokens de imagen → ctx 4096 overflow en Path B.',
      'match_po sin POs JSON → status no_po_candidates (esperado hasta cargar OCs).',
      'schema_llm es segunda pasada Qwen — coste fijo por factura aunque OCR sea rápido.',
      'No precargar OCR+LLM juntos: cache de modelId stale + OOM ggml_gallocr.'
    ]
  }
}

const suiteT0 = performance.now()
console.log('🍐 Bench ingest ×4 (serie + trazabilidad)\n')
console.log('(sin preload dual OCR+LLM — evita OOM ggml_gallocr)\n')

await mkdir(outDir, { recursive: true })

const preload = {
  label: 'preload_model_handles',
  ok: true,
  ms: 0,
  skipped: true,
  reason: 'Evitar cargar OCR 3B + Qwen a la vez antes del loop'
}

const rows = []
for (let i = 0; i < FILES.length; i++) {
  const n = i + 1
  console.log(`\n── [${n}/4] ${FILES[i]} ──`)
  resetQvacModelCache()
  const row = await runOne(FILES[i], n)
  rows.push(row)
  console.log(
    JSON.stringify(
      {
        totalMs: row.totalMs,
        ocrPath: row.ocrPath,
        stages: Object.fromEntries(
          Object.entries(row.stages).map(([k, v]) => [k, { ok: v.ok, ms: v.ms }])
        ),
        vendor: row.invoice?.vendor,
        invoiceNumber: row.invoice?.invoiceNumber,
        total: row.invoice?.total,
        matchStatus: row.match?.status
      },
      null,
      2
    )
  )
}

const report = {
  generatedAt: new Date().toISOString(),
  host: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    ctxSize: process.env.QVAC_CTX_SIZE || '4096'
  },
  preload,
  wallMs: +(performance.now() - suiteT0).toFixed(1),
  summary: summarize(rows),
  runs: rows
}

const jsonPath = path.join(outDir, 'bench-ingest-series.json')
const mdPath = path.join(outDir, 'bench-ingest-series.md')
await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')

const s = report.summary
const md = `# Bench ingest ×4 — trazabilidad

Generado: ${report.generatedAt}  
Wall total: **${report.wallMs} ms** · Preload modelos: **${preload.ms} ms**

## Resumen

| Métrica | Valor |
|---------|-------|
| OK / total | ${s.okCount}/${s.count} |
| Path B (multimodal) | ${s.pathBCount} |
| Fallback OCR_LATIN | ${s.pathAFallbackCount} |
| Total avg / max / sum | ${s.totalsMs.avg} / ${s.totalsMs.max} / ${s.totalsMs.sum} ms |
| Cold (1ª) | ${s.coldVsWarm.coldTotalMs} ms |
| Warm avg (2–4) | ${s.coldVsWarm.warmAvgTotalMs} ms |

## Etapas (avg ms)

| Etapa | Avg ms | Max ms |
|-------|--------|--------|
| resolve_image | ${s.stagesAvgMs.resolve_image} | — |
| ocr_path_b | ${s.stagesAvgMs.ocr_path_b} | ${s.stagesMaxMs.ocr_path_b} |
| ocr_path_a | ${s.stagesAvgMs.ocr_path_a ?? '—'} | — |
| schema_llm | ${s.stagesAvgMs.schema_llm} | ${s.stagesMaxMs.schema_llm} |
| match_po | ${s.stagesAvgMs.match_po} | ${s.stagesMaxMs.match_po} |

## Por factura

${rows
  .map(
    (r) => `### ${r.file}
- **total**: ${r.totalMs} ms · OCR path: \`${r.ocrPath}\` · bytes: ${r.bytes}
- stages: ${Object.entries(r.stages)
  .map(([k, v]) => `${k}=${v.ms}ms${v.ok ? '' : ' FAIL'}`)
  .join(', ')}
- invoice: ${r.invoice ? `${r.invoice.vendor} / ${r.invoice.invoiceNumber} / total=${r.invoice.total}` : '—'}
- match: ${r.match?.status ?? r.error ?? '—'}
`
  )
  .join('\n')}

## Cuellos de botella

${s.bottlenecks.map((b) => `- **${b.stage}**: ${b.why}${b.avgMs != null ? ` (avg ${b.avgMs} ms)` : ''}`).join('\n') || '- (ninguno detectado automáticamente)'}

## Notas producto

${s.productNotes.map((n) => `- ${n}`).join('\n')}

Raw JSON: \`${path.relative(root, jsonPath)}\`
`

await writeFile(mdPath, md, 'utf8')
console.log(`\n✅ Reportes:\n  ${jsonPath}\n  ${mdPath}`)
