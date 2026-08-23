import { useState, type FormEvent, type ReactNode } from 'react'

import { Icon } from '@dashboard/components/Icon'
import { LanguageMenu } from '@dashboard/components/LanguageMenu'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { statusDetail, statusText } from '@dashboard/lib/status'

/**
 * Cabecera: acción rápida a la izquierda, preferencias y alertas a la derecha.
 *
 * El campo es el que más se usa — la ruta de una factura — y ejecuta el mismo
 * flujo que la pantalla de Facturas. La campana no notifica nada por su
 * cuenta: cuenta las tools bloqueadas y fallidas de la sesión.
 *
 * El estado del stream sólo se muestra cuando hay algo que decir. "En vivo" era
 * ruido permanente; "reconectando" o "sin stream" sí piden atención.
 */
export function TopBar({
  onIngest,
  onAlerts
}: {
  onIngest(path: string): void
  onAlerts(): void
}): ReactNode {
  const { status, streamState, counters, bridge } = usePear()
  const { t, theme, setTheme } = usePrefs()
  const [path, setPath] = useState('')

  const alerts = counters['tool:blocked'] + counters['tool:failed']
  const streamBroken =
    bridge.host === 'web' && (streamState === 'reconnecting' || streamState === 'error' || streamState === 'closed')

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

      {streamBroken ? (
        <span className="pill pill--warn">
          {streamState === 'reconnecting' ? t.stream.reconnecting : t.stream.error}
        </span>
      ) : null}

      <span
        key={statusText(status, t)}
        className={status.tone === 'error' ? 'pill pill--warn pill--flip' : 'pill pill--flip'}
        title={statusDetail(status)}
      >
        {statusText(status, t)}
      </span>

      <div className="identity">
        <LanguageMenu />

        <button
          type="button"
          className="bell"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? t.topbar.themeLight : t.topbar.theme}
        >
          <span key={isDark ? 'dark' : 'light'} className="bell__swap">
            <Icon name={isDark ? 'sun' : 'moon'} size={18} />
          </span>
        </button>

        <button type="button" className="bell" onClick={onAlerts} aria-label={t.topbar.alerts}>
          <Icon name="bell" size={18} />
          {alerts > 0 ? <span className="bell__count">{alerts}</span> : null}
        </button>
      </div>
    </header>
  )
}
