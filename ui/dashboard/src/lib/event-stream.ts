/**
 * Lector de SSE sobre `fetch`.
 *
 * `EventSource` no admite cabeceras propias, así que el token de sesión sólo
 * podría viajar en la query string o en una cookie — y las dos están prohibidas
 * por diseño (la query acaba en logs e historial; la cookie viaja sola y
 * habilita CSRF). Con `fetch` + `ReadableStream` sí se puede mandar
 * `X-PearLedger-Token`, y el formato del cable sigue siendo SSE estándar.
 *
 * Replica la semántica de `EventSource`, reconexión con backoff acotado
 * incluida.
 */
import type { StreamState } from '@dashboard/lib/types'

export interface EventStreamHandlers<T> {
  onMessage(message: T): void
  onState(state: StreamState, info?: string | number): void
}

export interface EventStreamOptions {
  headers(): Record<string, string>
  initialDelayMs?: number
  maxDelayMs?: number
}

const FRAME_SEPARATOR = '\n\n'

/** Un frame SSE puede traer varias líneas `data:`; se concatenan con `\n`. */
function parseFrame(frame: string): string | null {
  const lines = frame.replace(/\r\n/g, '\n').split('\n')
  const data: string[] = []

  for (const line of lines) {
    if (line === '' || line.startsWith(':')) continue // comentario / heartbeat
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'data') data.push(value)
  }

  return data.length === 0 ? null : data.join('\n')
}

async function readError(response: Response): Promise<Error> {
  let message = `HTTP ${response.status}`
  try {
    const payload: unknown = await response.json()
    if (payload && typeof payload === 'object') {
      const body = payload as { message?: unknown; error?: unknown }
      if (typeof body.message === 'string') message = body.message
      else if (typeof body.error === 'string') message = body.error
    }
  } catch {
    // Respuesta sin JSON: nos quedamos con el código.
  }
  return new Error(message)
}

/** Abre el stream y devuelve la función de cierre. */
export function openEventStream<T>(
  path: string,
  handlers: EventStreamHandlers<T>,
  options: EventStreamOptions
): () => void {
  const initialDelay = options.initialDelayMs ?? 1000
  const maxDelay = options.maxDelayMs ?? 15_000

  let closed = false
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let delay = initialDelay

  async function pump(): Promise<void> {
    controller = new AbortController()
    const response = await fetch(path, {
      method: 'GET',
      headers: { ...options.headers(), Accept: 'text/event-stream' },
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal
    })

    if (!response.ok) throw await readError(response)
    if (!response.body) throw new Error('El navegador no expone el cuerpo del stream')

    handlers.onState('live')
    delay = initialDelay

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })

      let split = buffer.indexOf(FRAME_SEPARATOR)
      while (split >= 0) {
        const raw = parseFrame(buffer.slice(0, split))
        buffer = buffer.slice(split + FRAME_SEPARATOR.length)
        split = buffer.indexOf(FRAME_SEPARATOR)
        if (raw === null) continue
        try {
          handlers.onMessage(JSON.parse(raw) as T)
        } catch {
          // Un frame corrupto no debe tumbar el stream.
        }
      }
    }
  }

  function schedule(): void {
    if (closed) return
    handlers.onState('reconnecting', delay)
    timer = setTimeout(loop, delay)
    delay = Math.min(delay * 2, maxDelay)
  }

  function loop(): void {
    if (closed) return
    pump().then(schedule, (err: unknown) => {
      if (closed) return
      handlers.onState('error', err instanceof Error ? err.message : String(err))
      schedule()
    })
  }

  loop()

  return function close(): void {
    closed = true
    if (timer) clearTimeout(timer)
    if (controller) controller.abort()
    handlers.onState('closed')
  }
}
