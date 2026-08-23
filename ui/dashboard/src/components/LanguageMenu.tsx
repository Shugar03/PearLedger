import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { Flag } from '@dashboard/components/Flag'
import { Icon } from '@dashboard/components/Icon'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { LOCALES, type Locale } from '@dashboard/i18n'

/**
 * Selector de idioma con banderas.
 *
 * Un `<select>` nativo no puede llevar SVG dentro de sus opciones, así que es
 * un desplegable propio. Lo mínimo para que se comporte como uno: cierra con
 * Escape, con un clic afuera y al elegir, y devuelve el foco al botón.
 */
export function LanguageMenu(): ReactNode {
  const { locale, setLocale, t } = usePrefs()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent): void {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(next: Locale): void {
    setLocale(next)
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <div className="lang" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="lang__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t.topbar.language}
        onClick={() => setOpen((value) => !value)}
      >
        <Flag locale={locale} size={19} />
        <span className={open ? 'lang__caret is-open' : 'lang__caret'}>
          <Icon name="caret" size={12} />
        </span>
      </button>

      {open ? (
        <ul className="lang__menu" id={menuId} role="listbox" aria-label={t.topbar.language}>
          {LOCALES.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === locale}
                className={option === locale ? 'lang__option is-active' : 'lang__option'}
                onClick={() => choose(option)}
              >
                <Flag locale={option} />
                {t.languages[option]}
                {option === locale ? (
                  <span className="lang__check">
                    <Icon name="check" size={14} />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
