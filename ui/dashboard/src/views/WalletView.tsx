import { useState, type ReactNode } from 'react'

import { Card } from '@ui/components/Card'
import { JsonBlock } from '@ui/components/JsonBlock'
import { usePear } from '@ui/hooks/usePear'
import { useToolResult } from '@ui/hooks/useToolResult'
import type { WalletBalance } from '@ui/lib/types'

export function WalletView(): ReactNode {
  const { runTool } = usePear()
  const { result, pending, run } = useToolResult()
  const [balance, setBalance] = useState<WalletBalance | null>(null)

  function refresh(): void {
    void run(async () => {
      const value = await runTool<WalletBalance>('get_wallet_balance', {})
      setBalance(value)
      return value
    })
  }

  return (
    <div className="view">
      <div className="cards-row">
        <Kpi title="Saldo USDt" value={balance?.usdt} note="Fee gasless: $0.00" />
        <Kpi title="Red" value={balance?.network} note="Selección por chainId" />
        <Kpi title="Nativo" value={balance?.native ?? balance?.eth} note="Sólo informativo" />
      </div>

      <Card>
        <div className="actions">
          <button type="button" className="btn primary" onClick={refresh} disabled={pending}>
            Actualizar saldo
          </button>
        </div>
        <JsonBlock value={result} />
      </Card>
    </div>
  )
}

function Kpi({
  title,
  value,
  note
}: {
  title: string
  value: string | undefined
  note: string
}): ReactNode {
  return (
    <section className="card kpi">
      <h3>{title}</h3>
      <p className="kpi-value">{value ?? '—'}</p>
      <p className="muted">{note}</p>
    </section>
  )
}
