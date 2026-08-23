import type { ReactNode } from 'react'

import type { Locale } from '@dashboard/i18n'

/**
 * Banderas dibujadas, no emoji.
 *
 * Windows no pinta los emoji de bandera: muestra las dos letras del país en un
 * recuadro. Con SVG se ven igual en los tres sistemas y no cuestan una fuente.
 */
export function Flag({ locale, size = 20 }: { locale: Locale; size?: number }): ReactNode {
  const height = Math.round((size * 3) / 4)

  return (
    <svg
      className="flag"
      width={size}
      height={height}
      viewBox="0 0 20 15"
      aria-hidden="true"
      focusable="false"
    >
      {locale === 'es' ? <SpainFlag /> : <UkFlag />}
      <rect x="0.4" y="0.4" width="19.2" height="14.2" rx="2.1" className="flag__edge" />
    </svg>
  )
}

/** Rojigualda: bandas 1/4 · 2/4 · 1/4. */
function SpainFlag(): ReactNode {
  return (
    <g>
      <rect width="20" height="15" rx="2.5" fill="#c60b1e" />
      <rect y="3.75" width="20" height="7.5" fill="#ffc400" />
    </g>
  )
}

/** Union Jack simplificada: sin la asimetría de las diagonales blancas. */
function UkFlag(): ReactNode {
  return (
    <g>
      <rect width="20" height="15" rx="2.5" fill="#012169" />
      <path d="M0 0 20 15M20 0 0 15" stroke="#ffffff" strokeWidth="3" />
      <path d="M0 0 20 15M20 0 0 15" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M10 0v15M0 7.5h20" stroke="#ffffff" strokeWidth="5" />
      <path d="M10 0v15M0 7.5h20" stroke="#c8102e" strokeWidth="3" />
    </g>
  )
}
