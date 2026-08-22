/**
 * Contratos del CLI.
 *
 * Un comando **devuelve datos y no imprime**. La presentación vive en
 * `@cli/render.js`, que es el único módulo autorizado a escribir en stdout.
 * Gracias a eso el mismo comando sirve al CLI, al dashboard y a los tests.
 */

import type { Harness } from '@core/harness.js'

/**
 * Lo que cambia de verdad entre Bare y Node: cómo se pregunta al humano y cómo
 * se termina el proceso. Se inyecta desde el entrypoint (DIP) en vez de
 * detectar el runtime a mitad de la lógica.
 */
export interface CliHost {
  /** Confirmación interactiva. Devuelve false si no hay canal con el humano. */
  confirm(message: string): Promise<boolean>
  exit(code: number): void
  readonly interactive: boolean
}

export interface CommandContext {
  harness: Harness
  host: CliHost
  json: boolean
}

export interface CommandFlags {
  sku?: string
  vendor?: string
  amount?: string | number
  network?: string
  dryRun?: boolean
  purchaseOrderId?: string
  payoutAddress?: string
}

export interface CommandInput {
  flags: CommandFlags
  args: string[]
}

/** Un comando recibe input y contexto, y devuelve el dato a presentar. */
export type Command = (input: CommandInput, ctx: CommandContext) => Promise<unknown>

export type Network = 'mainnet' | 'sepolia'

export function resolveNetwork(value?: string): Network {
  return value === 'mainnet' ? 'mainnet' : 'sepolia'
}
