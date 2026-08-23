import type { CSSProperties, ReactNode } from 'react'

import '@site/tiles/CashFlow.css'

/** Gráfico de barras de entradas y salidas por mes. */
export function CashFlow(): ReactNode {
  return (
    <figure className="cf">
      <figcaption className="cf__cap">
        {' '}
        <span>
          Net cash flow · 12 months
        </span>
        {' '}
        <span className="cf__last">
          61k
        </span>
        {' '}
      </figcaption>
      <svg
        viewBox="0 0 320 96"
        role="img"
        aria-label="Net cash flow · 12 months. thousands of USD."
      >
        <line className="cf__axis" x1="0" y1="84" x2="320" y2="84" />
        <g className="cf__bars">
          <g className="cf__group" style={{ '--i': '0' } as CSSProperties}>
            <title>
              18k
            </title>
            <rect
              className="cf__hit"
              x="0"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M0 84 V66.1639344262295 Q0 62.16393442622951 4 62.16393442622951 H15.333333333333332 Q19.333333333333332 62.16393442622951 19.333333333333332 66.1639344262295 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '1' } as CSSProperties}>
            <title>
              24k
            </title>
            <rect
              className="cf__hit"
              x="27.333333333333332"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M27.333333333333332 84 V58.885245901639344 Q27.333333333333332 54.885245901639344 31.333333333333332 54.885245901639344 H42.666666666666664 Q46.666666666666664 54.885245901639344 46.666666666666664 58.885245901639344 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '2' } as CSSProperties}>
            <title>
              21k
            </title>
            <rect
              className="cf__hit"
              x="54.666666666666664"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M54.666666666666664 84 V62.52459016393443 Q54.666666666666664 58.52459016393443 58.666666666666664 58.52459016393443 H70 Q74 58.52459016393443 74 62.52459016393443 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '3' } as CSSProperties}>
            <title>
              32k
            </title>
            <rect
              className="cf__hit"
              x="82"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M82 84 V49.18032786885246 Q82 45.18032786885246 86 45.18032786885246 H97.33333333333333 Q101.33333333333333 45.18032786885246 101.33333333333333 49.18032786885246 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '4' } as CSSProperties}>
            <title>
              28k
            </title>
            <rect
              className="cf__hit"
              x="109.33333333333333"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M109.33333333333333 84 V54.0327868852459 Q109.33333333333333 50.0327868852459 113.33333333333333 50.0327868852459 H124.66666666666666 Q128.66666666666666 50.0327868852459 128.66666666666666 54.0327868852459 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '5' } as CSSProperties}>
            <title>
              41k
            </title>
            <rect
              className="cf__hit"
              x="136.66666666666666"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M136.66666666666666 84 V38.26229508196722 Q136.66666666666666 34.26229508196722 140.66666666666666 34.26229508196722 H152 Q156 34.26229508196722 156 38.26229508196722 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '6' } as CSSProperties}>
            <title>
              37k
            </title>
            <rect
              className="cf__hit"
              x="164"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M164 84 V43.114754098360656 Q164 39.114754098360656 168 39.114754098360656 H179.33333333333334 Q183.33333333333334 39.114754098360656 183.33333333333334 43.114754098360656 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '7' } as CSSProperties}>
            <title>
              46k
            </title>
            <rect
              className="cf__hit"
              x="191.33333333333331"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M191.33333333333331 84 V32.196721311475414 Q191.33333333333331 28.196721311475414 195.33333333333331 28.196721311475414 H206.66666666666666 Q210.66666666666666 28.196721311475414 210.66666666666666 32.196721311475414 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '8' } as CSSProperties}>
            <title>
              44k
            </title>
            <rect
              className="cf__hit"
              x="218.66666666666666"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M218.66666666666666 84 V34.62295081967213 Q218.66666666666666 30.622950819672127 222.66666666666666 30.622950819672127 H234 Q238 30.622950819672127 238 34.62295081967213 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '9' } as CSSProperties}>
            <title>
              52k
            </title>
            <rect
              className="cf__hit"
              x="246"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M246 84 V24.91803278688525 Q246 20.91803278688525 250 20.91803278688525 H261.3333333333333 Q265.3333333333333 20.91803278688525 265.3333333333333 24.91803278688525 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '10' } as CSSProperties}>
            <title>
              49k
            </title>
            <rect
              className="cf__hit"
              x="273.3333333333333"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M273.3333333333333 84 V28.557377049180324 Q273.3333333333333 24.557377049180324 277.3333333333333 24.557377049180324 H288.66666666666663 Q292.66666666666663 24.557377049180324 292.66666666666663 28.557377049180324 V84 Z"
            />
          </g>
          <g className="cf__group" style={{ '--i': '11' } as CSSProperties}>
            <title>
              61k
            </title>
            <rect
              className="cf__hit"
              x="300.66666666666663"
              y="0"
              width="19.333333333333332"
              height="84"
            />
            <path
              className="cf__bar"
              d="M300.66666666666663 84 V14 Q300.66666666666663 10 304.66666666666663 10 H315.99999999999994 Q319.99999999999994 10 319.99999999999994 14 V84 Z"
            />
          </g>
        </g>
      </svg>
    </figure>
  )
}
