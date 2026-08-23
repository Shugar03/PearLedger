import type { ReactNode } from 'react'

import { HeroPreview } from '@site/components/HeroPreview'

import '@site/sections/Hero.css'

/** Portada: propuesta de valor y vista previa del producto. */
export function Hero(): ReactNode {
  return (
    <section className="hero">
      <div className="hero__glow" aria-hidden="true" />
      <div className="wrap hero__inner">
        <div className="hero__copy reveal">
          <span className="pill pill--ghost hero__eyebrow">
            <span className="dot" />
            Local-first financial automation
          </span>
          <h1 className="hero__headline">
            {' '}
            <span className="hero__line">
              {' '}
              <span>
                The agent that automates
              </span>
              {' '}
            </span>
            <span className="hero__line">
              {' '}
              <span>
                {'your '}
              </span>
              <span className="hero__accent">
                financial operations
              </span>
              <span>
                .
              </span>
              {' '}
            </span>
            {' '}
          </h1>
          <p className="hero__sub">
            It reads the invoice, reconciles it, projects inventory and settles in USDt. All on your device, with no network fees.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#empezar">
              {' GET STARTED '}
            </a>
            <a className="btn btn--ghost" href="#producto">
              {' VIEW THE DASHBOARD '}
            </a>
          </div>
          <ul className="hero__badges">
            <li className="pill pill--ghost">
              <span className="dot" />
              100% local AI
            </li>
            <li className="pill pill--ghost">
              <span className="dot" />
              $0.00 network fee
            </li>
            <li className="pill pill--ghost">
              <span className="dot" />
              P2P distribution
            </li>
          </ul>
        </div>
        <div className="hero__preview reveal" aria-label="Product preview">
          <HeroPreview />
        </div>
      </div>
    </section>
  )
}
