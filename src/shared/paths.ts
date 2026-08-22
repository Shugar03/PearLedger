/**
 * Resolución de rutas portable entre Node (dev), Bare (producción) y el binario
 * standalone de `bare-build`.
 *
 * Regla del proyecto: NADA resuelve rutas con `process.cwd()`. El cwd es el
 * directorio desde el que el usuario invocó el comando, no la raíz de la app;
 * una app instalada con `pear install` se ejecuta desde el home del usuario.
 *
 * Se distinguen dos raíces:
 *  - `appRoot()`  → assets de solo lectura que viajan con el código.
 *  - `dataDir()`  → datos mutables del usuario, fuera del bundle.
 */

import process from 'node:process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_DIR_NAME = 'pearledger'

let cachedAppRoot: string | null = null
let cachedDataDir: string | null = null

/**
 * Dentro de un bundle standalone los módulos se cargan con URLs `bare:/…`, no
 * `file:`, y `fileURLToPath` lanza. Devolvemos null y caemos a `dataDir()`.
 */
function moduleDir(): string | null {
  try {
    const url = import.meta.url
    if (!url.startsWith('file:')) return null
    return path.dirname(fileURLToPath(url))
  } catch {
    return null
  }
}

/**
 * Raíz de la aplicación (assets de solo lectura).
 *
 * En dev/compilado este archivo vive en `dist/shared/paths.js`, así que la raíz
 * está dos niveles por encima. En standalone no hay raíz en disco y se usa
 * `dataDir()`, donde el arranque siembra los assets por defecto.
 */
export function appRoot(): string {
  if (cachedAppRoot) return cachedAppRoot

  const override = process.env.PEARLEDGER_ROOT?.trim()
  if (override) {
    cachedAppRoot = path.resolve(override)
    return cachedAppRoot
  }

  const dir = moduleDir()
  cachedAppRoot = dir ? path.resolve(dir, '..', '..') : dataDir()
  return cachedAppRoot
}

/**
 * Directorio de datos mutables del usuario.
 * Sigue la XDG Base Directory Specification en Linux y el equivalente por
 * plataforma en macOS/Windows. Nunca dentro del bundle: en standalone el
 * bundle es de solo lectura.
 */
export function dataDir(): string {
  if (cachedDataDir) return cachedDataDir

  const override = process.env.PEARLEDGER_DATA_DIR?.trim()
  if (override) {
    cachedDataDir = path.resolve(override)
    return cachedDataDir
  }

  cachedDataDir = path.join(platformDataHome(), APP_DIR_NAME)
  return cachedDataDir
}

function platformDataHome(): string {
  const home = safeHomedir()

  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA?.trim() || path.join(home, 'AppData', 'Local')
  }

  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support')
  }

  return process.env.XDG_DATA_HOME?.trim() || path.join(home, '.local', 'share')
}

function safeHomedir(): string {
  try {
    const home = os.homedir()
    if (home) return home
  } catch {
    // bare-os puede no exponer homedir en algunas plataformas
  }
  return process.env.HOME?.trim() || process.env.USERPROFILE?.trim() || os.tmpdir()
}

/**
 * Directorio del workspace (facturas, órdenes de compra, inventario).
 *
 * Es contenido mutable, así que vive bajo `dataDir()` salvo que exista en el
 * árbol del repo, que es el caso de desarrollo y el de los fixtures de test.
 */
export function workspaceRoot(): string {
  const override = process.env.PEARLEDGER_WORKSPACE?.trim()
  if (override) return path.resolve(override)

  const inRepo = path.join(appRoot(), 'workspace')
  return existsSync(inRepo) ? inRepo : path.join(dataDir(), 'workspace')
}

export function workspaceDir(...segments: string[]): string {
  return path.join(workspaceRoot(), ...segments)
}

/** Cache de imágenes derivadas del OCR — siempre mutable, nunca en el bundle. */
export function ocrCacheDir(): string {
  return path.join(dataDir(), 'ocr-cache')
}

/** Solo para tests: olvida las rutas memoizadas. */
export function resetPaths(): void {
  cachedAppRoot = null
  cachedDataDir = null
}

function existsSync(target: string): boolean {
  try {
    return fs.existsSync(target)
  } catch {
    return false
  }
}
