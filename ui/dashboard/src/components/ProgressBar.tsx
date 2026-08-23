import type { ReactNode } from 'react'

/**
 * Barra de progreso con el resto rayado, como en la referencia.
 *
 * Va en SVG y no en CSS porque el ancho depende de un dato y la CSP del
 * servidor (`style-src 'self'`, sin `unsafe-inline`) descarta cualquier
 * `style=`. En SVG el ancho es un atributo y el rayado es un `pattern`.
 */
const HEIGHT = 14

export function ProgressBar({
  ratio,
  tone = 'ok',
  label
}: {
  /** Entre 0 y 1. Fuera de rango se recorta. */
  ratio: number
  tone?: 'ok' | 'warn'
  label: string
}): ReactNode {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0))
  const percent = Math.round(clamped * 100)

  return (
    <svg
      className="list__bar"
      width="100%"
      height={HEIGHT}
      viewBox={`0 0 100 ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: ${percent}%`}
    >
      <defs>
        <pattern
          id="hatch"
          width="2.4"
          height="2.4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <line className="bar__hatch" x1="0" y1="0" x2="0" y2="2.4" />
        </pattern>
      </defs>

      {/* Sin `rx`: con `preserveAspectRatio="none"` un radio se estiraría hasta
          volverse una elipse. El redondeo lo pone la CSS sobre el propio SVG. */}
      <rect className="bar__track" width="100" height={HEIGHT} />
      <rect width="100" height={HEIGHT} fill="url(#hatch)" />
      {clamped > 0 ? (
        <rect
          className={tone === 'warn' ? 'bar__fill is-low' : 'bar__fill'}
          width={clamped * 100}
          height={HEIGHT}
        />
      ) : null}
    </svg>
  )
}
