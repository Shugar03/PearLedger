/**
 * Diccionarios del dashboard.
 *
 * Sin librería de i18n: dos objetos tipados y una función para elegir. Una
 * dependencia entera para dos idiomas y trescientas cadenas no se paga, y la
 * CSP no deja cargar nada de la red igual.
 */
import { en } from '@dashboard/i18n/en'
import { es } from '@dashboard/i18n/es'
import type { Dict, Locale } from '@dashboard/i18n/dict'

export type { Dict, Locale }

export const DICTS: Record<Locale, Dict> = { es, en }

export const LOCALES: readonly Locale[] = ['es', 'en']

/** Etiqueta corta del selector: siempre el idioma AL QUE se cambia. */
export const LOCALE_LABEL: Record<Locale, string> = { es: 'ES', en: 'EN' }

/** El idioma del navegador si lo tenemos; si no, español. */
export function detectLocale(): Locale {
  const candidates = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  for (const tag of candidates) {
    if (typeof tag !== 'string') continue
    const base = tag.toLowerCase().split('-')[0]
    if (base === 'en') return 'en'
    if (base === 'es') return 'es'
  }
  return 'es'
}
