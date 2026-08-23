/**
 * Ciclo de vida de los modelos QVAC — carga perezosa por rol.
 *
 * El runtime puede desalojar un modelo al cargar otro, así que al (re)cargar uno
 * invalidamos el cache de sus hermanos: quedarse con un `modelId` muerto produce
 * fallos opacos mucho más tarde.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import {
  close,
  loadModel,
  unloadModel,
  OCR_3B_MULTIMODAL_Q4_0,
  MMPROJ_OCR_3B_MULTIMODAL_Q8_0,
  QWEN3_1_7B_INST_Q4,
  GTE_LARGE_FP16
} from '@qvac/sdk'

import { getConfig } from '@config/index.js'
import { getLogger } from '@shared/logger.js'

const log = getLogger('invoice-ops:qvac')

/** Cargar los embeddings puede tardar bastante la primera vez. */
const EMBEDDING_LOAD_TIMEOUT_MS = 180_000

let ocrModelId: string | null = null
let llmModelId: string | null = null
let embeddingModelId: string | null = null

function ctxSize(): number {
  return getConfig().qvac.ctxSize
}

function qvacHome(): string {
  return getConfig().qvac.home || path.join(os.homedir(), '.qvac')
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Borra el `.worker.lock` que deja un worker de Bare al morir (típico en Windows). */
export function clearStaleWorkerLock(): void {
  const lockPath = path.join(qvacHome(), '.worker.lock')
  try {
    if (!fs.existsSync(lockPath)) return
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: number }
    if (typeof raw.pid === 'number' && isPidAlive(raw.pid)) return
    fs.unlinkSync(lockPath)
    log.warn(`lock de worker huérfano eliminado (pid ${raw.pid ?? 'desconocido'})`)
  } catch {
    // best-effort: si no se puede limpiar, el load posterior dará el error real
  }
}

export async function getOcrModelId(): Promise<string> {
  if (ocrModelId) return ocrModelId

  // Cargar OCR puede desalojar LLM / embeddings de memoria.
  llmModelId = null
  embeddingModelId = null

  clearStaleWorkerLock()
  ocrModelId = await loadModel({
    modelSrc: OCR_3B_MULTIMODAL_Q4_0,
    modelConfig: {
      ctx_size: ctxSize(),
      projectionModelSrc: MMPROJ_OCR_3B_MULTIMODAL_Q8_0
    }
  })
  return ocrModelId
}

export async function getLlmModelId(): Promise<string> {
  if (llmModelId) return llmModelId

  ocrModelId = null
  embeddingModelId = null

  clearStaleWorkerLock()
  llmModelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: ctxSize() }
  })
  return llmModelId
}

export async function getEmbeddingModelId(): Promise<string> {
  if (embeddingModelId) return embeddingModelId

  ocrModelId = null
  llmModelId = null

  clearStaleWorkerLock()
  embeddingModelId = await loadModel(
    { modelSrc: GTE_LARGE_FP16 },
    { timeout: EMBEDDING_LOAD_TIMEOUT_MS }
  )
  return embeddingModelId
}

/** Olvida los `modelId` cacheados sin tocar el runtime. Lo usan los benchmarks. */
export function resetQvacModelCache(): void {
  ocrModelId = null
  llmModelId = null
  embeddingModelId = null
}

/**
 * Tras un crash del worker de Bare los `modelId` cacheados están muertos y los
 * locks de fd siguen ahí. Cerramos el RPC y limpiamos el cache para que el
 * reintento pueda levantar un worker nuevo.
 */
export async function resetQvacRuntime(): Promise<void> {
  const ids = [ocrModelId, llmModelId, embeddingModelId].filter(
    (id): id is string => typeof id === 'string'
  )
  resetQvacModelCache()

  for (const modelId of ids) {
    try {
      await unloadModel({ modelId, autoClose: false })
    } catch {
      // el worker puede estar ya muerto
    }
  }

  try {
    await close()
  } catch {
    // idem
  }

  clearStaleWorkerLock()
}

let modelsPreloaded = false

/**
 * Precarga embeddings y LLM para procesos de larga vida (dashboard/Electron).
 * DocTR se carga por request en `ocr.ts` y se descarga al terminar cada OCR.
 */
export async function preloadQvacModels(): Promise<void> {
  if (modelsPreloaded) return
  clearStaleWorkerLock()
  log.info('precargando modelos QVAC (embeddings + LLM)...')
  await getEmbeddingModelId()
  await getLlmModelId()
  modelsPreloaded = true
  log.info('modelos QVAC listos')
}

export function isServiceMode(): boolean {
  return getConfig().service.mode
}

/**
 * Cierra el runtime QVAC al terminar un comando CLI.
 *
 * `unloadModel` sólo cierra el RPC automáticamente cuando se descarga el último
 * modelo. Nosotros dejábamos el LLM cargado tras `ingest`, así que el proceso
 * quedaba colgado minutos después de imprimir el JSON.
 */
export async function shutdownQvacRuntime(options?: { force?: boolean }): Promise<void> {
  if (isServiceMode() && !options?.force) return
  const ids = [ocrModelId, llmModelId, embeddingModelId].filter(
    (id): id is string => typeof id === 'string'
  )
  resetQvacModelCache()

  for (const modelId of ids) {
    try {
      await unloadModel({ modelId, clearStorage: false })
    } catch {
      // el worker puede estar ya muerto
    }
  }

  try {
    await close()
  } catch {
    // idem
  }

  clearStaleWorkerLock()
}
