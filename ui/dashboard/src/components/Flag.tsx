import type { ReactNode } from 'react'

import type { Locale } from '@dashboard/i18n'

/**
 * Banderas dibujadas, no emoji.
 *
 * Windows no pinta los emoji de bandera: muestra las dos letras del país en un
 * recuadro. Con SVG se ven igual en los tres sistemas y no cuestan una fuente.
 *
 * El idioma se representa con el país donde se habla en este producto:
 * Argentina para el español, Estados Unidos para el inglés.
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
      {locale === 'es' ? <ArgentinaFlag /> : <UsaFlag />}
      <rect x="0.4" y="0.4" width="19.2" height="14.2" rx="2.1" className="flag__edge" />
    </svg>
  )
}

/** Celeste y blanca, con el sol de mayo simplificado a disco y rayos. */
function ArgentinaFlag(): ReactNode {
  const rays = Array.from({ length: 8 }, (_, i) => (i * 360) / 8)

  return (
    <g>
      <rect width="20" height="15" rx="2.5" fill="#74acdf" />
      <rect y="5" width="20" height="5" fill="#ffffff" />
      <g stroke="#f6b40e" strokeWidth="0.5" strokeLinecap="round">
        {rays.map((angle) => (
          <line
            key={angle}
            x1="10"
            y1="7.5"
            x2="10"
            y2="4.6"
            transform={`rotate(${angle} 10 7.5)`}
          />
        ))}
      </g>
      <circle cx="10" cy="7.5" r="1.5" fill="#f6b40e" />
    </g>
  )
}

/** Trece franjas y el cantón; las estrellas van como puntos legibles a 20px. */
function UsaFlag(): ReactNode {
  const stripes = [0, 2, 4, 6, 8, 10, 12]
  const stars: Array<[number, number]> = []
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      stars.push([1.1 + column * 1.6, 1.1 + row * 1.6])
    }
  }

  return (
    <g>
      <rect width="20" height="15" rx="2.5" fill="#ffffff" />
      {stripes.map((y) => (
        <rect key={y} y={(y * 15) / 13} width="20" height={15 / 13} fill="#b22234" />
      ))}
      <rect width="9" height={(15 * 7) / 13} fill="#3c3b6e" />
      <g fill="#ffffff">
        {stars.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.42" />
        ))}
      </g>
    </g>
  )
}
