/**
 * SPEC: H-05, H-06
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadPlugins,
  harness,
  expectedToolNames,
  FROZEN_TOOLS
} from '../dist/harness/loader.js'

describe('Loader (integración)', () => {
  before(async () => {
    await loadPlugins({ reset: true })
  })

  it('H-05: carga 8 tools desde dist/', () => {
    const names = harness.listTools().map((t) => t.name).sort()
    const expected = expectedToolNames().sort()
    assert.equal(names.length, 8)
    assert.deepEqual(names, expected)
  })

  it('H-06: cada plugin registra tools congeladas', () => {
    for (const [plugin, tools] of Object.entries(FROZEN_TOOLS)) {
      for (const toolName of tools) {
        const tool = harness.listTools().find((t) => t.name === toolName)
        assert.ok(tool, `missing tool ${toolName}`)
        assert.equal(tool.plugin, plugin)
      }
    }
  })

  it('H-08: execute_gasless_payment dry-run bajo umbral', async () => {
    const result = await harness.execute('execute_gasless_payment', {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: 250,
      dryRun: true
    })
    assert.notEqual(result.blocked, true)
  })
})
