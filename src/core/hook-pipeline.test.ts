/** El pipeline es la única lógica con ramas del núcleo: se prueba aislado. */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runHookPipeline } from '@core/hook-pipeline.js'
import type { HookFn, Tool } from '@core/types.js'

const tool: Tool = { name: 't', description: 'd', plugin: 'p', handler: async () => null }

describe('runHookPipeline', () => {
  it('encadena los params de un hook al siguiente', async () => {
    const first: HookFn = async (_t, p) => ({ proceed: true, params: { ...p, a: 1 } })
    const second: HookFn = async (_t, p) => ({ proceed: true, params: { ...p, b: 2 } })
    const out = await runHookPipeline([first, second], tool, { seed: true })
    assert.deepEqual(out.params, { seed: true, a: 1, b: 2 })
    assert.equal(out.proceed, true)
  })

  it('se detiene en el primer hook que rechaza', async () => {
    const stop: HookFn = async (_t, p) => ({ proceed: false, params: p })
    let reached = false
    const after: HookFn = async (_t, p) => { reached = true; return { proceed: true, params: p } }
    const out = await runHookPipeline([stop, after], tool, {})
    assert.equal(out.proceed, false)
    assert.equal(out.stoppedAt, 0)
    assert.equal(reached, false)
  })

  it('identifica al hook culpable si devuelve algo inválido', async () => {
    const broken = (async () => undefined) as unknown as HookFn
    await assert.rejects(
      () => runHookPipeline([broken], tool, {}),
      /Hook #0 aplicado a "t" devolvió un valor inválido/
    )
  })

  it('no muta los params de entrada', async () => {
    const input = { a: 1 }
    const mutate: HookFn = async (_t, p) => ({ proceed: true, params: { ...p, a: 99 } })
    await runHookPipeline([mutate], tool, input)
    assert.deepEqual(input, { a: 1 })
  })
})
