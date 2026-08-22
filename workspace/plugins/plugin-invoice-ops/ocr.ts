/**
 * QVAC OCR wrapper — Path B (OCR_3B_MULTIMODAL_Q4_0) para facturas reales.
 * ctx_size ≥ 4096 configurado en qvac.config.json
 *
 * Permalink jurado QVAC: workspace/plugins/plugin-invoice-ops/ocr.ts
 */

const CTX_SIZE = Number(process.env.QVAC_CTX_SIZE || 4096)

export async function ocrInvoice(filePath: string): Promise<string> {
  // TODO: integrar @qvac/sdk cuando modelos estén descargados
  // import { loadModel, ocr, OCR_3B_MULTIMODAL_Q4_0, unloadModel } from '@qvac/sdk'
  console.log(`[ocr] ctx_size=${CTX_SIZE}, file=${filePath}`)
  console.log('[ocr] Stub — descargar modelos con: npm run models:download')

  return `[OCR stub] Contenido extraído de ${filePath}`
}
