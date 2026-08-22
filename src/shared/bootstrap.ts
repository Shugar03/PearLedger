/**
 * Siembra el workspace por defecto la primera vez que se ejecuta la app.
 *
 * Hace falta porque un binario standalone no tiene árbol de ficheros en disco:
 * dentro del bundle los módulos se cargan con URLs `bare:/…`, así que
 * `appRoot()` no existe y `workspaceRoot()` apunta al directorio de datos del
 * usuario, que está vacío en una instalación limpia.
 *
 * Sin esto, un juez que hiciera `pear install pear://…` y ejecutara
 * `pearledger forecast` recibía un ENOENT. Verificado sobre el binario real.
 *
 * Los datos se importan como módulos JSON en vez de leerse del disco: así
 * viajan dentro del bundle, que es justo lo que `bare-pack` sabe empaquetar.
 */

import fs from 'node:fs'
import path from 'node:path'

import { getLogger } from '@shared/logger.js'
import { workspaceDir } from '@shared/paths.js'

import stock from '@assets/stock.json' with { type: 'json' }
import po2026001 from '@assets/purchase-orders/PO-2026-001.json' with { type: 'json' }
import poDemoAcme from '@assets/purchase-orders/PO-DEMO-ACME-042.json' with { type: 'json' }
import poLarana from '@assets/purchase-orders/PO-LARANA-004.json' with { type: 'json' }

const DEFAULT_PURCHASE_ORDERS: Array<[string, unknown]> = [
  ['PO-2026-001.json', po2026001],
  ['PO-DEMO-ACME-042.json', poDemoAcme],
  ['PO-LARANA-004.json', poLarana]
]

function writeIfAbsent(target: string, contents: unknown): boolean {
  if (fs.existsSync(target)) return false
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(contents, null, 2) + '\n', 'utf8')
  return true
}

/**
 * Garantiza que exista el workspace con datos de demo utilizables.
 * Es idempotente y **nunca sobrescribe** lo que el usuario haya modificado.
 */
export function ensureWorkspace(): void {
  const log = getLogger('bootstrap')
  let seeded = 0

  try {
    if (writeIfAbsent(workspaceDir('inventory', 'stock.json'), stock)) seeded++

    for (const [name, contents] of DEFAULT_PURCHASE_ORDERS) {
      if (writeIfAbsent(workspaceDir('purchase-orders', name), contents)) seeded++
    }

    // Las facturas las aporta el usuario; sólo se asegura el directorio.
    fs.mkdirSync(workspaceDir('invoices'), { recursive: true })

    if (seeded > 0) {
      log.info(`workspace inicializado en ${workspaceDir()} (${seeded} archivos de demo)`)
    }
  } catch (err) {
    log.warn(
      `no se pudo inicializar el workspace: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
