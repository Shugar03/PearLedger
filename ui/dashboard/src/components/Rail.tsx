import { useState, type ReactNode } from 'react'

import { Icon, type IconName } from '@dashboard/components/Icon'
import type { ActivityEntry } from '@dashboard/context/pear-context'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import type { Dict } from '@dashboard/i18n'

/** Cuántos círculos entran sin que la rejilla empiece a scrollear. */
const BADGES = 35

/** Cuántas filas de la tabla se muestran. */
const ROWS = 7

interface Look {
  badge: string
  icon: IconName
  pill: string
  label: keyof Dict['state']
}

const STATE: Record<string, Look> = {
  'tool:done': { badge: 'badge badge--done', icon: 'check', pill: 'pill pill--ok', label: 'done' },
  'tool:executing': {
    badge: 'badge badge--running',
    icon: 'play',
    pill: 'pill pill--wait',
    label: 'running'
  },
  'tool:blocked': {
    badge: 'badge badge--blocked',
    icon: 'close',
    pill: 'pill pill--warn',
    label: 'blocked'
  },
  'tool:failed': {
    badge: 'badge badge--failed',
    icon: 'close',
    pill: 'pill pill--warn',
    label: 'failed'
  },
  'tool:registered': { badge: 'badge', icon: 'check', pill: 'pill', label: 'registered' }
}

function lookOf(entry: ActivityEntry): Look {
  return STATE[entry.event.type] ?? STATE['tool:registered']!
}

function isAlert(entry: ActivityEntry): boolean {
  return entry.event.type === 'tool:blocked' || entry.event.type === 'tool:failed'
}

/**
 * Riel derecho: el pulso del harness.
 *
 * Arriba, un círculo por ejecución — lima la que terminó, coral la que falló o
 * quedó bloqueada, celeste la que está corriendo. Abajo, las últimas con su
 * hora y su plugin.
 */
export function Rail({ alertsOnly }: { alertsOnly: boolean }): ReactNode {
  const { events, counters, clearActivity } = usePear()
  const { t, locale } = usePrefs()
  const [onlyAlerts, setOnlyAlerts] = useState(alertsOnly)

  const shown = onlyAlerts ? events.filter(isAlert) : events
  const alerts = counters['tool:blocked'] + counters['tool:failed']

  const time = (entry: ActivityEntry): string => {
    const at = entry.event.at ? new Date(entry.event.at) : new Date()
    return Number.isNaN(at.getTime())
      ? ''
      : at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="rail">
      <section className="card">
        <div className="card__head">
          <h2 className="card__title">{t.rail.title}</h2>
          <button
            type="button"
            className={onlyAlerts ? 'pill pill--ink' : 'pill'}
            onClick={() => setOnlyAlerts((value) => !value)}
          >
            {onlyAlerts ? t.rail.alertsOnly(alerts) : t.rail.session(events.length)}
          </button>
        </div>

        {shown.length === 0 ? (
          <p className="empty">{onlyAlerts ? t.rail.emptyAlerts : t.rail.emptyAll}</p>
        ) : (
          <div className="grid-badges">
            {shown.slice(0, BADGES).map((entry) => {
              const look = lookOf(entry)
              return (
                <span
                  key={entry.key}
                  className={look.badge}
                  title={`${entry.event.tool ?? t.common.none} · ${t.state[look.label]}`}
                >
                  <Icon name={look.icon} size={13} />
                </span>
              )
            })}
          </div>
        )}

        <p className="legend">
          <span>
            <i className="is-done" /> {t.rail.legendDone} {counters['tool:done']}
          </span>
          <span>
            <i className="is-running" /> {t.rail.legendRunning} {counters['tool:executing']}
          </span>
          <span>
            <i className="is-alert" /> {t.rail.legendAlerts} {alerts}
          </span>
        </p>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">{t.rail.lastTools}</h2>
          <button type="button" className="btn btn--tiny" onClick={clearActivity}>
            {t.rail.clear}
          </button>
        </div>

        {shown.length === 0 ? (
          <p className="empty">{t.rail.emptyTable}</p>
        ) : (
          <div className="rail__scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t.rail.colTime}</th>
                  <th scope="col">{t.rail.colTool}</th>
                  <th scope="col">{t.rail.colState}</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, ROWS).map((entry) => {
                  const look = lookOf(entry)
                  return (
                    <tr key={entry.key}>
                      <td className="table__time">{time(entry)}</td>
                      <td>
                        <span className="table__tool">{entry.event.tool ?? t.common.none}</span>
                        {entry.event.plugin ? (
                          <span className="table__plugin">{entry.event.plugin}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={look.pill}>{t.state[look.label]}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
