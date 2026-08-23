/**
 * Bundle de la landing page.
 *
 * Sale a `dist/pitch/site/`, junto al deck y fuera del producto. Las imágenes
 * se importan desde `src/assets/` para que Vite las versione por hash en vez de
 * viajar en base64 dentro del HTML, como venían en el export original.
 */
import { defineConfig } from 'vite'

import { defineApp } from '../vite.shared'

export default defineConfig(defineApp({ name: 'site', outDir: 'dist/pitch/site' }))
