/**
 * Acceso a disco del plugin de compras. Es el único módulo del plugin con I/O:
 * el resto (`algorithm.ts`) es puro y por tanto testeable sin filesystem.
 *
 * La ruta se resuelve con `workspaceDir()`, nunca contra el directorio de
 * trabajo del proceso: ese directorio es aquel desde el que el usuario invocó
 * el comando y una app instalada corre desde el home, lo que hacía fallar la
 * carga del inventario con ENOENT.
 */

import { readFile, stat } from 'node:fs/promises'

import { workspaceDir } from '@shared/paths.js'

import type { InventoryItem } from './types.js'

interface InventoryCache {
  path: string
  mtimeMs: number
  items: InventoryItem[]
}

let cache: InventoryCache | null = null

function inventoryPath(): string {
  return workspaceDir('inventory', 'stock.json')
}

/**
 * Última modificación del archivo, o `null` si no se puede consultar. Se usa
 * para invalidar la cache: antes era un global de módulo que no caducaba nunca,
 * así que un `stock.json` editado seguía sirviendo datos viejos en el mismo
 * proceso (el dashboard es de larga vida).
 */
async function mtimeOf(target: string): Promise<number | null> {
  try {
    return (await stat(target)).mtimeMs
  } catch {
    return null
  }
}

/** Carga el inventario desde disco, memoizado por ruta + mtime. */
export async function loadInventory(): Promise<InventoryItem[]> {
  const target = inventoryPath()
  const mtimeMs = await mtimeOf(target)

  if (cache && cache.path === target && mtimeMs !== null && cache.mtimeMs === mtimeMs) {
    return cache.items
  }

  const raw = await readFile(target, 'utf8')
  const items = JSON.parse(raw) as InventoryItem[]
  cache = { path: target, mtimeMs: mtimeMs ?? 0, items }
  return items
}

/** Inventario completo, o los ítems que coincidan con el SKU pedido. */
export async function checkInventory(sku?: string): Promise<InventoryItem[]> {
  const items = await loadInventory()
  if (!sku || sku === 'ALL') return items
  return items.filter((item) => item.sku.toLowerCase() === sku.toLowerCase())
}

/** Solo para tests: olvida el inventario memoizado. */
export function resetInventoryCache(): void {
  cache = null
}
