/**
 * Punto de entrada de la landing.
 *
 * El orden de los CSS importa y no es decorativo: tokens, después el reset y
 * las piezas compartidas, y al final la hoja de cada componente. Varias reglas
 * de componente pisan a una clase compartida sobre el mismo elemento — un
 * `.hp__status` sobre un `.pill--ghost` — y con la misma especificidad gana la
 * última. En el export eso lo resolvía el `[data-c]`; acá lo resuelve el orden.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Los globales van ANTES que la app: los imports se evalúan en orden, así que
// esto es lo que garantiza que las hojas de cada componente se apilen detrás
// del reset y de las piezas compartidas, y no al revés.
import '@site/styles/tokens.css'
import '@site/styles/base.css'

import { App } from '@site/App'

const container = document.getElementById('root')
if (!container) throw new Error('Falta el contenedor #root en index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
