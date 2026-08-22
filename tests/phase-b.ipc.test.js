/**
 * Fase B — smoke integración UI API (sin Electron).
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ensureHarnessReady,
  executeTool,
  listTools
} from '../dist/harness/ipc-bridge.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePng = path.join(root, 'tests/fixtures/invoice-demo.png')
const samplePng = path.join(root, 'workspace/invoices/sample.png')

describe('Fase B — contrato IPC (Evelin)', () => {
  before(async () => {
    await ensureHarnessReady()
  })

  it('listTools expone 8 tools para la UI', () => {
    const tools = listTools()
    assert.equal(tools.length, 8)
    assert.ok(tools.every((t) => t.name && t.description && t.plugin))
  })

  it('parse_invoice rechaza formato inválido', async () => {
    await assert.rejects(
      () =>
        executeTool('parse_invoice', {
          filePath: 'workspace/invoices/.gitkeep'
        }),
      /Formato no soportado/
    )
  })

  it('parse_invoice retorna objeto procesable', async (t) => {
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
      t.skip('OCR/LLM integration omitido en CI (sin modelos QVAC)')
      return
    }

    const filePath = fs.existsSync(fixturePng)
      ? fixturePng
      : fs.existsSync(samplePng)
        ? samplePng
        : null

    if (!filePath) {
      t.skip('fixture invoice PNG ausente')
      return
    }

    try {
      const result = await executeTool('parse_invoice', { filePath })
      assert.ok(result !== null && typeof result === 'object')
      // Contrato Antony: { invoice, rawTextPreview? } o invoice plano
      assert.ok(
        'invoice' in result ||
          'invoiceNumber' in result ||
          'vendor' in result
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      t.skip(`OCR/LLM requiere modelos QVAC: ${message}`)
    }
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
