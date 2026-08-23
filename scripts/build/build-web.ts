/**
 * Compila el renderer del dashboard a `dist/dashboard/web/`.
 *
 * El renderer es la app React de `ui/dashboard/` y la compila Vite; este script
 * sólo es el puente desde `npm run build` de la raíz. El deck y la landing
 * (`ui/deck`, `ui/site`) NO se compilan aquí: no forman parte del programa y
 * tienen su propio comando, `npm run pitch:build`.
 *
 * Si `ui/` no tiene dependencias instaladas, no falla: avisa y sigue. El
 * harness, sus tests y el binario standalone no dependen del frontend, y
 * obligar a instalar Electron y toda la cadena de Vite para cualquier
 * `npm run build` sería un peaje absurdo en CI y en el arranque de un clon
 * nuevo. Quien quiera el dashboard corre `npm run ui:install` una vez.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const uiDir = path.join(root, 'ui')
const viteBin = path.join(uiDir, 'node_modules', 'vite', 'bin', 'vite.js')

if (!existsSync(viteBin)) {
  process.stderr.write(
    '[build:web] sin dependencias en ui/ — se omite el bundle del dashboard.\n' +
      '[build:web] instalalas con `npm run ui:install` si vas a usar el dashboard o Electron.\n'
  )
  process.exit(0)
}

// Se invoca el JS de Vite con el propio Node en vez del `.cmd` del bin: en
// Windows el shim depende del shell y aquí no queremos ninguno de por medio.
const result = spawnSync(process.execPath, [viteBin, 'build', '--config', 'dashboard/vite.config.ts'], {
  cwd: uiDir,
  stdio: 'inherit'
})

if (result.error) {
  process.stderr.write(`[build:web] no se pudo lanzar Vite: ${result.error.message}\n`)
  process.exit(1)
}

process.exit(result.status ?? 1)
