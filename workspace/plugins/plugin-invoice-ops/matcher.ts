/**
 * 3-Way Match via qvac.ragSearch() sobre workspace "purchase-orders".
 * Embeddings: GTE_LARGE_FP16 — NO indexar binarios sin OCR previo.
 *
 * Permalink jurado QVAC RAG: workspace/plugins/plugin-invoice-ops/matcher.ts
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ragIngest, ragSearch } from '@qvac/sdk'
import { getEmbeddingModelId } from './qvac-client.js'
import type { Invoice } from './schema.js'

const WORKSPACE = 'purchase-orders'
const PO_DIR = path.join(process.cwd(), 'workspace', 'purchase-orders')
const MATCH_THRESHOLD = 0.55

/** Similitud mínima de proveedor para siquiera proponer una PO. */
const VENDOR_MIN_SIMILARITY = Number(process.env.PEARLEDGER_VENDOR_MIN_SIM || 0.34)
/** Por encima de esto el proveedor se considera el mismo pese al ruido del OCR. */
const VENDOR_MATCH_SIMILARITY = 0.75

export interface PurchaseOrder {
  purchaseOrderId: string
  vendor: string
  date?: string
  currency?: string
  lineItems: Array<{
    sku?: string
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  tax: number
  total: number
  status?: string
}

export interface MatchDiscrepancy {
  field: string
  invoice: unknown
  purchaseOrder: unknown
  severity: 'warning' | 'error'
}

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
const poById = new Map<string, PurchaseOrder>()

function normalize(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.\s$-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sufijos societarios y conectores que no aportan señal al comparar proveedores. */
const VENDOR_STOPWORDS = new Set([
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

function vendorTokens(value: string | null | undefined): string[] {
  return normalize(value)
    .split(' ')
    .map((token) => token.replace(/[.$-]/g, ''))
    .filter((token) => token.length > 1 && !VENDOR_STOPWORDS.has(token))
}

/** Coincidencia parcial: el OCR muta letras, así que un prefijo común ya cuenta. */
function tokenAffinity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4))) return 0.6
  }
  return 0
}

export function vendorSimilarity(a: string | null | undefined, b: string | null | undefined): number {
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

function poToDocument(po: PurchaseOrder): string {
  const lines = po.lineItems
    .map(
      (item) =>
        `- ${item.sku ?? ''} ${item.description} Qty ${item.quantity} Unit $${item.unitPrice} Total $${item.total}`
    )
    .join('\n')

  return [
    `PURCHASE ORDER ${po.purchaseOrderId}`,
    `Vendor: ${po.vendor}`,
    `Date: ${po.date ?? ''}`,
    `Currency: ${po.currency ?? 'USD'}`,
    'Line items:',
    lines,
    `Subtotal: $${po.subtotal}`,
    `Tax: $${po.tax}`,
    `Total: $${po.total}`,
    `Status: ${po.status ?? 'approved'}`,
    `JSON:${JSON.stringify(po)}`
  ].join('\n')
}

function parsePoFromRagContent(content: string): PurchaseOrder | null {
  const jsonMarker = content.indexOf('JSON:')
  if (jsonMarker >= 0) {
    try {
      return JSON.parse(content.slice(jsonMarker + 5)) as PurchaseOrder
    } catch {
      // fall through
    }
  }

  const idMatch = content.match(/PURCHASE ORDER\s+(\S+)/i)
  if (!idMatch?.[1]) return null
  return poById.get(idMatch[1]) ?? null
}

async function loadPurchaseOrdersFromDisk(): Promise<PurchaseOrder[]> {
  const entries = await readdir(PO_DIR).catch(() => [] as string[])
  const orders: PurchaseOrder[] = []

  for (const name of entries) {
    if (!name.endsWith('.json')) continue
    const raw = await readFile(path.join(PO_DIR, name), 'utf8')
    const po = JSON.parse(raw) as PurchaseOrder
    if (!po.purchaseOrderId) continue
    poById.set(po.purchaseOrderId, po)
    orders.push(po)
  }

  return orders
}

export async function ensurePurchaseOrderIndex(): Promise<void> {
  if (poIndexReady) return

  const orders = await loadPurchaseOrdersFromDisk()
  if (orders.length === 0) {
    console.warn('[matcher] No hay purchase-orders JSON en workspace/purchase-orders/')
    poIndexReady = true
    return
  }

  const modelId = await getEmbeddingModelId()
  const documents = orders.map(poToDocument)

  console.log(`[matcher] Ingestando ${documents.length} POs en workspace "${WORKSPACE}"`)
  await ragIngest({
    modelId,
    workspace: WORKSPACE,
    documents,
    chunk: false
  })

  poIndexReady = true
}

function buildQuery(invoice?: Invoice, invoiceId?: string): string {
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
  return invoiceId || ''
}

function compareThreeWay(invoice: Invoice, po: PurchaseOrder): MatchDiscrepancy[] {
  const discrepancies: MatchDiscrepancy[] = []

  const vendorSim = vendorSimilarity(invoice.vendor, po.vendor)
  if (vendorSim < VENDOR_MATCH_SIMILARITY) {
    discrepancies.push({
      field: 'vendor',
      invoice: invoice.vendor,
      purchaseOrder: po.vendor,
      severity: vendorSim >= VENDOR_MIN_SIMILARITY ? 'warning' : 'error'
    })
  }

  if (Math.abs(invoice.total - po.total) > 0.01) {
    discrepancies.push({
      field: 'total',
      invoice: invoice.total,
      purchaseOrder: po.total,
      severity: 'error'
    })
  }

  if (Math.abs(invoice.subtotal - po.subtotal) > 0.01) {
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

    if (Math.abs(invLine.unitPrice - poLine.unitPrice) > 0.01) {
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

function confidenceFrom(ragScore: number, discrepancies: MatchDiscrepancy[]): number {
  const errorCount = discrepancies.filter((d) => d.severity === 'error').length
  const warningCount = discrepancies.filter((d) => d.severity === 'warning').length
  const penalty = errorCount * 0.25 + warningCount * 0.1
  return Math.max(0, Math.min(1, ragScore - penalty))
}

export async function matchPurchaseOrder(params: {
  invoiceId?: string
  invoice?: Invoice | { invoice?: Invoice }
}): Promise<MatchResult> {
  const invoice =
    params.invoice && 'invoice' in params.invoice && params.invoice.invoice
      ? params.invoice.invoice
      : (params.invoice as Invoice | undefined)
  const invoiceId = params.invoiceId || invoice?.invoiceNumber || ''

  try {
    await ensurePurchaseOrderIndex()
  } catch (err) {
    console.warn(
      `[matcher] Index RAG falló (${err instanceof Error ? err.message : err}) — fallback filesystem`
    )
    return matchFromFilesystem({ invoiceId, invoice }, invoiceId)
  }

  try {
    const modelId = await getEmbeddingModelId()
    const query = buildQuery(invoice, invoiceId)

    if (!query) {
      return {
        invoiceId,
        matched: false,
        purchaseOrderId: null,
        confidence: 0,
        discrepancies: [],
        status: 'missing_invoice_data'
      }
    }

    const searchResult = await ragSearch({
      modelId,
      workspace: WORKSPACE,
      query,
      topK: 3
    })
    const hits = Array.isArray(searchResult)
      ? searchResult
      : Array.isArray((searchResult as { results?: unknown[] } | null)?.results)
        ? ((searchResult as { results: unknown[] }).results)
        : []

    if (!hits.length) {
      return matchFromFilesystem({ invoiceId, invoice }, invoiceId)
    }

    const candidates = (hits as Array<{ content?: string; score?: number }>)
      .map((hit) => {
        if (!hit?.content) return null
        const po = parsePoFromRagContent(hit.content)
        if (!po) return null
        return {
          po,
          ragScore: Number(hit.score ?? 0),
          vendorSim: invoice ? vendorSimilarity(invoice.vendor, po.vendor) : 1
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    if (!candidates.length) {
      return matchFromFilesystem({ invoiceId, invoice }, invoiceId)
    }

    const chosen = candidates.find((entry) => entry.vendorSim >= VENDOR_MIN_SIMILARITY)

    if (!chosen) {
      const closest = candidates.reduce((best, entry) =>
        entry.vendorSim > best.vendorSim ? entry : best
      )
      return {
        invoiceId,
        matched: false,
        purchaseOrderId: null,
        confidence: 0,
        discrepancies: [],
        status: 'vendor_mismatch',
        vendorSimilarity: Number(closest.vendorSim.toFixed(3)),
        rejectedCandidate: closest.po.purchaseOrderId
      }
    }

    const { po, ragScore, vendorSim } = chosen
    const discrepancies = invoice ? compareThreeWay(invoice, po) : []
    const confidence = invoice ? confidenceFrom(ragScore, discrepancies) : ragScore
    const hasErrors = discrepancies.some((d) => d.severity === 'error')
    const matched = confidence >= MATCH_THRESHOLD && !hasErrors

    return {
      invoiceId,
      matched,
      purchaseOrderId: po.purchaseOrderId,
      confidence: Number(confidence.toFixed(3)),
      discrepancies,
      ragScore: Number(ragScore.toFixed(3)),
      vendorSimilarity: Number(vendorSim.toFixed(3)),
      status: matched ? 'matched' : hasErrors ? 'discrepancies_found' : 'low_confidence'
    }
  } catch (err) {
    console.warn(
      `[matcher] ragSearch falló (${err instanceof Error ? err.message : err}) — fallback filesystem`
    )
    return matchFromFilesystem({ invoiceId, invoice }, invoiceId)
  }
}

async function matchFromFilesystem(
  params: { invoiceId?: string; invoice?: Invoice },
  invoiceId: string
): Promise<MatchResult> {
  const orders = await loadPurchaseOrdersFromDisk()
  if (!orders.length) {
    return {
      invoiceId,
      matched: false,
      purchaseOrderId: null,
      confidence: 0,
      discrepancies: [],
      status: 'no_po_candidates'
    }
  }

  let best: PurchaseOrder | null = null
  let bestScore = 0
  let bestVendorSim = 0
  let closestVendorSim = 0
  let closestVendorPo: PurchaseOrder | null = null

  for (const po of orders) {
    let score = 0
    let vendorSim = 0

    if (params.invoice) {
      vendorSim = vendorSimilarity(params.invoice.vendor, po.vendor)
      if (vendorSim > closestVendorSim) {
        closestVendorSim = vendorSim
        closestVendorPo = po
      }

      const totalMatches = Math.abs(params.invoice.total - po.total) < 0.01
      if (vendorSim < VENDOR_MIN_SIMILARITY && !totalMatches) continue

      score += 0.45 * vendorSim
      if (totalMatches) score += 0.35
      if (params.invoice.lineItems.length === po.lineItems.length) score += 0.1
      const invDesc = normalize(params.invoice.lineItems[0]?.description ?? '')
      const poDesc = normalize(po.lineItems[0]?.description ?? '')
      if (invDesc && poDesc && (invDesc.includes(poDesc) || poDesc.includes(invDesc))) {
        score += 0.1
      }
    } else if (invoiceId && po.purchaseOrderId.includes(invoiceId)) {
      score = 0.5
    }

    if (score > bestScore) {
      bestScore = score
      bestVendorSim = vendorSim
      best = po
    }
  }

  if (!best) {
    return {
      invoiceId,
      matched: false,
      purchaseOrderId: null,
      confidence: 0,
      discrepancies: [],
      status: closestVendorPo ? 'vendor_mismatch' : 'no_po_candidates',
      ...(closestVendorPo
        ? {
            vendorSimilarity: Number(closestVendorSim.toFixed(3)),
            rejectedCandidate: closestVendorPo.purchaseOrderId
          }
        : {})
    }
  }

  const discrepancies = params.invoice ? compareThreeWay(params.invoice, best) : []
  const confidence = params.invoice
    ? confidenceFrom(bestScore, discrepancies)
    : bestScore
  const hasErrors = discrepancies.some((d) => d.severity === 'error')
  const matched = confidence >= MATCH_THRESHOLD && !hasErrors

  return {
    invoiceId,
    matched,
    purchaseOrderId: best.purchaseOrderId,
    confidence: Number(confidence.toFixed(3)),
    discrepancies,
    vendorSimilarity: Number(bestVendorSim.toFixed(3)),
    status: matched
      ? 'matched_filesystem'
      : hasErrors
        ? 'discrepancies_found'
        : 'low_confidence'
  }
}
