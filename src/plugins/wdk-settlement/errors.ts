/**
 * Clasificación de errores. Módulo **puro**: recibe un `unknown` y responde
 * `boolean`/`string`. Nada de red ni de config.
 */

/**
 * Error de configuración (seed ausente, seed de test en mainnet…).
 *
 * Se distingue del resto porque **no** se cura reintentando contra otro RPC:
 * el failover debe abortar de inmediato y el resultado debe decir la verdad en
 * vez de disfrazarse de "RPC caído".
 */
export class ConfigurationError extends Error {
  override readonly name = 'ConfigurationError'

  constructor(message: string) {
    super(message)
  }
}

export function isConfigurationError(err: unknown): err is ConfigurationError {
  return err instanceof ConfigurationError
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err) ?? String(err)
  } catch {
    return String(err)
  }
}

const CONNECTIVITY_MARKERS = [
  'certificate',
  'ssl',
  'tls',
  'unable to verify',
  'econnreset',
  'etimedout',
  'econnrefused',
  'enotfound',
  'network',
  'fetch failed',
  'socket hang up',
  'bad gateway',
  '503',
  '502',
  '429'
] as const

/** ¿Merece la pena reintentar contra otro RPC? TLS, DNS, 5xx, rate limit. */
export function isRpcConnectivityError(err: unknown): boolean {
  if (isConfigurationError(err)) return false
  const message = errorMessage(err).toLowerCase()
  return CONNECTIVITY_MARKERS.some((marker) => message.includes(marker))
}

/**
 * Fallo de `pimlico_getUserOperationGasPrice`.
 *
 * Cambiar de RPC público no lo arregla —es el bundler, no la cadena—, así que
 * el failover lo propaga en vez de gastar la lista entera de endpoints.
 */
export function isPimlicoGasPriceError(err: unknown): boolean {
  const message = errorMessage(err).toLowerCase()
  return (
    message.includes('pimlico_getuseroperationgasprice') ||
    message.includes('getuseroperationgasprice')
  )
}
