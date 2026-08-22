/**
 * Entrypoint de Node — desarrollo, tests y dev server del dashboard.
 *
 * No toca Pear ni el OTA: eso es exclusivo del entrypoint de Bare. Comparte con
 * él exactamente el mismo parser y los mismos comandos, así que la gramática de
 * argumentos ya no puede divergir entre dev y producción.
 */

import process from 'node:process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { appRoot } from '@shared/paths.js'
import { main } from '@cli/run.js'
import { createCliHost } from '@cli/host.js'

/**
 * Carga `.env` sin dependencias externas y sin registrar valores.
 * No sobrescribe lo que ya venga del entorno real.
 */
function loadDotEnv(): void {
  const envPath = path.join(appRoot(), '.env')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()

    const commentAt = value.indexOf(' #')
    if (commentAt >= 0) value = value.slice(0, commentAt).trim()

    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (quoted) value = value.slice(1, -1)

    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

loadDotEnv()

await main({
  argv: process.argv.slice(2),
  host: createCliHost(),
  onDashboard: async ({ port, open }) => {
    // Import estático por alias: el dashboard sólo se usa bajo Node, pero el
    // especificador es literal para que el grafo siga siendo analizable.
    const { startDashboard } = await import('@dashboard/server.js')
    await startDashboard({ port, open })
  }
})
