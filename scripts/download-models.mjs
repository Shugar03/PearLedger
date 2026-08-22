#!/usr/bin/env node

/**
 * Descarga modelos QVAC requeridos para PearLedger.
 * ~5 GB total — ejecutar antes del demo.
 *
 * Modelos:
 *  - QWEN3_1_7B-Q4_0 (~1.1 GB) — LLM tool calling
 *  - OCR_3B_MULTIMODAL_Q4_0 (~3 GB + 1 GB mmproj) — OCR Path B
 *  - GTE_LARGE_FP16 (~670 MB) — embeddings RAG
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const MODELS = [
  {
    name: 'qwen3-1.7b-q4_0.bin',
    note: 'QWEN3_1_7B — tool calling recomendado'
  },
  {
    name: 'ocr-3b-multimodal-q4_0.bin',
    note: 'OCR_3B_MULTIMODAL_Q4_0 — Path B facturas reales'
  },
  {
    name: 'gte-large-fp16.bin',
    note: 'GTE_LARGE_FP16 — embeddings purchase-orders RAG'
  }
]

const modelsDir = path.join(process.cwd(), 'models')
await mkdir(modelsDir, { recursive: true })

console.log('🍐 PearLedger — Descarga de modelos QVAC\n')
console.log('Descargar manualmente desde el registry QVAC:')
console.log('  https://docs.qvac.tether.io/sdk/getting-started/\n')

for (const m of MODELS) {
  console.log(`  models/${m.name}`)
  console.log(`    → ${m.note}\n`)
}

console.log('Después de descargar, verificar ctx_size=4096 en qvac.config.json')
console.log('Probar: npm run dev -- ingest ./workspace/invoices/sample.pdf')
