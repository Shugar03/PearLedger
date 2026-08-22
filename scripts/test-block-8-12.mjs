#!/usr/bin/env node

/**
 * Smoke bloque 8–12h: parse_invoice → match_purchase_order (RAG 3-way).
 *
 * Usage:
 *   node --env-file=.env scripts/test-block-8-12.mjs
 */

import { access } from 'node:fs/promises'
import { loadPlugins, harness } from '../dist/harness/loader.js'
import { registerDefaultHooks } from '../dist/harness/hooks.js'

await loadPlugins()
registerDefaultHooks(harness)

console.log('🍐 Bloque 8–12h — RAG 3-Way Match smoke\n')

const invoicePath = './workspace/invoices/sample.png'
try {
  await access(invoicePath)
} catch {
  console.error(`Falta ${invoicePath} — generá companion PNG de la factura demo`)
  process.exit(1)
}

console.log('▸ parse_invoice')
const parsed = await harness.execute('parse_invoice', { filePath: invoicePath })
console.log(JSON.stringify(parsed, null, 2))

const invoice = parsed?.invoice
if (!invoice) {
  console.error('parse_invoice no devolvió invoice')
  process.exit(1)
}

console.log('\n▸ match_purchase_order')
const match = await harness.execute('match_purchase_order', {
  invoiceId: invoice.invoiceNumber,
  invoice
})
console.log(JSON.stringify(match, null, 2))

if (match.matched || match.purchaseOrderId === 'PO-2026-001') {
  console.log('\n✅ Match smoke OK')
} else {
  console.log(`\n⚠ Match status=${match.status} confidence=${match.confidence}`)
  process.exitCode = match.purchaseOrderId ? 0 : 1
}
