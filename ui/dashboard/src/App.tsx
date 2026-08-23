import { useState, type ReactNode } from 'react'

import { ActivityPanel } from '@dashboard/components/ActivityPanel'
import { Sidebar } from '@dashboard/components/Sidebar'
import { TopBar } from '@dashboard/components/TopBar'
import { titleOf, type ViewKey } from '@dashboard/lib/navigation'
import { ForecastView } from '@dashboard/views/ForecastView'
import { InboxView } from '@dashboard/views/InboxView'
import { PaymentsView } from '@dashboard/views/PaymentsView'
import { WalletView } from '@dashboard/views/WalletView'

/**
 * Sólo se monta la vista activa.
 *
 * El dashboard viejo dibujaba las cuatro y las escondía con CSS, lo que dejaba
 * cuatro formularios vivos compitiendo por los mismos `id`. Aquí cambiar de
 * sección desmonta la anterior con su estado.
 */
const VIEW_COMPONENT: Record<ViewKey, () => ReactNode> = {
  inbox: InboxView,
  pay: PaymentsView,
  forecast: ForecastView,
  wallet: WalletView
}

export function App(): ReactNode {
  const [view, setView] = useState<ViewKey>('inbox')
  const Current = VIEW_COMPONENT[view]

  return (
    <div className="app">
      <Sidebar active={view} onSelect={setView} />

      <main className="content">
        <TopBar title={titleOf(view)} />
        <Current />
      </main>

      <ActivityPanel />
    </div>
  )
}
