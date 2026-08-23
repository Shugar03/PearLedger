import type { CSSProperties, ReactNode } from 'react'

import { Icon } from '@site/components/Icon'
import { Mascot } from '@site/components/Mascot'
import { logoMarkInvert, mascotArchitecture } from '@site/assets'

import '@site/sections/Architecture.css'

/** Las capas del sistema: harness, plugins y runtimes. */
export function Architecture(): ReactNode {
  return (
    <section className="section" id="arquitectura">
      <div className="wrap">
        <div className="section__head section__head--center reveal">
          <Mascot image={mascotArchitecture} size={140} width={460} height={561} className="ar__pear" />
          <span className="kicker">
            Architecture
          </span>
          <h2 className="section__title">
            How the technology connects
          </h2>
          <p className="section__subtitle">
            Four pieces, none of them with a server of its own.
          </p>
        </div>
        <div className="ar reveal">
          <div className="ar__root">
            <img className="ar__mark" src={logoMarkInvert} alt="" width="260" height="422" />
            <div>
              <strong className="ar__root-name">
                PearLedger
              </strong>
              <span className="ar__root-role">
                Orchestrator · harness + plugins
              </span>
            </div>
          </div>
          <svg
            className="ar__wires"
            viewBox="0 0 1000 72"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path className="ar__wire draw" style={{ '--len': '520' } as CSSProperties} d="M500 0 V28 H125 V72" />
            <path className="ar__wire draw" style={{ '--len': '520' } as CSSProperties} d="M500 0 V28 H375 V72" />
            <path className="ar__wire draw" style={{ '--len': '520' } as CSSProperties} d="M500 0 V28 H625 V72" />
            <path className="ar__wire draw" style={{ '--len': '520' } as CSSProperties} d="M500 0 V28 H875 V72" />
          </svg>
          <ul className="ar__grid">
            <li>
              <div className="leaf leaf--md leaf--hover ar__card">
                <span className="ar__icon">
                  {' '}
                  <Icon name="brain" size={20} />
                  {' '}
                </span>
                <h3 className="ar__name">
                  QVAC
                </h3>
                <span className="pill pill--tag">
                  Local AI / OCR
                </span>
                <p className="ar__body">
                  Reads the documents and matches them against purchase orders.
                </p>
              </div>
            </li>
            <li>
              <div className="leaf leaf--mirror leaf--md leaf--hover ar__card">
                <span className="ar__icon">
                  {' '}
                  <Icon name="wallet" size={20} />
                  {' '}
                </span>
                <h3 className="ar__name">
                  WDK
                </h3>
                <span className="pill pill--tag">
                  Payments
                </span>
                <p className="ar__body">
                  Wallet and USDt settlement through a paymaster.
                </p>
              </div>
            </li>
            <li>
              <div className="leaf leaf--md leaf--hover ar__card">
                <span className="ar__icon">
                  {' '}
                  <Icon name="network" size={20} />
                  {' '}
                </span>
                <h3 className="ar__name">
                  Pear
                </h3>
                <span className="pill pill--tag">
                  P2P runtime
                </span>
                <p className="ar__body">
                  Installs and updates from a pear:// key.
                </p>
              </div>
            </li>
            <li>
              <div className="leaf leaf--mirror leaf--md leaf--hover ar__card">
                <span className="ar__icon">
                  {' '}
                  <Icon name="device" size={20} />
                  {' '}
                </span>
                <h3 className="ar__name">
                  Bare
                </h3>
                <span className="pill pill--tag">
                  Base runtime
                </span>
                <p className="ar__body">
                  Runs without Node.js, with per-platform binaries.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
