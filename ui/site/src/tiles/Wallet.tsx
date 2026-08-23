import type { ReactNode } from 'react'

import { Icon } from '@site/components/Icon'

import '@site/tiles/Wallet.css'

/** Tile de saldo en USDt. */
export function Wallet(): ReactNode {
  return (
    <div className="leaf leaf--mirror leaf--hover tile wallet col-4">
      <header className="tile__head">
        <span className="tile__icon">
          <Icon name="wallet" />
        </span>
        <h3 className="tile__title">
          Wallet
        </h3>
      </header>
      <div className="stat">
        <span className="stat__k">
          USDt balance
        </span>
        <span className="wallet__amount">
          {'12,480.00 '}
          <small>
            USDt
          </small>
        </span>
      </div>
      <div className="kv">
        <div className="kv__row">
          <span className="kv__k">
            Network
          </span>
          <span className="kv__v">
            mainnet
          </span>
        </div>
        <div className="kv__row">
          <span className="kv__k">
            Address
          </span>
          <span className="kv__v kv__v--mono">
            0x7a3f…c19b
          </span>
        </div>
      </div>
      <span className="tile__tool mono">
        get_wallet_balance
      </span>
    </div>
  )
}
