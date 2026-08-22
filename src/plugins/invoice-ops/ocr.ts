/**
 * OCR local sobre QVAC, con dos caminos y fallback cruzado:
 *
 *  - **Path B** — `OCR_3B_MULTIMODAL_Q4_0` + mmproj Q8. Mejor calidad en
 *    facturas reales, pero caro y con tendencia a abortar; se le pone un
 *    presupuesto de tiempo y se cancela si se pasa.
 *  - **Path A** — `OCR_LATIN`. Rápido y estable; en Windows va primero porque
 *    Path B suele terminar en SIGABRT / ACCESS_VIOLATION.
 *
 * `QVAC_OCR_PATH=latin|multimodal|auto` fuerza el orden. Si se fija un camino
 * concreto, su fallo es definitivo y no se cae al otro: pedirlo explícitamente
 * es una orden, no una preferencia. En `auto` sí hay fallback cruzado.
 *
 * Todo el diagnóstico va por `getLogger()` (stderr). Antes se escribía a stdout
 * y eso rompía la salida `--json`.
 */

import process from 'node:process'

import { cancel, completion, loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'

import { getConfig } from '@config/index.js'
import { getLogger } from '@shared/logger.js'

import { resolveInvoiceImagePath } from './image-input.js'
import { clearStaleWorkerLock, getOcrModelId, resetQvacRuntime } from './qvac-client.js'

const log = getLogger('invoice-ops:ocr')

const LATIN_ATTEMPTS = 3

class PathBTimeoutError extends Error {}

function preferLatinFirst(): boolean {
  const mode = getConfig().qvac.ocrPath
  if (mode === 'latin') return true
  if (mode === 'multimodal') return false
  return process.platform === 'win32'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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
    return (final.contentText ?? '').trim()
  } finally {
    clearTimeout(timer)
  }
}

async function ocrWithLatinPipeline(imagePath: string): Promise<string> {
  clearStaleWorkerLock()
  const modelId = await loadModel({ modelSrc: OCR_LATIN })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    const text = result
      .map((block) => block.text)
      .join('\n')
      .trim()
    log.info(`Path A — ${result.length} bloques, ${text.length} chars`)
    return text
  } finally {
    try {
      await unloadModel({ modelId })
    } catch {
      // el worker puede haber muerto ya; el error real es el de arriba
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
      log.warn(`OCR_LATIN intento ${i + 1}/${attempts} falló: ${describe(err)}`)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/** Texto plano de la factura. Lanza si ningún camino extrajo nada. */
export async function ocrInvoice(filePath: string): Promise<string> {
  const { qvac } = getConfig()
  const imagePath = await resolveInvoiceImagePath(filePath)
  log.info(
    `ctx_size=${qvac.ctxSize}, path_b_budget=${qvac.ocrPathBTimeoutMs}ms, image=${imagePath}`
  )

  clearStaleWorkerLock()

  let text = ''
  const startedAt = Date.now()

  if (preferLatinFirst()) {
    log.info('Path A — OCR_LATIN (preferido en esta plataforma)')
    try {
      text = await ocrWithLatinRetry(imagePath)
    } catch (latinErr) {
      // `latin` es una orden, no una preferencia: no caemos a Path B.
      if (qvac.ocrPath === 'latin') throw latinErr
      log.warn(`Path A falló (${describe(latinErr)}) — se intenta OCR_3B`)
      await resetQvacRuntime()
      await sleep(300)
      text = await ocrWithMultimodal(imagePath)
    }
  } else {
    try {
      log.info('Path B — OCR_3B_MULTIMODAL_Q4_0 + mmproj Q8')
      text = await ocrWithMultimodal(imagePath)
      log.info(`Path B ok en ${Date.now() - startedAt}ms, ${text.length} chars`)
    } catch (err) {
      if (qvac.ocrPath === 'multimodal') throw err
      log.warn(
        `Path B descartado tras ${Date.now() - startedAt}ms (${describe(err)}) — fallback OCR_LATIN`
      )
      await resetQvacRuntime()
      await sleep(400)
      text = await ocrWithLatinRetry(imagePath)
    }
  }

  if (!text) {
    throw new Error('OCR no extrajo texto — verificar imagen y modelos QVAC')
  }

  return text
}
