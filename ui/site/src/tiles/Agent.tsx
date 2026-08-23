import type { CSSProperties, ReactNode } from 'react'

import { Icon } from '@site/components/Icon'

import '@site/tiles/Agent.css'

/** Tile del agente local y su actividad. */
export function Agent(): ReactNode {
  return (
    <div className="leaf leaf--dark leaf--hover tile agent col-4">
      <header className="tile__head">
        <span className="tile__icon">
          <Icon name="brain" />
        </span>
        <h3 className="tile__title">
          AI Agent
        </h3>
        <span className="pill pill--ghost">
          <span className="dot dot--live" />
          Online
        </span>
      </header>
      <p className="agent__sub">
        Running locally
      </p>
      <ul className="agent__bars" aria-hidden="true">
        <li style={{ '--d': '0' } as CSSProperties} />
        <li style={{ '--d': '1' } as CSSProperties} />
        <li style={{ '--d': '2' } as CSSProperties} />
        <li style={{ '--d': '3' } as CSSProperties} />
        <li style={{ '--d': '4' } as CSSProperties} />
        <li style={{ '--d': '5' } as CSSProperties} />
        <li style={{ '--d': '6' } as CSSProperties} />
        <li style={{ '--d': '7' } as CSSProperties} />
      </ul>
      <div className="kv">
        <div className="kv__row">
          <span className="kv__k">
            OCR · reconciliation · forecast
          </span>
        </div>
        <div className="kv__row">
          <span className="kv__k">
            No outbound calls
          </span>
        </div>
      </div>
    </div>
  )
}
