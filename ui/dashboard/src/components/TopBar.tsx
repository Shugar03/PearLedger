import type { ReactNode } from 'react'

import { usePear } from '@ui/hooks/usePear'
import type { StreamState } from '@ui/lib/types'

/** Cada estado del stream con su clase y su texto, sin cadenas sueltas. */
const STREAM: Record<StreamState, { className: string; label: string }> = {
  idle: { className: 'pill dim', label: 'SSE' },
  live: { className: 'pill live', label: 'en vivo' },
  reconnecting: { className: 'pill dim', label: 'reconectando' },
  error: { className: 'pill error', label: 'sin stream' },
  closed: { className: 'pill error', label: 'sin stream' }
}

export function TopBar({ title }: { title: string }): ReactNode {
  const { status, streamState, bridge } = usePear()
  const stream = STREAM[streamState]

  return (
    <header className="header">
      <h1>{title}</h1>
      <div className="header-right">
        {/* En Electron el transporte es IPC: no hay stream que mostrar. */}
        {bridge.host === 'web' ? (
          <span className={stream.className}>
            <i className="dot" /> {stream.label}
          </span>
        ) : null}
        <span className={status.kind === 'idle' ? 'pill' : `pill ${status.kind}`}>
          {status.text}
        </span>
      </div>
    </header>
  )
}
