/**
 * SPEC: H-07, H-08
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Harness } from '../dist/harness/core.js'
import {
  paymentConfirmationHook,
  registerDefaultHooks
} from '../dist/harness/hooks.js'

describe('Hooks (payment confirmation)', () => {
  let prevThreshold

  beforeEach(() => {
    prevThreshold = process.env.HUMAN_CONFIRM_THRESHOLD_USDT
    process.env.HUMAN_CONFIRM_THRESHOLD_USDT = '1000'
  })

  afterEach(() => {
    if (prevThreshold === undefined) {
      delete process.env.HUMAN_CONFIRM_THRESHOLD_USDT
    } else {
      process.env.HUMAN_CONFIRM_THRESHOLD_USDT = prevThreshold
    }
  })

  it('H-07: bloquea pago > umbral sin confirmed', async () => {
    const h = new Harness()
    registerDefaultHooks(h)
    h.registerTool({
      name: 'execute_gasless_payment',
      description: 'pay',
      plugin: 'plugin-wdk-settlement',
      handler: async () => ({ status: 'sent' })
    })

    const result = await h.execute('execute_gasless_payment', {
      to: '0xabc',
      amount: 1500,
      dryRun: false
    })

    assert.equal(result.blocked, true)
    assert.equal(result.requiresConfirmation, true)
    assert.match(result.reason, /1500/)
  })

  it('H-08: permite pago bajo umbral', async () => {
    const h = new Harness()
    h.registerHook(paymentConfirmationHook)
    h.registerTool({
      name: 'execute_gasless_payment',
      description: 'pay',
      plugin: 'plugin-wdk-settlement',
      handler: async (params) => ({
        status: params.dryRun ? 'dry-run' : 'sent',
        amount: params.amount
      })
    })

    const result = await h.execute('execute_gasless_payment', {
      to: '0xabc',
      amount: 250,
      dryRun: true
    })

    assert.equal(result.blocked, undefined)
    assert.equal(result.status, 'dry-run')
  })
})
