import type { Harness } from '../../../harness/core.ts'
import { runOcr, parseInvoiceText } from './ocr.ts'
import { matchPurchaseOrder } from './matcher.ts'

export const name = 'plugin-invoice-ops'

export async function register(h: Harness): Promise<void> {
  h.registerTool({
    name: 'parse_invoice',
    description: 'OCR local + extracción estructurada de factura (QVAC Path B)',
    plugin: name,
    handler: async ({ file }) => {
      const filePath = String(file)
      const rawText = await runOcr(filePath)
      const invoice = await parseInvoiceText(rawText)
      return { invoice, rawTextPreview: rawText.slice(0, 200) }
    },
  })

  h.registerTool({
    name: 'match_purchase_order',
    description: '3-Way Match contra órdenes de compra indexadas (RAG)',
    plugin: name,
    handler: async ({ invoice }) => {
      return matchPurchaseOrder(invoice as Parameters<typeof matchPurchaseOrder>[0])
    },
  })
}
