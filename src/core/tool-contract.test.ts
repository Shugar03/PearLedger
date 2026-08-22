/**
 * Contrato anti-regresión de las tools expuestas.
 *
 * La lista se declara aquí a propósito y NO se deriva de los plugins: derivarla
 * convertiría el test en una tautología que pasaría aunque un plugin dejara de
 * registrar sus tools en silencio. Antes vivía en el loader, en código de
 * producción, que no es su sitio.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHarness } from '@core/harness.js'
import { loadPlugins } from '@core/loader.js'

export const FROZEN_TOOLS: Record<string, string[]> = {
  'plugin-invoice-ops': ['parse_invoice', 'match_purchase_order'],
  'plugin-procurement-forecast': ['check_inventory', 'run_usage_forecast', 'draft_purchase_order'],
  'plugin-wdk-settlement': ['get_wallet_balance', 'quote_payment', 'execute_gasless_payment']
}

const EXPECTED = Object.values(FROZEN_TOOLS).flat()

describe('Contrato de tools', () => {
  it(`los plugins registran exactamente ${EXPECTED.length} tools`, async () => {
    const harness = await loadPlugins(createHarness())
    const names = harness.listTools().map((t) => t.name).sort()
    assert.deepEqual(names, [...EXPECTED].sort())
  })

  it('cada tool pertenece a su plugin declarado', async () => {
    const harness = await loadPlugins(createHarness())
    for (const [plugin, toolNames] of Object.entries(FROZEN_TOOLS)) {
      for (const toolName of toolNames) {
        const tool = harness.getTool(toolName)
        assert.ok(tool, `falta la tool ${toolName}`)
        assert.equal(tool.plugin, plugin)
      }
    }
  })

  it('cada harness es independiente (sin estado global compartido)', async () => {
    const a = await loadPlugins(createHarness())
    const b = await loadPlugins(createHarness())
    assert.equal(a.listTools().length, b.listTools().length)
    assert.notEqual(a, b)
  })
})
