/**
 * 3-Way Matching vía RAG sobre purchase-orders/
 * Embeddings: GTE_LARGE_FP16 — vector store NO acepta binarios sin OCR previo.
 */
export interface MatchResult {
  matched: boolean
  purchaseOrderId?: string
  confidence: number
  discrepancies: string[]
}

export async function matchPurchaseOrder(invoice: {
  vendor: string
  invoiceNumber: string
  total: number
}): Promise<MatchResult> {
  // TODO: qvac.ragSearch() sobre workspace "purchase-orders"
  // import { ragSearch } from '@qvac/sdk'
  //
  // const results = await ragSearch({
  //   workspace: 'purchase-orders',
  //   query: `${invoice.vendor} ${invoice.invoiceNumber} ${invoice.total}`,
  //   topK: 3,
  // })

  return {
    matched: true,
    purchaseOrderId: 'PO-2026-0042',
    confidence: 0.92,
    discrepancies: [],
  }
}
