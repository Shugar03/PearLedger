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
}

let poIndexReady = false
const poById = new Map<string, PurchaseOrder>()

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.\s$-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

  if (normalize(invoice.vendor) !== normalize(po.vendor)) {
    discrepancies.push({
      field: 'vendor',
      invoice: invoice.vendor,
      purchaseOrder: po.vendor,
      severity: 'error'
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
  invoice?: Invoice
}): Promise<MatchResult> {
  const invoiceId = params.invoiceId || params.invoice?.invoiceNumber || ''

  try {
    await ensurePurchaseOrderIndex()
  } catch (err) {
    console.warn(
      `[matcher] Index RAG falló (${err instanceof Error ? err.message : err}) — fallback filesystem`
    )
    return matchFromFilesystem(params, invoiceId)
  }

  try {
    const modelId = await getEmbeddingModelId()
    const query = buildQuery(params.invoice, invoiceId)

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

    const hits = (await ragSearch({
      modelId,
      workspace: WORKSPACE,
      query,
      topK: 3
    })) ?? []

    if (!Array.isArray(hits) || hits.length === 0) {
      return matchFromFilesystem(params, invoiceId)
    }

    const top = hits[0]
    if (!top?.content) {
      return matchFromFilesystem(params, invoiceId)
    }

    const po = parsePoFromRagContent(top.content)
    const ragScore = Number(top.score ?? 0)

    if (!po) {
      return matchFromFilesystem(params, invoiceId)
    }

    const discrepancies = params.invoice ? compareThreeWay(params.invoice, po) : []
    const confidence = params.invoice
      ? confidenceFrom(ragScore, discrepancies)
      : ragScore
    const hasErrors = discrepancies.some((d) => d.severity === 'error')
    const matched = confidence >= MATCH_THRESHOLD && !hasErrors

    return {
      invoiceId,
      matched,
      purchaseOrderId: po.purchaseOrderId,
      confidence: Number(confidence.toFixed(3)),
      discrepancies,
      ragScore: Number(ragScore.toFixed(3)),
      status: matched ? 'matched' : hasErrors ? 'discrepancies_found' : 'low_confidence'
    }
  } catch (err) {
    console.warn(
      `[matcher] ragSearch falló (${err instanceof Error ? err.message : err}) — fallback filesystem`
    )
    return matchFromFilesystem(params, invoiceId)
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

  for (const po of orders) {
    let score = 0
    if (params.invoice) {
      if (normalize(params.invoice.vendor) === normalize(po.vendor)) score += 0.45
      if (Math.abs(params.invoice.total - po.total) < 0.01) score += 0.35
      if (params.invoice.lineItems.length === po.lineItems.length) score += 0.1
      const invDesc = normalize(params.invoice.lineItems[0]?.description ?? '')
      const poDesc = normalize(po.lineItems[0]?.description ?? '')
      if (invDesc && poDesc && (invDesc.includes(poDesc) || poDesc.includes(invDesc))) {
        score += 0.1
      }
    } else if (invoiceId && po.purchaseOrderId.includes(invoiceId)) {
      score = 0.5
    }
    if (!best || score > bestScore) {
      bestScore = score
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
      status: 'no_po_candidates'
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
    status: matched
      ? 'matched_filesystem'
      : hasErrors
        ? 'discrepancies_found'
        : 'low_confidence'
  }
}
