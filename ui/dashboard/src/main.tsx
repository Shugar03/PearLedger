/**
 * Punto de entrada del renderer.
 *
 * El orden de los CSS importa: primero los tokens, después el layout. Y el de
 * los providers también: las preferencias envuelven al puente porque el tema y
 * el idioma valen aunque el harness no arranque.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@dashboard/styles/tokens.css'
import '@dashboard/styles/app.css'

import { App } from '@dashboard/App'
import { PearProvider } from '@dashboard/context/PearProvider'
import { PrefsProvider } from '@dashboard/context/PrefsProvider'

const container = document.getElementById('root')
if (!container) throw new Error('Falta el contenedor #root en index.html')

createRoot(container).render(
  <StrictMode>
    <PrefsProvider>
      <PearProvider>
        <App />
      </PearProvider>
    </PrefsProvider>
  </StrictMode>
)
