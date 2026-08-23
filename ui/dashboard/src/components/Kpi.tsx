import type { ReactNode } from 'react'

import { Icon } from '@dashboard/components/Icon'

/**
 * Cifra grande con su distintivo y su nota, como en la referencia.
 *
 * La flecha de la esquina lleva a la pantalla donde ese número se trabaja; si
 * no hay a dónde ir, no se dibuja.
 */
export function Kpi({
  label,
  value,
  badge,
  tone = 'neutral',
  note,
  onOpen,
  openLabel
}: {
  label: string
  value: string
  badge?: string
  tone?: 'neutral' | 'ok' | 'wait' | 'warn'
  note?: string
  onOpen?: () => void
  openLabel?: string
}): ReactNode {
  const badgeClass =
    tone === 'ok'
      ? 'pill pill--ok'
      : tone === 'wait'
        ? 'pill pill--wait'
        : tone === 'warn'
          ? 'pill pill--warn'
          : 'pill'

  return (
    <section className="card kpi">
      <div className="card__head">
        <span className="kpi__label">{label}</span>
        {onOpen ? (
          <button type="button" className="icon-btn" onClick={onOpen} aria-label={openLabel}>
            <Icon name="arrow" size={15} />
          </button>
        ) : null}
      </div>

      <div className="kpi__row">
        {/* La `key` remonta el nodo al cambiar el dato, y con eso se repite
            la animación de entrada: la cifra nueva llega, no aparece. */}
        <p key={value} className={value === '—' ? 'kpi__value is-empty' : 'kpi__value'}>
          {value}
        </p>
        {badge ? <span className={badgeClass}>{badge}</span> : null}
      </div>

      {note ? <p className="kpi__note">{note}</p> : null}
    </section>
  )
}
