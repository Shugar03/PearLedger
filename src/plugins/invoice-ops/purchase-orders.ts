/**
 * Carga de órdenes de compra desde disco.
 *
 * Único módulo del plugin que sabe dónde viven los JSON de las POs. La ruta se
 * resuelve con `workspaceDir()`: antes se armaba desde el directorio actual y la
 * app fallaba con ENOENT en cuanto se la invocaba desde otro directorio.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { getLogger } from '@shared/logger.js'
import { workspaceDir } from '@shared/paths.js'

const log = getLogger('invoice-ops:po')

export interface PurchaseOrderLineItem {
  sku?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface PurchaseOrder {
  purchaseOrderId: string
  vendor: string
  date?: string
  currency?: string
  lineItems: PurchaseOrderLineItem[]
  subtotal: number
  tax: number
  total: number
  status?: string
}

/** Directorio de POs. Se resuelve en cada llamada: los tests mueven la raíz. */
export function purchaseOrdersDir(): string {
  return workspaceDir('purchase-orders')
}

/**
 * Lee todos los `*.json` del directorio de POs.
 *
 * Un archivo corrupto no derriba la carga: se avisa y se sigue. Perder una PO
 * es recuperable; perder las diez porque una tenía una coma de más, no.
 */
export async function loadPurchaseOrders(): Promise<PurchaseOrder[]> {
  const dir = purchaseOrdersDir()
  const entries = await readdir(dir).catch(() => [] as string[])
  const orders: PurchaseOrder[] = []

  for (const name of entries) {
    if (!name.endsWith('.json')) continue
    try {
      const raw = await readFile(path.join(dir, name), 'utf8')
      const po = JSON.parse(raw) as PurchaseOrder
      if (!po?.purchaseOrderId) {
        log.warn(`PO ignorada sin purchaseOrderId: ${name}`)
        continue
      }
      if (!Array.isArray(po.lineItems)) po.lineItems = []
      orders.push(po)
    } catch (err) {
      log.warn(`PO ilegible ${name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return orders
}

/** Índice por id, para resolver un hit de RAG a la PO original. */
export function indexById(orders: readonly PurchaseOrder[]): Map<string, PurchaseOrder> {
  return new Map(orders.map((po) => [po.purchaseOrderId, po]))
}

/** Representación textual que se ingesta en el workspace RAG. */
export function poToDocument(po: PurchaseOrder): string {
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

/**
 * Recupera la PO de un fragmento devuelto por `ragSearch`.
 *
 * Primero intenta el JSON embebido; si el chunking lo partió, cae al id del
 * encabezado y lo busca en el índice.
 */
export function parsePoFromRagContent(
  content: string,
  byId: ReadonlyMap<string, PurchaseOrder>
): PurchaseOrder | null {
  const jsonMarker = content.indexOf('JSON:')
  if (jsonMarker >= 0) {
    try {
      const parsed = JSON.parse(content.slice(jsonMarker + 5)) as PurchaseOrder
      if (parsed?.purchaseOrderId) return parsed
    } catch {
      // el chunk cortó el JSON — caemos al id del encabezado
    }
  }

  const idMatch = content.match(/PURCHASE ORDER\s+(\S+)/i)
  const id = idMatch?.[1]
  if (!id) return null
  return byId.get(id) ?? null
}
