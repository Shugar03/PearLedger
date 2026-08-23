import type { CSSProperties, ReactNode } from 'react'

import '@site/tiles/StockLine.css'

/** Curva de stock proyectado con su umbral de reposición. */
export function StockLine(): ReactNode {
  return (
    <figure className="sl">
      <figcaption className="sl__legend">
        {' '}
        <span className="sl__swatch" aria-hidden="true" />
        {' Threshold · 10 '}
      </figcaption>
      <svg viewBox="0 0 320 92" role="img" aria-label="Threshold: 10.">
        <defs>
          <linearGradient id="slFade" x1="0" y1="0" x2="0" y2="1">
            {' '}
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.1" />
            {' '}
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
            {' '}
          </linearGradient>
        </defs>
        <path
          className="sl__area"
          d="M0.0 10.0 L35.6 15.7 L71.1 21.4 L106.7 27.1 L142.2 32.9 L177.8 38.6 L213.3 44.3 L248.9 50.0 L284.4 55.7 L320.0 61.4 L320 70 L0 70 Z"
        />
        <line
          className="sl__threshold"
          x1="0"
          y1="55.71428571428571"
          x2="320"
          y2="55.71428571428571"
        />
        <path
          className="sl__line draw"
          d="M0.0 10.0 L35.6 15.7 L71.1 21.4 L106.7 27.1 L142.2 32.9 L177.8 38.6 L213.3 44.3 L248.9 50.0 L284.4 55.7 L320.0 61.4"
          style={{ '--len': '420' } as CSSProperties}
        />
        <circle className="sl__end" cx="320" cy="61.42857142857143" r="4.5" />
        <line className="sl__axis" x1="0" y1="70" x2="320" y2="70" />
      </svg>
    </figure>
  )
}
