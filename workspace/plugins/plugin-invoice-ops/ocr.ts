/**
 * QVAC OCR wrapper — Path B (OCR_3B_MULTIMODAL_Q4_0) para facturas reales.
 * Fallback Path A (OCR_LATIN) si el worker multimodal aborta.
 * ctx_size ≥ 4096 configurado en qvac.config.json
 *
 * Permalink jurado QVAC: workspace/plugins/plugin-invoice-ops/ocr.ts
 */

import { completion, loadModel, ocr, OCR_LATIN, unloadModel } from '@qvac/sdk'
import { getOcrModelId } from './qvac-client.js'
import { resolveInvoiceImagePath } from './image-input.js'

const CTX_SIZE = Number(process.env.QVAC_CTX_SIZE || 4096)

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
  const modelId = await loadModel({ modelSrc: OCR_LATIN })
  try {
    const { blocks } = ocr({ modelId, image: imagePath })
    const result = await blocks
    return result.map((block) => block.text).join('\n').trim()
  } finally {
    await unloadModel({ modelId })
  }
}

export async function ocrInvoice(filePath: string): Promise<string> {
  const imagePath = await resolveInvoiceImagePath(filePath)
  console.log(`[ocr] ctx_size=${CTX_SIZE}, image=${imagePath}`)

  let text = ''
  try {
    console.log('[ocr] Path B — OCR_3B_MULTIMODAL_Q4_0')
    text = await ocrWithMultimodal(imagePath)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[ocr] Path B failed (${message}) — fallback OCR_LATIN`)
    text = await ocrWithLatinPipeline(imagePath)
  }

  if (!text) {
    throw new Error('OCR no extrajo texto — verificar imagen y modelos QVAC')
  }

  return text
}
