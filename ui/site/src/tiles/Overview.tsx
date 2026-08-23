import type { CSSProperties, ReactNode } from 'react'

import { CashFlow } from '@site/tiles/CashFlow'
import { Icon } from '@site/components/Icon'

import '@site/tiles/Overview.css'

/** Tile grande: dinero conciliado y detalle de la factura leída. */
export function Overview(): ReactNode {
  return (
    <div className="leaf leaf--hover tile ov col-12">
      <div className="ov__grid">
        <section className="ov__money">
          <header className="tile__head">
            <span className="tile__icon">
              <Icon name="chart" />
            </span>
            <h3 className="tile__title">
              Financial overview
            </h3>
          </header>
          <div className="ov__stats">
            <div className="stat">
              <span className="stat__k">
                Balance
              </span>
              <span className="stat__v">
                $248,510
              </span>
            </div>
            <div className="stat">
              <span className="stat__k">
                Revenue
              </span>
              <span className="stat__v">
                $61,200
              </span>
            </div>
            <div className="stat">
              <span className="stat__k">
                Expenses
              </span>
              <span className="stat__v">
                $12,480
              </span>
            </div>
          </div>
          <CashFlow />
        </section>
        <section className="ov__invoice">
          <header className="tile__head">
            <span className="tile__icon">
              <Icon name="document" />
            </span>
            <h3 className="tile__title">
              Invoice OCR
            </h3>
            <span className="pill pill--soft">
              <Icon name="check" size={13} />
              Processed
            </span>
          </header>
          <div className="kv">
            <div className="kv__row">
              <span className="kv__k">
                Vendor
              </span>
              <span className="kv__v">
                ACME S.R.L.
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__k">
                Number
              </span>
              <span className="kv__v kv__v--mono">
                INV-0421
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__k">
                Total
              </span>
              <span className="kv__v">
                USD 1,240.00
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__k">
                Line items
              </span>
              <span className="kv__v">
                4
              </span>
            </div>
          </div>
          <div className="ov__conf">
            <div className="ov__conf-top">
              <span className="kv__k">
                Confidence
              </span>
              <span className="num ov__pct">
                98%
              </span>
            </div>
            <div className="ov__bar">
              <span style={{ '--w': '98%' } as CSSProperties} />
            </div>
          </div>
          <p className="ov__match">
            {' Matched against '}
            <strong className="mono">
              PO-2291
            </strong>
            {' '}
          </p>
          <span className="tile__tool mono">
            parse_invoice
          </span>
        </section>
      </div>
    </div>
  )
}
