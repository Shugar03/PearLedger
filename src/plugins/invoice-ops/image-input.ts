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

/**
 * Intérpretes a probar, en orden.
 *
 * `python3` primero: es lo que hay en Linux y en macOS. `py` al final por
 * Windows, donde es el lanzador oficial y a veces lo único que resuelve a un
 * intérprete real — el `python3` del PATH suele ser el alias de la Store, que
 * no ejecuta nada y sólo abre la tienda.
 */
const PYTHON_CANDIDATES = ['python3', 'python', 'py'] as const

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

export interface ResolveImageOptions {
  /**
   * Lado largo máximo en píxeles. `false` = imagen original (recomendado para
   * DocTR / EasyOCR). Sólo Path B multimodal necesita reducir.
   */
  maxEdge?: number | false
}

/**
 * Rasteriza la primera página de un PDF a PNG: `pdftoppm` o PyMuPDF.
 *
 * Devuelve `true` si generó el PNG. Si no pudo, deja en `attempts` qué se
 * probó y con qué resultado — sin eso, el error final decía qué instalar
 * pero no cuál de las dos vías había fallado ni por qué.
 */
async function rasterPdfFirstPage(
  pdfPath: string,
  pngPath: string,
  attempts: Map<string, string> = new Map()
): Promise<boolean> {
  const outPrefix = pngPath.replace(/\.png$/i, '')

  /** Primer motivo por herramienta, recortado: el mensaje se lee en la UI. */
  const note = (tool: string, why: string): void => {
    if (attempts.has(tool)) return
    const clean = why.split(/\r?\n/)[0]?.trim() ?? ''
    // El alias de la Microsoft Store contesta con un párrafo entero.
    const short = /Microsoft Store|Windows Apps/i.test(clean)
      ? 'alias de la Microsoft Store, no es un intérprete'
      : clean.length > 70
        ? `${clean.slice(0, 70)}…`
        : clean || 'falló sin decir por qué'
    attempts.set(tool, short)
  }
  const pdftoppm = await new Promise<boolean>((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(
        'pdftoppm',
        ['-png', '-singlefile', '-f', '1', '-l', '1', pdfPath, outPrefix],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      )
    } catch {
      resolve(false)
      return
    }

    let stderr = ''
    child.stderr?.on('data', (chunk: unknown) => {
      stderr += String(chunk)
    })
    child.on('error', () => {
      note('pdftoppm', 'no está instalado')
      resolve(false)
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true)
        return
      }
      const detail = stderr.trim() || `salió con ${code}`
      note('pdftoppm', detail)
      log.debug(`pdftoppm falló (${code}): ${detail}`)
      resolve(false)
    })
  })
  if (pdftoppm && (await exists(pngPath))) return true

  // PyMuPDF se importa como `pymupdf` desde la 1.24; `fitz` es el nombre viejo
  // y sigue existiendo, pero una instalación nueva puede no traerlo.
  const PDF_RASTER_SCRIPT = `
import sys
try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        sys.exit(2)
doc = fitz.open(sys.argv[1])
pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
pix.save(sys.argv[2])
`

  for (const interpreter of PYTHON_CANDIDATES) {
    const outcome = await new Promise<{ ok: boolean; why: string }>((resolve) => {
      let child: ReturnType<typeof spawn>
      try {
        child = spawn(interpreter, ['-c', PDF_RASTER_SCRIPT, pdfPath, pngPath], {
          stdio: ['ignore', 'ignore', 'pipe']
        })
      } catch {
        resolve({ ok: false, why: 'no se pudo lanzar' })
        return
      }

      let stderr = ''
      child.stderr?.on('data', (chunk: unknown) => {
        stderr += String(chunk)
      })
      child.on('error', () => resolve({ ok: false, why: 'no está instalado' }))
      child.on('close', (code) => {
        // El 2 lo devuelve el propio script cuando no encuentra PyMuPDF.
        if (code === 0) resolve({ ok: true, why: '' })
        else if (code === 2) resolve({ ok: false, why: 'sin PyMuPDF' })
        else resolve({ ok: false, why: stderr.trim().split('\n').pop() ?? `salió con ${code}` })
      })
    })

    if (outcome.ok && (await exists(pngPath))) {
      log.info(`PDF rasterizado con ${interpreter}: ${pngPath}`)
      return true
    }
    note(interpreter, outcome.why)
  }

  return false
}

/**
 * Si `filePath` es PDF y no existe el PNG companion, intenta rasterizarlo.
 * Devuelve la ruta lista para OCR (imagen o PNG generado).
 */
export async function ensurePdfRasterized(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  if (IMAGE_EXTENSIONS.has(ext)) {
    const found = await locate(filePath)
    if (!found) throw new Error(`No se encontró la imagen: ${filePath}`)
    return found
  }

  if (ext !== '.pdf') {
    throw new Error(`Formato no soportado para OCR: ${ext || '(sin extensión)'}`)
  }

  // Antes se iba directo a rasterizar: un PDF inexistente terminaba culpando al
  // rasterizador en vez de decir que el archivo no está.
  const pdf = await locate(filePath)
  if (!pdf) throw new Error(`No se encontró el PDF: ${filePath}`)

  const pngPath = pdf.replace(/\.pdf$/i, '.png')
  if (await exists(pngPath)) return pngPath

  const attempts = new Map<string, string>()
  if (await rasterPdfFirstPage(pdf, pngPath, attempts)) return pngPath

  const tried = [...attempts].map(([tool, why]) => `${tool}: ${why}`).join(' · ')
  throw new Error(
    `No se pudo rasterizar el PDF (${tried}). ` +
      `Instalá PyMuPDF con "pip install pymupdf", o generá el PNG a mano: ` +
      `pdftoppm -png -singlefile "${pdf}" "${pngPath.replace(/\.png$/i, '')}"`
  )
}

async function locateSource(filePath: string): Promise<string> {
  return ensurePdfRasterized(filePath)
}

/**
 * Resuelve la ruta de imagen y, si se pide, devuelve una copia reducida en cache.
 */
export async function resolveInvoiceImagePath(
  filePath: string,
  options: ResolveImageOptions = {}
): Promise<string> {
  const resolved = await locateSource(filePath)
  const maxEdge = options.maxEdge ?? false
  if (maxEdge === false || !Number.isFinite(maxEdge) || maxEdge <= 0) return resolved

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
