#!/usr/bin/env node
/**
 * Bench ingest ×4 en procesos aislados (un node por factura).
 * Evita corrupción del worker Bare entre corridas.
 *
 * Uso: node --env-file=.env scripts/bench-ingest-series-proc.mjs
 */
import { spawn } from 'node:child_process'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'agent-tools')

const FILES = [
  'workspace/invoices/factura-test-1.png',
  'workspace/invoices/factura-test-2.png',
  'workspace/invoices/factura-test-3.png',
  'workspace/invoices/factura-test-4.png'
]

const TIMEOUT_MS = Number(process.env.INGEST_TIMEOUT_MS || 150_000)

function killTree(pid) {
  if (!pid) return
  spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
}

function runIngest(relPath) {
  return new Promise(async (resolve) => {
    const t0 = performance.now()
    const abs = path.join(root, relPath)
    const st = await stat(abs)
    const child = spawn(
      process.execPath,
      ['--env-file=.env', 'cli/dev.mjs', 'ingest', relPath, '--json'],
      {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      }
    )
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child.pid)
    }, TIMEOUT_MS)
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const ms = +(performance.now() - t0).toFixed(1)
      let parsed = null
      try {
        const start = stdout.indexOf('{')
        if (start >= 0) parsed = JSON.parse(stdout.slice(start))
      } catch {
        parsed = null
      }
      const combined = `${stderr}\n${stdout}`
      const fatal = /Path B fatal \(([^)]+)\)/.exec(combined)
      const discarded = /Path B descartado tras (\d+)ms \(([^)]+)\)/.exec(combined)
      const pathBMs = /Path B ok en (\d+)ms, (\d+) chars/.exec(combined)
      const latinBlocks = /Path A — (\d+) bloques, (\d+) chars/.exec(combined)
      const schemaReject = /Extracción inválida[^\n]*/.exec(combined)
      const latin = /fallback OCR_LATIN/.test(combined)
      resolve({
        file: relPath,
        bytes: st.size,
        exitCode: timedOut ? -1 : code,
        timedOut,
        ms,
        ocrPath: pathBMs ? 'B_multimodal' : latin ? 'A_latin_fallback' : null,
        pathBMs: pathBMs ? Number(pathBMs[1]) : discarded ? Number(discarded[1]) : null,
        ocrChars: pathBMs ? Number(pathBMs[2]) : latinBlocks ? Number(latinBlocks[2]) : null,
        latinBlocks: latinBlocks ? Number(latinBlocks[1]) : null,
        pathBError:
          fatal?.[1] ?? discarded?.[2] ?? (timedOut ? `timeout ${TIMEOUT_MS}ms` : null),
        schemaRejected: schemaReject?.[0] ?? null,
        stderrTail: stderr.slice(-800),
        invoice: parsed?.parsed?.invoice ?? parsed?.invoice ?? null,
        quality: parsed?.parsed?.quality ?? null,
        rawTextPreview: parsed?.parsed?.rawTextPreview ?? null,
        match: parsed?.match ?? null,
        ok: !timedOut && code === 0 && Boolean(parsed?.parsed?.invoice || parsed?.invoice)
      })
    })
  })
}

await mkdir(outDir, { recursive: true })
console.log('🍐 Bench ingest ×4 — 1 proceso por factura\n')

const wall0 = performance.now()
const runs = []
for (let i = 0; i < FILES.length; i++) {
  console.log(`── [${i + 1}/4] ${FILES[i]} ──`)
  const row = await runIngest(FILES[i])
  runs.push(row)
  console.log(
    JSON.stringify(
      {
        ms: row.ms,
        ok: row.ok,
        ocrPath: row.ocrPath,
        pathBMs: row.pathBMs,
        ocrChars: row.ocrChars,
        pathBError: row.pathBError,
        schemaRejected: row.schemaRejected,
        vendor: row.invoice?.vendor,
        invoiceNumber: row.invoice?.invoiceNumber,
        total: row.invoice?.total,
        match: row.match?.status,
        vendorSimilarity: row.match?.vendorSimilarity
      },
      null,
      2
    )
  )
}

const ok = runs.filter((r) => r.ok)
const avg = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null)

const report = {
  generatedAt: new Date().toISOString(),
  mode: 'process-isolated',
  wallMs: +(performance.now() - wall0).toFixed(1),
  summary: {
    okCount: ok.length,
    count: runs.length,
    pathB: runs.filter((r) => r.ocrPath === 'B_multimodal').length,
    pathA: runs.filter((r) => r.ocrPath === 'A_latin_fallback').length,
    avgMs: avg(runs.map((r) => r.ms)),
    maxMs: Math.max(...runs.map((r) => r.ms)),
    sumMs: +runs.reduce((a, r) => a + r.ms, 0).toFixed(1)
  },
  runs,
  productFindings: [
    'Aislamiento por proceso: cada ingest carga/descarga modelos — mide costo real de CLI.',
    'Si Path B crashea el worker (0xC0000005), el proceso muere; el siguiente arranca limpio.',
    'Cuello típico: load OCR multimodal + inferencia imagen (~20–40s cold).',
    'Segundo cuello: schema LLM (Qwen) tras OCR.',
    'match_po sin OCs → no_po_candidates (producto incompleto para 3-way match).'
  ]
}

const jsonPath = path.join(outDir, 'bench-ingest-series-proc.json')
const mdPath = path.join(outDir, 'bench-ingest-series-proc.md')
await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')

const md = `# Bench ingest ×4 — procesos aislados

Generado: ${report.generatedAt}  
Wall: **${report.wallMs} ms**

| OK | Path B | Fallback LATIN | Avg | Max | Sum |
|----|--------|----------------|-----|-----|-----|
| ${report.summary.okCount}/${report.summary.count} | ${report.summary.pathB} | ${report.summary.pathA} | ${report.summary.avgMs} ms | ${report.summary.maxMs} ms | ${report.summary.sumMs} ms |

## Por factura

${runs
  .map(
    (r) => `### ${r.file}
- **${r.ms} ms** · ok=${r.ok} · path=\`${r.ocrPath}\` · exit=${r.exitCode}
- OCR: ${r.pathBMs ?? '—'} ms, ${r.ocrChars ?? '—'} chars${r.latinBlocks ? `, ${r.latinBlocks} bloques LATIN` : ''}
- invoice: ${r.invoice ? `${r.invoice.vendor} / #${r.invoice.invoiceNumber} / total=${r.invoice.total}` : '—'}
- match: ${r.match?.status ?? '—'}${r.match?.vendorSimilarity !== undefined ? ` (vendorSim=${r.match.vendorSimilarity})` : ''}
- pathBError: ${r.pathBError ?? '—'}
- schemaRejected: ${r.schemaRejected ?? '—'}
`
  )
  .join('\n')}

## Hallazgos producto

${report.productFindings.map((f) => `- ${f}`).join('\n')}

JSON: \`${path.relative(root, jsonPath)}\`
`

await writeFile(mdPath, md, 'utf8')
console.log(`\n✅ ${jsonPath}\n✅ ${mdPath}`)
