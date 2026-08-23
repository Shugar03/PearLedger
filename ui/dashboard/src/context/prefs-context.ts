/**
 * Contrato de las preferencias de quien mira: tema e idioma.
 *
 * Separado del provider para que aquel módulo exporte sólo componentes.
 */
import { createContext } from 'react'

import type { Dict, Locale } from '@dashboard/i18n'

/** `system` sigue a `prefers-color-scheme`; los otros dos lo fuerzan. */
export type ThemePref = 'system' | 'light' | 'dark'

export interface PrefsValue {
  theme: ThemePref
  setTheme(next: ThemePref): void
  locale: Locale
  setLocale(next: Locale): void
  /** El diccionario del idioma activo. */
  t: Dict
}

export const PrefsContext = createContext<PrefsValue | null>(null)
