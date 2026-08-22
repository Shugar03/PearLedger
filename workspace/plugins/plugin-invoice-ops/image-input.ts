import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.gif'])

/** Lado largo máximo antes de Path B (evita overflow ctx 4096). */
const MAX_EDGE = Number(process.env.QVAC_OCR_MAX_EDGE || 896)

function runPythonResize(inputPath: string, outputPath: string, maxEdge: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = `
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
print(f"{w}x{h}->{im.size[0]}x{im.size[1]}")
`
    const child = spawn('python', ['-c', script, inputPath, outputPath, String(maxEdge)], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let err = ''
    child.stderr.on('data', (d) => {
      err += d
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err || `python resize exit ${code}`))
    })
  })
}

/** Resuelve PDF → PNG companion o imagen; opcionalmente downscale para OCR. */
export async function resolveInvoiceImagePath(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  let resolved = filePath

  if (IMAGE_EXTENSIONS.has(ext)) {
    await access(filePath)
    resolved = filePath
  } else if (ext === '.pdf') {
    const pngPath = filePath.replace(/\.pdf$/i, '.png')
    try {
      await access(pngPath)
      resolved = pngPath
    } catch {
      throw new Error(
        `PDF requiere raster previo: generar ${pngPath} (pdftoppm -png "${filePath}" out)`
      )
    }
  } else {
    throw new Error(`Formato no soportado para OCR: ${ext || '(sin extensión)'}`)
  }

  if (!MAX_EDGE || MAX_EDGE <= 0) return resolved

  const abs = path.isAbsolute(resolved) ? resolved : path.join(process.cwd(), resolved)
  const ocrDir = path.join(process.cwd(), 'workspace', 'invoices', '.ocr-cache')
  await mkdir(ocrDir, { recursive: true })
  const cached = path.join(
    ocrDir,
    `${path.basename(abs, path.extname(abs))}-e${MAX_EDGE}.png`
  )

  try {
    await access(cached)
    return cached
  } catch {
    // generate
  }

  try {
    await runPythonResize(abs, cached, MAX_EDGE)
    console.error(`[ocr] resized → ${cached} (maxEdge=${MAX_EDGE})`)
    return cached
  } catch (err) {
    console.warn(
      `[ocr] resize omitido (${err instanceof Error ? err.message : err}) — usando original`
    )
    return resolved
  }
}
