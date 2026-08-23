/**
 * Contrato del contexto que comparte el puente y el estado global de la UI.
 *
 * Vive separado del provider para que el módulo del componente exporte sólo
 * componentes (react-refresh se queja si mezcla) y para que un consumidor
 * pueda importar los tipos sin arrastrar el árbol del provider.
 */
import { createContext } from 'react'

import type { Status } from '@dashboard/lib/status'

import type {
  DashboardEvent,
  PearBridge,
  StreamState,
  ToolParams,
  WalletBalance
} from '@dashboard/lib/types'

export type ModelState = 'busy' | 'ready' | 'error'

/** Los cuatro tipos de evento que el panel de actividad cuenta aparte. */
export const COUNTED_EVENTS = [
  'tool:executing',
  'tool:done',
  'tool:blocked',
  'tool:failed'
] as const

export type CountedEvent = (typeof COUNTED_EVENTS)[number]

export type Counters = Record<CountedEvent, number>

/**
 * Un evento con su clave de lista.
 *
 * El identificador del hub (`event.id`) no sirve como `key`: Electron no lo
 * manda y el hub reinicia su contador al reconectar. El provider emite un
 * correlativo propio, monótono en la vida de la pestaña.
 */
export interface ActivityEntry {
  key: string
  event: DashboardEvent
}

/**
 * Una factura procesada en esta sesión.
 *
 * Vive en el contexto y no en la vista porque lo consumen dos pantallas: el
 * formulario que la produce y la lista del Dashboard. No se persiste: al
 * recargar, la sesión empieza limpia, igual que el panel de actividad.
 */
export interface IngestRecord {
  id: string
  path: string
  vendor: string
  total: string
  /** El veredicto de `match_purchase_order`, o `no_match` si no llegó a correr. */
  status: string
  at: string
}

export interface PearMeta {
  /** `null` mientras no se sabe: la cabecera muestra un guion. */
  tools: number | null
  version: string | null
  models: ModelState
}

export interface PearContextValue {
  bridge: PearBridge
  status: Status
  setStatus(next: Status): void
  streamState: StreamState
  meta: PearMeta
  events: ActivityEntry[]
  counters: Counters
  clearActivity(): void
  /** Facturas procesadas en esta sesión, la más reciente primero. */
  ingests: IngestRecord[]
  recordIngest(record: Omit<IngestRecord, 'id' | 'at'>): void
  /** Último saldo consultado. `null` mientras nadie lo pidió. */
  balance: WalletBalance | null
  setBalance(value: WalletBalance): void
  /** Ejecuta una tool reflejando el progreso en la píldora de estado. */
  runTool<T = unknown>(name: string, params?: ToolParams): Promise<T>
}

export const PearContext = createContext<PearContextValue | null>(null)
