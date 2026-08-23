import type { ReactNode } from 'react'

import { Icon } from '@site/components/Icon'
import { Mascot } from '@site/components/Mascot'
import { mascotFlow } from '@site/assets'

import '@site/sections/Flow.css'

/** Los cuatro pasos del agente, de la factura al pago. */
export function Flow(): ReactNode {
  return (
    <section className="section section--dark" id="como-funciona">
      <div className="wrap">
        <div className="fw__top reveal">
          <div className="section__head fw__head">
            <span className="kicker">
              The problem
            </span>
            <h2 className="section__title">
              Financial operations shouldn't be this complicated.
            </h2>
            <p className="section__subtitle">
              Three tasks done by hand today that the agent handles on its own.
            </p>
            <div className="fw__audience">
              <span className="pill pill--ghost">
                {' '}
                <Icon name="user" size={14} />
                {' Accountants '}
              </span>
              <span className="pill pill--ghost">
                {' '}
                <Icon name="user" size={14} />
                {' Treasury '}
              </span>
              <span className="pill pill--ghost">
                {' '}
                <Icon name="user" size={14} />
                {' Finance teams '}
              </span>
            </div>
          </div>
          <Mascot image={mascotFlow} size={168} width={460} height={668} className="mascot--circle mascot--white" />
        </div>
        <div className="fw reveal">
          <div className="fw__cols" aria-hidden="true">
            <span className="fw__col fw__col--before">
              Today
            </span>
            <span className="fw__col fw__col--after">
              With PearLedger
            </span>
          </div>
          <ol className="fw__rows">
            <li className="fw__row">
              <span className="fw__n mono">
                01
              </span>
              <p className="fw__before">
                {' '}
                <span className="fw__mark fw__mark--x" aria-hidden="true" />
                {' Typing every invoice by hand. '}
              </p>
              <span className="fw__arrow" aria-hidden="true">
                →
              </span>
              <div className="fw__after">
                <span className="fw__step">
                  {' '}
                  <span className="fw__mark fw__mark--ok" aria-hidden="true">
                    {' '}
                    <Icon name="check" size={12} />
                    {' '}
                  </span>
                  {' INGEST '}
                </span>
                <p className="fw__text">
                  The agent reads the document and extracts the fields.
                </p>
                <code className="fw__tool">
                  parse_invoice
                </code>
              </div>
            </li>
            <li className="fw__row">
              <span className="fw__n mono">
                02
              </span>
              <p className="fw__before">
                {' '}
                <span className="fw__mark fw__mark--x" aria-hidden="true" />
                {' Eyeballing invoice against purchase order. '}
              </p>
              <span className="fw__arrow" aria-hidden="true">
                →
              </span>
              <div className="fw__after">
                <span className="fw__step">
                  {' '}
                  <span className="fw__mark fw__mark--ok" aria-hidden="true">
                    {' '}
                    <Icon name="check" size={12} />
                    {' '}
                  </span>
                  {' UNDERSTAND '}
                </span>
                <p className="fw__text">
                  It reconciles on its own, with confidence and gaps.
                </p>
                <code className="fw__tool">
                  match_purchase_order
                </code>
              </div>
            </li>
            <li className="fw__row">
              <span className="fw__n mono">
                03
              </span>
              <p className="fw__before">
                {' '}
                <span className="fw__mark fw__mark--x" aria-hidden="true" />
                {' Paying fees and waiting for settlement. '}
              </p>
              <span className="fw__arrow" aria-hidden="true">
                →
              </span>
              <div className="fw__after">
                <span className="fw__step">
                  {' '}
                  <span className="fw__mark fw__mark--ok" aria-hidden="true">
                    {' '}
                    <Icon name="check" size={12} />
                    {' '}
                  </span>
                  {' SETTLE '}
                </span>
                <p className="fw__text">
                  It settles in USDt with a $0.00 network fee.
                </p>
                <code className="fw__tool">
                  execute_gasless_payment
                </code>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  )
}
