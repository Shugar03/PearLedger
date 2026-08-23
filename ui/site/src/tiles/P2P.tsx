import type { CSSProperties, ReactNode } from 'react'

import { Icon } from '@site/components/Icon'

import '@site/tiles/P2P.css'

/** Tile de la red P2P y las actualizaciones OTA. */
export function P2P(): ReactNode {
  return (
    <div className="leaf leaf--md leaf--dark leaf--hover tile p2p col-4">
      <header className="tile__head">
        <span className="tile__icon">
          <Icon name="network" />
        </span>
        <h3 className="tile__title">
          P2P network
        </h3>
        <span className="pill pill--ghost">
          <span className="dot dot--live" />
          Synced
        </span>
      </header>
      <svg className="p2p__net" viewBox="0 0 100 92" aria-hidden="true">
        <line x1="50" y1="46" x2="50" y2="16" />
        <line x1="50" y1="46" x2="82" y2="40" />
        <line x1="50" y1="46" x2="70" y2="76" />
        <line x1="50" y1="46" x2="30" y2="76" />
        <line x1="50" y1="46" x2="18" y2="40" />
        <circle cx="50" cy="16" r="3.2" style={{ '--d': '0' } as CSSProperties} />
        <circle cx="82" cy="40" r="3.2" style={{ '--d': '1' } as CSSProperties} />
        <circle cx="70" cy="76" r="3.2" style={{ '--d': '2' } as CSSProperties} />
        <circle cx="30" cy="76" r="3.2" style={{ '--d': '3' } as CSSProperties} />
        <circle cx="18" cy="40" r="3.2" style={{ '--d': '4' } as CSSProperties} />
        <circle className="p2p__hub" cx="50" cy="46" r="6" />
      </svg>
      <div className="kv">
        <div className="kv__row">
          <span className="kv__k">
            Peers
          </span>
          <span className="kv__v">
            12
          </span>
        </div>
        <div className="kv__row">
          <span className="kv__k">
            Channel
          </span>
          <span className="kv__v kv__v--mono">
            alpha
          </span>
        </div>
      </div>
      <span className="tile__tool">
        OTA updates
      </span>
    </div>
  )
}
