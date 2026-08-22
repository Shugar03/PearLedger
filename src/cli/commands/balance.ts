/** Comando `balance` — saldo de la wallet WDK. */
import { resolveNetwork } from '@cli/types.js'
import type { Command } from '@cli/types.js'

export const balance: Command = async (input, ctx) => {
  return ctx.harness.execute('get_wallet_balance', {
    network: resolveNetwork(input.flags.network)
  })
}
