/**
 * Ciclo de vida de los modelos QVAC — carga perezosa por rol.
 *
 * El runtime puede desalojar un modelo al cargar otro, así que al (re)cargar uno
 * invalidamos el cache de sus hermanos: quedarse con un `modelId` muerto produce
 * fallos opacos mucho más tarde.
 *
 * En `PEARLEDGER_SERVICE_MODE` DocTR (y EasyOCR) se mantienen cargados entre
 * facturas; embeddings/LLM los invalidan al cargar, y `rewarmDoctrIfService`
 * los vuelve a calentar en background tras el match.
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
  OCR_DOCTR,
  OCR_LATIN,
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
let doctrModelId: string | null = null
let latinModelId: string | null = null

/** Evita apilar varios rewarm DocTR en paralelo. */
let doctrRewarmInFlight: Promise<void> | null = null
/** Coalesce de loadModel concurrentes (rewarm + OCR). */
let doctrLoadInFlight: Promise<string> | null = null
let latinLoadInFlight: Promise<string> | null = null

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

function invalidateOnnxOcrCache(): void {
  doctrModelId = null
  latinModelId = null
}

function invalidateExceptOnnxOcr(): void {
  ocrModelId = null
  llmModelId = null
  embeddingModelId = null
}

export function hasDoctrModel(): boolean {
  return doctrModelId !== null
}

export function hasLatinModel(): boolean {
  return latinModelId !== null
}

export async function getDoctrModelId(): Promise<string> {
  if (doctrModelId) return doctrModelId
  if (doctrLoadInFlight) return doctrLoadInFlight

  doctrLoadInFlight = (async () => {
    invalidateExceptOnnxOcr()
    latinModelId = null

    clearStaleWorkerLock()
    const startedAt = Date.now()
    doctrModelId = await loadModel({ modelSrc: OCR_DOCTR })
    log.info(`DocTR cargado en ${Date.now() - startedAt}ms`)
    return doctrModelId
  })().finally(() => {
    doctrLoadInFlight = null
  })

  return doctrLoadInFlight
}

export async function getLatinModelId(): Promise<string> {
  if (latinModelId) return latinModelId
  if (latinLoadInFlight) return latinLoadInFlight

  latinLoadInFlight = (async () => {
    invalidateExceptOnnxOcr()
    doctrModelId = null

    clearStaleWorkerLock()
    const startedAt = Date.now()
    latinModelId = await loadModel({ modelSrc: OCR_LATIN })
    log.info(`EasyOCR cargado en ${Date.now() - startedAt}ms`)
    return latinModelId
  })().finally(() => {
    latinLoadInFlight = null
  })

  return latinLoadInFlight
}

/**
 * En CLI one-shot descarga el motor ONNX tras el OCR para que el proceso pueda
 * salir. En service mode el modelo queda pinneado.
 */
export async function releaseOnnxOcrIfCli(engine: 'doctr' | 'latin'): Promise<void> {
  if (isServiceMode()) return

  const modelId = engine === 'doctr' ? doctrModelId : latinModelId
  if (engine === 'doctr') doctrModelId = null
  else latinModelId = null

  if (!modelId) return
  try {
    await unloadModel({ modelId, clearStorage: false })
  } catch {
    // el worker puede haber muerto ya
  }
}

export async function getOcrModelId(): Promise<string> {
  if (ocrModelId) return ocrModelId

  // Cargar OCR multimodal puede desalojar LLM / embeddings / DocTR.
  llmModelId = null
  embeddingModelId = null
  invalidateOnnxOcrCache()

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
  invalidateOnnxOcrCache()

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
  invalidateOnnxOcrCache()

  clearStaleWorkerLock()
  embeddingModelId = await loadModel(
    { modelSrc: GTE_LARGE_FP16 },
    { timeout: EMBEDDING_LOAD_TIMEOUT_MS }
  )
  return embeddingModelId
}

/**
 * Tras match (embeddings), recalienta DocTR sin bloquear la respuesta.
 * Sólo en service mode; no-op si ya hay un rewarm en curso.
 */
export function rewarmDoctrIfService(): void {
  if (!isServiceMode()) return
  if (doctrModelId) return
  if (doctrRewarmInFlight) return

  doctrRewarmInFlight = getDoctrModelId()
    .then(() => {
      log.info('DocTR re-calentado tras embeddings')
    })
    .catch((err) => {
      log.warn(
        `rewarm DocTR falló: ${err instanceof Error ? err.message : String(err)}`
      )
    })
    .finally(() => {
      doctrRewarmInFlight = null
    })
}

/** Olvida los `modelId` cacheados sin tocar el runtime. Lo usan los benchmarks. */
export function resetQvacModelCache(): void {
  ocrModelId = null
  llmModelId = null
  embeddingModelId = null
  invalidateOnnxOcrCache()
}

function cachedModelIds(): string[] {
  return [ocrModelId, llmModelId, embeddingModelId, doctrModelId, latinModelId].filter(
    (id): id is string => typeof id === 'string'
  )
}

/**
 * Tras un crash del worker de Bare los `modelId` cacheados están muertos y los
 * locks de fd siguen ahí. Cerramos el RPC y limpiamos el cache para que el
 * reintento pueda levantar un worker nuevo.
 */
export async function resetQvacRuntime(): Promise<void> {
  const ids = cachedModelIds()
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
 * Precarga embeddings para procesos de larga vida (dashboard/Electron).
 *
 * DocTR se calienta después del índice RAG vía `warmDoctrForService()` — cargar
 * embeddings para el índice desalojaría DocTR si lo precargáramos antes.
 * El LLM (Qwen) sigue bajo demanda en el primer fallback de `parseInvoiceSchema`.
 */
export async function preloadQvacModels(): Promise<void> {
  if (modelsPreloaded) return
  clearStaleWorkerLock()
  log.info('precargando embeddings QVAC (LLM bajo demanda)...')
  await getEmbeddingModelId()
  modelsPreloaded = true
  log.info('embeddings QVAC listos')
}

/**
 * Carga DocTR y lo deja pinneado en service mode.
 * Llamar tras `ensurePurchaseOrderIndex` para que el índice no lo desaloje.
 */
export async function warmDoctrForService(): Promise<void> {
  if (!isServiceMode()) return
  if (doctrModelId) return
  log.info('precargando DocTR para OCR caliente...')
  await getDoctrModelId()
  log.info('DocTR listo')
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
  const ids = cachedModelIds()
  resetQvacModelCache()

  for (const modelId of ids) {
    try {
      await unloadModel({ modelId, clearStorage: false })
    } catch {
      // el worker puede haber muerto ya
    }
  }

  try {
    await close()
  } catch {
    // idem
  }

  clearStaleWorkerLock()
}
