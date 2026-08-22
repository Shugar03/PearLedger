/**
 * TDD — protocolo MCP (Client ↔ Server in-process)
 * SPEC: MCP-T01…T10
 *
 * Red → green: listTools / callTool contra createPearledgerMcpServer().
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { access } from 'node:fs/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { loadPlugins, harness } from '../dist/harness/loader.js'
import { repoRoot } from '../dist/harness/runtime.js'
import { createPearledgerMcpServer } from '../workers/pearledger-mcp.js'
import { contractToolNames } from '../contracts/load-contract.js'
import { createLinkedTransports } from './helpers/linked-mcp-transport.js'

describe('MCP TDD (protocolo)', () => {
  /** @type {Client} */
  let client
  /** @type {Awaited<ReturnType<typeof createPearledgerMcpServer>>} */
  let server
  /** @type {{ clientTransport: any, serverTransport: any }} */
  let transports

  before(async () => {
    await loadPlugins({ reset: true })
    server = await createPearledgerMcpServer()
    client = new Client({ name: 'pearledger-tdd', version: '0.0.0' })
    transports = createLinkedTransports()
    await Promise.all([
      server.connect(transports.serverTransport),
      client.connect(transports.clientTransport)
    ])
  })

  after(async () => {
    await client?.close().catch(() => {})
    await server?.close().catch(() => {})
  })

  it('MCP-T01: tools/list expone las tools del contrato', async () => {
    const listed = await client.listTools()
    const names = listed.tools.map((t) => t.name).sort()
    assert.deepEqual(names, contractToolNames().sort())
  })

  it('MCP-T02: tools/list incluye inputSchema por tool', async () => {
    const listed = await client.listTools()
    for (const tool of listed.tools) {
      assert.ok(tool.description, `${tool.name} needs description`)
      assert.ok(tool.inputSchema, `${tool.name} needs inputSchema`)
      assert.equal(tool.inputSchema.type, 'object')
    }
  })

  it('MCP-T03: callTool(check_inventory) devuelve JSON usable', async () => {
    const result = await client.callTool({
      name: 'check_inventory',
      arguments: {}
    })
    assert.equal(result.isError, undefined)
    assert.ok(Array.isArray(result.content))
    assert.equal(result.content[0]?.type, 'text')
    const parsed = JSON.parse(result.content[0].text)
    assert.ok(Array.isArray(parsed) || typeof parsed === 'object')
  })

  it('MCP-T04: callTool(execute_gasless_payment) dryRun no bloquea bajo umbral', async () => {
    const result = await client.callTool({
      name: 'execute_gasless_payment',
      arguments: {
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        amount: 250,
        dryRun: true
      }
    })
    assert.notEqual(result.isError, true)
    const parsed = JSON.parse(result.content[0].text)
    assert.notEqual(parsed.blocked, true)
  })

  it('MCP-T05: callTool tool desconocida → error MCP', async () => {
    const result = await client.callTool({
      name: 'not_a_real_tool',
      arguments: {}
    })
    assert.equal(result.isError, true)
  })

  it('MCP-T06: harness y MCP ven el mismo registro vivo', () => {
    const harnessNames = harness.listTools().map((t) => t.name).sort()
    assert.deepEqual(harnessNames, contractToolNames().sort())
  })

  it('MCP-T07: pago sobre umbral sin confirmed → blocked vía MCP', async () => {
    const result = await client.callTool({
      name: 'execute_gasless_payment',
      arguments: {
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        amount: 1500,
        dryRun: true
      }
    })
    assert.notEqual(result.isError, true)
    const parsed = JSON.parse(result.content[0].text)
    assert.equal(parsed.blocked, true)
    assert.equal(parsed.requiresConfirmation, true)
  })

  it('MCP-T08: quote_payment sin to → error de validación MCP', async () => {
    const result = await client.callTool({
      name: 'quote_payment',
      arguments: { amount: 10 }
    })
    assert.equal(result.isError, true)
  })

  it('MCP-T09: match_purchase_order {} viola requiredAnyOf', async () => {
    const result = await client.callTool({
      name: 'match_purchase_order',
      arguments: {}
    })
    assert.equal(result.isError, true)
  })

  it('MCP-T10: fixtures vía repoRoot aunque cwd sea incorrecto', async () => {
    const root = repoRoot()
    await access(path.join(root, 'workspace', 'inventory', 'stock.json'))
    const prev = process.cwd()
    try {
      process.chdir(os.tmpdir())
      assert.notEqual(process.cwd(), root)
      const result = await client.callTool({
        name: 'check_inventory',
        arguments: {}
      })
      assert.notEqual(result.isError, true)
      const parsed = JSON.parse(result.content[0].text)
      assert.ok(Array.isArray(parsed) && parsed.length > 0)
    } finally {
      process.chdir(prev)
    }
  })
})
