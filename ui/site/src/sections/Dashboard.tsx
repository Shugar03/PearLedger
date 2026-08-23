import type { ReactNode } from 'react'

import { Agent } from '@site/tiles/Agent'
import { Forecast } from '@site/tiles/Forecast'
import { Mascot } from '@site/components/Mascot'
import { Overview } from '@site/tiles/Overview'
import { P2P } from '@site/tiles/P2P'
import { Payment } from '@site/tiles/Payment'
import { Wallet } from '@site/tiles/Wallet'
import { mascotOverview } from '@site/assets'

import '@site/sections/Dashboard.css'

/** El producto en un bento grid: seis tiles con datos de ejemplo. */
export function Dashboard(): ReactNode {
  return (
    <section className="section section--alt" id="producto">
      <div className="wrap">
        <div className="db__top reveal">
          <div className="section__head db__head">
            <span className="kicker">
              The product
            </span>
            <h2 className="section__title">
              The agent works. You approve.
            </h2>
            <p className="section__subtitle">
              What it read, what it matched and what it is about to pay, in plain sight.
            </p>
          </div>
          <Mascot image={mascotOverview} size={168} width={460} height={394} />
        </div>
        <div className="bento reveal">
          <Overview />
          <Agent />
          <Wallet />
          <Payment />
          <Forecast />
          <P2P />
        </div>
      </div>
    </section>
  )
}
