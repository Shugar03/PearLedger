/**
 * plugin-invoice-ops — ingesta y conciliación de facturas.
 *
 * `parse_invoice` hace OCR local y extracción estructurada; `match_purchase_order`
 * concilia contra las órdenes de compra. El plugin no toca el harness global:
 * recibe su `PluginHost` y registra contra él, de modo que un test puede
 * cargarlo en un harness aislado.
 */

import { registerTools } from '@core/loader.js'
import type { PluginHost, ToolParams } from '@core/types.js'

import { getConfig } from '@config/index.js'

import { ocrInvoice } from './ocr.js'
import { matchPurchaseOrder } from './matcher.js'
import { assessInvoice, parseInvoiceSchema, type Invoice } from './schema.js'

export const name = 'plugin-invoice-ops'

/** Longitud del extracto de OCR que se devuelve para inspección humana. */
const RAW_TEXT_PREVIEW_CHARS = 500

function requiredPath(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('parse_invoice requiere `filePath`')
  }
  return value
}

function optionalInvoice(value: unknown): Invoice | { invoice?: Invoice } | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Invoice | { invoice?: Invoice })
    : undefined
}

function optionalId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

export function register(host: PluginHost): void {
  registerTools(host, name, [
    {
      name: 'parse_invoice',
      description: 'OCR local + extracción estructurada de factura PDF',
      handler: async (params: ToolParams) => {
        const filePath = requiredPath(params.filePath)
        const rawText = await ocrInvoice(filePath)
        const invoice = await parseInvoiceSchema(rawText, {
          strict: getConfig().invoice.strict
        })
        return {
          invoice,
          quality: assessInvoice(invoice),
          rawTextPreview: rawText.slice(0, RAW_TEXT_PREVIEW_CHARS)
        }
      }
    },
    {
      name: 'match_purchase_order',
      description: '3-Way Match contra purchase-orders vía RAG',
      handler: async (params: ToolParams) =>
        matchPurchaseOrder({
          invoiceId: optionalId(params.invoiceId),
          invoice: optionalInvoice(params.invoice)
        })
    }
  ])
}

export { ocrInvoice } from './ocr.js'
export {
  ensurePurchaseOrderIndex,
  matchPurchaseOrder,
  resetPurchaseOrderIndex,
  vendorSimilarity,
  type MatchDiscrepancy,
  type MatchResult,
  type PurchaseOrder
} from './matcher.js'
export {
  assessInvoice,
  parseInvoiceSchema,
  InvoiceSchema,
  type Invoice,
  type InvoiceIssue,
  type InvoiceQuality
} from './schema.js'
export { resolveInvoiceImagePath } from './image-input.js'
export { compareThreeWay, confidenceFrom } from './three-way.js'
export { loadPurchaseOrders } from './purchase-orders.js'
