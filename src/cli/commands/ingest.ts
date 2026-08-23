/**
 * Comando `ingest` — OCR local de una factura y conciliación 3-way contra las
 * órdenes de compra. Con `--batch` procesa todos los PDF/PNG de un directorio.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import type { Command } from '@cli/types.js'

interface ParsedInvoice {
  invoice?: { invoiceNumber?: string; invoiceId?: string; vendor?: string }
  invoiceNumber?: string
  vendor?: string
  blocked?: boolean
}

const INVOICE_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp'])

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

async function resolveIngestFiles(target: string, batch: boolean): Promise<string[]> {
  if (!batch) return [target]

  const stat = await fs.stat(target)
  if (!stat.isDirectory()) return [target]

  const entries = await fs.readdir(target)
  return entries
    .filter((name) => INVOICE_EXT.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(target, name))
    .sort()
}

async function ingestOne(
  file: string,
  ctx: Parameters<Command>[1]
): Promise<Record<string, unknown>> {
  const t0 = Date.now()
  const parsed = await ctx.harness.execute('parse_invoice', { filePath: file })
  const invoice = extractInvoice(parsed)
  if (!invoice) {
    return { file, timingMs: { total: Date.now() - t0 }, parsed, match: null }
  }

  const invoiceId =
    (invoice.invoiceNumber as string) ?? (invoice.invoiceId as string) ?? 'unknown'

  const match = await ctx.harness.execute('match_purchase_order', { invoiceId, invoice })
  return {
    file,
    timingMs: { total: Date.now() - t0 },
    parsed,
    match
  }
}

export const ingest: Command = async (input, ctx) => {
  const target = input.args[0]
  if (!target) throw new Error('Uso: pearledger ingest <archivo|directorio> [--batch]')

  const batch = input.flags.batch === true
  const files = await resolveIngestFiles(target, batch)
  if (files.length === 0) throw new Error('No hay facturas PDF/PNG para procesar')

  const wall0 = Date.now()

  if (!batch && files.length === 1) {
    const result = await ingestOne(files[0]!, ctx)
    return { parsed: result.parsed, match: result.match, timingMs: result.timingMs }
  }

  const results = []
  for (const file of files) {
    results.push(await ingestOne(file, ctx))
  }

  return {
    count: results.length,
    wallMs: Date.now() - wall0,
    results
  }
}
