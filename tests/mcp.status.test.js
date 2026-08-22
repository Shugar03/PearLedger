/**
 * Smoke: pearledger-mcp --status lista las tools congeladas del harness.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'workers', 'pearledger-mcp.js')

function runStatus() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--use-system-ca', entry, '--status'],
      {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
    let out = ''
    let err = ''
    child.stdout.on('data', (c) => {
      out += c
    })
    child.stderr.on('data', (c) => {
      err += c
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code, out, err })
    })
  })
}

describe('pearledger-mcp', () => {
  it('--status reports ready tools', async () => {
    const { code, out, err } = await runStatus()
    assert.equal(code, 0, err || out)
    const json = JSON.parse(out)
    assert.equal(json.server, 'pearledger-mcp')
    assert.equal(json.ready, true)
    const names = json.tools.map((t) => t.name).sort()
    assert.deepEqual(names, [...json.expected].sort())
    assert.ok(names.includes('parse_invoice'))
    assert.ok(names.includes('execute_gasless_payment'))
  })
})
