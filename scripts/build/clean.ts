/** Borra los artefactos de build. */
import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

for (const target of ['dist', 'out', 'deployment']) {
  rmSync(path.join(root, target), { recursive: true, force: true })
  process.stderr.write(`[clean] ${target}\n`)
}
