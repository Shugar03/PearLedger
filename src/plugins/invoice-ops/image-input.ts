/**
 * Resolución de la imagen que se le entrega al OCR.
 *
 * Dos cosas que antes estaban mal:
 *
 *  1. El cache de imágenes redimensionadas colgaba del directorio de trabajo,
 *     así que la app escribía en sitios distintos —o fallaba con ENOENT— según
 *     desde dónde se la invocara. Ahora usa `ocrCacheDir()`, bajo el directorio
 *     de datos del usuario.
 *  2. El redimensionado dependía del binario `python`, que en Linux moderno se
 *     llama `python3` y en muchas máquinas no existe. Se prueban ambos, se
 *     distingue "no hay intérprete" de "el script falló" y en cualquiera de los
 *     dos casos se degrada a la imagen original con un aviso legible.
 *
 * No se añaden dependencias npm: el redimensionado es una optimización para no
 * desbordar el contexto de Path B, no un requisito.
 */

import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { getConfig } from '@config/index.js'
import { getLogger } from '@shared/logger.js'
import { appRoot, ocrCacheDir } from '@shared/paths.js'

const log = getLogger('invoice-ops:image')

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.bmp',
  '.webp',
  '.gif'
])

/** Intérpretes a probar, en orden. `python3` primero: es lo que hay en Linux. */
const PYTHON_CANDIDATES = ['python3', 'python'] as const

const RESIZE_SCRIPT = `
from PIL import Image
import sys
src, dst, max_edge = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src)
im = im.convert("RGB")
w, h = im.size
scale = min(1.0, max_edge / float(max(w, h)))
if scale < 1.0:
    im = im.resize((max(1, int(w*scale)), max(1, int(h*scale))), Image.Resampling.LANCZOS)
im.save(dst, format="PNG", optimize=True)
sys.stderr.write("%dx%d->%dx%d" % (w, h, im.size[0], im.size[1]))
`

type ResizeOutcome =
  | { ok: true; detail: string }
  /** El intérprete no existe en el PATH: probamos el siguiente candidato. */
  | { ok: false; missingInterpreter: true; detail: string }
  /** El intérprete existe pero el script falló (sin Pillow, imagen corrupta…). */
  | { ok: false; missingInterpreter: false; detail: string }

function runPythonResize(
  interpreter: string,
  inputPath: string,
  outputPath: string,
  maxEdge: number
): Promise<ResizeOutcome> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(interpreter, ['-c', RESIZE_SCRIPT, inputPath, outputPath, String(maxEdge)], {
        stdio: ['ignore', 'ignore', 'pipe']
      })
    } catch (err) {
      resolve({
        ok: false,
        missingInterpreter: true,
        detail: err instanceof Error ? err.message : String(err)
      })
      return
    }

    let stderr = ''
    let settled = false
    const settle = (outcome: ResizeOutcome): void => {
      if (settled) return
      settled = true
      resolve(outcome)
    }

    child.stderr?.on('data', (chunk: unknown) => {
      stderr += String(chunk)
    })

    // ENOENT aquí = el binario no está en el PATH. Es un caso distinto de que
    // el script reviente, y merece un mensaje distinto.
    child.on('error', (err: NodeJS.ErrnoException) => {
      settle({
        ok: false,
        missingInterpreter: err?.code === 'ENOENT',
        detail: err?.message ?? String(err)
      })
    })

    child.on('close', (code: number | null) => {
      if (code === 0) {
        settle({ ok: true, detail: stderr.trim() })
        return
      }
      settle({
        ok: false,
        missingInterpreter: false,
        detail: stderr.trim() || `${interpreter} terminó con código ${code}`
      })
    })
  })
}

/**
 * Redimensiona con el primer intérprete disponible.
 * Devuelve `null` si ninguno sirvió — el llamador degrada al original.
 */
async function resizeWithAnyPython(
  inputPath: string,
  outputPath: string,
  maxEdge: number
): Promise<string | null> {
  const failures: string[] = []

  for (const interpreter of PYTHON_CANDIDATES) {
    const outcome = await runPythonResize(interpreter, inputPath, outputPath, maxEdge)
    if (outcome.ok) {
      log.debug(`redimensionado con ${interpreter}: ${outcome.detail || 'ok'}`)
      return outputPath
    }

    failures.push(
      outcome.missingInterpreter
        ? `${interpreter}: no está instalado`
        : `${interpreter}: ${outcome.detail}`
    )

    // Si el intérprete existe pero el script falló (p. ej. falta Pillow),
    // probar el siguiente no cuesta nada y a veces sí lo tiene.
  }

  log.warn(`redimensionado omitido — se usa la imagen original (${failures.join('; ')})`)
  return null
}

/** Hash estable y barato (djb2) para desambiguar basenames iguales en el cache. */
function shortHash(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36).padStart(7, '0')
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

/**
 * Localiza el archivo.
 *
 * Una ruta relativa se prueba tal cual (`fs` la resuelve contra el cwd del
 * proceso, que es lo que espera quien escribe una ruta en la CLI) y, si no
 * existe, contra la raíz de la aplicación. Ningún módulo consulta el cwd.
 */
async function locate(filePath: string): Promise<string | null> {
  if (await exists(filePath)) return filePath
  if (path.isAbsolute(filePath)) return null

  const fromAppRoot = path.join(appRoot(), filePath)
  return (await exists(fromAppRoot)) ? fromAppRoot : null
}

/**
 * Resuelve PDF → PNG companion o imagen directa y, si procede, devuelve una
 * copia reducida para no desbordar el contexto del modelo multimodal.
 */
export async function resolveInvoiceImagePath(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  let resolved: string

  if (IMAGE_EXTENSIONS.has(ext)) {
    const found = await locate(filePath)
    if (!found) throw new Error(`No se encontró la imagen: ${filePath}`)
    resolved = found
  } else if (ext === '.pdf') {
    const pdf = (await locate(filePath)) ?? filePath
    const pngPath = pdf.replace(/\.pdf$/i, '.png')
    if (!(await exists(pngPath))) {
      throw new Error(
        `PDF requiere raster previo: generar ${pngPath} (pdftoppm -png "${pdf}" out)`
      )
    }
    resolved = pngPath
  } else {
    throw new Error(`Formato no soportado para OCR: ${ext || '(sin extensión)'}`)
  }

  const maxEdge = getConfig().qvac.ocrMaxEdge
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) return resolved

  const cacheDir = ocrCacheDir()
  const base = path.basename(resolved, path.extname(resolved))
  const cached = path.join(cacheDir, `${base}-${shortHash(resolved)}-e${maxEdge}.png`)

  if (await exists(cached)) return cached

  try {
    await mkdir(cacheDir, { recursive: true })
  } catch (err) {
    log.warn(
      `no se pudo crear el cache de OCR (${err instanceof Error ? err.message : String(err)}) — se usa la imagen original`
    )
    return resolved
  }

  const produced = await resizeWithAnyPython(resolved, cached, maxEdge)
  return produced ?? resolved
}
