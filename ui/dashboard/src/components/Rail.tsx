import { useEffect, useState, type ReactNode } from 'react'

import { Icon } from '@dashboard/components/Icon'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { isAlert, lookOf, reasonOf, timeOf } from '@dashboard/lib/activity'

/** Cuántos círculos entran sin que la rejilla empiece a scrollear. */
const BADGES = 32

/** Ejecuciones por página de la tabla. */
const PAGE = 6

/**
 * Riel derecho: el pulso del harness.
 *
 * Arriba, un círculo por ejecución — lima la que terminó, coral la que falló o
 * quedó bloqueada, celeste la que está corriendo. Abajo, la tabla paginada:
 * las ejecuciones se acumulan durante toda la sesión y sin páginas la tarjeta
 * crecería sin fin o escondería todo lo viejo.
 */
export function Rail({ alertsOnly }: { alertsOnly: boolean }): ReactNode {
  const { events, counters, clearActivity } = usePear()
  const { t, locale } = usePrefs()
  const [onlyAlerts, setOnlyAlerts] = useState(alertsOnly)
  const [page, setPage] = useState(0)

  const shown = onlyAlerts ? events.filter(isAlert) : events
  const alerts = counters['tool:blocked'] + counters['tool:failed']
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))

  // Al filtrar, al limpiar o cuando la lista se acorta, la página actual puede
  // quedar fuera de rango: se vuelve a la última que existe.
  useEffect(() => {
    setPage((current) => Math.min(current, pages - 1))
  }, [pages])

  function filter(next: boolean): void {
    setOnlyAlerts(next)
    setPage(0)
  }

  const slice = shown.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <div className="rail">
      <section className="card">
        <div className="card__head">
          <h2 className="card__title">{t.rail.title}</h2>
          <button
            type="button"
            className={onlyAlerts ? 'pill pill--ink' : 'pill'}
            onClick={() => filter(!onlyAlerts)}
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
              const reason = reasonOf(entry)
              return (
                <span
                  key={entry.key}
                  className={look.badge}
                  title={[entry.event.tool ?? t.common.none, t.state[look.label], reason]
                    .filter(Boolean)
                    .join(' · ')}
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
          <>
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
                  {slice.map((entry) => {
                    const look = lookOf(entry)
                    const reason = reasonOf(entry)
                    return (
                      <tr key={entry.key}>
                        <td className="table__time">{timeOf(entry, locale)}</td>
                        <td>
                          <span className="table__tool">{entry.event.tool ?? t.common.none}</span>
                          {entry.event.plugin ? (
                            <span className="table__plugin">{entry.event.plugin}</span>
                          ) : null}
                          {reason ? (
                            <span className="table__reason" title={reason}>
                              {reason}
                            </span>
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

            <div className="pager">
              <span className="pager__count">
                {t.rail.range(page * PAGE + 1, page * PAGE + slice.length, shown.length)}
              </span>
              <div className="pager__controls">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  aria-label={t.rail.previous}
                >
                  <Icon name="chevronLeft" size={15} />
                </button>
                <span className="pager__page">{t.rail.page(page + 1, pages)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
                  disabled={page >= pages - 1}
                  aria-label={t.rail.next}
                >
                  <Icon name="chevronRight" size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
