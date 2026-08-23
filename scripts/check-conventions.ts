/**
 * Verifica mecánicamente las reglas de CONVENTIONS.md.
 *
 * Existe porque cada una de estas reglas corresponde a un bug real que ya
 * ocurrió en este repositorio: un `console.log` en el pipeline de OCR rompía
 * `--json`, un `process.cwd()` hacía fallar la app instalada, y un builtin sin
 * mapear tiraba abajo `npm start` bajo Bare.
 *
 * Se ejecuta con `npm run lint:rules`, también en CI.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')

interface Violation {
  rule: string
  file: string
  line: number
  text: string
}

const violations: Violation[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      // `web/` es JavaScript de navegador: no le aplican las reglas de Node.
      if (entry === 'web') continue
      walk(full, out)
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

function report(rule: string, file: string, index: number, text: string): void {
  violations.push({
    rule,
    file: path.relative(root, file),
    line: index + 1,
    text: text.trim().slice(0, 100)
  })
}

/**
 * Excepciones deliberadas y documentadas.
 *
 * `paths.ts` es más primitivo que la capa de configuración: resuelve dónde vive
 * todo, incluida la propia app, así que no puede depender de `@config` sin
 * crear un ciclo. `dev.ts` no lee el entorno: lo *puebla* desde `.env`.
 */
const ENV_ALLOWLIST = new Set(['shared/paths.ts', 'dev.ts'])

/** Elimina comentarios de bloque y de línea para no marcar la documentación. */
function stripComments(source: string): string[] {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replace(/[^\n]/g, ' ')
  )
  return withoutBlocks.split(/\r?\n/).map((line) => line.replace(/\/\/.*/, ''))
}

const files = walk(srcDir)

for (const file of files) {
  const rel = path.relative(srcDir, file).split(path.sep).join('/')
  const source = readFileSync(file, 'utf8')
  const original = source.split('\n')
  const stripped = stripComments(source)

  stripped.forEach((code, index) => {
    const line = original[index] ?? code

    // Escape explícito y auditable para casos legítimos puntuales, p. ej.
    // reenviar el entorno completo a un subproceso.
    if (/conventions:allow/.test(line)) return

    // Regla 1 — nada de imports relativos hacia arriba.
    if (/from\s+['"]\.\.\//.test(code) || /import\(['"]\.\.\//.test(code)) {
      report('sin-imports-padre', file, index, line)
    }

    // Regla 3 — stdout es sagrado: nada de console.
    if (/\bconsole\.(log|info|warn|error|debug|trace)\b/.test(code)) {
      report('sin-console', file, index, line)
    }

    // Regla 4 — nada de resolver rutas con el cwd.
    if (/process\.cwd\(\)/.test(code)) {
      report('sin-process-cwd', file, index, line)
    }

    // Regla 5 — process.env sólo en la capa de configuración.
    if (
      /process\.env\b/.test(code) &&
      !rel.startsWith('config/') &&
      !ENV_ALLOWLIST.has(rel)
    ) {
      report('env-solo-en-config', file, index, line)
    }

    // Regla 6 — imports estáticos y literales, o bare-pack no los bundlea.
    if (/import\(\s*[`'"]?[^'"`)]*\$\{/.test(code)) {
      report('sin-import-dinamico', file, index, line)
    }
  })
}

// Regla 2 — todo builtin `node:` usado debe estar mapeado para Bare.
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  imports: Record<string, unknown>
}
const mapped = new Set(Object.keys(pkg.imports ?? {}))
const usedBuiltins = new Set<string>()

for (const file of files) {
  // Los tests corren siempre bajo Node y nunca entran en el binario standalone,
  // así que sus builtins (node:test, node:assert) no necesitan mapeo para Bare.
  if (file.endsWith('.test.ts')) continue

  const contents = readFileSync(file, 'utf8')
  for (const match of contents.matchAll(/from\s+['"](node:[a-z/]+)['"]/g)) {
    if (match[1]) usedBuiltins.add(match[1])
  }
}

const unmapped = [...usedBuiltins].filter((builtin) => !mapped.has(builtin))

// ── Informe ────────────────────────────────────────────────────────────────
const RULE_HELP: Record<string, string> = {
  'sin-imports-padre': 'Usá un alias @ (ver CONVENTIONS.md §1)',
  'sin-console': 'Usá getLogger() de @shared/logger.js (§3)',
  'sin-process-cwd': 'Usá workspaceDir()/dataDir() de @shared/paths.js (§4)',
  'env-solo-en-config': 'Leé la config con getConfig() de @config/index.js (§5)',
  'sin-import-dinamico': 'bare-pack sólo sigue especificadores literales (§6)'
}

if (violations.length === 0 && unmapped.length === 0) {
  process.stderr.write(`[conventions] ${files.length} archivos, sin violaciones ✓\n`)
  process.exit(0)
}

for (const v of violations) {
  process.stderr.write(`${v.file}:${v.line}  [${v.rule}]  ${v.text}\n`)
  process.stderr.write(`    → ${RULE_HELP[v.rule] ?? ''}\n`)
}

if (unmapped.length > 0) {
  process.stderr.write(
    `\n[conventions] builtins sin mapear en package.json "imports": ${unmapped.join(', ')}\n` +
      '    → Bare fallará con MODULE_NOT_FOUND en el binario standalone (§2)\n'
  )
}

process.stderr.write(
  `\n[conventions] ${violations.length} violaciones, ${unmapped.length} builtins sin mapear\n`
)
process.exit(1)
