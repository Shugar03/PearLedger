import type { ReactNode } from 'react'

export function TitleSlide(): ReactNode {
  return (
    <>
      <p className="eyebrow">Hackathon Aleph 2026</p>
      <h1 className="brand">
        <span className="pear">Pear</span>Ledger
      </h1>
      <p className="sub sub--lead">
        El sistema operativo de tesorería P2P:
        <br />
        privado, local-first y sin comisiones de gas.
      </p>
      <p className="tagline">Local-first · Gasless · P2P · Soberanía operativa</p>
    </>
  )
}
