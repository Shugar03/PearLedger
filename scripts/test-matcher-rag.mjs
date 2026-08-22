#!/usr/bin/env node

/**
 * Smoke RAG 3-way match sin OCR (invoice sintético).
 * Usage: node --env-file=.env scripts/test-matcher-rag.mjs
 */

import { loadPlugins, harness } from '../dist/harness/loader.js'
import { registerDefaultHooks } from '../dist/harness/hooks.js'

await loadPlugins()
registerDefaultHooks(harness)

console.log('🍐 Matcher RAG smoke (invoice sintético)\n')

const invoice = {
  vendor: 'Proveedor Demo S.A.',
  invoiceNumber: 'INV-001',
  date: '2026-08-22',
  lineItems: [
    {
      description: 'Material de oficina',
      quantity: 1,
      unitPrice: 100,
      total: 100
    }
  ],
  subtotal: 100,
  tax: 0,
  total: 100,
  currency: 'USD'
}

console.log('▸ match_purchase_order')
const match = await harness.execute('match_purchase_order', {
  invoiceId: invoice.invoiceNumber,
  invoice
})
console.log(JSON.stringify(match, null, 2))

if (match.purchaseOrderId === 'PO-2026-001') {
  console.log('\n✅ RAG encontró PO-2026-001')
  process.exitCode = match.matched ? 0 : 0
} else {
  console.log(`\n✖ No match — status=${match.status}`)
  process.exitCode = 1
}
