#!/usr/bin/env node

/**
 * Descarga modelos QVAC requeridos para PearLedger vía registry P2P/HTTP.
 * ~5 GB total — ejecutar antes del demo.
 *
 * Modelos:
 *  - QWEN3_1_7B_INST_Q4 (~1.1 GB) — LLM tool calling
 *  - OCR_3B_MULTIMODAL_Q4_0 (~1.7 GB + mmproj) — OCR Path B
 *  - GTE_LARGE_FP16 (~670 MB) — embeddings RAG
 */

import { mkdir, symlink, access, unlink, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  close,
  loadModel,
  unloadModel,
  GTE_LARGE_FP16,
  QWEN3_1_7B_INST_Q4,
  OCR_3B_MULTIMODAL_Q4_0,
  MMPROJ_OCR_3B_MULTIMODAL_F16
} from '@qvac/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const modelsDir = path.join(root, 'models')

const MODELS = [
  {
    alias: 'gte-large-fp16.bin',
    label: 'GTE_LARGE_FP16 — embeddings RAG',
    src: GTE_LARGE_FP16,
    config: {}
  },
  {
    alias: 'qwen3-1.7b-q4_0.bin',
    label: 'QWEN3_1_7B_INST_Q4 — LLM tool calling',
    src: QWEN3_1_7B_INST_Q4,
    config: { ctx_size: 4096 }
  },
  {
    alias: 'ocr-3b-multimodal-q4_0.bin',
    label: 'OCR_3B_MULTIMODAL_Q4_0 — OCR Path B facturas',
    src: OCR_3B_MULTIMODAL_Q4_0,
    config: {
      ctx_size: 4096,
      projectionModelSrc: MMPROJ_OCR_3B_MULTIMODAL_F16
    }
  }
]

function formatProgress(progress) {
  const pct = progress.percentage ?? progress.percent ?? progress.progress
  const downloaded = progress.downloadedBytes ?? progress.bytesDownloaded
  const total = progress.totalBytes ?? progress.bytesTotal
  if (pct != null) return `${Math.round(pct)}%`
  if (downloaded != null && total != null) {
    return `${Math.round((downloaded / total) * 100)}% (${downloaded}/${total})`
  }
  return JSON.stringify(progress)
}

async function findInQvacCache(filenameHint) {
  const cacheRoot = path.join(process.env.HOME || '', '.qvac', 'models')
  const files = await readdir(cacheRoot)
  const match = files.find((f) => f.endsWith('.gguf') && f.includes(filenameHint))
  if (!match) return null
  return path.join(cacheRoot, match)
}

async function linkCachedModel(alias, modelSrc) {
  const linkPath = path.join(modelsDir, alias)
  try {
    await access(linkPath)
    await unlink(linkPath)
  } catch {
    // no existing link
  }

  const hint = modelSrc.modelId?.replace(/\.gguf$/, '') ?? alias.replace(/\.bin$/, '')
  const cached = await findInQvacCache(hint)
  if (cached) {
    await symlink(cached, linkPath)
    return cached
  }

  console.warn(`  ⚠ No se pudo crear symlink para ${alias}; hint=${hint}`)
  return null
}

await mkdir(modelsDir, { recursive: true })

console.log('🍐 PearLedger — Descarga de modelos QVAC\n')
console.log(`Destino cache/symlinks: ${modelsDir}\n`)

for (const model of MODELS) {
  console.log(`▸ ${model.label}`)
  console.log(`  Registry: ${model.src.name}`)

  const modelId = await loadModel({
    modelSrc: model.src,
    modelConfig: model.config,
    onProgress: (progress) => {
      process.stdout.write(`\r  Descargando… ${formatProgress(progress)}`)
    }
  })

  console.log(`\n  ✓ Cargado: ${modelId}`)
  const linked = await linkCachedModel(model.alias, model.src)
  if (linked) console.log(`  ✓ Symlink: models/${model.alias} → ${linked}`)

  await unloadModel({ modelId, clearStorage: false })
}

await close()

console.log('\n✅ Descarga completada.')
console.log('Verificar ctx_size=4096 en qvac.config.json')
console.log('Probar: npm run dev -- ingest ./workspace/invoices/sample.pdf')
