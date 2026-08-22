#!/usr/bin/env node

/**
 * Smoke tests bloque 3–8h: parse_invoice (QVAC) + balance/quote (WDK Sepolia).
 *
 * Usage:
 *   node --env-file=.env scripts/test-block-3-8.mjs
 */

import { loadPlugins, harness } from '../dist/harness/loader.js'
import { registerDefaultHooks } from '../dist/harness/hooks.js'

await loadPlugins()
registerDefaultHooks(harness)

console.log('🍐 Bloque 3–8h — smoke tests\n')

console.log('▸ parse_invoice (QVAC OCR + structured output)')
const ingest = await harness.execute('parse_invoice', {
  filePath: './workspace/invoices/sample.pdf'
})
console.log(JSON.stringify(ingest, null, 2))

console.log('\n▸ get_wallet_balance (WDK Sepolia)')
const balance = await harness.execute('get_wallet_balance', { network: 'sepolia' })
console.log(JSON.stringify(balance, null, 2))

console.log('\n▸ quote_payment dry-run (WDK Sepolia)')
const quote = await harness.execute('quote_payment', {
  to: '0x0000000000000000000000000000000000000001',
  amount: 1,
  network: 'sepolia'
})
console.log(JSON.stringify(quote, null, 2))

console.log('\n▸ execute_gasless_payment dryRun (default)')
const preview = await harness.execute('execute_gasless_payment', {
  to: '0x0000000000000000000000000000000000000001',
  amount: 1,
  network: 'sepolia'
})
console.log(JSON.stringify(preview, null, 2))

console.log('\n✅ Bloque 3–8h smoke tests completados')
