#!/usr/bin/env node
/**
 * Smoke P2 live Sepolia — balance → quote → (optional) dryRun:false.
 *
 * Safe by default. Real transfer only when:
 *   CONFIRM_LIVE_PAY=1
 *
 * Usage:
 *   node --use-system-ca --env-file=.env scripts/test-p2-live-pay.mjs
 *   CONFIRM_LIVE_PAY=1 node --use-system-ca --env-file=.env scripts/test-p2-live-pay.mjs
 */

import { loadPlugins, harness } from '../dist/harness/loader.js'
import { registerDefaultHooks } from '../dist/harness/hooks.js'

const VENDOR = '0x0000000000000000000000000000000000000001'
const AMOUNT = Number(process.env.LIVE_PAY_AMOUNT || 1)
const confirmLive = process.env.CONFIRM_LIVE_PAY === '1'

await loadPlugins()
registerDefaultHooks(harness)

console.log('🍐 P2 live Sepolia checklist\n')
console.log(`CONFIRM_LIVE_PAY=${confirmLive ? '1 (WILL EXECUTE)' : 'unset (dry checks only)'}`)
console.log(`amount=${AMOUNT} USDt → ${VENDOR}\n`)

console.log('▸ 1) get_wallet_balance')
const balance = await harness.execute('get_wallet_balance', { network: 'sepolia' })
console.log(JSON.stringify(balance, null, 2))

if (balance?.status === 'rpc_unavailable') {
  console.error('\n✖ RPC/TLS unavailable — see docs/WDK-SEPOLIA-LIVE-PAY.md')
  process.exitCode = 1
  process.exit()
}

const usdt = Number.parseFloat(balance?.usdt ?? '0')
if (!(usdt >= AMOUNT)) {
  console.error(
    `\n✖ Insufficient MOCK USDt (${balance?.usdt ?? '0'} < ${AMOUNT}).\n` +
      `  Fund ${balance?.address ?? 'smart account'} via Pimlico/Candide faucet.\n` +
      `  Docs: docs/WDK-SEPOLIA-LIVE-PAY.md`
  )
  process.exitCode = 1
  process.exit()
}

console.log('\n▸ 2) quote_payment')
const quote = await harness.execute('quote_payment', {
  to: VENDOR,
  amount: AMOUNT,
  network: 'sepolia'
})
console.log(JSON.stringify(quote, null, 2))

if (quote?.status !== 'ok' && quote?.status !== 'quote_skipped_no_api_key') {
  console.error('\n✖ Quote failed')
  process.exitCode = 1
  process.exit()
}

console.log('\n▸ 3) execute_gasless_payment dryRun (preview)')
const dry = await harness.execute('execute_gasless_payment', {
  to: VENDOR,
  amount: AMOUNT,
  network: 'sepolia',
  dryRun: true
})
console.log(JSON.stringify(dry, null, 2))

if (!confirmLive) {
  console.log(`
✅ Preflight OK — wallet funded (${balance.usdt} USDt), quote/dry-run OK.

To send a REAL Sepolia MOCK USDt transfer:
  CONFIRM_LIVE_PAY=1 npm run test:p2-live

Or CLI:
  npm run dev -- pay --vendor ${VENDOR} --amount ${AMOUNT} --network sepolia --dry-run=false

Guide: docs/WDK-SEPOLIA-LIVE-PAY.md
`)
  process.exit(0)
}

console.log('\n▸ 4) execute_gasless_payment dryRun:false (LIVE)')
const live = await harness.execute('execute_gasless_payment', {
  to: VENDOR,
  amount: AMOUNT,
  network: 'sepolia',
  dryRun: false
})
console.log(JSON.stringify(live, null, 2))

if (live?.status === 'ok' && live?.txHash) {
  console.log(`\n✅ Live pay OK — txHash: ${live.txHash}`)
  console.log(`   https://sepolia.etherscan.io/tx/${live.txHash}`)
} else {
  console.error('\n✖ Live pay failed — see docs/WDK-SEPOLIA-LIVE-PAY.md troubleshooting')
  process.exitCode = 1
}
