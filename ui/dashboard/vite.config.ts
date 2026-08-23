/**
 * Bundle del dashboard.
 *
 * Sale a `dist/dashboard/web/`, que es de donde sirve el dev server
 * (`src/dashboard/server.ts` → `resolveWebRoot()`) y de donde carga Electron
 * (`ui/electron/main.mjs`). Un solo bundle para las dos superficies.
 *
 * Nada de CDNs ni de fuentes remotas: la CSP del servidor es
 * `default-src 'self'` sin `unsafe-inline`, así que todo va en el bundle y
 * ningún componente puede usar atributos `style` en línea.
 */
import { defineConfig } from 'vite'

// Único `../` admitido en `ui/`: los alias no existen hasta que Vite los lee.
import { defineApp } from '../vite.shared'

export default defineConfig(defineApp({ name: 'dashboard', outDir: 'dist/dashboard/web' }))
