/**
 * TDD — protocolo MCP (Client ↔ Server in-process)
 * SPEC: MCP-T01…T10
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { access } from 'node:fs/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { appRoot, workspaceDir } from '@shared/paths.js'
import {
  createPearledgerMcpServer,
  type PearledgerMcpHandle
} from '@workers/pearledger-mcp.js'
import { contractToolNames } from '@workers/mcp-contract.js'
import { createLinkedTransports } from '@workers/linked-mcp-transport.js'

function textContent(result: unknown): string {
  assert.ok(result && typeof result === 'object')
  const content = (result as { content?: unknown }).content
  assert.ok(Array.isArray(content))
  const first = content[0] as { type?: string; text?: string }
  assert.equal(first?.type, 'text')
  assert.ok(typeof first.text === 'string')
  return first.text
}

describe('MCP TDD (protocolo)', () => {
  let client: Client
  let handle: PearledgerMcpHandle
  let transports: ReturnType<typeof createLinkedTransports>

  before(async () => {
    handle = await createPearledgerMcpServer()
    client = new Client({ name: 'pearledger-tdd', version: '0.0.0' })
    transports = createLinkedTransports()
    await Promise.all([
      handle.server.connect(transports.serverTransport),
      client.connect(transports.clientTransport)
    ])
  })

  after(async () => {
    await client?.close().catch(() => {})
    await handle?.server.close().catch(() => {})
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
    const text = textContent(result)
    const parsed = JSON.parse(text)
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
    const parsed = JSON.parse(textContent(result))
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
    const harnessNames = handle.harness.listTools().map((t) => t.name).sort()
    assert.deepEqual(harnessNames, contractToolNames().sort())
  })

  it('MCP-T07: pago live sobre umbral sin confirmed → blocked vía MCP', async () => {
    const result = await client.callTool({
      name: 'execute_gasless_payment',
      arguments: {
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        amount: 1500,
        dryRun: false
      }
    })
    assert.notEqual(result.isError, true)
    const parsed = JSON.parse(textContent(result))
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

  it('MCP-T10: fixtures vía appRoot/workspaceDir aunque cwd sea incorrecto', async () => {
    const root = appRoot()
    const stock = workspaceDir('inventory', 'stock.json')
    // en el layout nuevo el stock demo puede vivir en src/assets
    const candidates = [
      stock,
      path.join(root, 'src', 'assets', 'stock.json'),
      path.join(root, 'workspace', 'inventory', 'stock.json')
    ]
    let found = false
    for (const candidate of candidates) {
      try {
        await access(candidate)
        found = true
        break
      } catch {
        // try next
      }
    }
    assert.ok(found, 'expected demo stock.json under appRoot/workspace/assets')

    const prev = process.cwd() // conventions:allow — el test prueba independencia del cwd
    try {
      process.chdir(os.tmpdir())
      assert.notEqual(process.cwd(), root) // conventions:allow — aserción del test cwd
      const result = await client.callTool({
        name: 'check_inventory',
        arguments: {}
      })
      assert.notEqual(result.isError, true)
      const parsed = JSON.parse(textContent(result))
      assert.ok(Array.isArray(parsed) && parsed.length > 0)
    } finally {
      process.chdir(prev)
    }
  })
})
