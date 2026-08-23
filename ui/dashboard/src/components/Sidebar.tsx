import type { ReactNode } from 'react'

import { usePear } from '@dashboard/hooks/usePear'
import { VIEWS, type ViewKey } from '@dashboard/lib/navigation'

const MODEL_LABEL = {
  busy: 'Cargando…',
  ready: 'Listos',
  error: 'Error'
} as const

export function Sidebar({
  active,
  onSelect
}: {
  active: ViewKey
  onSelect(view: ViewKey): void
}): ReactNode {
  const { meta } = usePear()

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">🍐</span> PearLedger
      </div>
      <p className="badge-local">100% local · sin cloud</p>

      <nav aria-label="Secciones">
        {VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            className={view.key === active ? 'nav active' : 'nav'}
            aria-current={view.key === active ? 'page' : undefined}
            onClick={() => onSelect(view.key)}
          >
            <span className="nav-icon">{view.icon}</span> {view.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="meta-row">
          <span>Tools</span>
          <b>{meta.tools ?? '—'}</b>
        </div>
        <div className="meta-row">
          <span>Versión</span>
          <b>{meta.version ? `v${meta.version}` : '—'}</b>
        </div>
        <div className="meta-row">
          <span>Modelos</span>
          <b className={meta.models === 'ready' ? 'ready' : 'busy'}>{MODEL_LABEL[meta.models]}</b>
        </div>
        <div className="meta-row">
          <span>Modo</span>
          <b className="tag-dry">dry-run</b>
        </div>
      </div>
    </aside>
  )
}
