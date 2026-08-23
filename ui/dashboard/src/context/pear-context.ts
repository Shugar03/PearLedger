/**
 * Contrato del contexto que comparte el puente y el estado global de la UI.
 *
 * Vive separado del provider para que el módulo del componente exporte sólo
 * componentes (react-refresh se queja si mezcla) y para que un consumidor
 * pueda importar los tipos sin arrastrar el árbol del provider.
 */
import { createContext } from 'react'

import type { DashboardEvent, PearBridge, StreamState, ToolParams } from '@ui/lib/types'

export type StatusKind = 'idle' | 'busy' | 'error'

export interface Status {
  text: string
  kind: StatusKind
}

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

export interface PearMeta {
  /** `null` mientras no se sabe: la cabecera muestra un guion. */
  tools: number | null
  version: string | null
  models: ModelState
}

export interface PearContextValue {
  bridge: PearBridge
  status: Status
  setStatus(text: string, kind?: StatusKind): void
  streamState: StreamState
  meta: PearMeta
  events: ActivityEntry[]
  counters: Counters
  clearActivity(): void
  /** Ejecuta una tool reflejando el progreso en la píldora de estado. */
  runTool<T = unknown>(name: string, params?: ToolParams): Promise<T>
}

export const PearContext = createContext<PearContextValue | null>(null)
