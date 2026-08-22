/**
 * plugin-wdk-settlement — liquidación gasless de USDt.
 *
 * Sólo hace de adaptador: traduce los `ToolParams` sueltos del harness a los
 * parámetros tipados de los casos de uso de `paymaster.ts`. La lógica vive
 * allí, no aquí.
 */

import { registerTools } from '@core/loader.js'
import type { PluginHost, ToolParams } from '@core/types.js'
import {
  executeGaslessPayment,
  getWalletBalance,
  quotePayment,
  type PaymentParams,
  type QuoteParams
} from './paymaster.js'

export const name = 'plugin-wdk-settlement'

export async function register(host: PluginHost): Promise<void> {
  registerTools(host, name, [
    {
      name: 'get_wallet_balance',
      description: 'Saldo de la wallet WDK (USDt + nativo)',
      handler: async (params: ToolParams) =>
        getWalletBalance({ network: readString(params, 'network') })
    },
    {
      name: 'quote_payment',
      description: 'Cotiza un pago gasless en USDt (cache TTL 2 min, sólo cotizaciones válidas)',
      handler: async (params: ToolParams) => quotePayment(readQuoteParams(params))
    },
    {
      name: 'execute_gasless_payment',
      description: 'Ejecuta una transferencia gasless de USDt (requiere dryRun:false explícito)',
      handler: async (params: ToolParams) => executeGaslessPayment(readPaymentParams(params))
    }
  ])
}

function readQuoteParams(params: ToolParams): QuoteParams {
  return {
    to: readString(params, 'to'),
    amount: readNumber(params, 'amount'),
    network: readString(params, 'network')
  }
}

function readPaymentParams(params: ToolParams): PaymentParams {
  return {
    ...readQuoteParams(params),
    // Booleanos estrictos: un `"false"` de cadena NO desactiva el dry-run ni
    // cuenta como confirmación humana. Ante la duda, no se mueve el dinero.
    dryRun: readBoolean(params, 'dryRun'),
    confirmed: readBoolean(params, 'confirmed'),
    purchaseOrderId: readString(params, 'purchaseOrderId'),
    payoutAddress: readString(params, 'payoutAddress')
  }
}

function readString(params: ToolParams, key: string): string | undefined {
  const value = params[key]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function readNumber(params: ToolParams, key: string): number | undefined {
  const value = params[key]
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function readBoolean(params: ToolParams, key: string): boolean | undefined {
  const value = params[key]
  return typeof value === 'boolean' ? value : undefined
}

export {
  executeGaslessPayment,
  getWalletBalance,
  quotePayment,
  type BalanceParams,
  type PaymasterDeps,
  type PaymentParams,
  type QuoteParams
} from './paymaster.js'
export type {
  BalanceResult,
  DryRunResult,
  ExecuteResult,
  Network,
  PaymentResult,
  QuoteResult,
  WalletProvider
} from './types.js'
