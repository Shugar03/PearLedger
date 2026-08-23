/**
 * Similitud de nombres de proveedor.
 *
 * Módulo **puro**: sin IO, sin red, sin QVAC, sin `getConfig()`. Es el corazón
 * de la decisión "¿esta factura es de la misma empresa que la orden de compra?"
 * y por eso tiene que poder testearse con una tabla de casos, sin arrancar
 * ningún modelo.
 *
 * El OCR muta letras y pierde puntuación, así que la comparación es tolerante:
 * normaliza acentos y puntuación, descarta sufijos societarios y acepta
 * prefijos comunes entre tokens.
 */

/** Sufijos societarios y conectores que no aportan señal al comparar proveedores. */
const VENDOR_STOPWORDS: ReadonlySet<string> = new Set([
  'sa',
  'srl',
  'sas',
  'sl',
  'inc',
  'llc',
  'ltd',
  'ltda',
  'co',
  'corp',
  'company',
  'gmbh',
  'bv',
  'nv',
  'plc',
  'the',
  'de',
  'del',
  'la',
  'los',
  'and',
  'y'
])

/**
 * Minúsculas, sin acentos y sin puntuación. Deja `$` y `-` porque aparecen en
 * descripciones de ítems, que se normalizan con la misma función.
 */
export function normalize(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Sin puntuación "S.A." ≈ "SA" al comparar proveedores.
    .replace(/[^a-z0-9\s$-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Igualdad blanda de proveedor: ignora puntos y espaciado del OCR. */
export function vendorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalize(a).replace(/\s+/g, '')
  const nb = normalize(b).replace(/\s+/g, '')
  if (!na || !nb) return false
  if (na === nb) return true
  return na.includes(nb) || nb.includes(na)
}

/** Tokens significativos de un nombre comercial, sin stopwords ni ruido. */
export function vendorTokens(value: string | null | undefined): string[] {
  return normalize(value)
    .split(' ')
    .map((token) => token.replace(/[.$-]/g, ''))
    .filter((token) => token.length > 1 && !VENDOR_STOPWORDS.has(token))
}

/** Coincidencia parcial: el OCR muta letras, así que un prefijo común ya cuenta. */
export function tokenAffinity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4))) return 0.6
  }
  return 0
}

/**
 * Score en `[0, 1]`. `1` cuando los nombres normalizados coinciden o uno
 * contiene al otro; si no, media armónica de las afinidades por token.
 */
export function vendorSimilarity(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  if (vendorsMatch(a, b)) return 1

  const left = vendorTokens(a)
  const right = vendorTokens(b)
  if (!left.length || !right.length) return 0

  let score = 0
  for (const token of left) {
    let best = 0
    for (const other of right) best = Math.max(best, tokenAffinity(token, other))
    score += best
  }

  return Math.min(1, (2 * score) / (left.length + right.length))
}
