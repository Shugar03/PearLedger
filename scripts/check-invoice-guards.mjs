/**
 * Chequeo rápido de las guardas de calidad de ingest, sin cargar modelos QVAC:
 * heurísticas de validación de factura + similitud de proveedor.
 */

import assert from 'node:assert/strict'
import { assessInvoice } from '../dist/workspace/plugins/plugin-invoice-ops/schema.js'
import { vendorSimilarity } from '../dist/workspace/plugins/plugin-invoice-ops/matcher.js'

function invoice(overrides = {}) {
  return {
    vendor: 'La Rana Suministros',
    invoiceNumber: 'F-004',
    date: '2026-08-01',
    lineItems: [{ description: 'Cajas', quantity: 10, unitPrice: 10, total: 100 }],
    subtotal: 100,
    tax: 21,
    total: 121,
    currency: 'USD',
    ...overrides
  }
}

const cases = [
  ['factura limpia', invoice(), true],
  ['invoiceNumber con coordenadas', invoice({ invoiceNumber: '120, 480, 300' }), false],
  ['vendor con dirección', invoice({ vendor: '742 Evergreen Terrace' }), false],
  ['vendor con código postal', invoice({ vendor: 'Springfield 49007' }), false],
  ['total en cero', invoice({ total: 0 }), false],
  ['sin ítems', invoice({ lineItems: [] }), false],
  ['aritmética que no cierra', invoice({ tax: 500 }), true]
]

for (const [label, value, expectOk] of cases) {
  const { ok, issues } = assessInvoice(value)
  assert.equal(ok, expectOk, `${label}: esperaba ok=${expectOk}, issues=${JSON.stringify(issues)}`)
  console.log(`ok=${String(ok).padEnd(5)} ${label}${issues.length ? ` (${issues.map((i) => i.field).join(',')})` : ''}`)
}

console.log('')

const pairs = [
  ['La Rana Suministros', 'La Rana Suministros S.A.'],
  ['La Rana Suministros', 'Larana Suministros'],
  ['ACME Corp', 'ACME Corporation'],
  ['La Rana Suministros', 'ACME Corp'],
  ['742 Evergreen Terrace', 'ACME Corp'],
  ['', 'ACME Corp']
]

for (const [a, b] of pairs) {
  console.log(`sim=${vendorSimilarity(a, b).toFixed(3)}  "${a}" vs "${b}"`)
}
