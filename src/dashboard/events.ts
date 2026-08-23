/**
 * Hub SSE: retransmite el bus de eventos del harness a los navegadores.
 *
 * Dos trampas que este módulo evita a propósito:
 *
 *  1. **Serializar el objeto `Tool` entero.** El harness emite el `Tool`, que
 *     lleva su `handler` (una función). `JSON.stringify` la descarta en
 *     silencio y con ella cualquier garantía de qué se está enviando; peor, el
 *     resultado de una tool puede arrastrar buffers, providers o wallets. Aquí
 *     sólo se toma `tool.name` y `tool.plugin`, y el detalle pasa por un
 *     saneador con tope de profundidad, de longitud y redacción de secretos.
 *
 *  2. **Fugas de suscripción.** Cada cliente que se va debe soltar su respuesta
 *     y el hub debe soltar sus 5 suscripciones al cerrar. Sin eso, un dev
 *     server de larga vida acumula listeners en el bus del harness hasta que
 *     cada ejecución de tool dispara cientos de handlers muertos.
 */

import type { ServerResponse } from 'node:http'

import type { HarnessEvent } from '@core/types.js'
import { onHarnessEvent } from '@ipc/bridge.js'
import { getLogger } from '@shared/logger.js'

const HARNESS_EVENTS: readonly HarnessEvent[] = [
  'tool:registered',
  'tool:executing',
  'tool:done',
  'tool:blocked',
  'tool:failed'
]

/** Claves cuyo valor no sale nunca del proceso, aunque sea por diagnóstico. */
const SENSITIVE_KEY = /seed|mnemonic|private|secret|passphrase|password|api[-_]?key|token/i

const MAX_DEPTH = 4
const MAX_ARRAY = 20
const MAX_STRING = 400
const MAX_KEYS = 30

export interface DashboardEvent {
  id: number
  at: string
  type: HarnessEvent | 'dashboard:hello'
  tool?: string
  plugin?: string
  detail?: unknown
}

export interface EventHub {
  /** Engancha una respuesta HTTP como cliente SSE. Devuelve el desenganche. */
  subscribe(res: ServerResponse): () => void
  /** Últimos eventos, para que un cliente recién llegado no vea un panel vacío. */
  recent(): DashboardEvent[]
  clients(): number
  close(): void
}

export interface EventHubOptions {
  historySize?: number
  heartbeatMs?: number
}

/** Extrae sólo lo publicable de un `Tool`: nunca el objeto entero. */
function toolIdentity(value: unknown): { tool?: string; plugin?: string } {
  if (typeof value !== 'object' || value === null) return {}
  const candidate = value as { name?: unknown; plugin?: unknown }
  const identity: { tool?: string; plugin?: string } = {}
  if (typeof candidate.name === 'string') identity.tool = candidate.name
  if (typeof candidate.plugin === 'string') identity.plugin = candidate.plugin
  return identity
}

/** Copia defensiva: sin funciones, sin ciclos, sin secretos, sin gigantes. */
function jsonSafe(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'function') return '[function]'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Error) return { error: value.message }
  if (value instanceof Date) return value.toISOString()

  if (depth >= MAX_DEPTH) return '[…]'

  if (Array.isArray(value)) {
    const head = value.slice(0, MAX_ARRAY).map((item) => jsonSafe(item, depth + 1))
    return value.length > MAX_ARRAY ? [...head, `…(+${value.length - MAX_ARRAY})`] : head
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    const source = value as Record<string, unknown>
    for (const key of Object.keys(source).slice(0, MAX_KEYS)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : jsonSafe(source[key], depth + 1)
    }
    return out
  }

  return String(value)
}

export function createEventHub(options: EventHubOptions = {}): EventHub {
  const historySize = options.historySize ?? 60
  const heartbeatMs = options.heartbeatMs ?? 20_000
  const log = getLogger('dashboard:events')

  const clients = new Set<ServerResponse>()
  const history: DashboardEvent[] = []
  let sequence = 0
  let closed = false

  function publish(event: DashboardEvent): void {
    history.push(event)
    if (history.length > historySize) history.splice(0, history.length - historySize)

    if (clients.size === 0) return
    const frame = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
    for (const res of [...clients]) {
      try {
        res.write(frame)
      } catch {
        // Un cliente que se fue a mitad de escritura no debe tumbar la emisión
        // para el resto; el evento 'close' de su socket lo desengancha.
        clients.delete(res)
      }
    }
  }

  function record(type: HarnessEvent, args: unknown[]): void {
    const identity = toolIdentity(args[0])
    sequence += 1
    const event: DashboardEvent = {
      id: sequence,
      at: new Date().toISOString(),
      type,
      ...identity
    }
    if (args.length > 1) event.detail = jsonSafe(args[1])
    publish(event)
  }

  // Suscripción a los 5 eventos del harness. `onHarnessEvent` resuelve de forma
  // perezosa (el harness puede seguir cargando plugins) y devuelve la baja.
  const unsubscribers = HARNESS_EVENTS.map((type) =>
    onHarnessEvent(type, (...args: unknown[]) => {
      if (closed) return
      record(type, args)
    })
  )

  // El heartbeat mantiene viva la conexión frente a proxies y suspensiones del
  // navegador. `unref` evita que un dev server quede colgado por el timer.
  const heartbeat: ReturnType<typeof setInterval> = setInterval(() => {
    for (const res of [...clients]) {
      try {
        res.write(': heartbeat\n\n')
      } catch {
        clients.delete(res)
      }
    }
  }, heartbeatMs)
  if (typeof heartbeat.unref === 'function') heartbeat.unref()

  return {
    subscribe(res: ServerResponse): () => void {
      clients.add(res)

      sequence += 1
      const hello: DashboardEvent = {
        id: sequence,
        at: new Date().toISOString(),
        type: 'dashboard:hello',
        detail: { clients: clients.size, buffered: history.length }
      }
      res.write(`retry: 3000\n\n`)
      res.write(`id: ${hello.id}\nevent: ${hello.type}\ndata: ${JSON.stringify(hello)}\n\n`)

      for (const event of history) {
        res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      }

      let released = false
      const release = (): void => {
        if (released) return
        released = true
        clients.delete(res)
        log.debug(`cliente SSE desconectado (${clients.size} activos)`)
      }

      res.on('close', release)
      res.on('error', release)
      log.debug(`cliente SSE conectado (${clients.size} activos)`)
      return release
    },

    recent(): DashboardEvent[] {
      return [...history]
    },

    clients(): number {
      return clients.size
    },

    close(): void {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      for (const off of unsubscribers) off()
      for (const res of [...clients]) {
        try {
          res.end()
        } catch {
          // El socket ya estaba muerto; nada que hacer.
        }
      }
      clients.clear()
    }
  }
}
