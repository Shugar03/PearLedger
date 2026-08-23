/**
 * Copia los estáticos del dashboard a `dist/`.
 *
 * `src/dashboard/web` está excluido del tsconfig a propósito: es JavaScript de
 * navegador, no del programa de Node, y mezclarlos metería `lib.dom` en el
 * harness y `node:fs` en el renderer. Por eso se copian en vez de compilarse.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const from = path.join(root, 'src', 'dashboard', 'web')
const to = path.join(root, 'dist', 'dashboard', 'web')

if (!existsSync(from)) {
  process.stderr.write('[copy-web] sin src/dashboard/web — se omite\n')
  process.exit(0)
}

mkdirSync(path.dirname(to), { recursive: true })
cpSync(from, to, { recursive: true, force: true })
process.stderr.write(`[copy-web] ${path.relative(root, to)}\n`)
