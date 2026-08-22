/**
 * QVAC OCR wrapper — Path B (OCR_3B_MULTIMODAL_Q4_0) para facturas reales.
 * Fallback Path A (OCR_LATIN) si el worker multimodal aborta.
 * En Windows, Path A primero (Path B suele SIGABRT / ACCESS_VIOLATION).
 * Override: QVAC_OCR_PATH=latin|multimodal|auto
 *
 * Permalink jurado QVAC: workspace/plugins/plugin-invoice-ops/ocr.ts
 */

import { completion, loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'
import {
  clearStaleWorkerLock,
  getOcrModelId,
  resetQvacRuntime
} from './qvac-client.js'
import { resolveInvoiceImagePath } from './image-input.js'

const CTX_SIZE = Number(process.env.QVAC_CTX_SIZE || 4096)

type OcrPath = 'auto' | 'latin' | 'multimodal'

function resolveOcrPath(): OcrPath {
  const raw = (process.env.QVAC_OCR_PATH || 'auto').toLowerCase()
  if (raw === 'latin' || raw === 'multimodal' || raw === 'auto') return raw
  return 'auto'
}

function preferLatinFirst(): boolean {
  const mode = resolveOcrPath()
  if (mode === 'latin') return true
  if (mode === 'multimodal') return false
  return process.platform === 'win32'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  const final = await run.final
  return (final.contentText ?? '').trim()
}

async function ocrWithLatinPipeline(imagePath: string): Promise<string> {
  clearStaleWorkerLock()
  const modelId = await loadModel({ modelSrc: OCR_LATIN })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    return result.map((block) => block.text).join('\n').trim()
  } finally {
    try {
      await unloadModel({ modelId })
    } catch {
      // ignore unload errors after crash paths
    }
  }
}

async function ocrWithLatinRetry(imagePath: string, attempts = 3): Promise<string> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      await resetQvacRuntime()
      await sleep(350 * (i + 1))
      return await ocrWithLatinPipeline(imagePath)
    } catch (err) {
      lastError = err
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[ocr] OCR_LATIN attempt ${i + 1}/${attempts} failed: ${message}`)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function ocrInvoice(filePath: string): Promise<string> {
  const imagePath = await resolveInvoiceImagePath(filePath)
  console.log(`[ocr] ctx_size=${CTX_SIZE}, image=${imagePath}`)

  clearStaleWorkerLock()

  let text = ''

  if (preferLatinFirst()) {
    console.log('[ocr] Path A — OCR_LATIN (preferred on this platform)')
    try {
      text = await ocrWithLatinRetry(imagePath)
    } catch (latinErr) {
      if (resolveOcrPath() === 'latin') throw latinErr
      console.warn(
        `[ocr] Path A failed (${latinErr instanceof Error ? latinErr.message : latinErr}) — try OCR_3B`
      )
      await resetQvacRuntime()
      await sleep(300)
      text = await ocrWithMultimodal(imagePath)
    }
  } else {
    try {
      console.log('[ocr] Path B — OCR_3B_MULTIMODAL_Q4_0')
      text = await ocrWithMultimodal(imagePath)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[ocr] Path B failed (${message}) — fallback OCR_LATIN`)
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
