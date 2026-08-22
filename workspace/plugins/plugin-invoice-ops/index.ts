/**
 * plugin-invoice-ops — Ingesta y conciliación de facturas.
 * Permalink jurado: workspace/plugins/plugin-invoice-ops/
 */

import { registerTools } from '../../../harness/loader.js'
import type { Harness } from '../../../harness/core.js'
import { ocrInvoice } from './ocr.js'
import { matchPurchaseOrder } from './matcher.js'
import { parseInvoiceSchema, type Invoice } from './schema.js'

export const name = 'plugin-invoice-ops'

export async function register(_h: Harness) {
  registerTools(
    [
      {
        name: 'parse_invoice',
        description: 'OCR local + extracción estructurada de factura PDF',
        handler: async ({ filePath }: { filePath?: string }) => {
          if (!filePath) throw new Error('filePath required')
          const rawText = await ocrInvoice(filePath)
          const invoice = await parseInvoiceSchema(rawText)
          return {
            invoice,
            rawTextPreview: rawText.slice(0, 500)
          }
        }
      },
      {
        name: 'match_purchase_order',
        description: '3-Way Match contra purchase-orders via RAG',
        handler: async (params: { invoiceId?: string; invoice?: Invoice }) => {
          return matchPurchaseOrder({
            invoiceId: params.invoiceId,
            invoice: params.invoice
          })
        }
      }
    ],
    name
  )
}
