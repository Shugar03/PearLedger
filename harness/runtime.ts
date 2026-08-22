import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Dev = Node + strip-types (npm run dev). Prod = Bare standalone o dist compilado. */
export function isDevRuntime(): boolean {
  if (process.env.PEARLEDGER_DEV === '1') return true
  if (process.env.PEARLEDGER_DEV === '0') return false

  const entry = process.argv[1] ?? ''
  if (entry.replace(/\\/g, '/').endsWith('bin.mjs') && process.versions?.node) {
    return true
  }

  return false
}

export function harnessDir(): string {
  return path.dirname(fileURLToPath(import.meta.url))
}

/** Repo root. Works from source (harness/) and compiled (dist/harness/). */
export function repoRoot(): string {
  const dir = harnessDir()
  // dist/harness → ../../ ; harness → ../
  if (path.basename(path.dirname(dir)) === 'dist') {
    return path.resolve(dir, '..', '..')
  }
  return path.resolve(dir, '..')
}
