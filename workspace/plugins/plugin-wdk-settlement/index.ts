/**
 * plugin-wdk-settlement — Liquidación gasless USDt.
 * Permalink jurado WDK: workspace/plugins/plugin-wdk-settlement/paymaster.ts
 */

import { registerTools } from '../../../harness/loader.js'
import type { Harness } from '../../../harness/core.js'
import { getWalletBalance, quotePayment, executeGaslessPayment } from './paymaster.js'

export const name = 'plugin-wdk-settlement'

export async function register(_h: Harness) {
  registerTools(
    [
      {
        name: 'get_wallet_balance',
        description: 'Saldo de wallet WDK (USDt + nativo)',
        handler: async (params: { network?: string }) => getWalletBalance(params)
      },
      {
        name: 'quote_payment',
        description: 'Cotiza pago gasless (cache TTL 2 min)',
        handler: async (params: { to?: string; amount?: number; network?: string }) =>
          quotePayment(params)
      },
      {
        name: 'execute_gasless_payment',
        description: 'Ejecuta transferencia gasless USDt (dryRun:false explícito)',
        handler: async (params: {
          to?: string
          amount?: number
          dryRun?: boolean
          confirmed?: boolean
          network?: string
        }) => executeGaslessPayment(params)
      }
    ],
    name
  )
}
