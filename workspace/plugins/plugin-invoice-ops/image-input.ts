import { access } from 'node:fs/promises'
import path from 'node:path'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.gif'])

/** Resuelve PDF → PNG companion o devuelve la imagen directamente. */
export async function resolveInvoiceImagePath(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()

  if (IMAGE_EXTENSIONS.has(ext)) {
    await access(filePath)
    return filePath
  }

  if (ext === '.pdf') {
    const pngPath = filePath.replace(/\.pdf$/i, '.png')
    try {
      await access(pngPath)
      return pngPath
    } catch {
      throw new Error(
        `PDF requiere raster previo: generar ${pngPath} (pdftoppm -png "${filePath}" out)`
      )
    }
  }

  throw new Error(`Formato no soportado para OCR: ${ext || '(sin extensión)'}`)
}
