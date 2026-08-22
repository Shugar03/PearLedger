/**
 * Comparación 3-way (factura ↔ orden de compra) y cálculo de confianza.
 *
 * Módulo **puro**: sin IO, sin red, sin QVAC y sin `getConfig()`. Los umbrales
 * entran por parámetro precisamente para que sea así — quien conoce la
 * configuración es `matcher.ts`, que la lee una vez y la inyecta aquí.
 */

import type { PurchaseOrder } from './purchase-orders.js'
import type { Invoice } from './schema.js'
import { vendorSimilarity } from './vendor-match.js'

export interface MatchDiscrepancy {
  field: string
  invoice: unknown
  purchaseOrder: unknown
  severity: 'warning' | 'error'
}

export interface ThreeWayThresholds {
  /** Por debajo de esto el proveedor se considera distinto (discrepancia `error`). */
  vendorMinSimilarity: number
  /** Por encima de esto el proveedor es el mismo pese al ruido del OCR. */
  vendorMatchSimilarity: number
  /** Tolerancia absoluta al comparar montos, en unidades de la moneda. */
  amountTolerance: number
}

export const DEFAULT_THRESHOLDS: ThreeWayThresholds = {
  vendorMinSimilarity: 0.34,
  vendorMatchSimilarity: 0.75,
  amountTolerance: 0.01
}

/** Confianza mínima para dar una factura por conciliada. */
export const MATCH_CONFIDENCE_THRESHOLD = 0.55

/**
 * Discrepancias entre factura y PO.
 *
 * Severidades: `error` bloquea la conciliación (proveedor distinto, total,
 * cantidades, precio unitario); `warning` sólo penaliza la confianza.
 */
export function compareThreeWay(
  invoice: Invoice,
  po: PurchaseOrder,
  thresholds: ThreeWayThresholds = DEFAULT_THRESHOLDS
): MatchDiscrepancy[] {
  const discrepancies: MatchDiscrepancy[] = []
  const tolerance = thresholds.amountTolerance

  const vendorSim = vendorSimilarity(invoice.vendor, po.vendor)
  if (vendorSim < thresholds.vendorMatchSimilarity) {
    discrepancies.push({
      field: 'vendor',
      invoice: invoice.vendor,
      purchaseOrder: po.vendor,
      severity: vendorSim >= thresholds.vendorMinSimilarity ? 'warning' : 'error'
    })
  }

  if (Math.abs(invoice.total - po.total) > tolerance) {
    discrepancies.push({
      field: 'total',
      invoice: invoice.total,
      purchaseOrder: po.total,
      severity: 'error'
    })
  }

  if (Math.abs(invoice.subtotal - po.subtotal) > tolerance) {
    discrepancies.push({
      field: 'subtotal',
      invoice: invoice.subtotal,
      purchaseOrder: po.subtotal,
      severity: 'warning'
    })
  }

  if (invoice.lineItems.length !== po.lineItems.length) {
    discrepancies.push({
      field: 'lineItems.count',
      invoice: invoice.lineItems.length,
      purchaseOrder: po.lineItems.length,
      severity: 'warning'
    })
  }

  const maxLines = Math.max(invoice.lineItems.length, po.lineItems.length)
  for (let i = 0; i < maxLines; i++) {
    const invLine = invoice.lineItems[i]
    const poLine = po.lineItems[i]
    if (!invLine || !poLine) continue

    if (invLine.quantity !== poLine.quantity) {
      discrepancies.push({
        field: `lineItems[${i}].quantity`,
        invoice: invLine.quantity,
        purchaseOrder: poLine.quantity,
        severity: 'error'
      })
    }

    if (Math.abs(invLine.unitPrice - poLine.unitPrice) > tolerance) {
      discrepancies.push({
        field: `lineItems[${i}].unitPrice`,
        invoice: invLine.unitPrice,
        purchaseOrder: poLine.unitPrice,
        severity: 'error'
      })
    }
  }

  return discrepancies
}

/** Confianza = score de recuperación menos penalización por discrepancias. */
export function confidenceFrom(
  ragScore: number,
  discrepancies: readonly MatchDiscrepancy[]
): number {
  const base = Number.isFinite(ragScore) ? ragScore : 0
  let penalty = 0
  for (const d of discrepancies) penalty += d.severity === 'error' ? 0.25 : 0.1
  return Math.max(0, Math.min(1, base - penalty))
}

export function hasBlockingDiscrepancy(discrepancies: readonly MatchDiscrepancy[]): boolean {
  return discrepancies.some((d) => d.severity === 'error')
}
