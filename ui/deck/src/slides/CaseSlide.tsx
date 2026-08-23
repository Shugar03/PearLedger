import { Fragment, type ReactNode } from 'react'

const ROWS = [
  { key: 'Comprador', value: 'PearOps LatAm — tesorería interna', lime: false },
  { key: 'Vendor', value: 'PackRight SA', lime: false },
  { key: 'Docs', value: 'INV-2026-0847 ↔ PO-2026-0312', lime: false },
  { key: 'Liquidación', value: '250.00 USDt · gasless dry-run', lime: true }
] as const

/** El paso 4 va apagado: es lo que queda por mostrar cuando se corta a la demo. */
const STEPS = [
  { label: '1 · ingest OCR', on: true },
  { label: '2 · 3-way match', on: true },
  { label: '3 · pay USDt', on: true },
  { label: '4 · OTA P2P', on: false }
] as const

export function CaseSlide(): ReactNode {
  return (
    <>
      <p className="eyebrow">Caso en vivo · 2 minutos</p>
      <h2 className="headline">PearOps paga a PackRight. Sin nube. Sin gas.</h2>

      <div className="case-card">
        {ROWS.map((row) => (
          <div className="case-row" key={row.key}>
            <span className="k">{row.key}</span>
            <span className={row.lime ? 'v lime' : 'v'}>{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flow">
        {STEPS.map((step, index) => (
          <Fragment key={step.label}>
            {index > 0 ? <span className="arrow">→</span> : null}
            <span className={step.on ? 'step on' : 'step'}>{step.label}</span>
          </Fragment>
        ))}
      </div>
    </>
  )
}