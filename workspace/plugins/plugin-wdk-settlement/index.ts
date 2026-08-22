import type { Harness } from '../../../harness/core.ts'
import {
  executeGaslessPayment,
  getWalletBalance,
  quotePayment,
} from './paymaster.ts'

export const name = 'plugin-wdk-settlement'

export async function register(h: Harness): Promise<void> {
  h.registerTool({
    name: 'get_wallet_balance',
    description: 'Consulta balance USDt y nativo de la wallet WDK',
    plugin: name,
    handler: async ({ network }) =>
      getWalletBalance((network as 'mainnet' | 'sepolia') ?? 'mainnet'),
  })

  h.registerTool({
    name: 'quote_payment',
    description: 'Cotiza pago gasless (cache TTL 2 min)',
    plugin: name,
    handler: async ({ vendor, amount }) =>
      quotePayment(String(vendor), Number(amount)),
  })

  h.registerTool({
    name: 'execute_gasless_payment',
    description: 'Ejecuta pago USDt gasless vía Pimlico/Candide (EIP-7702 / ERC-4337)',
    plugin: name,
    handler: async ({ vendor, amount, dryRun, network }) =>
      executeGaslessPayment({
        vendor: String(vendor),
        amount: Number(amount),
        dryRun: dryRun !== false && dryRun !== 'false',
        network: (network as 'mainnet' | 'sepolia') ?? 'mainnet',
      }),
  })
}
