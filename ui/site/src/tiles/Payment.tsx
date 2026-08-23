import type { ReactNode } from 'react'

import { Icon } from '@site/components/Icon'

import '@site/tiles/Payment.css'

/** Tile del pago gasless, con la comisión en cero. */
export function Payment(): ReactNode {
  return (
    <div className="leaf leaf--hover tile pay col-4">
      <header className="tile__head">
        <span className="tile__icon">
          <Icon name="bolt" />
        </span>
        <h3 className="tile__title">
          Gasless payment
        </h3>
        <span className="pill pill--soft">
          <Icon name="check" size={13} />
          Completed
        </span>
      </header>
      <div className="pay__fee">
        <span className="stat__k">
          Network fee
        </span>
        <span className="pay__zero">
          $0.00
        </span>
      </div>
      <div className="kv">
        <div className="kv__row">
          <span className="kv__k">
            Amount
          </span>
          <span className="kv__v">
            1,240.00 USDt
          </span>
        </div>
        <div className="kv__row">
          <span className="kv__k">
            Transaction
          </span>
          <span className="kv__v kv__v--mono">
            0x7a3f…c19b
          </span>
        </div>
      </div>
      <span className="tile__tool mono">
        execute_gasless_payment
      </span>
    </div>
  )
}
