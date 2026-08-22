/**
 * 3-Way Match: factura ↔ orden de compra.
 *
 * Camino principal: `ragSearch()` sobre el workspace "purchase-orders", indexado
 * con GTE_LARGE_FP16. Camino de respaldo: barrido del filesystem con un score
 * heurístico. El respaldo importa — sin modelos descargados (CI, primer
 * arranque) el RAG no está y aun así hay que poder conciliar.
 *
 * La orquestación vive aquí; la comparación y la similitud de proveedor viven en
 * `three-way.ts` y `vendor-match.ts`, que son puros y testeables sin QVAC.
 */

import { ragIngest, ragSearch } from '@qvac/sdk'

import { getConfig } from '@config/index.js'
import { getLogger } from '@shared/logger.js'

import {
  indexById,
  loadPurchaseOrders,
  parsePoFromRagContent,
  poToDocument,
  type PurchaseOrder
} from './purchase-orders.js'
import { getEmbeddingModelId } from './qvac-client.js'
import type { Invoice } from './schema.js'
import {
  compareThreeWay,
  confidenceFrom,
  hasBlockingDiscrepancy,
  DEFAULT_THRESHOLDS,
  MATCH_CONFIDENCE_THRESHOLD,
  type MatchDiscrepancy,
  type ThreeWayThresholds
} from './three-way.js'
import { normalize, vendorSimilarity } from './vendor-match.js'

const log = getLogger('invoice-ops:matcher')

const RAG_WORKSPACE = 'purchase-orders'
const RAG_TOP_K = 3

export type { PurchaseOrder } from './purchase-orders.js'
export type { MatchDiscrepancy } from './three-way.js'
export { vendorSimilarity } from './vendor-match.js'

export interface MatchResult {
  invoiceId: string
  matched: boolean
  purchaseOrderId: string | null
  confidence: number
  discrepancies: MatchDiscrepancy[]
  status: string
  ragScore?: number
  vendorSimilarity?: number
  rejectedCandidate?: string
}

let poIndexReady = false
let poById: ReadonlyMap<string, PurchaseOrder> = new Map()

/** Umbrales vigentes. Se leen en cada match: la config puede cambiar entre tests. */
function thresholds(): ThreeWayThresholds {
  return {
    ...DEFAULT_THRESHOLDS,
    vendorMinSimilarity: getConfig().invoice.vendorMinSimilarity
  }
}

function emptyResult(invoiceId: string, status: string): MatchResult {
  return {
    invoiceId,
    matched: false,
    purchaseOrderId: null,
    confidence: 0,
    discrepancies: [],
    status
  }
}

/**
 * Ingesta las POs en el workspace RAG. Idempotente: sólo la primera llamada
 * hace trabajo.
 */
export async function ensurePurchaseOrderIndex(): Promise<void> {
  if (poIndexReady) return

  const orders = await loadPurchaseOrders()
  poById = indexById(orders)

  if (orders.length === 0) {
    log.warn('no hay JSON de purchase-orders en el workspace')
    poIndexReady = true
    return
  }

  const modelId = await getEmbeddingModelId()
  const documents = orders.map(poToDocument)

  log.info(`ingestando ${documents.length} POs en el workspace "${RAG_WORKSPACE}"`)
  await ragIngest({ modelId, workspace: RAG_WORKSPACE, documents, chunk: false })

  poIndexReady = true
}

/** Fuerza una reindexación en la próxima llamada. Para tests y para recargas. */
export function resetPurchaseOrderIndex(): void {
  poIndexReady = false
  poById = new Map()
}

function buildQuery(invoice: Invoice | undefined, invoiceId: string): string {
  if (invoice) {
    const lines = invoice.lineItems
      .map((i) => `${i.description} qty ${i.quantity} $${i.unitPrice}`)
      .join('; ')
    return [
      `Invoice ${invoice.invoiceNumber}`,
      `Vendor ${invoice.vendor}`,
      `Total $${invoice.total}`,
      lines
    ].join(' | ')
  }
  return invoiceId
}

interface RagHit {
  content?: string
  score?: number
}

function hitsOf(searchResult: unknown): RagHit[] {
  if (Array.isArray(searchResult)) return searchResult as RagHit[]
  const results = (searchResult as { results?: unknown } | null)?.results
  return Array.isArray(results) ? (results as RagHit[]) : []
}

/** Desenvuelve `{ invoice: {...} }`, que es lo que devuelve `parse_invoice`. */
function unwrapInvoice(value: Invoice | { invoice?: Invoice } | undefined): Invoice | undefined {
  if (!value) return undefined
  if ('invoice' in value && value.invoice) return value.invoice
  return value as Invoice
}

export async function matchPurchaseOrder(params: {
  invoiceId?: string
  invoice?: Invoice | { invoice?: Invoice }
}): Promise<MatchResult> {
  const invoice = unwrapInvoice(params.invoice)
  const invoiceId = params.invoiceId || invoice?.invoiceNumber || ''
  const limits = thresholds()

  try {
    await ensurePurchaseOrderIndex()
  } catch (err) {
    log.warn(
      `índice RAG no disponible (${err instanceof Error ? err.message : String(err)}) — fallback filesystem`
    )
    return matchFromFilesystem(invoice, invoiceId, limits)
  }

  try {
    const query = buildQuery(invoice, invoiceId)
    if (!query) return emptyResult(invoiceId, 'missing_invoice_data')

    const modelId = await getEmbeddingModelId()
    const hits = hitsOf(
      await ragSearch({ modelId, workspace: RAG_WORKSPACE, query, topK: RAG_TOP_K })
    )
    if (!hits.length) return matchFromFilesystem(invoice, invoiceId, limits)

    const candidates = hits
      .map((hit) => {
        if (!hit?.content) return null
        const po = parsePoFromRagContent(hit.content, poById)
        if (!po) return null
        return {
          po,
          ragScore: Number(hit.score ?? 0),
          vendorSim: invoice ? vendorSimilarity(invoice.vendor, po.vendor) : 1
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    if (!candidates.length) return matchFromFilesystem(invoice, invoiceId, limits)

    const chosen = candidates.find((entry) => entry.vendorSim >= limits.vendorMinSimilarity)

    if (!chosen) {
      const closest = candidates.reduce((best, entry) =>
        entry.vendorSim > best.vendorSim ? entry : best
      )
      return {
        ...emptyResult(invoiceId, 'vendor_mismatch'),
        vendorSimilarity: Number(closest.vendorSim.toFixed(3)),
        rejectedCandidate: closest.po.purchaseOrderId
      }
    }

    const { po, ragScore, vendorSim } = chosen
    const discrepancies = invoice ? compareThreeWay(invoice, po, limits) : []
    const confidence = invoice ? confidenceFrom(ragScore, discrepancies) : ragScore
    const blocking = hasBlockingDiscrepancy(discrepancies)
    const matched = confidence >= MATCH_CONFIDENCE_THRESHOLD && !blocking

    return {
      invoiceId,
      matched,
      purchaseOrderId: po.purchaseOrderId,
      confidence: Number(confidence.toFixed(3)),
      discrepancies,
      ragScore: Number(ragScore.toFixed(3)),
      vendorSimilarity: Number(vendorSim.toFixed(3)),
      status: matched ? 'matched' : blocking ? 'discrepancies_found' : 'low_confidence'
    }
  } catch (err) {
    log.warn(
      `ragSearch falló (${err instanceof Error ? err.message : String(err)}) — fallback filesystem`
    )
    return matchFromFilesystem(invoice, invoiceId, limits)
  }
}

/**
 * Respaldo sin embeddings: score heurístico sobre las POs en disco.
 * Ponderación: proveedor 0.45, total exacto 0.35, nº de ítems 0.10,
 * descripción del primer ítem 0.10.
 */
async function matchFromFilesystem(
  invoice: Invoice | undefined,
  invoiceId: string,
  limits: ThreeWayThresholds
): Promise<MatchResult> {
  const orders = await loadPurchaseOrders()
  if (!orders.length) return emptyResult(invoiceId, 'no_po_candidates')

  let best: PurchaseOrder | null = null
  let bestScore = 0
  let bestVendorSim = 0
  let closestVendorSim = 0
  let closestVendorPo: PurchaseOrder | null = null

  for (const po of orders) {
    let score = 0
    let vendorSim = 0

    if (invoice) {
      vendorSim = vendorSimilarity(invoice.vendor, po.vendor)
      if (vendorSim > closestVendorSim) {
        closestVendorSim = vendorSim
        closestVendorPo = po
      }

      const totalMatches = Math.abs(invoice.total - po.total) < limits.amountTolerance
      if (vendorSim < limits.vendorMinSimilarity && !totalMatches) continue

      score += 0.45 * vendorSim
      if (totalMatches) score += 0.35
      if (invoice.lineItems.length === po.lineItems.length) score += 0.1
      const invDesc = normalize(invoice.lineItems[0]?.description ?? '')
      const poDesc = normalize(po.lineItems[0]?.description ?? '')
      if (invDesc && poDesc && (invDesc.includes(poDesc) || poDesc.includes(invDesc))) {
        score += 0.1
      }
    } else if (invoiceId && po.purchaseOrderId.includes(invoiceId)) {
      score = 0.5
    }

    if (!best || score > bestScore) {
      bestScore = score
      bestVendorSim = vendorSim
      best = po
    }
  }

  if (!best) {
    if (!closestVendorPo) return emptyResult(invoiceId, 'no_po_candidates')
    return {
      ...emptyResult(invoiceId, 'vendor_mismatch'),
      vendorSimilarity: Number(closestVendorSim.toFixed(3)),
      rejectedCandidate: closestVendorPo.purchaseOrderId
    }
  }

  const discrepancies = invoice ? compareThreeWay(invoice, best, limits) : []
  const confidence = invoice ? confidenceFrom(bestScore, discrepancies) : bestScore
  const blocking = hasBlockingDiscrepancy(discrepancies)
  const matched = confidence >= MATCH_CONFIDENCE_THRESHOLD && !blocking

  return {
    invoiceId,
    matched,
    purchaseOrderId: best.purchaseOrderId,
    confidence: Number(confidence.toFixed(3)),
    discrepancies,
    vendorSimilarity: Number(bestVendorSim.toFixed(3)),
    status: matched ? 'matched_filesystem' : blocking ? 'discrepancies_found' : 'low_confidence'
  }
}
