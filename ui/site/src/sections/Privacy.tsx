import type { ReactNode } from 'react'

import { Icon } from '@site/components/Icon'
import { Mascot } from '@site/components/Mascot'
import { mascotPrivacy } from '@site/assets'

import '@site/sections/Privacy.css'

/** Qué se queda en el dispositivo y qué no sale nunca. */
export function Privacy(): ReactNode {
  return (
    <section className="section section--dark" id="seguridad">
      <div className="wrap pv">
        <div className="pv__intro reveal">
          <span className="kicker">
            Privacy and security
          </span>
          <h2 className="section__title">
            Your financial data stays yours.
          </h2>
          <p className="section__subtitle">
            Amounts, vendors and accounts never leave the device.
          </p>
          <div className="pv__foot">
            <a
              className="btn btn--ghost btn--sm"
              href="https://github.com/Shugar03/PearLedger/blob/main/harness/hooks.ts"
              target="_blank"
              rel="noopener"
            >
              {' '}
              <Icon name="shield" size={15} />
              {' See the hook '}
            </a>
            <Mascot image={mascotPrivacy} size={140} width={460} height={600} />
          </div>
        </div>
        <ul className="pv__list reveal">
          <li className="pv__item">
            <span className="pv__icon">
              {' '}
              <Icon name="device" />
              {' '}
            </span>
            <div>
              <h3 className="pv__title">
                100% Local AI
              </h3>
              <p className="pv__body">
                Inference and OCR via @qvac/sdk, on your machine.
              </p>
            </div>
            <span className="pv__check" aria-hidden="true">
              {' '}
              <Icon name="check" size={12} />
              {' '}
            </span>
          </li>
          <li className="pv__item">
            <span className="pv__icon">
              {' '}
              <Icon name="server" />
              {' '}
            </span>
            <div>
              <h3 className="pv__title">
                No central server
              </h3>
              <p className="pv__body">
                No backend receives or stores the documents.
              </p>
            </div>
            <span className="pv__check" aria-hidden="true">
              {' '}
              <Icon name="check" size={12} />
              {' '}
            </span>
          </li>
          <li className="pv__item">
            <span className="pv__icon">
              {' '}
              <Icon name="cloudOff" />
              {' '}
            </span>
            <div>
              <h3 className="pv__title">
                No cloud APIs
              </h3>
              <p className="pv__body">
                Zero calls to external AI services.
              </p>
            </div>
            <span className="pv__check" aria-hidden="true">
              {' '}
              <Icon name="check" size={12} />
              {' '}
            </span>
          </li>
          <li className="pv__item">
            <span className="pv__icon">
              {' '}
              <Icon name="lock" />
              {' '}
            </span>
            <div>
              <h3 className="pv__title">
                Human confirmation
              </h3>
              <p className="pv__body">
                Every payment above $1,000 USDt is approved by a person.
              </p>
            </div>
            <span className="pv__check" aria-hidden="true">
              {' '}
              <Icon name="check" size={12} />
              {' '}
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}
