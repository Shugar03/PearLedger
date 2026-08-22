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

/** Structured output en llamada LLM separada (sin tool calls). */
export async function parseInvoiceSchema(rawText: string): Promise<Invoice> {
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
  return InvoiceSchema.parse(parsed)
}

export { InvoiceSchema as schema }
