/**
 * Bundle del pitch deck.
 *
 * Sale a `dist/pitch/deck/`, fuera del web root del dashboard: el deck es
 * material de presentación, no parte del producto, y no debe quedar servido en
 * el puerto del harness ni empaquetado en el instalador.
 */
import { defineConfig } from 'vite'

import { defineApp } from '../vite.shared'

export default defineConfig(defineApp({ name: 'deck', outDir: 'dist/pitch/deck' }))
