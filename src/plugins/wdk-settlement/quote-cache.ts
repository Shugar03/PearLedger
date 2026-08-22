/**
 * Cache TTL de cotizaciones, con `Clock` inyectable.
 *
 * Invariante de seguridad: **sólo entran resultados `status === 'ok'`**. La
 * versión anterior cacheaba también los fallos, así que un `quote_failed`
 * puntual —o un `quote_skipped_no_api_key`— se perpetuaba durante toda la
 * ventana del TTL y la UI seguía mostrando el mismo error ya resuelto.
 */

import type { Clock } from './types.js'

export const DEFAULT_QUOTE_TTL_MS = 2 * 60 * 1000

/** Tope de entradas: el cache es un acelerador, no un almacén. */
const DEFAULT_MAX_ENTRIES = 64

export const systemClock: Clock = { now: () => Date.now() }

export interface CacheableResult {
  status: string
}

export interface QuoteCacheOptions {
  ttlMs?: number
  clock?: Clock
  maxEntries?: number
}

interface Entry<T> {
  value: T
  expiresAt: number
}

export class QuoteCache<T extends CacheableResult> {
  readonly #entries = new Map<string, Entry<T>>()
  readonly #ttlMs: number
  readonly #clock: Clock
  readonly #maxEntries: number

  constructor(options: QuoteCacheOptions = {}) {
    this.#ttlMs = options.ttlMs ?? DEFAULT_QUOTE_TTL_MS
    this.#clock = options.clock ?? systemClock
    this.#maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  }

  get(key: string): T | undefined {
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.#clock.now()) {
      this.#entries.delete(key)
      return undefined
    }
    return entry.value
  }

  /**
   * Guarda sólo cotizaciones exitosas; devuelve si la entrada se admitió.
   * La regla vive aquí, no en el llamador, para que no se pueda olvidar.
   */
  set(key: string, value: T): boolean {
    if (value.status !== 'ok') return false

    this.#entries.delete(key)
    this.#entries.set(key, { value, expiresAt: this.#clock.now() + this.#ttlMs })

    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next()
      if (oldest.done) break
      this.#entries.delete(oldest.value)
    }

    return true
  }

  clear(): void {
    this.#entries.clear()
  }

  get size(): number {
    return this.#entries.size
  }
}
