/**
 * CDD — Contract-Driven Development
 * SPEC: MCP-C01…C04
 *
 * El contrato máquina (contracts/tools.contract.json) debe coincidir con:
 * - docs/PLUGIN_CONTRACT.md / FROZEN_TOOLS del harness
 * - schemas MCP (TOOL_INPUT) en workers/pearledger-mcp.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  loadToolsContract,
  contractToolNames,
  contractFrozenByPlugin,
  contractParamKeys,
  contractTool
} from '../contracts/load-contract.js'
import { expectedToolNames, FROZEN_TOOLS } from '../dist/harness/loader.js'
import { TOOL_INPUT } from '../workers/pearledger-mcp.js'

describe('MCP CDD (contrato)', () => {
  const contract = loadToolsContract()

  it('MCP-C01: contrato declara las 8 tools congeladas', () => {
    const names = contractToolNames(contract).sort()
    assert.deepEqual(names, expectedToolNames().sort())
    assert.equal(names.length, 8)
  })

  it('MCP-C02: plugins del contrato === FROZEN_TOOLS del loader', () => {
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
        const field = shape[req]
        assert.ok(field, `${name}: required ${req}`)
        // required zod fields are not ZodOptional
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
})
