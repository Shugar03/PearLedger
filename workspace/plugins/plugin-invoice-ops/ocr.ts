/**
 * QVAC OCR wrapper — Path B recomendado para facturas reales
 * @see https://docs.qvac.tether.io/ai-capabilities/ocr/
 */
import { z } from 'zod'

export const InvoiceSchema = z.object({
  vendor: z.string(),
  invoiceNumber: z.string(),
  date: z.string(),
  total: z.number(),
  currency: z.string().default('USD'),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    })
  ),
})

export type Invoice = z.infer<typeof InvoiceSchema>

/**
 * Ejecuta OCR local sobre un PDF/imagen de factura.
 * Path B: OCR_3B_MULTIMODAL_Q4_0 (3B + 1GB mmproj)
 * Path A fallback: OCR_LATIN (~50MB) solo para facturas 100% latín.
 */
export async function runOcr(filePath: string): Promise<string> {
  // TODO: integrar @qvac/sdk cuando modelos estén descargados
  // import { loadModel, ocr, unloadModel, OCR_3B_MULTIMODAL_Q4_0 } from '@qvac/sdk'
  //
  // const modelId = await loadModel({
  //   modelSrc: OCR_3B_MULTIMODAL_Q4_0.src,
  //   modelType: 'ggmlOcr',
  //   modelConfig: { ctxSize: 4096 },
  // })
  // const { blocks } = ocr({ modelId, image: filePath })
  // const result = await blocks
  // await unloadModel(modelId)
  // return result.map(b => b.text).join('\n')

  console.log(`[ocr] stub — procesando ${filePath} con ctx_size=4096`)
  return `FACTURA DEMO\nProveedor: Acme S.A.\nN°: INV-2026-001\nTotal: 250.00 USD`
}

export async function parseInvoiceText(rawText: string): Promise<Invoice> {
  // TODO: llamada LLM separada (NO combinar structured output + tools)
  return InvoiceSchema.parse({
    vendor: 'Acme S.A.',
    invoiceNumber: 'INV-2026-001',
    date: new Date().toISOString().slice(0, 10),
    total: 250,
    currency: 'USD',
    lineItems: [{ description: 'Suministros', quantity: 1, unitPrice: 250 }],
  })
}
