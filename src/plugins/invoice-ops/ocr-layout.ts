/**
 * Reconstrucción del layout a partir de los bloques del OCR.
 *
 * El pipeline DocTR devuelve **una palabra por bloque**: "Tarta", "de", "peras",
 * "$5.600,25"… Concatenarlas con saltos de línea, que es lo que se hacía antes,
 * destruye la tabla: el LLM recibía una columna de fragmentos sueltos y acababa
 * leyendo el precio unitario como cantidad.
 *
 * Cada bloque trae `bbox`, así que las filas se pueden reconstruir: dos palabras
 * pertenecen a la misma línea si sus centros verticales están más cerca que la
 * altura del texto. Medido sobre las facturas de prueba, esto convierte 83
 * fragmentos en 21 filas legibles:
 *
 *     lkg de peras $2.500,34 1 $2500,34
 *
 * `confidence` se usa para avisar, no para descartar: un bloque dudoso suele ser
 * un logo o un sello, y borrarlo mutila la factura. Se reporta y decide arriba.
 */

export interface OcrBlock {
  text: string
  bbox?: [number, number, number, number]
  confidence?: number
}

export interface OcrLayout {
  /** Texto reconstruido, una línea por fila visual. */
  text: string
  rows: string[]
  blockCount: number
  /** Bloques por debajo del umbral de confianza. */
  lowConfidenceCount: number
  averageConfidence: number | null
  /** `false` si ningún bloque traía `bbox` y hubo que concatenar sin más. */
  layoutReconstructed: boolean
}

interface PositionedWord {
  text: string
  left: number
  verticalCenter: number
  height: number
}

/** Mínimo en píxeles: con texto muy pequeño la altura sola es demasiado estricta. */
const MIN_ROW_TOLERANCE_PX = 6

/** Fracción de la altura del texto dentro de la cual dos palabras son la misma fila. */
const ROW_TOLERANCE_RATIO = 0.6

function toPositionedWord(block: OcrBlock): PositionedWord | null {
  const box = block.bbox
  if (!box || box.length !== 4) return null

  const [x0, y0, x1, y1] = box
  if (![x0, y0, x1, y1].every((n) => Number.isFinite(n))) return null

  return {
    text: block.text,
    left: Math.min(x0, x1),
    verticalCenter: (y0 + y1) / 2,
    height: Math.abs(y1 - y0)
  }
}

/**
 * Agrupa palabras en filas visuales.
 *
 * Recorre de arriba abajo y compara contra el centro de la fila abierta, que se
 * promedia a medida que crece: una fila con texto de tamaños distintos (un total
 * en negrita junto a su etiqueta) va corrigiendo su propia referencia en vez de
 * quedar anclada a la primera palabra.
 */
function buildRows(words: PositionedWord[]): string[] {
  const sorted = [...words].sort((a, b) => a.verticalCenter - b.verticalCenter)
  const rows: { verticalCenter: number; words: PositionedWord[] }[] = []

  for (const word of sorted) {
    const current = rows.at(-1)
    const tolerance = Math.max(word.height * ROW_TOLERANCE_RATIO, MIN_ROW_TOLERANCE_PX)

    if (current && Math.abs(current.verticalCenter - word.verticalCenter) <= tolerance) {
      current.words.push(word)
      current.verticalCenter =
        (current.verticalCenter * (current.words.length - 1) + word.verticalCenter) /
        current.words.length
    } else {
      rows.push({ verticalCenter: word.verticalCenter, words: [word] })
    }
  }

  return rows.map((row) =>
    row.words
      .sort((a, b) => a.left - b.left)
      .map((word) => word.text.trim())
      .filter(Boolean)
      .join(' ')
  )
}

/** Reconstruye el texto de la factura a partir de los bloques del OCR. */
export function layoutOcrBlocks(
  blocks: readonly OcrBlock[],
  options: { minConfidence?: number } = {}
): OcrLayout {
  const minConfidence = options.minConfidence ?? 0
  const confidences = blocks
    .map((block) => block.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const averageConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null

  const words = blocks
    .map(toPositionedWord)
    .filter((word): word is PositionedWord => word !== null)

  // Sin bbox no hay layout que reconstruir: se respeta el orden de llegada.
  const rows =
    words.length > 0
      ? buildRows(words)
      : blocks.map((block) => block.text.trim()).filter(Boolean)

  return {
    text: rows.join('\n').trim(),
    rows,
    blockCount: blocks.length,
    lowConfidenceCount: confidences.filter((value) => value < minConfidence).length,
    averageConfidence,
    layoutReconstructed: words.length > 0
  }
}
