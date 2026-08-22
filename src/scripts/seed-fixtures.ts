/**
 * Siembra el workspace con los datos de la demo: inventario, órdenes de compra
 * y las facturas de ejemplo.
 *
 * `workspace/purchase-orders` e `invoices` están en `.gitignore` salvo los
 * samples, así que un clon limpio —o una instalación con `pear install`, donde
 * el workspace vive en el directorio de datos del usuario— puede quedarse sin
 * nada con lo que arrancar la demo.
 *
 * El inventario y las OCs se siembran con `ensureWorkspace()`, que las lleva
 * embebidas como módulos JSON (es lo único que `bare-pack` sabe empaquetar).
 * Las facturas son binarios y no viajan en el bundle: se copian desde el árbol
 * del repo cuando existe.
 *
 * Rutas resueltas con `appRoot()` / `workspaceDir()`: el cwd es desde donde el
 * usuario invocó el comando, no la raíz de la app.
 *
 * Uso: node dist/scripts/seed-fixtures.js
 */

import process from 'node:process'
import path from 'node:path'
import { access, copyFile, mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { ensureWorkspace } from '@shared/bootstrap.js'
import { getLogger, writeOut } from '@shared/logger.js'
import { appRoot, workspaceDir } from '@shared/paths.js'

const log = getLogger('seed-fixtures')

/** Facturas de ejemplo versionadas en el repo, fuera del bundle. */
const SAMPLE_INVOICES = ['sample.png', 'sample.pdf'] as const

async function exists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

export interface SeedReport {
  workspace: string
  /** Facturas copiadas al workspace. */
  copied: string[]
  /** Facturas que no estaban disponibles en el árbol del repo. */
  missing: string[]
}

export async function seedFixtures(): Promise<SeedReport> {
  // Inventario + órdenes de compra: idempotente, nunca pisa lo del usuario.
  ensureWorkspace()

  const source = path.join(appRoot(), 'workspace', 'invoices')
  const target = workspaceDir('invoices')
  await mkdir(target, { recursive: true })

  const copied: string[] = []
  const missing: string[] = []

  for (const name of SAMPLE_INVOICES) {
    const from = path.join(source, name)
    const to = path.join(target, name)

    if (path.resolve(from) === path.resolve(to)) {
      log.debug(`${name} ya está en su sitio (workspace en el árbol del repo)`)
      continue
    }
    if (!(await exists(from))) {
      log.warn(`falta el origen: ${from}`)
      missing.push(name)
      continue
    }

    await copyFile(from, to)
    log.info(`copiado → ${to}`)
    copied.push(to)
  }

  return { workspace: workspaceDir(), copied, missing }
}

export async function main(): Promise<number> {
  const report = await seedFixtures()

  log.info(`workspace sembrado en ${report.workspace}`)
  if (report.missing.length > 0) {
    log.warn(
      `facturas de ejemplo sin copiar: ${report.missing.join(', ')} — ` +
        'generalas con scripts/generate-demo-invoice.ps1 o pasá las tuyas a `ingest`.'
    )
  }

  writeOut(JSON.stringify(report, null, 2))

  // No copiar nada no es un fallo: con el workspace ya poblado el sembrado es
  // un no-op deseable.
  return 0
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  return Boolean(entry) && import.meta.url === pathToFileURL(entry!).href
}

if (isMainModule()) {
  process.exitCode = await main()
}
