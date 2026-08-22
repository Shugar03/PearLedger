/**
 * Fase B — smoke integración UI API (sin Electron).
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureHarnessReady,
  executeTool,
  listTools
} from '../dist/harness/ipc-bridge.js'

describe('Fase B — contrato IPC (Evelin)', () => {
  before(async () => {
    await ensureHarnessReady()
  })

  it('listTools expone 8 tools para la UI', () => {
    const tools = listTools()
    assert.equal(tools.length, 8)
    assert.ok(tools.every((t) => t.name && t.description && t.plugin))
  })

  it('parse_invoice retorna objeto procesable', async () => {
    const result = await executeTool('parse_invoice', {
      filePath: 'workspace/invoices/sample.png'
    })
    assert.ok(result !== null && typeof result === 'object')
    assert.ok('invoice' in result || 'invoiceNumber' in result || 'vendor' in result)
  })

  it('get_wallet_balance retorna usdt para pantalla Wallet', async () => {
    const result = await executeTool('get_wallet_balance', {})
    assert.ok(result && typeof result === 'object' && 'usdt' in result)
  })

  it('execute_gasless_payment dry-run para cola de pagos', async () => {
    const result = await executeTool('execute_gasless_payment', {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: 250,
      dryRun: true
    })
    assert.notEqual(result?.blocked, true)
  })
})
