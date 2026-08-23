import type { ReactNode } from 'react'

const TRACKS = [
  {
    track: 'QVAC',
    title: 'IA 100% local',
    detail: 'OCR + RAG + match factura/PO. Ningún byte sale del dispositivo.'
  },
  {
    track: 'WDK',
    title: 'Settlement gasless',
    detail: 'USDt patrocinado. Comisión de gas nativo: $0.00.'
  },
  {
    track: 'Pear',
    title: 'Distribución P2P',
    detail: 'CLI variant/daemon. Updates OTA sin app store ni servidor central.'
  }
] as const

export function ProofSlide(): ReactNode {
  return (
    <>
      <p className="eyebrow">Lo que acabás de ver</p>
      <h2 className="headline">Tres tracks. Un solo agente soberano.</h2>
      <div className="proof-grid">
        {TRACKS.map((item) => (
          <div className="proof" key={item.track}>
            <div className="track">{item.track}</div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </>
  )
}
