/**
 * Contratos que cruzan el puente hacia el harness.
 *
 * Es un espejo declarativo de `src/core/types.ts` (`ToolDescriptor`) y de
 * `src/dashboard/events.ts` (`DashboardEvent`). Se redeclaran aquí en vez de
 * importarse de `src/` a propósito: aquel árbol se compila para Bare
 * (`moduleResolution: NodeNext`, sin `lib.dom`) y traerlo a este programa
 * metería `node:http` en el renderer. Si cambian allí, cambian aquí.
 */

export type HarnessEventType =
  | 'tool:registered'
  | 'tool:executing'
  | 'tool:done'
  | 'tool:blocked'
  | 'tool:failed'

/** Los dos `harness:*` sólo los emite el proceso principal de Electron. */
export type DashboardEventType =
  | HarnessEventType
  | 'dashboard:hello'
  | 'harness:loading'
  | 'harness:ready'

export interface DashboardEvent {
  type: DashboardEventType
  /** Correlativo del hub SSE. Electron no lo manda. */
  id?: number
  /** ISO del hub SSE. Ausente en Electron: se cae a la hora local. */
  at?: string
  tool?: string
  plugin?: string
  /** Nombre del campo en el hub SSE. */
  detail?: unknown
  /** Nombre del campo en el puente de Electron. */
  payload?: unknown
}

export interface ToolDescriptor {
  name: string
  description: string
  plugin: string
}

export interface HealthPayload {
  ok: boolean
  version: string
  tools: number
}

export type StreamState = 'idle' | 'live' | 'reconnecting' | 'error' | 'closed'

export type ToolParams = Record<string, unknown>

/**
 * Fachada única del harness.
 *
 * La implementan `lib/pear-web.ts` (fetch + SSE) y `electron/preload.mjs`
 * (IPC). Ningún componente sabe en cuál de los dos hosts corre: los métodos
 * que sólo existen en uno van marcados como opcionales y se detectan con
 * `typeof bridge.x === 'function'`.
 */
export interface PearBridge {
  host: 'web' | 'electron'
  listTools(): Promise<ToolDescriptor[]>
  execute(name: string, params?: ToolParams): Promise<unknown>
  /** Devuelve la función de desuscripción. */
  onEvent(handler: (event: DashboardEvent) => void): () => void

  /** Sólo Electron: diálogo nativo que devuelve la ruta absoluta en disco. */
  pickInvoice?(): Promise<string | null>
  /** Sólo web: `/api/health`. */
  health?(): Promise<HealthPayload>
  /** Sólo web: estado del stream SSE. */
  onStreamState?(handler: (state: StreamState) => void): () => void
  /** Sólo web: notas de política que el servidor adjunta a `/api/execute`. */
  onPolicyNotes?(handler: (notes: string[]) => void): () => void
}

// ── Formas laxas de los resultados de tools ─────────────────────────────────
// El harness devuelve `unknown`; la UI sólo lee unos pocos campos y tolera que
// falten. Nada de castear a un tipo estricto que el día de mañana mienta.

export interface ParsedInvoice {
  vendor?: string
  total?: number | string
  currency?: string
  invoiceNumber?: string
}

export interface ParseInvoiceResult {
  blocked?: boolean
  invoice?: ParsedInvoice
  invoiceId?: string
}

export interface MatchResult {
  status?: string
}

/**
 * Formas de `check_inventory` y `run_usage_forecast`.
 *
 * Espejo de `src/plugins/procurement-forecast/types.ts`, donde el comentario de
 * cabecera dice que estas claves son contrato público y no se renombran. Por
 * eso la vista de forecast puede dibujar filas de verdad en vez de volcar JSON.
 */
export interface InventoryItem {
  sku: string
  description: string
  stock: number
  unit: string
  dailyUsage: number
  safetyThreshold: number
  vendor: string
  unitPrice: number
}

export interface ForecastResult {
  sku: string
  description?: string
  currentStock: number
  projectedConsumption: number
  /** `null` cuando no hay quiebre proyectado dentro del horizonte. */
  breakDate: string | null
  belowThreshold: boolean
  recommendedOrderQty: number
  vendor?: string
  unitPrice?: number
  daysHorizon: number
}

export interface WalletBalance {
  usdt?: string
  network?: string
  native?: string
  eth?: string
}
