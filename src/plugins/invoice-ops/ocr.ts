/**
 * OCR local sobre QVAC — tres caminos con fallback cruzado:
 *
 *  - **DocTR** (`OCR_DOCTR`) — detector DBNet, ~3 s a resolución completa.
 *    Camino preferido: preserva `$` y tablas mejor que EasyOCR reducido.
 *  - **EasyOCR** (`OCR_LATIN`) — respaldo estable si DocTR falla.
 *  - **Path B** — `OCR_3B_MULTIMODAL` + mmproj Q8. Sólo si se fuerza o en
 *    `auto` tras agotar ONNX; usa imagen reducida para no desbordar ctx.
 *
 * Tras el OCR, los bloques se reagrupan por `bbox` (ver `ocr-layout.ts`) y los
 * importes se normalizan (ver `amounts.ts`) antes de llegar al LLM del schema.
 *
 * `QVAC_OCR_PIPELINE=doctr|latin|multimodal|auto` fuerza el orden.
 * Un modo explícito no hace fallback al siguiente.
 */

import process from 'node:process'

import { cancel, completion, loadModel, ocr, OCR_DOCTR, OCR_LATIN, unloadModel } from '@qvac/sdk'

import { getConfig } from '@config/index.js'
import { getLogger } from '@shared/logger.js'

import { normalizeAmounts } from './amounts.js'
import { resolveInvoiceImagePath } from './image-input.js'
import { layoutOcrBlocks, type OcrBlock } from './ocr-layout.js'
import { clearStaleWorkerLock, getOcrModelId, resetQvacRuntime } from './qvac-client.js'

const log = getLogger('invoice-ops:ocr')

const LATIN_ATTEMPTS = 3

type OcrEngine = 'doctr' | 'latin' | 'multimodal'

class PathBTimeoutError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function pipelineOrder(): OcrEngine[] {
  const { ocrPipeline, ocrPath } = getConfig().qvac

  if (ocrPipeline === 'doctr') return ['doctr']
  if (ocrPipeline === 'latin') return ['latin']
  if (ocrPipeline === 'multimodal') return ['multimodal']

  // Compatibilidad con QVAC_OCR_PATH (legacy).
  if (ocrPath === 'latin') return ['latin']
  if (ocrPath === 'multimodal') return ['multimodal']

  // auto: DocTR primero; en Windows omitimos Path B (inestable).
  if (process.platform === 'win32') return ['doctr', 'latin']
  return ['doctr', 'latin', 'multimodal']
}

function finalizeOcrText(blocks: OcrBlock[]): string {
  const { qvac } = getConfig()
  const layout = layoutOcrBlocks(blocks, { minConfidence: qvac.ocrLowConfidence })
  if (layout.lowConfidenceCount > 0) {
    log.warn(
      `${layout.lowConfidenceCount} bloque(s) con confianza < ${qvac.ocrLowConfidence}`
    )
  }
  return normalizeAmounts(layout.text)
}

async function ocrWithDoctr(imagePath: string): Promise<string> {
  clearStaleWorkerLock()
  const modelId = await loadModel({ modelSrc: OCR_DOCTR })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    const text = finalizeOcrText(result)
    log.info(
      `DocTR — ${result.length} bloques → ${text.split('\n').length} filas, ${text.length} chars`
    )
    if (!text) throw new Error('DocTR no extrajo texto')
    return text
  } finally {
    try {
      await unloadModel({ modelId, clearStorage: false })
    } catch {
      // el worker puede haber muerto ya
    }
  }
}

async function ocrWithLatinPipeline(imagePath: string): Promise<string> {
  clearStaleWorkerLock()
  const modelId = await loadModel({ modelSrc: OCR_LATIN })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    const text = finalizeOcrText(result)
    log.info(
      `EasyOCR — ${result.length} bloques → ${text.split('\n').length} filas, ${text.length} chars`
    )
    if (!text) throw new Error('EasyOCR no extrajo texto')
    return text
  } finally {
    try {
      await unloadModel({ modelId, clearStorage: false })
    } catch {
      // el worker puede haber muerto ya
    }
  }
}

async function ocrWithLatinRetry(imagePath: string, attempts = LATIN_ATTEMPTS): Promise<string> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      await resetQvacRuntime()
      await sleep(350 * (i + 1))
      return await ocrWithLatinPipeline(imagePath)
    } catch (err) {
      lastError = err
      log.warn(`EasyOCR intento ${i + 1}/${attempts} falló: ${describe(err)}`)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function ocrWithMultimodal(imagePath: string): Promise<string> {
  const budgetMs = getConfig().qvac.ocrPathBTimeoutMs
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

  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      void cancel({ requestId: run.requestId }).catch(() => {})
      reject(new PathBTimeoutError(`Path B excedió ${budgetMs} ms`))
    }, budgetMs)
  })

  try {
    const final = await Promise.race([run.final, budget])
    const text = normalizeAmounts((final.contentText ?? '').trim())
    if (!text) throw new Error('Path B no extrajo texto')
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function runEngine(engine: OcrEngine, sourcePath: string): Promise<string> {
  if (engine === 'doctr') return ocrWithDoctr(sourcePath)
  if (engine === 'latin') return ocrWithLatinRetry(sourcePath)

  const { ocrMaxEdge } = getConfig().qvac
  const resized = await resolveInvoiceImagePath(sourcePath, { maxEdge: ocrMaxEdge })
  return ocrWithMultimodal(resized)
}

/** Texto plano de la factura. Lanza si ningún camino extrajo nada. */
export async function ocrInvoice(filePath: string): Promise<string> {
  const { qvac } = getConfig()
  const sourcePath = await resolveInvoiceImagePath(filePath)
  const order = pipelineOrder()

  log.info(
    `pipeline=${order.join('→')}, ctx_size=${qvac.ctxSize}, path_b_budget=${qvac.ocrPathBTimeoutMs}ms, image=${sourcePath}`
  )

  clearStaleWorkerLock()

  const errors: string[] = []
  const allowFallback = order.length > 1

  for (let i = 0; i < order.length; i++) {
    const engine = order[i]!
    const startedAt = Date.now()
    try {
      log.info(`OCR — ${engine}`)
      const text = await runEngine(engine, sourcePath)
      log.info(`OCR ${engine} ok en ${Date.now() - startedAt}ms`)
      return text
    } catch (err) {
      const message = describe(err)
      errors.push(`${engine}: ${message}`)
      log.warn(`OCR ${engine} falló tras ${Date.now() - startedAt}ms (${message})`)

      if (!allowFallback || i === order.length - 1) break

      await resetQvacRuntime()
      await sleep(300)
    }
  }

  throw new Error(
    `OCR no extrajo texto — ${errors.join('; ')}. Verificar imagen y modelos QVAC.`
  )
}
