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
  type Counters,
  type PearContextValue,
  type PearMeta,
  type Status,
  type StatusKind
} from '@dashboard/context/pear-context'
import { getBridge } from '@dashboard/lib/bridge'
import type { DashboardEvent, StreamState, ToolParams } from '@dashboard/lib/types'

/** Tope de la lista en pantalla. El hub ya limita su propio historial. */
const MAX_EVENTS = 120

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

  const [status, setStatusState] = useState<Status>({ text: 'Listo', kind: 'idle' })
  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [events, setEvents] = useState<ActivityEntry[]>([])
  const [counters, setCounters] = useState<Counters>(ZERO_COUNTERS)
  const [meta, setMeta] = useState<PearMeta>({ tools: null, version: null, models: 'busy' })

  const setStatus = useCallback((text: string, kind: StatusKind = 'idle') => {
    setStatusState({ text, kind })
  }, [])

  const setModels = useCallback((models: PearMeta['models']) => {
    setMeta((previous) => ({ ...previous, models }))
  }, [])

  const clearActivity = useCallback(() => {
    setEvents([])
    setCounters(ZERO_COUNTERS)
  }, [])

  // `setStatus` cambiaría la identidad del efecto en cada render si se leyera
  // directo; el ref lo mantiene estable y el efecto se monta una sola vez.
  const statusRef = useRef(setStatus)
  statusRef.current = setStatus

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
        statusRef.current('Cargando modelos…', 'busy')
        return
      }
      if (event.type === 'harness:ready') {
        setModels('ready')
        statusRef.current('Listo')
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
        statusRef.current('Acción bloqueada — requiere confirmación humana', 'error')
      }
      if (event.type === 'tool:failed') {
        statusRef.current('La tool falló', 'error')
      }
    })

    const offState = bridge.onStreamState?.(setStreamState)
    const offPolicy = bridge.onPolicyNotes?.((notes) => {
      if (notes.length > 0) statusRef.current(`Política del servidor: ${notes[0]}`, 'busy')
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
        statusRef.current(`Listo · ${tools.length} tools`)
      } catch (err) {
        if (!alive) return
        setMeta((previous) => ({ ...previous, models: 'error' }))
        statusRef.current(messageOf(err) || 'Sin harness', 'error')
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
      setStatus(`Ejecutando ${name}…`, 'busy')
      try {
        const result = (await bridge.execute(name, params)) as T
        setStatus('Listo')
        return result
      } catch (err) {
        setStatus(messageOf(err) || 'Error', 'error')
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
      runTool
    }),
    [bridge, status, setStatus, streamState, meta, events, counters, clearActivity, runTool]
  )

  return <PearContext value={value}>{children}</PearContext>
}
