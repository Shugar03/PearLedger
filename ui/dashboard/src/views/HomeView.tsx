import { useState, type ReactNode } from 'react'

import { Icon } from '@dashboard/components/Icon'
import { Kpi } from '@dashboard/components/Kpi'
import { ProgressBar } from '@dashboard/components/ProgressBar'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import {
  INVOICE_FILTERS,
  matchesFilter,
  verdictOf,
  type InvoiceFilter
} from '@dashboard/lib/invoices'
import type { ViewKey } from '@dashboard/lib/navigation'

/**
 * Portada: los dos números que importan y las facturas de la sesión.
 *
 * No ejecuta nada por su cuenta — el saldo lo trae la pantalla de Wallet y las
 * facturas las produce la de Facturas. Acá se leen.
 */
export function HomeView({ onNavigate }: { onNavigate(view: ViewKey): void }): ReactNode {
  const { ingests, balance } = usePear()
  const { t } = usePrefs()
  const [filter, setFilter] = useState<InvoiceFilter>('all')

  const shown = ingests.filter((record) => matchesFilter(record.status, filter))
  const matched = ingests.filter((record) => record.status === 'matched').length

  return (
    <>
      <Kpi
        label={t.home.balance}
        value={balance?.usdt ?? t.common.none}
        badge={balance?.network}
        tone="ok"
        note={balance ? t.home.balanceNote : t.home.balanceEmpty}
        onOpen={() => onNavigate('wallet')}
        openLabel={t.home.openWallet}
      />

      <Kpi
        label={t.home.reconciled}
        value={ingests.length === 0 ? t.common.none : `${matched}/${ingests.length}`}
        badge={ingests.length > 0 && matched === ingests.length ? t.home.allBadge : undefined}
        tone="ok"
        note={t.home.reconciledNote}
        onOpen={() => onNavigate('invoices')}
        openLabel={t.home.openInvoices}
      />

      <section className="card card--wide card--fill">
        <div className="card__head">
          <h2 className="card__title">{t.home.sessionInvoices}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onNavigate('invoices')}
            aria-label={t.home.newInvoice}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>

        <div className="chips">
          {INVOICE_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              className={key === filter ? 'chip is-active' : 'chip'}
              onClick={() => setFilter(key)}
            >
              {t.filters[key]}
            </button>
          ))}
        </div>

        <div className="list__scroll">
          {shown.length === 0 ? (
            <p className="placeholder">
              {ingests.length === 0 ? t.home.emptyNone : t.home.emptyFilter}
            </p>
          ) : (
            <div className="list">
              {shown.map((record) => {
                const verdict = verdictOf(record.status)
                return (
                  <article className="list__item" key={record.id}>
                    <div>
                      <p className="list__title">{record.vendor}</p>
                      <p className="list__meta">
                        {record.total} · {record.path}
                      </p>
                    </div>
                    <div className="list__side">
                      <span className={verdict.pill}>{t.verdicts[verdict.key]}</span>
                    </div>
                    <ProgressBar
                      ratio={verdict.ratio}
                      tone={verdict.tone}
                      label={t.home.reconciliationOf(record.vendor)}
                    />
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => onNavigate('invoices')}
          >
            {t.home.newInvoice}
          </button>
        </div>
      </section>
    </>
  )
}
