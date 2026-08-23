/**
 * Configuración común de las tres superficies de `ui/`.
 *
 * Cada app tiene su propio `vite.config.ts` porque cada una compila a un
 * destino distinto y debe quedar aislada: el web root del dashboard lo sirve un
 * servidor HTTP que rechaza cualquier ruta con `..`, así que sus assets tienen
 * que vivir dentro de su propia carpeta y no en un `assets/` compartido con la
 * landing y el deck. Una compilación por app, un directorio por app.
 *
 * `base: './'` es obligatorio en las tres: el dashboard se abre por `file://`
 * en Electron, y el deck y la landing se abren a mano desde el disco.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import type { UserConfig } from 'vite'

const uiRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(uiRoot, '..')

export interface AppOptions {
  /** Carpeta dentro de `ui/`. Da nombre al alias: `@<name>/*` → `<name>/src/*`. */
  name: 'dashboard' | 'deck' | 'site'
  /** Destino del bundle, relativo a la raíz del repo. */
  outDir: string
}

export function defineApp({ name, outDir }: AppOptions): UserConfig {
  const root = path.join(uiRoot, name)

  return {
    root,
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        [`@${name}`]: path.join(root, 'src')
      }
    },
    build: {
      // Fuera del root de Vite: por eso `emptyOutDir` va explícito.
      outDir: path.join(repoRoot, outDir),
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 800
    }
  }
}
