import type { ReactNode } from 'react'

import { logoPearledger, logoPearledgerInvert } from '@dashboard/assets'
import { Icon } from '@dashboard/components/Icon'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { VIEWS, type ViewKey } from '@dashboard/lib/navigation'

export function Sidebar({
  active,
  onSelect
}: {
  active: ViewKey
  onSelect(view: ViewKey): void
}): ReactNode {
  const { meta } = usePear()
  const { t } = usePrefs()

  const harness =
    meta.models === 'ready'
      ? t.sidebar.harnessReady
      : meta.models === 'error'
        ? t.sidebar.harnessError
        : t.sidebar.harnessBusy

  const group = (name: 'main' | 'aside'): ReactNode => (
    <nav className="nav" aria-label={name === 'main' ? t.nav.sections : t.nav.harness}>
      {VIEWS.filter((view) => view.group === name).map((view) => (
        <button
          key={view.key}
          type="button"
          className={view.key === active ? 'nav__item is-active' : 'nav__item'}
          aria-current={view.key === active ? 'page' : undefined}
          onClick={() => onSelect(view.key)}
        >
          <Icon name={view.icon} />
          {t.nav[view.key]}
        </button>
      ))}
    </nav>
  )

  return (
    <aside className="sidebar">
      {/* Las dos versiones se montan y la CSS esconde la que no toca: así el
          cambio de tema no depende de que React sepa cuál está pintando. */}
      <div className="brand">
        <img className="brand__logo brand__logo--light" src={logoPearledger} alt="PearLedger" />
        <img
          className="brand__logo brand__logo--dark"
          src={logoPearledgerInvert}
          alt="PearLedger"
        />
      </div>

      {group('main')}
      {group('aside')}

      <div className="sidebar__foot">
        <div className="meta">
          <div className="meta__row">
            <span>{t.sidebar.tools}</span>
            <b>{meta.tools ?? t.common.none}</b>
          </div>
          <div className="meta__row">
            <span>{t.sidebar.version}</span>
            <b>{meta.version ? `v${meta.version}` : t.common.none}</b>
          </div>
          <div className="meta__row">
            <span>{t.sidebar.harness}</span>
            <b className={meta.models === 'ready' ? 'is-ready' : 'is-busy'}>{harness}</b>
          </div>
          <div className="meta__row">
            <span>{t.sidebar.mode}</span>
            <b className="is-ready">{t.sidebar.dryRun}</b>
          </div>
        </div>
      </div>
    </aside>
  )
}
