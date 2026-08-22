#!/usr/bin/env node

/**
 * Smoke WDK Sepolia con PIMLICO_API_KEY.
 * Usage: node --env-file=.env scripts/test-wdk-smoke.mjs
 */

import { loadPlugins, harness } from '../dist/harness/loader.js'
import { registerDefaultHooks } from '../dist/harness/hooks.js'

const hasKey = Boolean(process.env.PIMLICO_API_KEY?.trim())
console.log(`🍐 WDK Sepolia smoke — PIMLICO_API_KEY: ${hasKey ? 'SET' : 'MISSING'}\n`)

await loadPlugins()
registerDefaultHooks(harness)

console.log('▸ get_wallet_balance')
const balance = await harness.execute('get_wallet_balance', { network: 'sepolia' })
console.log(JSON.stringify(balance, null, 2))

console.log('\n▸ quote_payment (1 USDt MOCK)')
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

if (quote.status === 'ok') {
  console.log('\n✅ Quote gasless live OK (Pimlico respondió)')
} else if (quote.status === 'quote_skipped_no_api_key') {
  console.log('\n⚠ Key no leída — revisá .env')
  process.exitCode = 1
} else {
  console.log(`\n⚠ Quote status: ${quote.status}`)
}
