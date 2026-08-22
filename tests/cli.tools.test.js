/**
 * SPEC: CLI-01, P3-01
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function runDev(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['cli/dev.mjs', ...args], {
      cwd: root,
      env: process.env,
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
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
    child.on('error', reject)
  })
}

describe('CLI dev + build artifacts', () => {
  it('CLI-01: tools --json lista 8 tools', async () => {
    const { code, stdout, stderr } = await runDev(['tools', '--json'])
    assert.equal(code, 0, stderr)
    const payload = JSON.parse(stdout.trim())
    assert.equal(payload.tools.length, 8)
  })

  it('P3-01: binary Bare del host (si fue compilado)', (t) => {
    const platform = process.platform
    const arch = process.arch === 'x64' ? 'x64' : 'arm64'
    const name = platform === 'win32' ? 'pearledger.exe' : 'pearledger'
    const bin = path.join(root, 'out', `${platform}-${arch}`, name)
    if (!fs.existsSync(bin)) {
      t.skip(`Sin binario en ${bin} — correr npm run make:${platform}-${arch}`)
    }
    assert.ok(fs.existsSync(bin))
  })
})
