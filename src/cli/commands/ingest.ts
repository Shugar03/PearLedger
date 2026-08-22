/**
 * Comando `ingest` — OCR local de una factura y conciliación 3-way contra las
 * órdenes de compra.
 */
import type { Command } from '@cli/types.js'

interface ParsedInvoice {
  invoice?: { invoiceNumber?: string; invoiceId?: string; vendor?: string }
  invoiceNumber?: string
  vendor?: string
  blocked?: boolean
}

/**
 * `parse_invoice` devuelve `{invoice, quality, rawTextPreview}`, pero se acepta
 * también una factura plana por compatibilidad con integradores previos.
 */
function extractInvoice(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null
  const value = parsed as ParsedInvoice
  if (value.blocked) return null
  if (value.invoice && typeof value.invoice === 'object') {
    return value.invoice as Record<string, unknown>
  }
  if (value.invoiceNumber || value.vendor) return value as Record<string, unknown>
  return null
}

export const ingest: Command = async (input, ctx) => {
  const file = input.args[0]
  if (!file) throw new Error('Uso: pearledger ingest <archivo.pdf|png>')

  const parsed = await ctx.harness.execute('parse_invoice', { filePath: file })

  const invoice = extractInvoice(parsed)
  if (!invoice) return { parsed, match: null }

  const invoiceId =
    (invoice.invoiceNumber as string) ?? (invoice.invoiceId as string) ?? 'unknown'

  const match = await ctx.harness.execute('match_purchase_order', { invoiceId, invoice })
  return { parsed, match }
}
