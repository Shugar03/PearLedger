/**
 * Implementación de `PearBridge` para el navegador: HTTP + SSE.
 *
 * Expone EXACTAMENTE la misma forma que el preload de Electron
 * (`ui/electron/preload.mjs`), y por eso ningún componente pregunta en qué
 * host corre.
 *
 * Diferencia inevitable y documentada: aquí no hay `pickInvoice()`. En Electron
 * abre un diálogo nativo y devuelve la ruta absoluta en disco; el navegador no
 * expone rutas reales de un `<input type="file">` (le daría al sitio la
 * topología del sistema de ficheros). La vista de Inbox detecta su ausencia y
 * cae a un campo de ruta.
 */
import { openEventStream } from '@dashboard/lib/event-stream'
import type {
  DashboardEvent,
  HealthPayload,
  PearBridge,
  StreamState,
  ToolDescriptor,
  ToolParams
} from '@dashboard/lib/types'

const TOKEN_HEADER = 'X-PearLedger-Token'

/** Partido en dos para que no lo sustituya el propio inyector del servidor. */
const TOKEN_PLACEHOLDER = '__PEARLEDGER' + '_SESSION_TOKEN__'

function readToken(): string {
  const meta = document.querySelector('meta[name="pearledger-token"]')
  const value = meta?.getAttribute('content') ?? ''
  return value === TOKEN_PLACEHOLDER ? '' : value
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

export function createWebBridge(): PearBridge {
  const token = readToken()

  const authHeaders = (extra?: Record<string, string>): Record<string, string> => {
    const headers: Record<string, string> = { Accept: 'application/json', ...extra }
    if (token) headers[TOKEN_HEADER] = token
    return headers
  }

  async function getJson<T>(path: string): Promise<T> {
    const response = await fetch(path, {
      method: 'GET',
      headers: authHeaders(),
      credentials: 'omit',
      cache: 'no-store'
    })
    if (!response.ok) throw await readError(response)
    return (await response.json()) as T
  }

  const eventHandlers = new Set<(event: DashboardEvent) => void>()
  const stateHandlers = new Set<(state: StreamState) => void>()
  const policyHandlers = new Set<(notes: string[]) => void>()
  let closeStream: (() => void) | null = null

  /** Un handler roto no debe cortar la difusión al resto. */
  function fanOut<T>(handlers: Set<(value: T) => void>, value: T): void {
    for (const handler of handlers) {
      try {
        handler(value)
      } catch {
        // Ignorado a propósito.
      }
    }
  }

  function ensureStream(): void {
    if (closeStream) return
    closeStream = openEventStream<DashboardEvent>(
      '/api/events',
      {
        onMessage: (event) => fanOut(eventHandlers, event),
        onState: (state) => fanOut(stateHandlers, state)
      },
      { headers: () => authHeaders() }
    )
  }

  return {
    host: 'web',

    async listTools(): Promise<ToolDescriptor[]> {
      const payload = await getJson<{ tools?: ToolDescriptor[] }>('/api/tools')
      return payload.tools ?? []
    },

    /**
     * El servidor aplica su allowlist: sólo tools de lectura y
     * `execute_gasless_payment` en dry-run forzado. Lo que devuelva en `notes`
     * se propaga a quien escuche `onPolicyNotes`.
     */
    async execute(name: string, params: ToolParams = {}): Promise<unknown> {
      const response = await fetch('/api/execute', {
        method: 'POST',
        // Content-Type JSON obligatorio: fuerza el preflight CORS, que sin
        // cabeceras CORS el navegador aborta para cualquier origen ajeno.
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify({ name, params })
      })
      if (!response.ok) throw await readError(response)

      const payload = (await response.json()) as { result?: unknown; notes?: string[] }
      if (payload.notes && payload.notes.length > 0) fanOut(policyHandlers, payload.notes)
      return payload.result
    },

    onEvent(handler): () => void {
      eventHandlers.add(handler)
      ensureStream()
      return () => {
        eventHandlers.delete(handler)
      }
    },

    onStreamState(handler): () => void {
      stateHandlers.add(handler)
      return () => {
        stateHandlers.delete(handler)
      }
    },

    onPolicyNotes(handler): () => void {
      policyHandlers.add(handler)
      return () => {
        policyHandlers.delete(handler)
      }
    },

    health(): Promise<HealthPayload> {
      return getJson<HealthPayload>('/api/health')
    }
  }
}
