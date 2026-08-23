import { useCallback, useState, type ReactNode } from 'react'

import { Rail } from '@dashboard/components/Rail'
import { Sidebar } from '@dashboard/components/Sidebar'
import { TopBar } from '@dashboard/components/TopBar'
import type { ViewKey } from '@dashboard/lib/navigation'
import { ForecastView } from '@dashboard/views/ForecastView'
import { HomeView } from '@dashboard/views/HomeView'
import { InvoicesView } from '@dashboard/views/InvoicesView'
import { PaymentsView } from '@dashboard/views/PaymentsView'
import { ToolsView } from '@dashboard/views/ToolsView'
import { WalletView } from '@dashboard/views/WalletView'

/** Una orden de procesar llegada desde la cabecera. */
export interface QuickIngest {
  path: string
  /** Cambia en cada envío: es lo que dispara la ejecución, no la ruta. */
  token: number
}

export function App(): ReactNode {
  const [view, setView] = useState<ViewKey>('home')
  const [quick, setQuick] = useState<QuickIngest | null>(null)
  const [alertsOnly, setAlertsOnly] = useState(false)

  const ingestFromHeader = useCallback((path: string) => {
    setQuick((previous) => ({ path, token: (previous?.token ?? 0) + 1 }))
    setView('invoices')
  }, [])

  const showAlerts = useCallback(() => {
    setAlertsOnly((value) => !value)
  }, [])

  return (
    <div className="frame">
      <div className="frame__inner">
        <div className="app">
          <Sidebar active={view} onSelect={setView} />

          <div className="main">
            <TopBar onIngest={ingestFromHeader} onAlerts={showAlerts} />

            <div className="columns">
              <main className={view === 'home' ? 'view view--home' : 'view'}>
                {view === 'home' ? <HomeView onNavigate={setView} /> : null}
                {view === 'invoices' ? <InvoicesView quick={quick} /> : null}
                {view === 'pay' ? <PaymentsView /> : null}
                {view === 'forecast' ? <ForecastView /> : null}
                {view === 'wallet' ? <WalletView /> : null}
                {view === 'tools' ? <ToolsView /> : null}
              </main>

              {/* La `key` reinicia el filtro cuando se toca la campana. */}
              <Rail key={String(alertsOnly)} alertsOnly={alertsOnly} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
