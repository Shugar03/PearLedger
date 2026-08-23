import type { ReactNode } from 'react'

/** Los permalinks que mira el jurado, en el orden en que se nombran. */
const PERMALINKS = [
  { label: 'QVAC', path: 'src/plugins/invoice-ops/ocr.ts' },
  { label: 'RAG', path: 'src/plugins/invoice-ops/matcher.ts' },
  { label: 'WDK', path: 'src/plugins/wdk-settlement/paymaster.ts' },
  { label: 'Pear', path: 'workers/updater.js · bin.mjs' },
  { label: 'Core', path: 'src/core/harness.ts' }
] as const

const PEAR_KEY = 'pear://rxqrpu8fxa8fes4izqr8gprfq1facxnr9b37tinxdkrpad7bkq5o'

export function CloseSlide(): ReactNode {
  return (
    <>
      <p className="eyebrow">Para el jurado</p>
      <h2 className="headline">Código. Permalinks. Reproducible.</h2>

      <div className="permalinks">
        {PERMALINKS.map((item) => (
          <div key={item.label}>
            <span className="label">{item.label}</span>
            {item.path}
          </div>
        ))}
      </div>

      <p className="tagline tagline--close">
        Local-first · Gasless · P2P · Soberanía operativa
      </p>
      <p className="sub sub--key">{PEAR_KEY}</p>
    </>
  )
}
