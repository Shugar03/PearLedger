import type { ReactNode } from 'react'

/**
 * Fila de dato con medidor.
 *
 * El medidor va en SVG y no en CSS a propósito: el ancho depende del dato, y
 * un `style` en línea lo bloquearía la CSP del servidor (`style-src 'self'`,
 * sin `unsafe-inline`). En SVG el ancho es un atributo, no un estilo.
 */
const WIDTH = 88
const HEIGHT = 6

export function MeterRow({
  name,
  meta,
  value,
  ratio,
  low = false,
  badge
}: {
  name: string
  meta?: string
  value: string
  /** Entre 0 y 1. Fuera de rango se recorta. */
  ratio: number
  /** Pinta el medidor en coral: el dato pide una acción. */
  low?: boolean
  badge?: ReactNode
}): ReactNode {
  const filled = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * WIDTH

  return (
    <div className="row">
      <div>
        <span className="row__name">{name}</span>
        {meta ? <span className="row__meta">{meta}</span> : null}
      </div>
      <div className="row__side">
        {badge}
        <span className="row__value">{value}</span>
        <svg
          className="bar"
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          aria-hidden="true"
        >
          <rect className="bar__track" width={WIDTH} height={HEIGHT} rx={HEIGHT / 2} />
          <rect
            className={low ? 'bar__fill is-low' : 'bar__fill'}
            width={filled}
            height={HEIGHT}
            rx={HEIGHT / 2}
          />
        </svg>
      </div>
    </div>
  )
}
