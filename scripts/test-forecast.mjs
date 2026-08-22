#!/usr/bin/env node

/**
 * Smoke P1 pipeline: inventory → forecast → draft PO.
 * Usage: node --env-file=.env scripts/test-forecast.mjs
 */

import { loadPlugins, harness } from '../dist/harness/loader.js'
import { registerDefaultHooks } from '../dist/harness/hooks.js'

await loadPlugins()
registerDefaultHooks(harness)

console.log('🍐 P1 procurement-forecast smoke\n')

console.log('▸ check_inventory')
const inventory = await harness.execute('check_inventory', {})
console.log(JSON.stringify(inventory, null, 2))

console.log('\n▸ run_usage_forecast (all)')
const forecasts = await harness.execute('run_usage_forecast', { days: 30 })
console.log(JSON.stringify(forecasts, null, 2))

const atRisk = (forecasts || []).filter((f) => f.belowThreshold)
console.log(`\n▸ SKUs en riesgo: ${atRisk.length}`)

if (!atRisk.length) {
  console.error('Se esperaba al menos un SKU belowThreshold (SKU-RISK / MAT-003)')
  process.exit(1)
}

const target = atRisk.find((f) => f.sku === 'SKU-RISK') || atRisk[0]
console.log('\n▸ draft_purchase_order')
const draft = await harness.execute('draft_purchase_order', { forecast: target })
console.log(draft)

if (typeof draft === 'string' && draft.includes('DRAFT') && draft.includes(target.sku)) {
  console.log('\n✅ P1 forecast pipeline OK')
} else {
  console.error('\n✖ draft PO inválido')
  process.exit(1)
}
