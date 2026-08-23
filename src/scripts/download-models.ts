/**
 * Descarga los modelos QVAC que PearLedger necesita (~5 GB en total) y deja un
 * enlace estable en `models/` apuntando al blob de la cache del registry.
 *
 * Modelos:
 *  - `GTE_LARGE_FP16` (~670 MB) — embeddings del RAG de órdenes de compra.
 *  - `QWEN3_1_7B_INST_Q4` (~1,1 GB) — LLM de tool calling y structured output.
 *  - `OCR_3B_MULTIMODAL_Q4_0` (~1,7 GB + mmproj) — OCR Path B de facturas.
 *
 * Uso: node --env-file=.env dist/scripts/download-models.js
 */

import process from 'node:process'
import os from 'node:os'
import path from 'node:path'
import { access, copyFile, mkdir, readdir, symlink, unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import {
  close,
  loadModel,
  unloadModel,
  GTE_LARGE_FP16,
  QWEN3_1_7B_INST_Q4,
  OCR_3B_MULTIMODAL_Q4_0,
  MMPROJ_OCR_3B_MULTIMODAL_Q8_0
} from '@qvac/sdk'

import { getConfig } from '@config/index.js'
import { getLogger, writeOut } from '@shared/logger.js'
import { appRoot } from '@shared/paths.js'

const log = getLogger('download-models')

type ProgressHandler = (progress: ProgressLike) => void

/**
 * Cada modelo trae su propio `load()` en vez de un descriptor genérico: los
 * descriptores del registry son literales `readonly` y `loadModel` resuelve la
 * forma de `modelConfig` a partir de ellos. Guardarlos en un campo tipado los
 * ensancharía y se perdería esa comprobación.
 */
interface ModelSpec {
  /** Nombre del enlace en `models/`. */
  alias: string
  label: string
  registry: string
  modelId: string
  load(onProgress: ProgressHandler): Promise<string>
}

const MODELS: readonly ModelSpec[] = [
  {
    alias: 'gte-large-fp16.bin',
    label: 'GTE_LARGE_FP16 — embeddings RAG',
    registry: GTE_LARGE_FP16.name,
    modelId: GTE_LARGE_FP16.modelId,
    load: (onProgress) => loadModel({ modelSrc: GTE_LARGE_FP16, onProgress })
  },
  {
    alias: 'qwen3-1.7b-q4_0.bin',
    label: 'QWEN3_1_7B_INST_Q4 — LLM tool calling',
    registry: QWEN3_1_7B_INST_Q4.name,
    modelId: QWEN3_1_7B_INST_Q4.modelId,
    load: (onProgress) =>
      loadModel({
        modelSrc: QWEN3_1_7B_INST_Q4,
        modelConfig: { ctx_size: 4096 },
        onProgress
      })
  },
  {
    alias: 'ocr-3b-multimodal-q4_0.bin',
    label: 'OCR_3B_MULTIMODAL_Q4_0 — OCR Path B de facturas',
    registry: OCR_3B_MULTIMODAL_Q4_0.name,
    modelId: OCR_3B_MULTIMODAL_Q4_0.modelId,
    load: (onProgress) =>
      loadModel({
        modelSrc: OCR_3B_MULTIMODAL_Q4_0,
        modelConfig: {
          ctx_size: 4096,
          projectionModelSrc: MMPROJ_OCR_3B_MULTIMODAL_Q8_0
        },
        onProgress
      })
  }
]

/** Raíz de la cache del registry QVAC. Nunca se deriva del cwd. */
function qvacCacheRoot(): string {
  return getConfig().qvac.home || path.join(os.homedir(), '.qvac')
}

function modelsDir(): string {
  return path.join(appRoot(), 'models')
}

interface ProgressLike {
  percentage?: number
  percent?: number
  progress?: number
  downloadedBytes?: number
  bytesDownloaded?: number
  totalBytes?: number
  bytesTotal?: number
}

function formatProgress(progress: ProgressLike): string {
  const pct = progress.percentage ?? progress.percent ?? progress.progress
  const downloaded = progress.downloadedBytes ?? progress.bytesDownloaded
  const total = progress.totalBytes ?? progress.bytesTotal
  if (pct != null) return `${Math.round(pct)}%`
  if (downloaded != null && total != null) {
    return `${Math.round((downloaded / total) * 100)}% (${downloaded}/${total})`
  }
  return JSON.stringify(progress)
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function findInQvacCache(filenameHint: string): Promise<string | null> {
  const cacheRoot = path.join(qvacCacheRoot(), 'models')
  try {
    const files = await readdir(cacheRoot)
    const match = files.find((file) => file.endsWith('.gguf') && file.includes(filenameHint))
    return match ? path.join(cacheRoot, match) : null
  } catch {
    return null
  }
}

export interface LinkResult {
  path: string
  mode: 'symlink' | 'copy'
}

/**
 * Enlaza `models/<alias>` al blob descargado. En Windows sin Developer Mode no
 * hay privilegio para symlinks, así que se copia: perder 1,7 GB de disco es
 * preferible a que el modelo no se encuentre.
 */
export async function linkCachedModel(
  alias: string,
  modelSrc: { modelId?: string }
): Promise<LinkResult | null> {
  const linkPath = path.join(modelsDir(), alias)
  if (await exists(linkPath)) await unlink(linkPath)

  const hint = modelSrc.modelId?.replace(/\.gguf$/, '') ?? alias.replace(/\.bin$/, '')
  const cached = await findInQvacCache(hint)
  if (!cached) {
    log.warn(`no se encontró cache para ${alias} (hint=${hint})`)
    return null
  }

  try {
    await symlink(cached, linkPath)
    return { path: cached, mode: 'symlink' }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EPERM' || code === 'EACCES') {
      await copyFile(cached, linkPath)
      return { path: cached, mode: 'copy' }
    }
    throw err
  }
}

export async function main(): Promise<number> {
  await mkdir(modelsDir(), { recursive: true })

  log.info('🍐 PearLedger — descarga de modelos QVAC')
  log.info(`destino de enlaces: ${modelsDir()}`)
  log.info(`cache del registry: ${path.join(qvacCacheRoot(), 'models')}`)

  const downloaded: Array<Record<string, unknown>> = []

  try {
    for (const model of MODELS) {
      log.info(`▸ ${model.label} (registry: ${model.registry})`)

      const modelId = await model.load((progress) => {
        // Barra de progreso en stderr: stdout está reservado al resultado.
        process.stderr.write(`\r  descargando… ${formatProgress(progress)}   `)
      })

      process.stderr.write('\n')
      log.info(`  ✓ cargado: ${modelId}`)

      const linked = await linkCachedModel(model.alias, model)
      if (linked) {
        log.info(`  ✓ models/${model.alias} ← ${linked.path} (${linked.mode})`)
      }

      await unloadModel({ modelId, clearStorage: false })
      downloaded.push({
        alias: model.alias,
        registry: model.registry,
        modelId,
        linked: linked?.path ?? null,
        mode: linked?.mode ?? null
      })
    }
  } finally {
    await close()
  }

  writeOut(
    JSON.stringify(
      {
        modelsDir: modelsDir(),
        models: downloaded,
        next: [
          'Verificá ctx_size=4096 en qvac.config.json',
          'Probá: npm run dev -- ingest ./workspace/invoices/sample.pdf'
        ]
      },
      null,
      2
    )
  )

  return 0
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  return Boolean(entry) && import.meta.url === pathToFileURL(entry!).href
}

if (isMainModule()) {
  process.exitCode = await main()
}
