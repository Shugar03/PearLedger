/**
 * Build del renderer.
 *
 * Sale directo a `dist/dashboard/web/`, que es de donde sirve el dev server
 * (`src/dashboard/server.ts` → `resolveWebRoot()`) y de donde carga Electron
 * (`ui/electron/main.mjs`). Un solo bundle para las dos superficies.
 *
 * `base: './'` es obligatorio: Electron abre el HTML por `file://`, donde una
 * ruta absoluta `/assets/…` apuntaría a la raíz del disco.
 *
 * Nada de CDNs ni de fuentes remotas: la CSP del servidor es
 * `default-src 'self'` sin `unsafe-inline`, así que todo va en el bundle y
 * ningún componente puede usar atributos `style` en línea.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@ui': path.join(here, 'src')
    }
  },
  build: {
    // Fuera del root de Vite: por eso `emptyOutDir` va explícito.
    outDir: path.join(here, '..', 'dist', 'dashboard', 'web'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 800
  }
})
