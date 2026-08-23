/**
 * Conversión de importes y direcciones. Módulo **puro**: sin red, sin config,
 * sin reloj. Todo lo de aquí se prueba con aritmética y nada más.
 */

/** USDt usa 6 decimales tanto en mainnet como en el MOCK de Sepolia. */
export const USDT_DECIMALS = 6

/** Decimales del coin nativo (wei). */
export const NATIVE_DECIMALS = 18

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/**
 * Importe decimal → unidades base.
 *
 * Se pasa por `toFixed` en vez de multiplicar por `10 ** decimals` porque el
 * producto en coma flotante redondea mal importes corrientes (`19.99 * 1e6`
 * da `19989999.999999998`) y un céntimo perdido en dinero es un bug.
 */
export function toBaseUnits(amount: number, decimals: number = USDT_DECIMALS): bigint {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`Importe inválido: ${String(amount)}`)
  }
  if (amount < 0) {
    throw new Error(`Importe negativo: ${amount}`)
  }
  if (amount > Number.MAX_SAFE_INTEGER / 10 ** decimals) {
    throw new Error(`Importe fuera de rango seguro: ${amount}`)
  }

  const [whole = '0', frac = ''] = amount.toFixed(decimals).split('.')
  const scale = 10n ** BigInt(decimals)
  const fraction = frac.padEnd(decimals, '0').slice(0, decimals)

  return BigInt(whole) * scale + BigInt(fraction === '' ? '0' : fraction)
}

/** Unidades base → cadena decimal exacta (nunca `number`: perdería precisión). */
export function fromBaseUnits(value: bigint, decimals: number = USDT_DECIMALS): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const scale = 10n ** BigInt(decimals)
  const whole = absolute / scale
  const frac = (absolute % scale).toString().padStart(decimals, '0')
  return `${negative ? '-' : ''}${whole.toString()}.${frac}`
}

/** wei → cadena con `precision` decimales, sin pasar por coma flotante. */
export function formatNative(wei: bigint, precision = 6): string {
  const full = fromBaseUnits(wei, NATIVE_DECIMALS)
  const [whole = '0', frac = ''] = full.split('.')
  if (precision <= 0) return whole
  return `${whole}.${frac.slice(0, precision).padEnd(precision, '0')}`
}

/**
 * Valida y normaliza una dirección EVM a minúsculas.
 *
 * ethers rechaza el mixed-case que no cuadra con el checksum EIP-55, y una
 * dirección copiada a mano rara vez lo cumple. Bajar a minúsculas evita el
 * falso negativo sin relajar la validación de formato.
 */
export function normalizeAddress(address: string): string {
  const trimmed = typeof address === 'string' ? address.trim() : ''
  if (!EVM_ADDRESS.test(trimmed)) {
    throw new Error(`Dirección EVM inválida: ${String(address)}`)
  }
  return trimmed.toLowerCase()
}

/** Comparación laxa de direcciones: no lanza, sólo dice si coinciden. */
export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
