/**
 * Smoke — pearledger-mcp --status
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { appRoot } from '@shared/paths.js'

describe('pearledger-mcp', () => {
  it('--status reports ready tools', async () => {
    const entry = path.join(appRoot(), 'dist', 'workers', 'pearledger-mcp.js')
    // Hereda el env del proceso de test (ya válido). No pasar --env-file: un .env
    // local con WDK_USDT_MAINNET mal formado tumba getConfig() al arrancar hooks.
    const child = spawn(process.execPath, ['--use-system-ca', entry, '--status'], {
      cwd: appRoot(),
      env: process.env, // conventions:allow — reenvía env del runner al hijo --status
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })

    const code: number = await new Promise((resolve) => {
      child.on('close', (c) => resolve(c ?? 1))
    })

    assert.equal(code, 0, stderr)
    const parsed = JSON.parse(stdout)
    assert.equal(parsed.ready, true)
    assert.equal(parsed.server, 'pearledger-mcp')
    assert.ok(Array.isArray(parsed.tools) && parsed.tools.length === 8)
  })
})
