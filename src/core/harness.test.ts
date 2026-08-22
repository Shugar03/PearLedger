/** SPEC: H-01..H-04 — registro, duplicados, bloqueo por hook y eventos. */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHarness } from '@core/harness.js'
import type { Tool } from '@core/types.js'

function demoTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'demo',
    description: 'test',
    plugin: 'test',
    handler: async () => ({ ok: true }),
    ...overrides
  }
}

describe('Harness', () => {
  it('H-01: registra y lista tools', () => {
    const h = createHarness()
    h.registerTool(demoTool())
    assert.equal(h.listTools().length, 1)
    assert.equal(h.listTools()[0]?.name, 'demo')
  })

  it('H-02: rechaza una tool duplicada', () => {
    const h = createHarness()
    h.registerTool(demoTool())
    assert.throws(() => h.registerTool(demoTool()), /Tool already registered/)
  })

  it('H-03: un hook puede bloquear la ejecución', async () => {
    const h = createHarness()
    let ran = false
    h.registerTool(demoTool({ handler: async () => { ran = true; return { ok: true } } }))
    h.registerHook(async () => ({ proceed: false, params: {} }))

    const result = (await h.execute('demo')) as { blocked?: boolean }
    assert.equal(ran, false, 'el handler no debe ejecutarse')
    assert.equal(result.blocked, true)
  })

  it('H-04: emite tool:done al completar', async () => {
    const h = createHarness()
    h.registerTool(demoTool({ handler: async () => ({ value: 42 }) }))
    let done: unknown = null
    h.on('tool:done', (tool, result) => {
      done = { tool: (tool as Tool).name, result }
    })
    await h.execute('demo')
    assert.deepEqual(done, { tool: 'demo', result: { value: 42 } })
  })

  it('emite tool:failed y propaga si el handler lanza', async () => {
    const h = createHarness()
    h.registerTool(demoTool({ handler: async () => { throw new Error('boom') } }))
    let failed = false
    h.on('tool:failed', () => { failed = true })
    await assert.rejects(() => h.execute('demo'), /boom/)
    assert.equal(failed, true)
  })

  it('rechaza hooks nuevos tras sellar el harness', () => {
    const h = createHarness()
    h.seal()
    assert.throws(() => h.registerHook(async (_t, p) => ({ proceed: true, params: p })), /sellar/)
  })

  it('describeTools no expone los handlers (serializable por IPC)', () => {
    const h = createHarness()
    h.registerTool(demoTool())
    const [described] = h.describeTools()
    assert.deepEqual(described, { name: 'demo', description: 'test', plugin: 'test' })
    assert.equal(JSON.parse(JSON.stringify(described)).name, 'demo')
  })
})
