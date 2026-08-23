import type { ReactNode } from 'react'

import { Card } from '@dashboard/components/Card'
import { Icon } from '@dashboard/components/Icon'
import { JsonBlock } from '@dashboard/components/JsonBlock'
import { Kpi } from '@dashboard/components/Kpi'
import { Notice } from '@dashboard/components/Notice'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { useToolResult } from '@dashboard/hooks/useToolResult'
import type { WalletBalance } from '@dashboard/lib/types'

export function WalletView(): ReactNode {
  const { runTool, balance, setBalance } = usePear()
  const { t } = usePrefs()
  const { result, problem, pending, run } = useToolResult()

  function refresh(): void {
    void run(async () => {
      const value = await runTool<WalletBalance>('get_wallet_balance', {})
      setBalance(value)
      return value
    })
  }

  return (
    <>
      <div className="kpis">
        <Kpi
          label={t.wallet.balance}
          value={balance?.usdt ?? t.common.none}
          badge={balance ? t.wallet.upToDate : undefined}
          tone="ok"
          note={t.wallet.balanceNote}
        />
        <Kpi
          label={t.wallet.network}
          value={balance?.network ?? t.common.none}
          note={t.wallet.networkNote}
        />
        <Kpi
          label={t.wallet.native}
          value={balance?.native ?? balance?.eth ?? t.common.none}
          note={t.wallet.nativeNote}
        />
      </div>

      <Card title={t.wallet.title} lead={t.wallet.lead}>
        <div className="card__body">
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={refresh} disabled={pending}>
              <Icon name="refresh" size={16} />
              {balance ? t.wallet.refresh : t.wallet.fetch}
            </button>
          </div>

          {problem ? <Notice problem={problem} /> : null}
          <JsonBlock value={result} />
        </div>
      </Card>
    </>
  )
}
