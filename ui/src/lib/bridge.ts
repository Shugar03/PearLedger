/**
 * Resuelve el puente del host.
 *
 * En Electron el preload ya dejó `window.pear` colgado antes de que corra una
 * sola línea de React; en el navegador se construye la versión HTTP + SSE. La
 * detección mira que exista `execute`, no la marca `host`: si el preload
 * cambiase de forma queremos enterarnos aquí y no tres capas más abajo.
 */
import { createWebBridge } from '@ui/lib/pear-web'
import type { PearBridge } from '@ui/lib/types'

declare global {
  interface Window {
    pear?: PearBridge
    /** Umbral de confirmación para simular pagos. Lo puede fijar el host. */
    __PEAR_THRESHOLD__?: number
  }
}

let cached: PearBridge | null = null

export function getBridge(): PearBridge {
  if (cached) return cached

  const injected = window.pear
  cached = injected && typeof injected.execute === 'function' ? injected : createWebBridge()
  return cached
}

/** Umbral por encima del cual la vista de pagos pide confirmación humana. */
export function confirmThreshold(): number {
  const configured = window.__PEAR_THRESHOLD__
  return typeof configured === 'number' && Number.isFinite(configured) ? configured : 1000
}
