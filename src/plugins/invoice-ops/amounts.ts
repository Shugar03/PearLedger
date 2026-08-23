/**
 * Normalización de importes del OCR a formato canónico (punto decimal).
 *
 * Las facturas de prueba mezclan las dos convenciones: `$2.500,34` (es-AR) y
 * `$450.00` (en-US). El LLM decidía sola cuál era cuál y se equivocaba en la
 * dirección peor: leía `$14.450,50` como `14450.50` unas veces y como
 * `1445050` otras, produciendo totales cien veces mayores que pasaban las
 * validaciones porque la aritmética interna seguía siendo consistente.
 *
 * Resolverlo con un prompt es pedirle determinismo a un modelo. Aquí se decide
 * antes, con una regla mecánica: **el último separador manda**. Si le siguen una
 * o dos cifras es el decimal; si le siguen tres, es separador de miles.
 * `2.500,34` → `2500.34`, `20.000` → `20000`, `450.00` → `450.00`.
 *
 * Lo que no parece un importe no se toca: fechas (`02.06.2023`), teléfonos
 * (`1234-5678`), números de cuenta y porcentajes quedan intactos.
 */

/**
 * Un importe es un grupo de cifras con separadores de miles y/o decimales.
 *
 * Los bordes son deliberadamente restrictivos: no se acepta un candidato pegado
 * a más dígitos o a otro separador seguido de dígito, que es lo que distingue
 * `2.500,34` de la fecha `02.06.2023` o del teléfono `15-1234-5678`.
 */
const AMOUNT_PATTERN =
  /(?<![\d.,\-/])(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2})(?![\d]|[.,\-/]\d)/g

/**
 * Convierte un importe suelto a número.
 * Devuelve `null` si no tiene forma de importe.
 */
export function parseAmount(raw: string): number | null {
  const compact = raw.trim().replace(/\s/g, '')
  if (!/^\d[\d.,]*$/.test(compact)) return null

  const canonical = canonicalize(compact)
  const value = Number(canonical)
  return Number.isFinite(value) ? value : null
}

/** Reescribe un importe ya aislado. Asume que `raw` sólo tiene cifras y separadores. */
function canonicalize(raw: string): string {
  const lastSeparator = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','))
  if (lastSeparator === -1) return raw

  const decimals = raw.length - lastSeparator - 1
  const digitsOnly = (value: string): string => value.replace(/[.,]/g, '')

  // Tres cifras tras el último separador: es agrupación de miles, no decimales.
  // Un importe con tres decimales es rarísimo en una factura; uno en miles, la
  // norma. Ante la duda, la lectura que no multiplica por mil.
  if (decimals === 3) return digitsOnly(raw)

  if (decimals === 1 || decimals === 2) {
    const integerPart = digitsOnly(raw.slice(0, lastSeparator))
    const decimalPart = raw.slice(lastSeparator + 1)
    return `${integerPart}.${decimalPart}`
  }

  return digitsOnly(raw)
}

/**
 * Normaliza todos los importes de un texto de OCR.
 *
 * Se aplica antes de la extracción estructurada para que el modelo reciba una
 * sola convención numérica.
 */
export function normalizeAmounts(text: string): string {
  return text.replace(AMOUNT_PATTERN, (match) => canonicalize(match))
}
