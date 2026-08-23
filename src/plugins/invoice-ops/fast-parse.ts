/**
 * Extracción determinística de facturas a partir del texto OCR.
 *
 * Cuando DocTR + layout producen filas legibles, un LLM local es redundante
 * para el 70–80% de facturas SME con layout tabular. Este módulo intenta
 * parsear antes de invocar Qwen; si la confianza es baja, el caller cae al LLM.
 */

import { parseAmount } from './amounts.js'
import type { Invoice } from './schema.js'

export interface FastParseResult {
  invoice: Invoice
  confidence: number
  method: 'rules'
}


const DATE_ISO = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/
const DATE_YMD = /\b(\d{4})-(\d{2})-(\d{2})\b/
const DATE_SPANISH =
  /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/i
const DATE_FECHA = /(?:fecha|date)\s*[:\-]\s*(.+)/i

const TABLE_HEADER =
  /descripci[oó]n|description|precio|price|cantidad|qty|quantity|total|horas|hora|monto|subtotal/i
const TOTAL_ROW = /^total\b/i
const SUBTOTAL_ROW = /sub-?total/i
const TAX_ROW = /(?:impuesto|descuento|tax|iva)\b/i

const AMOUNT_TOKEN = /[$]?\s*([\d.,]+)/g

const SKIP_VENDOR = /^(factura|invoice|presupuesto|sociedad|cliente|informaci[oó]n|descripci[oó]n|contacto|pagar|banco|firma|total|sub-?total)$/i

function rows(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function detectCurrency(text: string): string {
  if (/\bARS\b/i.test(text) || /[$]\s*[\d.,]+/.test(text)) return 'USD'
  if (/\bEUR\b/i.test(text)) return 'EUR'
  if (/\bCLP\b/i.test(text)) return 'CLP'
  return 'USD'
}

function extractInvoiceNumber(lines: string[]): string | null {
  for (const line of lines.slice(0, 15)) {
    const tagged = line.match(/(?:factura|invoice)\s*#\s*([A-Z0-9][\w-]+)/i)
    if (tagged?.[1]) return tagged[1]

    const hash = line.match(/#\s*([A-Z0-9][\w-]{2,24}|\d{3,12})/i)
    if (hash?.[1]) return hash[1]

    const labeled = line.match(
      /(?:factura|invoice|presupuesto)\s*(?:n[o°'´`"]?\s*[#:.]?\s*|no[:\s]+)([A-Z0-9][\w-]{2,24}|\d{3,12})/i
    )
    if (labeled?.[1]) return labeled[1]

    const noOnly = line.match(/\bno[:\s]+([A-Z0-9][\w-]{2,24}|\d{3,12})\b/i)
    if (noOnly?.[1]) return noOnly[1]
  }
  return null
}

function extractDate(lines: string[]): string {
  for (const line of lines.slice(0, 20)) {
    const fecha = line.match(DATE_FECHA)
    if (fecha?.[1]) {
      const rest = fecha[1].trim()
      const ymd = rest.match(DATE_YMD)
      if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
      return rest
    }

    const es = line.match(DATE_SPANISH)
    if (es) return `${es[1]} de ${es[2]} de ${es[3]}`

    const ymd = line.match(DATE_YMD)
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`

    const iso = line.match(DATE_ISO)
    if (iso) return line.trim()
  }
  return ''
}

function extractVendor(lines: string[]): string {
  for (const line of lines.slice(0, 16)) {
    const labeled = line.match(
      /(?:vendor|proveedor|supplier|from|de)\s*[:\-]\s*(.+)/i
    )
    if (labeled?.[1]) {
      const name = labeled[1].trim()
      if (name.length >= 2 && name.length <= 80) return name
    }
  }

  const candidates: string[] = []
  for (const line of lines.slice(0, 12)) {
    if (TABLE_HEADER.test(line) || SKIP_VENDOR.test(line)) continue
    if (/^\d+$/.test(line)) continue
    if (/(?:invoice|factura|po\s*reference|currency|date|fecha)\b/i.test(line)) continue
    if (line.length < 2 || line.length > 60) continue
    candidates.push(line)
  }
  return candidates[0] ?? ''
}

function amountsInLine(line: string): number[] {
  const out: number[] = []
  for (const m of line.matchAll(AMOUNT_TOKEN)) {
    const raw = m[1]
    if (!raw) continue
    const n = parseAmount(raw)
    if (n !== null && n > 0) out.push(n)
  }
  return out
}

/** Elige qty/unit cuando hay 3 montos: ambos órdenes (qty×price) pueden cuadrar. */
function pickQuantityAndUnit(
  a: number,
  b: number,
  total: number
): { quantity: number; unitPrice: number } {
  const tol = Math.max(0.02, total * 0.05)
  const productOk = Math.abs(a * b - total) <= tol

  if (!productOk) {
    // Asumir orden qty, unit, total (inglés / tabular SME).
    return { quantity: a, unitPrice: b }
  }

  const aInt = Math.abs(a - Math.round(a)) < 0.01
  const bInt = Math.abs(b - Math.round(b)) < 0.01

  if (aInt && !bInt) return { quantity: a, unitPrice: b }
  if (bInt && !aInt) return { quantity: b, unitPrice: a }
  if (aInt && bInt) {
    // Ambos enteros: la cantidad suele ser la menor (1 × 100, no 100 × 1).
    return a <= b ? { quantity: a, unitPrice: b } : { quantity: b, unitPrice: a }
  }

  return { quantity: a, unitPrice: b }
}

function extractLineItems(lines: string[]): Invoice['lineItems'] {
  const items: Invoice['lineItems'] = []
  let inTable = false

  for (const line of lines) {
    if (TABLE_HEADER.test(line) && /precio|price|total|cantidad|qty|quantity|horas/i.test(line)) {
      inTable = true
      continue
    }
    if (!inTable) continue
    if (TOTAL_ROW.test(line) || SUBTOTAL_ROW.test(line) || TAX_ROW.test(line)) break

    const amounts = amountsInLine(line)
    if (amounts.length < 2) continue

    const desc = line
      .replace(/[$]?\s*[\d.,]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (desc.length < 2) continue

    const total = amounts[amounts.length - 1]!
    let quantity: number
    let unitPrice: number
    if (amounts.length >= 3) {
      const picked = pickQuantityAndUnit(
        amounts[amounts.length - 3]!,
        amounts[amounts.length - 2]!,
        total
      )
      quantity = picked.quantity
      unitPrice = picked.unitPrice
    } else {
      quantity = 1
      unitPrice = amounts[0]!
    }

    items.push({
      description: desc,
      quantity,
      unitPrice,
      total
    })
  }

  return items
}

function extractTotals(lines: string[]): { subtotal: number; tax: number; total: number } {
  let subtotal = 0
  let tax = 0
  let total = 0

  for (const line of lines) {
    const amounts = amountsInLine(line)
    if (amounts.length === 0) continue
    const value = amounts[amounts.length - 1]!

    if (TOTAL_ROW.test(line) && !SUBTOTAL_ROW.test(line)) {
      total = value
    } else if (SUBTOTAL_ROW.test(line)) {
      subtotal = value
    } else if (TAX_ROW.test(line)) {
      tax = value
    }
  }

  if (total === 0 && subtotal > 0) total = subtotal + tax
  if (subtotal === 0 && total > 0) subtotal = Math.max(0, total - tax)

  return { subtotal, tax, total }
}

function score(invoice: Invoice): number {
  let points = 0
  if (invoice.invoiceNumber) points += 0.2
  if (invoice.vendor.length >= 2) points += 0.15
  if (invoice.date) points += 0.1
  if (invoice.lineItems.length > 0) points += 0.2
  if (invoice.total > 0) points += 0.2
  if (invoice.subtotal > 0) points += 0.1
  if (invoice.lineItems.length > 0) {
    const linesOk = invoice.lineItems.filter(
      (li) => Math.abs(li.quantity * li.unitPrice - li.total) <= Math.max(0.02, li.total * 0.05)
    ).length
    points += 0.15 * (linesOk / invoice.lineItems.length)
  }
  return Math.min(1, points)
}

/**
 * Intenta extraer una factura sin LLM.
 * Devuelve `null` si no hay datos mínimos o la confianza es demasiado baja.
 */
export function fastParseInvoice(
  rawText: string,
  options: { minConfidence?: number } = {}
): FastParseResult | null {
  const minConfidence = options.minConfidence ?? 0.75
  const lines = rows(rawText)
  if (lines.length < 3) return null

  const invoiceNumber = extractInvoiceNumber(lines)
  const vendor = extractVendor(lines)
  const date = extractDate(lines)
  const lineItems = extractLineItems(lines)
  const totals = extractTotals(lines)

  if (!invoiceNumber || totals.total <= 0) return null

  const invoice: Invoice = {
    vendor: vendor || 'Desconocido',
    invoiceNumber,
    date,
    lineItems,
    subtotal: totals.subtotal || totals.total,
    tax: totals.tax,
    total: totals.total,
    currency: detectCurrency(rawText)
  }

  const confidence = score(invoice)
  if (confidence < minConfidence) return null

  return { invoice, confidence, method: 'rules' }
}
