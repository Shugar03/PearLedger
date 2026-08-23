/**
 * Cómo se lee el veredicto de la conciliación 3-way.
 *
 * Los cuatro estados salen de `match_purchase_order`; el quinto — `pending` —
 * es el nuestro, para la factura que se leyó pero todavía no se comparó. Acá
 * sólo vive la forma; el texto lo pone el diccionario.
 */
import type { Dict } from '@dashboard/i18n'

export type VerdictKey = keyof Dict['verdicts']

export interface Verdict {
  key: VerdictKey
  pill: string
  tone: 'ok' | 'warn'
  /** Cuánto del recorrido factura → orden conciliada cubre este estado. */
  ratio: number
}

const VERDICTS: Record<VerdictKey, Verdict> = {
  matched: { key: 'matched', pill: 'pill pill--ok', tone: 'ok', ratio: 1 },
  vendor_mismatch: { key: 'vendor_mismatch', pill: 'pill pill--warn', tone: 'warn', ratio: 0.66 },
  amount_mismatch: { key: 'amount_mismatch', pill: 'pill pill--warn', tone: 'warn', ratio: 0.66 },
  no_match: { key: 'no_match', pill: 'pill pill--wait', tone: 'warn', ratio: 0.5 },
  pending: { key: 'pending', pill: 'pill pill--wait', tone: 'warn', ratio: 0.33 }
}

/** Un estado desconocido se trata como "sin orden": no se inventa un texto. */
export function verdictOf(status: string): Verdict {
  return VERDICTS[status as VerdictKey] ?? VERDICTS.no_match
}

/** Los filtros de la lista del Dashboard, en el orden en que se muestran. */
export const INVOICE_FILTERS = ['all', 'matched', 'mismatch', 'no_match'] as const

export type InvoiceFilter = (typeof INVOICE_FILTERS)[number]

export function matchesFilter(status: string, filter: InvoiceFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'matched') return status === 'matched'
  if (filter === 'no_match') return status === 'no_match' || status === 'pending'
  return status === 'vendor_mismatch' || status === 'amount_mismatch'
}
