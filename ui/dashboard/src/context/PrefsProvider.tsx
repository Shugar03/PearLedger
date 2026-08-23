import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { PrefsContext, type PrefsValue, type ThemePref } from '@dashboard/context/prefs-context'
import { DICTS, detectLocale, type Locale } from '@dashboard/i18n'

const THEME_KEY = 'pearledger.theme'
const LOCALE_KEY = 'pearledger.locale'

/**
 * `localStorage` puede tirar excepción — ventana privada, almacenamiento
 * bloqueado, `file://` en algunos hosts — y una preferencia no es motivo para
 * tumbar la app: si falla, se usa el valor por defecto y se sigue.
 */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sin persistencia: la preferencia vale para esta sesión y nada más.
  }
}

function initialTheme(): ThemePref {
  const stored = read(THEME_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function initialLocale(): Locale {
  const stored = read(LOCALE_KEY)
  return stored === 'es' || stored === 'en' ? stored : detectLocale()
}

/**
 * Tema e idioma.
 *
 * Van aparte del contexto del harness porque no dependen de él: se resuelven
 * antes de que exista un puente y sobreviven a que el harness no arranque.
 */
export function PrefsProvider({ children }: { children: ReactNode }): ReactNode {
  const [theme, setThemeState] = useState<ThemePref>(initialTheme)
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  // `data-theme` en el <html> es lo que leen los selectores de `tokens.css`.
  // Vacío = seguir al sistema.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setTheme = useCallback((next: ThemePref) => {
    setThemeState(next)
    write(THEME_KEY, next)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    write(LOCALE_KEY, next)
  }, [])

  const value = useMemo<PrefsValue>(
    () => ({ theme, setTheme, locale, setLocale, t: DICTS[locale] }),
    [theme, setTheme, locale, setLocale]
  )

  return <PrefsContext value={value}>{children}</PrefsContext>
}
