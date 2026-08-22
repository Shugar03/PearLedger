#!/usr/bin/env node
import { loadModel, GTE_LARGE_FP16, ragIngest, ragSearch, unloadModel } from '@qvac/sdk'

const id = await loadModel({ modelSrc: GTE_LARGE_FP16 }, { timeout: 180_000 })
console.log('model', id)

const docs = [
  [
    'PURCHASE ORDER PO-2026-001',
    'Vendor: Proveedor Demo S.A.',
    'Total: $100',
    'Material de oficina',
    'JSON:{"purchaseOrderId":"PO-2026-001","vendor":"Proveedor Demo S.A.","total":100}'
  ].join('\n')
]

await ragIngest({ modelId: id, workspace: 'purchase-orders', documents: docs, chunk: false })
const hits = await ragSearch({
  modelId: id,
  workspace: 'purchase-orders',
  query: 'Invoice Proveedor Demo Total 100 Material oficina',
  topK: 1
})
console.log(JSON.stringify(hits, null, 2))
await unloadModel({ modelId: id })
