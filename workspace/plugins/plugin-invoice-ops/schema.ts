import { completion } from '@qvac/sdk'
import { z } from 'zod'
import { getLlmModelId } from './qvac-client.js'

export const InvoiceSchema = z.object({
  vendor: z.string(),
  invoiceNumber: z.string(),
  date: z.string(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      total: z.number()
    })
  ),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  currency: z.string().default('USD')
})

export type Invoice = z.infer<typeof InvoiceSchema>

const INVOICE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    vendor: { type: 'string' },
    invoiceNumber: { type: 'string' },
    date: { type: 'string' },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          total: { type: 'number' }
        },
        required: ['description', 'quantity', 'unitPrice', 'total'],
        additionalProperties: false
      }
    },
    subtotal: { type: 'number' },
    tax: { type: 'number' },
    total: { type: 'number' },
    currency: { type: 'string' }
  },
  required: [
    'vendor',
    'invoiceNumber',
    'date',
    'lineItems',
    'subtotal',
    'tax',
    'total',
    'currency'
  ],
  additionalProperties: false
} as const

export interface InvoiceIssue {
  field: string
  reason: string
  severity: 'error' | 'warning'
}

export interface InvoiceQuality {
  ok: boolean
  issues: InvoiceIssue[]
}

/** Ruido típico de OCR: bounding boxes o coordenadas colándose como identificador. */
function looksLikeCoordinates(value: string): boolean {
  const compact = value.trim()
  if (/^\d+(\.\d+)?\s*[,;]\s*\d+(\.\d+)?/.test(compact)) return true
  return /^\D*\d+(\.\d+)?([\s,;]+\d+(\.\d+)?){2,}\D*$/.test(compact)
}

/** El LLM confunde el bloque de dirección con el nombre del proveedor. */
function looksLikeAddress(value: string): boolean {
  const compact = value.trim()
  if (/^\d{1,6}\s+\S/.test(compact)) return true
  if (/\b\d{5}(-\d{4})?\b/.test(compact)) return true
  return /\b(street|avenue|ave|road|blvd|suite|ste|floor|calle|avenida|piso|dpto|depto|cp)\b/i.test(
    compact
  )
}

function sanitizeInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    vendor: invoice.vendor.trim(),
    invoiceNumber: invoice.invoiceNumber.trim(),
    date: invoice.date.trim(),
    currency: (invoice.currency || 'USD').trim().toUpperCase()
  }
}

/** Heurísticas de calidad sobre el JSON ya validado por Zod. */
export function assessInvoice(invoice: Invoice): InvoiceQuality {
  const issues: InvoiceIssue[] = []
  const push = (field: string, reason: string, severity: InvoiceIssue['severity'] = 'error') =>
    issues.push({ field, reason, severity })

  if (invoice.vendor.length < 2) push('vendor', 'vacío o demasiado corto')
  else if (invoice.vendor.length > 80) push('vendor', 'demasiado largo para un nombre comercial')
  else if (looksLikeAddress(invoice.vendor)) push('vendor', 'parece una dirección, no un proveedor')

  if (!invoice.invoiceNumber) push('invoiceNumber', 'vacío')
  else if (invoice.invoiceNumber.length > 40) push('invoiceNumber', 'demasiado largo')
  else if (looksLikeCoordinates(invoice.invoiceNumber))
    push('invoiceNumber', 'parece coordenadas o bounding box del OCR')

  if (!Number.isFinite(invoice.total) || invoice.total <= 0)
    push('total', 'no es un monto positivo')
  else if (invoice.total > 10_000_000) push('total', 'monto implausible')

  if (invoice.lineItems.length === 0) push('lineItems', 'sin ítems')

  if (!/\d{4}/.test(invoice.date)) push('date', 'sin año reconocible', 'warning')

  if (Number.isFinite(invoice.total) && invoice.total > 0) {
    const arithmeticGap = Math.abs(invoice.subtotal + invoice.tax - invoice.total)
    if (arithmeticGap > Math.max(0.02, invoice.total * 0.02)) {
      push('total', `subtotal + impuesto no cierra (dif. ${arithmeticGap.toFixed(2)})`, 'warning')
    }
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues }
}

/** Structured output en llamada LLM separada (sin tool calls). */
export async function parseInvoiceSchema(
  rawText: string,
  options: { strict?: boolean } = {}
): Promise<Invoice> {
  const modelId = await getLlmModelId()

  const run = completion({
    modelId,
    stream: false,
    history: [
      {
        role: 'system',
        content:
          'You extract structured invoice data from OCR text. Reply only with JSON matching the schema. /no_think'
      },
      {
        role: 'user',
        content: `Extract invoice fields from this OCR text:\n\n${rawText}`
      }
    ],
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'invoice',
        schema: INVOICE_JSON_SCHEMA
      }
    }
  })

  const final = await run.final
  const parsed = JSON.parse((final.contentText ?? '').trim())
  const invoice = sanitizeInvoice(InvoiceSchema.parse(parsed))

  const quality = assessInvoice(invoice)
  for (const issue of quality.issues) {
    console.warn(`[schema] ${issue.severity} ${issue.field}: ${issue.reason}`)
  }

  if (!quality.ok && options.strict !== false) {
    const detail = quality.issues
      .filter((i) => i.severity === 'error')
      .map((i) => `${i.field} (${i.reason})`)
      .join(', ')
    throw new Error(
      `Extracción inválida — el OCR probablemente devolvió ruido: ${detail}. Revisar la imagen o reintentar Path B.`
    )
  }

  return invoice
}

export { InvoiceSchema as schema }
