import type { CSSProperties, ReactNode } from 'react'

import { Icon } from '@site/components/Icon'

import '@site/components/HeroPreview.css'

/** Maqueta animada del agente trabajando, dentro de la portada. */
export function HeroPreview(): ReactNode {
  return (
    <div className="hp" aria-hidden="true">
      <div className="hp__glow" />
      <article className="hp__card">
        <header className="hp__head">
          <span className="hp__icon">
            <Icon name="brain" />
          </span>
          <div>
            <span className="hp__title">
              AI Agent
            </span>
            <span className="hp__sub">
              Running locally
            </span>
          </div>
          <span className="pill pill--ghost hp__status">
            <span className="dot dot--live" />
            Online
          </span>
        </header>
        <ol className="hp__steps">
          <li className="hp__step" style={{ '--i': '0' } as CSSProperties}>
            <span className="hp__check">
              {' '}
              <Icon name="check" size={12} />
              {' '}
            </span>
            <span className="hp__label">
              Invoice read
            </span>
            <span className="hp__detail mono">
              ACME S.R.L. · USD 1,240.00
            </span>
          </li>
          <li className="hp__step" style={{ '--i': '1' } as CSSProperties}>
            <span className="hp__check">
              {' '}
              <Icon name="check" size={12} />
              {' '}
            </span>
            <span className="hp__label">
              Matched
            </span>
            <span className="hp__detail mono">
              PO-2291 · match OK
            </span>
          </li>
          <li className="hp__step" style={{ '--i': '2' } as CSSProperties}>
            <span className="hp__check">
              {' '}
              <Icon name="check" size={12} />
              {' '}
            </span>
            <span className="hp__label">
              Paid
            </span>
            <span className="hp__detail mono">
              network fee $0.00
            </span>
          </li>
        </ol>
        <footer className="hp__foot">
          <span className="hp__bar">
            <i />
          </span>
          <span className="hp__note">
            0 bytes left the device
          </span>
        </footer>
      </article>
    </div>
  )
}
