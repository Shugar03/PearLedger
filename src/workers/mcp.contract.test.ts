/**
 * CDD — Contract-Driven Development
 * SPEC: MCP-C01…C07
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { FROZEN_TOOLS } from '@core/frozen-tools.js'
import {
  loadToolsContract,
  contractToolNames,
  contractFrozenByPlugin,
  contractParamKeys,
  contractTool
} from '@workers/mcp-contract.js'
import { TOOL_INPUT, schemaForTool } from '@workers/pearledger-mcp.js'

describe('MCP CDD (contrato)', () => {
  const contract = loadToolsContract()

  it('MCP-C01: contrato declara las 8 tools congeladas', () => {
    const names = contractToolNames(contract).sort()
    const expected = Object.values(FROZEN_TOOLS).flat().sort()
    assert.deepEqual(names, expected)
    assert.equal(names.length, 8)
  })

  it('MCP-C02: plugins del contrato === FROZEN_TOOLS', () => {
    assert.deepEqual(contractFrozenByPlugin(contract), FROZEN_TOOLS)
  })

  it('MCP-C03: TOOL_INPUT MCP cubre exactamente las tools del contrato', () => {
    const mcpTools = Object.keys(TOOL_INPUT).sort()
    assert.deepEqual(mcpTools, contractToolNames(contract).sort())
  })

  it('MCP-C04: cada schema MCP expone params del contrato', () => {
    for (const name of contractToolNames(contract)) {
      const shape = TOOL_INPUT[name]
      assert.ok(shape, `missing TOOL_INPUT.${name}`)
      const schemaKeys = Object.keys(shape).sort()
      const contractKeys = contractParamKeys(name, contract)
      for (const key of contractKeys) {
        assert.ok(
          schemaKeys.includes(key),
          `${name}: MCP schema missing contract param "${key}"`
        )
      }

      for (const req of contractTool(name, contract).required ?? []) {
        const field: z.ZodTypeAny | undefined = shape[req]
        assert.ok(field, `${name}: required ${req}`)
        assert.equal(
          field instanceof z.ZodOptional,
          false,
          `${name}.${req} must be required in Zod schema`
        )
      }
    }
  })

  it('MCP-C05: metadata del servidor MCP en contrato', () => {
    assert.equal(contract.server, 'pearledger-mcp')
    assert.equal(contract.source, 'docs/PLUGIN_CONTRACT.md')
    assert.ok(contract.version)
  })

  it('MCP-C06: requiredAnyOf tiene schema enforceable (refine)', () => {
    const name = 'match_purchase_order'
    const spec = contractTool(name, contract)
    assert.ok(spec.requiredAnyOf?.length, 'contract must declare requiredAnyOf')

    const schema = schemaForTool(name, TOOL_INPUT[name]!)
    assert.equal(schema.safeParse({}).success, false)
    assert.equal(schema.safeParse({ invoiceId: 'INV-1' }).success, true)
    assert.equal(
      schema.safeParse({ invoice: { invoiceNumber: 'INV-1' } }).success,
      true
    )
  })

  it('MCP-C07: safety de pagos en contrato (>umbral + preferDryRun)', () => {
    const pay = contractTool('execute_gasless_payment', contract)
    assert.equal(pay.safety?.confirmAboveUsdt, 1000)
    assert.equal(pay.safety?.preferDryRun, true)
  })
})
