/**
 * Wrapper Pimlico/Candide + WDK gasless modules.
 * Mainnet: wdk-wallet-evm-7702-gasless (EIP-7702)
 * Sepolia: wdk-wallet-evm-erc-4337 (EntryPoint v0.7 + MOCK USDt)
 *
 * safeModulesVersion: '0.3.0' obligatorio
 */

const SAFE_MODULES_VERSION = process.env.WDK_SAFE_MODULES_VERSION || '0.3.0'
const QUOTE_TTL_MS = 2 * 60 * 1000

interface QuoteCache {
  key: string
  result: unknown
  expiresAt: number
}

let quoteCache: QuoteCache | null = null

export async function getWalletBalance() {
  // TODO: WalletManagerEvm7702Gasless + getAccount().getBalance()
  return {
    safeModulesVersion: SAFE_MODULES_VERSION,
    usdt: '0.00',
    network: 'mainnet',
    status: 'stub'
  }
}

export async function quotePayment(params: {
  to?: string
  amount?: number
  network?: string
}) {
  const key = `${params.to}:${params.amount}:${params.network ?? 'mainnet'}`
  const now = Date.now()

  if (quoteCache && quoteCache.key === key && quoteCache.expiresAt > now) {
    return { ...quoteCache.result as object, cached: true }
  }

  const result = {
    to: params.to,
    amount: params.amount,
    fee: '0.00',
    sponsored: true,
    paymaster: process.env.WDK_PAYMASTER_ADDRESS,
    safeModulesVersion: SAFE_MODULES_VERSION,
    status: 'stub'
  }

  quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
  return result
}

export async function executeGaslessPayment(params: {
  to?: string
  amount?: number
  dryRun?: boolean
  confirmed?: boolean
}) {
  const dryRun = params.dryRun !== false // WDK default: dryRun true

  if (dryRun) {
    return {
      dryRun: true,
      preview: await quotePayment({ to: params.to, amount: params.amount }),
      hint: 'Set dryRun:false to execute'
    }
  }

  // TODO: import WalletManagerEvm7702Gasless from '@tetherto/wdk-wallet-evm-7702-gasless'
  return {
    dryRun: false,
    txHash: null,
    status: 'stub_pending_wdk_integration',
    safeModulesVersion: SAFE_MODULES_VERSION
  }
}
