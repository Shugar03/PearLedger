/**
 * QVAC OCR wrapper — Path B (OCR_3B_MULTIMODAL_Q4_0) para facturas reales.
 * Fallback Path A (OCR_LATIN) solo si el error es recuperable (p.ej. ctx overflow).
 * Si el worker Bare crashea, NO se intenta LATIN en el mismo proceso.
 *
 * Permalink jurado QVAC: workspace/plugins/plugin-invoice-ops/ocr.ts
 */

import { cancel, completion, loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'
import { getOcrModelId, resetQvacModelCache } from './qvac-client.js'
import { resolveInvoiceImagePath } from './image-input.js'

const CTX_SIZE = Number(process.env.QVAC_CTX_SIZE || 4096)

/** Path B se aborta pasado este presupuesto y cae a OCR_LATIN. */
const PATH_B_BUDGET_MS = Number(process.env.QVAC_OCR_PATH_B_TIMEOUT_MS || 45_000)

class PathBTimeoutError extends Error {}

function isFatalWorkerError(message: string): boolean {
  return /Bare worker exited|3221225477|ACCESS_VIOLATION|ggml_gallocr|Failed to load vision model|Failed to load model/i.test(
    message
  )
}

async function ocrWithMultimodal(imagePath: string): Promise<string> {
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
      cancel({ requestId: run.requestId }).catch(() => {})
      reject(new PathBTimeoutError(`Path B excedió ${PATH_B_BUDGET_MS} ms`))
    }, PATH_B_BUDGET_MS)
  })

  try {
    const final = await Promise.race([run.final, budget])
    return (final.contentText ?? '').trim()
  } finally {
    clearTimeout(timer)
  }
}

async function ocrWithLatinPipeline(imagePath: string): Promise<string> {
  const modelId = await loadModel({ modelSrc: OCR_LATIN })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    const text = result.map((block) => block.text).join('\n').trim()
    console.log(`[ocr] Path A — ${result.length} bloques, ${text.length} chars`)
    return text
  } finally {
    await unloadModel({ modelId })
  }
}

export async function ocrInvoice(filePath: string): Promise<string> {
  const imagePath = await resolveInvoiceImagePath(filePath)
  console.log(
    `[ocr] ctx_size=${CTX_SIZE}, path_b_budget=${PATH_B_BUDGET_MS}ms, image=${imagePath}`
  )

  let text = ''
  const startedAt = Date.now()
  try {
    console.log('[ocr] Path B — OCR_3B_MULTIMODAL_Q4_0 + mmproj Q8')
    text = await ocrWithMultimodal(imagePath)
    console.log(`[ocr] Path B ok en ${Date.now() - startedAt}ms, ${text.length} chars`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (isFatalWorkerError(message)) {
      resetQvacModelCache()
      console.warn(
        `[ocr] Path B fatal (${message}) — sin fallback LATIN (reiniciar proceso / reintentar)`
      )
      throw new Error(
        `OCR Path B fatal: ${message}. Reintentá en un proceso limpio (no usar OCR_LATIN tras crash de worker).`
      )
    }
    console.warn(
      `[ocr] Path B descartado tras ${Date.now() - startedAt}ms (${message}) — fallback OCR_LATIN`
    )
    text = await ocrWithLatinPipeline(imagePath)
  }

  if (!text) {
    throw new Error('OCR no extrajo texto — verificar imagen y modelos QVAC')
  }

  return text
}
