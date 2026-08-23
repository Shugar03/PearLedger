import { useState, type FormEvent, type ReactNode } from 'react'

import { Icon } from '@dashboard/components/Icon'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { LOCALE_LABEL } from '@dashboard/i18n'
import { statusText } from '@dashboard/lib/status'
import type { StreamState } from '@dashboard/lib/types'

/** Cada estado del stream con su píldora. */
const STREAM_CLASS: Record<StreamState, string> = {
  idle: 'pill',
  live: 'pill pill--ok',
  reconnecting: 'pill pill--warn',
  error: 'pill pill--warn',
  closed: 'pill pill--warn'
}

/**
 * Cabecera: acción rápida a la izquierda, preferencias y alertas a la derecha.
 *
 * El campo es el que más se usa — la ruta de una factura — y ejecuta el mismo
 * flujo que la pantalla de Facturas. La campana no notifica nada por su
 * cuenta: cuenta las tools bloqueadas y fallidas de la sesión.
 */
export function TopBar({
  onIngest,
  onAlerts
}: {
  onIngest(path: string): void
  onAlerts(): void
}): ReactNode {
  const { status, streamState, counters, bridge } = usePear()
  const { t, locale, setLocale, theme, setTheme } = usePrefs()
  const [path, setPath] = useState('')

  const alerts = counters['tool:blocked'] + counters['tool:failed']
  const streamLabel =
    streamState === 'live'
      ? t.stream.live
      : streamState === 'reconnecting'
        ? t.stream.reconnecting
        : streamState === 'idle'
          ? t.stream.idle
          : t.stream.error

  // El botón alterna entre los dos temas explícitos. Con la preferencia en
  // `system` se mira qué está pintando el sistema para saber a cuál saltar.
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)

  function submit(event: FormEvent): void {
    event.preventDefault()
    const target = path.trim()
    if (target) onIngest(target)
  }

  return (
    <header className="topbar">
      <form className="quick" onSubmit={submit}>
        <Icon name="invoice" size={16} />
        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder={t.topbar.placeholder}
          aria-label={t.topbar.pathLabel}
        />
        <button type="submit" className="btn btn--primary btn--tiny" disabled={!path.trim()}>
          {t.topbar.submit}
        </button>
      </form>

      {/* En Electron el transporte es IPC: no hay stream que vigilar. */}
      {bridge.host === 'web' ? (
        <span className={STREAM_CLASS[streamState]}>{streamLabel}</span>
      ) : null}
      <span className={status.tone === 'error' ? 'pill pill--warn' : 'pill'}>
        {statusText(status, t)}
      </span>

      <div className="identity">
        <span className="identity__who">{t.topbar.local}</span>

        <button
          type="button"
          className="chip chip--tiny"
          onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
          aria-label={t.topbar.language}
        >
          {LOCALE_LABEL[locale === 'es' ? 'en' : 'es']}
        </button>

        <button
          type="button"
          className="bell"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? t.topbar.themeLight : t.topbar.theme}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={18} />
        </button>

        <span className="identity__avatar" aria-hidden="true">
          🍐
        </span>

        <button type="button" className="bell" onClick={onAlerts} aria-label={t.topbar.alerts}>
          <Icon name="bell" size={18} />
          {alerts > 0 ? <span className="bell__count">{alerts}</span> : null}
        </button>
      </div>
    </header>
  )
}
