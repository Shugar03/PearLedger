/**
 * Entrypoint de Bare / Pear. Compila a `dist/bin.js`, que es lo que consumen
 * `npm start` y `bare-build --standalone`.
 *
 * Responsabilidades: arrancar el updater OTA desacoplado y delegar en el CLI
 * compartido. Toda la lógica de comandos vive en `@cli/run.js`, común con Node.
 */

import process from 'node:process'
import os from 'node:os'
import path from 'node:path'
// `execPath` es API de bare-os, no de node:os: sólo la usa este entrypoint,
// que por definición corre bajo Bare.
import { execPath } from 'bare-os'
import { persistent } from 'bare-storage'
import { isWindows } from 'which-runtime'
import FileLog from 'bare-file-logger'
import Console from 'bare-console'

import { META } from '@shared/meta.js'
import { configureLogger, getLogger } from '@shared/logger.js'
import { parseCli } from '@cli/program.js'
import { main } from '@cli/run.js'
import { createCliHost } from '@cli/host.js'
import { App } from '@pear/app.js'

if (typeof Bare === 'undefined' || !Bare) {
  throw new Error('dist/bin.js requiere el runtime Bare (usá `npm run dev` bajo Node)')
}
const bare: NonNullable<typeof Bare> = Bare

/** En dev el ejecutable es `bare`; instalado es el binario propio. */
const isDev = path.basename(bare.argv[0] ?? '', path.extname(bare.argv[0] ?? '')) === 'bare'
const argv = bare.argv.slice(isDev ? 2 : 1)

function parseUpdateWindow(value: unknown): number | undefined {
  if (value === undefined) return undefined
  const wait = Number(value)
  if (!Number.isSafeInteger(wait) || wait < 0) {
    throw new Error('--update-window debe ser un entero no negativo')
  }
  return wait
}

async function runUpdater(dir: string, wait: number | undefined): Promise<void> {
  const app = new App({
    dir,
    app: isDev ? null : execPath(),
    updates: true,
    version: META.version,
    upgrade: META.upgrade,
    name: isWindows ? `${META.productName}.exe` : META.productName
  })

  // El updater corre desacoplado: su diagnóstico va al log del storage, no a la
  // terminal, que para entonces ya devolvió el control al usuario.
  const output = new FileLog(path.join(dir, 'updates.log'), { maxSize: 1024 * 1024 })
  const log = new Console(output)

  app.on('updating', () => log.log('[updater] descargando actualización'))
  app.on('updating-delta', (delta: unknown) => log.log('[updater]', delta))
  app.on('updated', () => log.log('[updater] descarga completa, aplicando'))
  app.on('update-applied', () => log.log('[updater] aplicada; reiniciá para usar la nueva versión'))
  app.on('error', (err: unknown) => log.error('[updater:error]', err))

  process.on('SIGHUP', () => void app.exit(129))
  process.on('SIGINT', () => void app.exit(130))
  process.on('SIGQUIT', () => void app.exit(131))
  process.on('SIGTERM', () => void app.exit(143))

  let code = 0
  try {
    await app.updater(wait)
  } catch (err) {
    log.error('[updater:error]', err)
    code = 1
  }

  try {
    await app.exit(bare.exitCode || code)
  } finally {
    output.close()
  }
}

async function start(): Promise<void> {
  const parsed = parseCli(argv, { name: META.productName, description: META.description })
  if (!parsed) {
    bare.exit(1)
    return
  }

  configureLogger({ level: parsed.json ? 'error' : 'info' })
  const log = getLogger('pearledger')

  const root = parsed.root
  const storage =
    (root.storage as string | undefined) ??
    (isDev ? null : path.join(persistent(), META.productName))
  const dir = storage ?? path.join(os.tmpdir(), 'pear', META.productName)

  let wait: number | undefined
  try {
    wait = parseUpdateWindow(root.updateWindow)
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err))
    bare.exit(1)
    return
  }

  if (root.updater === true) {
    await runUpdater(dir, wait)
    bare.exit()
    return
  }

  if (root.updates !== false) {
    try {
      App.spawnUpdater(dir, execPath(), isDev ? (bare.argv[1] ?? null) : null, wait)
    } catch (err) {
      log.warn(`no se pudo lanzar el updater: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await main({ argv, host: createCliHost() })
}

await start()
