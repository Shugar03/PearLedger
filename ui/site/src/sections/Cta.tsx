import type { ReactNode } from 'react'

import { Mascot } from '@site/components/Mascot'
import { mascotCta } from '@site/assets'

import '@site/sections/Cta.css'

/** Cierre con la llamada a la acción. */
export function Cta(): ReactNode {
  return (
    <section className="section section--tight section--dark" id="empezar">
      <div className="wrap ct reveal">
        <div>
          <p className="ct__tagline">
            Local-first. Gasless. P2P.
          </p>
          <h2 className="ct__title">
            Automate your next invoice.
          </h2>
          <p className="ct__body">
            Clone, install and the agent runs on your machine.
          </p>
        </div>
        <Mascot image={mascotCta} size={140} width={460} height={608} className="mascot--mirror" />
        <div className="ct__actions">
          <a className="btn btn--primary" href="#empezar">
            {' SIGN UP '}
          </a>
          <a
            className="btn btn--ghost"
            href="https://github.com/Shugar03/PearLedger"
            target="_blank"
            rel="noopener"
          >
            {' View the repo '}
          </a>
        </div>
      </div>
    </section>
  )
}
