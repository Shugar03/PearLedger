import type { ReactNode } from 'react'

import { Icon } from '@site/components/Icon'
import { StockLine } from '@site/tiles/StockLine'

import '@site/tiles/Forecast.css'

/** Tile de proyección de inventario por SKU. */
export function Forecast(): ReactNode {
  return (
    <div className="leaf leaf--mirror leaf--hover tile fc col-8">
      <header className="tile__head">
        <span className="tile__icon">
          <Icon name="cart" />
        </span>
        <h3 className="tile__title">
          Inventory forecast
        </h3>
        <span className="pill pill--tag">
          SKU MAT-001
        </span>
      </header>
      <StockLine />
      <p className="fc__alert">
        <span className="dot" />
        Restock in 16 days
      </p>
      <span className="tile__tool mono">
        run_usage_forecast
      </span>
    </div>
  )
}
