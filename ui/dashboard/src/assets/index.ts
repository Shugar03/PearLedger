/**
 * Imágenes del dashboard.
 *
 * Van importadas y no como ruta suelta para que Vite las versione por hash y
 * las sirva desde el mismo origen: la CSP es `img-src 'self' data:` y cualquier
 * URL de fuera quedaría bloqueada.
 */
export { default as logoPearledger } from '@dashboard/assets/logo-pearledger.png'
export { default as logoPearledgerInvert } from '@dashboard/assets/logo-pearledger-invert.png'
