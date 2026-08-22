/**
 * SPEC: H-09
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureHarnessReady,
  executeTool,
  listTools
} from '../dist/harness/ipc-bridge.js'

describe('IPC bridge', () => {
  before(async () => {
    await ensureHarnessReady()
  })

  it('H-09: executeTool get_wallet_balance retorna usdt', async () => {
    const result = await executeTool('get_wallet_balance', {})
    assert.ok(typeof result === 'object' && result !== null)
    assert.ok('usdt' in result)
  })

  it('listTools expone las 8 tools', () => {
    assert.equal(listTools().length, 8)
  })
})
