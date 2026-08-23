/**
 * Punto de entrada del renderer.
 *
 * El mismo bundle sirve al dashboard web y a Electron: quién provee el puente
 * (`window.pear`) lo decide el host, no este archivo.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@dashboard/App'
import { PearProvider } from '@dashboard/context/PearProvider'

import '@dashboard/styles/tokens.css'
import '@dashboard/styles/app.css'

const container = document.getElementById('root')
if (!container) throw new Error('Falta el contenedor #root en index.html')

createRoot(container).render(
  <StrictMode>
    <PearProvider>
      <App />
    </PearProvider>
  </StrictMode>
)
