import type { ReactNode } from 'react'

const PAINS = [
  { title: 'OCR en la nube', detail: 'Facturas e inventario viajan a APIs de terceros.' },
  { title: 'Gas nativo', detail: 'Cada pago P2P exige ETH/tokens solo para liquidar.' },
  { title: 'Servidores únicos', detail: 'Un outage o un vendor lock frena la operación.' },
  { title: 'Conciliación lenta', detail: 'Factura vs PO vs stock: horas de trabajo humano.' }
] as const

export function ProblemSlide(): ReactNode {
  return (
    <>
      <p className="eyebrow">El problema</p>
      <h2 className="headline">La tesorería sigue atrapada entre Excel y la nube.</h2>
      <p className="sub">
        Facturas manuales, ERPs centralizados, gas que come margen y datos financieros que salen del
        perímetro.
      </p>
      <div className="pain-grid">
        {PAINS.map((pain) => (
          <div className="pain" key={pain.title}>
            <strong>{pain.title}</strong>
            <span>{pain.detail}</span>
          </div>
        ))}
      </div>
    </>
  )
}
