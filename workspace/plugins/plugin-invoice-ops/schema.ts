import { z } from 'zod'

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

/** Structured output separado de tool calls (QVAC devuelve 400 si se combinan). */
export function parseInvoiceSchema(rawText: string): Invoice {
  // TODO: segunda llamada LLM con structured output Zod
  return InvoiceSchema.parse({
    vendor: 'Proveedor Demo',
    invoiceNumber: 'INV-001',
    date: new Date().toISOString().slice(0, 10),
    lineItems: [{ description: 'Material', quantity: 1, unitPrice: 100, total: 100 }],
    subtotal: 100,
    tax: 0,
    total: 100,
    currency: 'USD'
  })
}

export { InvoiceSchema as schema }
