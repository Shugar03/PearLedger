/**
 * Genera `src/shared/meta.ts` a partir de package.json.
 *
 * `rootDir` es `src`, así que un `import '../package.json'` quedaría fuera del
 * árbol de compilación (TS6059) y además violaría la regla de no usar `../`.
 * Generar el módulo mantiene una sola fuente de verdad: package.json.
 *
 * Se ejecuta con `node scripts/build/gen-meta.ts` — Node 22 hace type stripping
 * nativo, así que no necesita compilarse.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

interface PackageJson {
  name: string
  version: string
  description: string
  productName?: string
  upgrade?: string
}

const pkg = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8')
) as PackageJson

const target = path.join(root, 'src', 'shared', 'meta.ts')

const contents = `/**
 * GENERADO AUTOMÁTICAMENTE por scripts/build/gen-meta.ts — no editar a mano.
 * La fuente de verdad es package.json.
 */

export const META = {
  name: ${JSON.stringify(pkg.name)},
  productName: ${JSON.stringify(pkg.productName ?? pkg.name)},
  version: ${JSON.stringify(pkg.version)},
  description: ${JSON.stringify(pkg.description)},
  upgrade: ${JSON.stringify(pkg.upgrade ?? '')}
} as const

export type Meta = typeof META
`

writeFileSync(target, contents, 'utf8')
process.stderr.write(`[gen-meta] ${pkg.productName ?? pkg.name} v${pkg.version}\n`)
