#!/usr/bin/env node

/**
 * Smoke P2 WDK: balance + quote + dryRun (+ insufficient balance path).
 * Usage: node --env-file=.env scripts/test-p2-wdk.mjs
 */

import { loadPlugins, harness } from '../dist/harness/loader.js'
import { registerDefaultHooks } from '../dist/harness/hooks.js'
import { resolveWdkMcpBin } from '../workers/wdk-worker.js'

await loadPlugins()
registerDefaultHooks(harness)

const hasKey = Boolean(process.env.PIMLICO_API_KEY?.trim())
console.log(`🍐 P2 WDK smoke — PIMLICO_API_KEY: ${hasKey ? 'SET' : 'MISSING'}\n`)

console.log('▸ get_wallet_balance (sepolia)')
const balance = await harness.execute('get_wallet_balance', { network: 'sepolia' })
console.log(JSON.stringify(balance, null, 2))

console.log('\n▸ quote_payment (1 USDt)')
const quote = await harness.execute('quote_payment', {
  to: '0x0000000000000000000000000000000000000001',
  amount: 1,
  network: 'sepolia'
})
console.log(JSON.stringify(quote, null, 2))

console.log('\n▸ execute_gasless_payment dryRun')
const dry = await harness.execute('execute_gasless_payment', {
  to: '0x0000000000000000000000000000000000000001',
  amount: 1,
  network: 'sepolia'
})
console.log(JSON.stringify(dry, null, 2))

console.log('\n▸ execute_gasless_payment dryRun:false (may be insufficient_token_balance)')
const live = await harness.execute('execute_gasless_payment', {
  to: '0x0000000000000000000000000000000000000001',
  amount: 1,
  dryRun: false,
  network: 'sepolia'
})
console.log(JSON.stringify(live, null, 2))

console.log('\n▸ hook block >$1k without confirmed')
const blocked = await harness.execute('execute_gasless_payment', {
  to: '0x0000000000000000000000000000000000000001',
  amount: 1500,
  dryRun: false,
  network: 'sepolia'
})
console.log(JSON.stringify(blocked, null, 2))

const mcpBin = resolveWdkMcpBin()
console.log(`\n▸ wdk-mcp bin: ${mcpBin || 'MISSING'}`)

const ok =
  balance?.status === 'ok' &&
  (quote?.status === 'ok' || quote?.status === 'quote_skipped_no_api_key') &&
  dry?.dryRun === true &&
  blocked?.blocked === true &&
  Boolean(mcpBin)

if (ok) {
  console.log('\n✅ P2 WDK smoke OK')
} else {
  console.error('\n✖ P2 smoke incompleto')
  process.exitCode = 1
}
