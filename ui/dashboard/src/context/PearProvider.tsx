/**
 * Estado compartido del dashboard: puente, píldoras de estado y actividad.
 *
 * Todo lo que antes vivía en variables sueltas de `app.js` (el estado de la
 * cabecera, los contadores, la lista de eventos) está aquí, y las vistas lo
 * consumen con `usePear()`. El puente se resuelve una sola vez: en Electron es
 * el preload, en el navegador la fachada HTTP + SSE.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  COUNTED_EVENTS,
  PearContext,
  type ActivityEntry,
  type CountedEvent,
  type IngestRecord,
  type Counters,
  type PearContextValue,
  type PearMeta
} from '@dashboard/context/pear-context'
import { getBridge } from '@dashboard/lib/bridge'
import { READY, type Status } from '@dashboard/lib/status'
import type {
  DashboardEvent,
  StreamState,
  ToolParams,
  WalletBalance
} from '@dashboard/lib/types'

/** Tope de la lista en pantalla. El hub ya limita su propio historial. */
const MAX_EVENTS = 120

/** Facturas de la sesión que se guardan; más allá, la lista deja de servir. */
const MAX_INGESTS = 40

const ZERO_COUNTERS: Counters = {
  'tool:executing': 0,
  'tool:done': 0,
  'tool:blocked': 0,
  'tool:failed': 0
}

function isCounted(type: string): type is CountedEvent {
  return (COUNTED_EVENTS as readonly string[]).includes(type)
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : String(err)
}

export function PearProvider({ children }: { children: ReactNode }): ReactNode {
  const bridge = useMemo(getBridge, [])

  const [status, setStatus] = useState<Status>(READY)
  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [events, setEvents] = useState<ActivityEntry[]>([])
  const [counters, setCounters] = useState<Counters>(ZERO_COUNTERS)
  const [meta, setMeta] = useState<PearMeta>({ tools: null, version: null, models: 'busy' })
  const [ingests, setIngests] = useState<IngestRecord[]>([])
  const [balance, setBalance] = useState<WalletBalance | null>(null)

  const setModels = useCallback((models: PearMeta['models']) => {
    setMeta((previous) => ({ ...previous, models }))
  }, [])

  const clearActivity = useCallback(() => {
    setEvents([])
    setCounters(ZERO_COUNTERS)
  }, [])

  const recordIngest = useCallback((record: Omit<IngestRecord, 'id' | 'at'>) => {
    setIngests((previous) => {
      const id = `${Date.now()}-${previous.length}`
      const entry: IngestRecord = { ...record, id, at: new Date().toISOString() }
      return [entry, ...previous].slice(0, MAX_INGESTS)
    })
  }, [])

  const seqRef = useRef(0)

  useEffect(() => {
    const offEvent = bridge.onEvent((event: DashboardEvent) => {
      if (!event || !event.type) return

      if (event.type === 'dashboard:hello') {
        setStreamState('live')
        return
      }
      if (event.type === 'harness:loading') {
        setModels('busy')
        setStatus({ code: 'loadingModels', tone: 'busy' })
        return
      }
      if (event.type === 'harness:ready') {
        setModels('ready')
        setStatus(READY)
        return
      }

      seqRef.current += 1
      const entry: ActivityEntry = { key: String(seqRef.current), event }
      setEvents((previous) => [entry, ...previous].slice(0, MAX_EVENTS))
      if (isCounted(event.type)) {
        const type = event.type
        setCounters((previous) => ({ ...previous, [type]: previous[type] + 1 }))
      }

      if (event.type === 'tool:blocked') {
        setStatus({ code: 'blocked', tone: 'error' })
      }
      if (event.type === 'tool:failed') {
        setStatus({ code: 'failed', tone: 'error' })
      }
    })

    const offState = bridge.onStreamState?.(setStreamState)
    const offPolicy = bridge.onPolicyNotes?.((notes) => {
      if (notes.length > 0) setStatus({ code: 'policy', tone: 'busy', detail: notes[0] })
    })

    return () => {
      offEvent()
      offState?.()
      offPolicy?.()
    }
  }, [bridge, setModels])

  // Arranque: catálogo de tools y versión del harness.
  useEffect(() => {
    let alive = true

    void (async () => {
      try {
        const tools = await bridge.listTools()
        if (!alive) return
        setMeta((previous) => ({ ...previous, tools: tools.length, models: 'ready' }))
        setStatus({ code: 'ready', tone: 'idle', detail: tools.length })
      } catch (err) {
        if (!alive) return
        setMeta((previous) => ({ ...previous, models: 'error' }))
        setStatus({ code: 'error', tone: 'error', detail: messageOf(err) })
      }

      if (typeof bridge.health !== 'function') return
      try {
        const health = await bridge.health()
        if (alive) setMeta((previous) => ({ ...previous, version: health.version }))
      } catch {
        // La cabecera puede vivir sin la versión.
      }
    })()

    return () => {
      alive = false
    }
  }, [bridge])

  const runTool = useCallback(
    async <T,>(name: string, params: ToolParams = {}): Promise<T> => {
      setStatus({ code: 'running', tone: 'busy', detail: name })
      try {
        const result = (await bridge.execute(name, params)) as T
        setStatus(READY)
        return result
      } catch (err) {
        setStatus({ code: 'error', tone: 'error', detail: messageOf(err) })
        throw err
      }
    },
    [bridge, setStatus]
  )

  const value = useMemo<PearContextValue>(
    () => ({
      bridge,
      status,
      setStatus,
      streamState,
      meta,
      events,
      counters,
      clearActivity,
      ingests,
      recordIngest,
      balance,
      setBalance,
      runTool
    }),
    [
      bridge,
      status,
      setStatus,
      streamState,
      meta,
      events,
      counters,
      clearActivity,
      ingests,
      recordIngest,
      balance,
      runTool
    ]
  )

  return <PearContext value={value}>{children}</PearContext>
}
