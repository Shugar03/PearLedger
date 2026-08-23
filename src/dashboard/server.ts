/**
 * Dev server del dashboard — `pearledger dashboard`.
 *
 * Cero dependencias: `node:http` y nada más. El servidor es la capa de
 * transporte y la única que decide *dónde* escucha; el enrutado vive en
 * `./routes.js` y toda la política de seguridad en `./security.js`.
 *
 * El bind es a `127.0.0.1` y no hay opción para cambiarlo. Es intencionado: un
 * `--host 0.0.0.0` "sólo para la demo" pondría el harness — que firma pagos —
 * en la red de la sala. La superficie de red no es configurable.
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

import { getConfig, resetConfig } from '@config/index.js'
import { ensureHarnessReady } from '@ipc/bridge.js'
import { shutdownQvacRuntime } from '@plugins/invoice-ops/qvac-client.js'
import { getLogger } from '@shared/logger.js'
import { META } from '@shared/meta.js'
import { appRoot, dataDir } from '@shared/paths.js'

import { createEventHub } from './events.js'
import { handleRequest, type RouteContext } from './routes.js'
import { LOOPBACK_HOST, sessionSecret } from './security.js'

export interface StartDashboardOptions {
  /** Puerto inicial. Por defecto `getConfig().dashboard.port` (7331). */
  port?: number
  /** Si el puerto está ocupado se prueban los siguientes. */
  portAttempts?: number
  /**
   * El navegador NO se abre desde aquí: lanzarlo exigiría `child_process` y
   * este módulo se mantiene con cuatro builtins. Con `open` la URL se imprime
   * destacada para copiarla de un vistazo.
   */
  open?: boolean
}

export interface DashboardHandle {
  url: string
  port: number
  /** Token de sesión del proceso. Se imprime en la terminal al arrancar. */
  token: string
  close(): Promise<void>
}

const DEFAULT_PORT_ATTEMPTS = 20

/**
 * Localiza los estáticos del renderer.
 *
 * El renderer es la app React de `ui/`, que Vite compila a
 * `dist/dashboard/web/` (`npm run build:web`). Aquí no se busca en `src/`: ahí
 * ya no hay nada servible, sólo TypeScript de este servidor.
 *
 * `dataDir()` es el segundo candidato por el binario standalone, donde el
 * bundle es de sólo lectura y los estáticos pueden haberse desplegado aparte.
 */
export function resolveWebRoot(): string {
  const fromDist = path.join(appRoot(), 'dist', 'dashboard', 'web')
  const fromData = path.join(dataDir(), 'dashboard', 'web')

  for (const candidate of [fromDist, fromData]) {
    try {
      if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate
    } catch {
      // Un candidato ilegible simplemente no es el bueno.
    }
  }
  return fromDist
}

/** Escucha en un puerto concreto, siempre en loopback. Resuelve o rechaza. */
function listenOnce(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error): void => {
      server.removeListener('listening', onListening)
      reject(err)
    }
    const onListening = (): void => {
      server.removeListener('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    // `exclusive: true` evita que el puerto se comparta con otro proceso del
    // mismo grupo de cluster: si está ocupado queremos EADDRINUSE, no compartir.
    server.listen({ host: LOOPBACK_HOST, port, exclusive: true })
  })
}

function isAddressInUse(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'EADDRINUSE'
}

export async function startDashboard(
  options: StartDashboardOptions = {}
): Promise<DashboardHandle> {
  process.env.PEARLEDGER_SERVICE_MODE = '1' // conventions:allow — el dashboard puebla el flag de servicio antes de getConfig
  resetConfig()

  const log = getLogger('dashboard')
  const config = getConfig()

  const basePort =
    typeof options.port === 'number' && Number.isInteger(options.port) && options.port > 0
      ? options.port
      : config.dashboard.port
  const attempts = options.portAttempts ?? DEFAULT_PORT_ATTEMPTS

  const webRoot = resolveWebRoot()
  const token = sessionSecret()
  const hub = createEventHub()

  // El contexto se crea con el puerto provisional y se corrige al enlazar: la
  // validación de Host y Origin depende del puerto REAL, no del solicitado.
  const ctx: RouteContext = { port: basePort, webRoot, hub }

  const server = http.createServer((req, res) => {
    handleRequest(req, res, ctx).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`fallo no controlado: ${message}`)
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Error interno')
    })
  })

  // SSE mantiene la conexión abierta indefinidamente; los timeouts por defecto
  // de keep-alive cortarían el stream a mitad de una demo.
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000
  server.requestTimeout = 0

  let bound = -1
  let lastError: unknown = null

  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = basePort + offset
    try {
      await listenOnce(server, candidate)
      bound = candidate
      break
    } catch (err) {
      lastError = err
      if (!isAddressInUse(err)) break
      log.debug(`puerto ${candidate} ocupado, probando el siguiente`)
    }
  }

  if (bound === -1) {
    hub.close()
    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(
      `No se pudo escuchar en ${LOOPBACK_HOST}:${basePort}..${basePort + attempts - 1} — ${detail}`
    )
  }

  ctx.port = bound
  const url = `http://${LOOPBACK_HOST}:${bound}`

  log.info('')
  log.info(`  🍐 PearLedger dashboard v${META.version}`)
  log.info(`  URL      ${url}`)
  log.info(`  Token    ${token}`)
  log.info(`  Estáticos ${webRoot}`)
  log.info(
    `  Modo     sólo lectura + dry-run · pagos en vivo ${
      config.dashboard.allowLivePayments ? 'PERMITIDOS (¡cuidado!)' : 'bloqueados'
    }`
  )
  log.info(`  Bind     ${LOOPBACK_HOST} exclusivo — inalcanzable desde la red`)
  if (options.open) log.info(`  Abrí ${url} en el navegador (no se lanza solo: cero dependencias)`)
  log.info('')

  ensureHarnessReady().catch((err: unknown) => {
    log.warn(`el harness no arrancó: ${err instanceof Error ? err.message : String(err)}`)
  })

  return {
    url,
    port: bound,
    token,
    close(): Promise<void> {
      hub.close()
      return shutdownQvacRuntime({ force: true }).then(
        () =>
          new Promise<void>((resolve) => {
            server.close(() => resolve())
            server.closeAllConnections?.()
          })
      )
    }
  }
}
