/**
 * 3-Way Match via qvac.ragSearch() sobre workspace "purchase-orders".
 * Embeddings: GTE_LARGE_FP16 — NO indexar binarios sin OCR previo.
 */

export async function matchPurchaseOrder(invoiceId: string) {
  // TODO: qvac.ragSearch({ workspace: 'purchase-orders', query: invoiceId })
  return {
    invoiceId,
    matched: false,
    purchaseOrderId: null,
    confidence: 0,
    status: 'pending_implementation'
  }
}
