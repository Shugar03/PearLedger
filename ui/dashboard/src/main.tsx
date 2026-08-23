/**
 * Punto de entrada del renderer.
 *
 * El mismo bundle sirve al dashboard web y a Electron: quién provee el puente
 * (`window.pear`) lo decide el host, no este archivo.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@ui/App'
import { PearProvider } from '@ui/context/PearProvider'

import '@ui/styles/tokens.css'
import '@ui/styles/app.css'

const container = document.getElementById('root')
if (!container) throw new Error('Falta el contenedor #root en index.html')

createRoot(container).render(
  <StrictMode>
    <PearProvider>
      <App />
    </PearProvider>
  </StrictMode>
)
