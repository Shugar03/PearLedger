/**
 * Punto de entrada del pitch deck.
 *
 * Cinco diapositivas para los tres minutos del pitch de Aleph 2026. El guion
 * y los tiempos están en `docs/PITCH-VIDEO-3MIN.md`.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Los globales antes que la app: los imports se evalúan en orden.
import '@deck/styles/tokens.css'
import '@deck/styles/deck.css'

import { Deck } from '@deck/Deck'

const container = document.getElementById('root')
if (!container) throw new Error('Falta el contenedor #root en index.html')

createRoot(container).render(
  <StrictMode>
    <Deck />
  </StrictMode>
)
