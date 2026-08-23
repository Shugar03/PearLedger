import type { ReactNode } from 'react'

import { COUNTED_EVENTS, type ActivityEntry } from '@ui/context/pear-context'
import { usePear } from '@ui/hooks/usePear'

const COUNTER_ICON = {
  'tool:executing': '▶',
  'tool:done': '✔',
  'tool:blocked': '⛔',
  'tool:failed': '✖'
} as const

/** El hub manda `detail`; el puente de Electron manda `payload`. */
function detailOf(entry: ActivityEntry): string {
  const raw = entry.event.detail ?? entry.event.payload
  if (raw === undefined || raw === null) return ''
  if (typeof raw === 'string') return raw
  try {
    return JSON.stringify(raw)
  } catch {
    return ''
  }
}

function timeOf(entry: ActivityEntry): string {
  const at = entry.event.at ? new Date(entry.event.at) : new Date()
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleTimeString()
}

export function ActivityPanel(): ReactNode {
  const { events, counters, clearActivity } = usePear()

  return (
    <aside className="activity">
      <div className="activity-head">
        <h2>Actividad en vivo</h2>
        <button type="button" className="btn tiny" onClick={clearActivity}>
          Limpiar
        </button>
      </div>
      <p className="muted small">Eventos del harness en tiempo real.</p>

      <div className="counters">
        {COUNTED_EVENTS.map((type) => (
          <span key={type} className="counter" data-kind={type}>
            {COUNTER_ICON[type]} <b>{counters[type]}</b>
          </span>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="muted small">Sin eventos todavía. Ejecutá una tool.</p>
      ) : (
        <ol className="activity-list">
          {events.map((entry) => {
            const detail = detailOf(entry)
            return (
              <li key={entry.key} className="event" data-type={entry.event.type}>
                <div className="event-top">
                  <span className="event-type">{entry.event.type.replace('tool:', '')}</span>
                  <span className="event-time">{timeOf(entry)}</span>
                </div>
                <div className="event-tool">{entry.event.tool ?? entry.event.plugin ?? '—'}</div>
                {detail ? <p className="event-detail">{detail}</p> : null}
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
