/**
 * SPEC: H-01, H-02, H-03, H-04
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Harness } from '../dist/harness/core.js'

describe('Harness (core)', () => {
  it('H-01: registra y lista tools', () => {
    const h = new Harness()
    h.registerTool({
      name: 'demo',
      description: 'test',
      plugin: 'test',
      handler: async () => ({ ok: true })
    })
    assert.equal(h.listTools().length, 1)
    assert.equal(h.listTools()[0].name, 'demo')
  })

  it('H-02: rechaza tool duplicada', () => {
    const h = new Harness()
    const tool = {
      name: 'demo',
      description: 'test',
      plugin: 'test',
      handler: async () => ({})
    }
    h.registerTool(tool)
    assert.throws(() => h.registerTool(tool), /Tool already registered/)
  })

  it('H-03: hook puede bloquear ejecución', async () => {
    const h = new Harness()
    let ran = false
    h.registerTool({
      name: 'demo',
      description: 'test',
      plugin: 'test',
      handler: async () => {
        ran = true
        return { ok: true }
      }
    })
    h.registerHook(async () => ({ proceed: false, params: {} }))
    const result = await h.execute('demo', {})
    assert.equal(ran, false)
    assert.equal(result.blocked, true)
  })

  it('H-04: emite tool:done al completar', async () => {
    const h = new Harness()
    h.registerTool({
      name: 'demo',
      description: 'test',
      plugin: 'test',
      handler: async () => ({ value: 42 })
    })
    let done = null
    h.on('tool:done', (tool, result) => {
      done = { tool: tool.name, result }
    })
    await h.execute('demo', {})
    assert.deepEqual(done, { tool: 'demo', result: { value: 42 } })
  })
})
