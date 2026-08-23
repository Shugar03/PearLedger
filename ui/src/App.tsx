import { useState, type ReactNode } from 'react'

import { ActivityPanel } from '@ui/components/ActivityPanel'
import { Sidebar } from '@ui/components/Sidebar'
import { TopBar } from '@ui/components/TopBar'
import { titleOf, type ViewKey } from '@ui/lib/navigation'
import { ForecastView } from '@ui/views/ForecastView'
import { InboxView } from '@ui/views/InboxView'
import { PaymentsView } from '@ui/views/PaymentsView'
import { WalletView } from '@ui/views/WalletView'

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
