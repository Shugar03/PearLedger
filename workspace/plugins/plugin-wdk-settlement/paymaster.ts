/**
 * Wrapper Pimlico/Candide + WDK gasless modules.
 * Mainnet: wdk-wallet-evm-7702-gasless (EIP-7702)
 * Sepolia: wdk-wallet-evm-erc-4337 (EntryPoint v0.7 + MOCK USDt)
 *
 * safeModulesVersion: '0.3.0' obligatorio
 */

import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'

const SAFE_MODULES_VERSION = process.env.WDK_SAFE_MODULES_VERSION || '0.3.0'
const QUOTE_TTL_MS = 2 * 60 * 1000
const SEPOLIA_CHAIN_ID = 11155111
const USDT_DECIMALS = 6

interface QuoteCache {
  key: string
  result: unknown
  expiresAt: number
}

let quoteCache: QuoteCache | null = null

type Network = 'mainnet' | 'sepolia'

function requireSeed(): string {
  const seed =
    process.env.WDK_SEED_PHRASE ||
    process.env.SEED_PHRASE ||
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  return seed
}

function resolveNetwork(network?: string): Network {
  return network === 'mainnet' ? 'mainnet' : 'sepolia'
}

function pimlicoBundlerUrl(network: Network): string {
  const apiKey = process.env.PIMLICO_API_KEY || process.env.CANDIDE_API_KEY
  const base =
    network === 'mainnet'
      ? process.env.WDK_BUNDLER_URL || 'https://api.pimlico.io/v2/1/rpc'
      : process.env.WDK_BUNDLER_URL_SEPOLIA || 'https://api.pimlico.io/v2/sepolia/rpc'

  if (!apiKey) return base
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}apikey=${apiKey}`
}

function providerUrl(network: Network): string {
  if (network === 'mainnet') {
    return process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com'
  }
  return process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'
}

function tokenAddress(network: Network): string {
  if (network === 'mainnet') {
    return process.env.WDK_USDT_MAINNET || '0xdAC17F958D2ee523468220AC697809737E73D23ec7'
  }
  return process.env.WDK_MOCK_USDT_SEPOLIA || '0xd077a40066800590F633c0000900f7F6cD0A10dB'
}

function toBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDT_DECIMALS))
}

function fromBaseUnits(value: bigint): string {
  const whole = value / BigInt(10 ** USDT_DECIMALS)
  const frac = value % BigInt(10 ** USDT_DECIMALS)
  return `${whole}.${frac.toString().padStart(USDT_DECIMALS, '0')}`
}

function createSepoliaWallet() {
  const apiKey = process.env.PIMLICO_API_KEY || process.env.CANDIDE_API_KEY
  const bundlerUrl = pimlicoBundlerUrl('sepolia')

  const baseConfig = {
    chainId: SEPOLIA_CHAIN_ID,
    provider: providerUrl('sepolia'),
    bundlerUrl,
    safeModulesVersion: SAFE_MODULES_VERSION
  }

  if (apiKey) {
    return new WalletManagerEvmErc4337(requireSeed(), {
      ...baseConfig,
      isSponsored: true,
      paymasterUrl: bundlerUrl
    })
  }

  return new WalletManagerEvmErc4337(requireSeed(), {
    ...baseConfig,
    useNativeCoins: true
  })
}

export async function getWalletBalance(params: { network?: string } = {}) {
  const network = resolveNetwork(params.network)
  if (network !== 'sepolia') {
    return {
      safeModulesVersion: SAFE_MODULES_VERSION,
      usdt: '0.00',
      native: '0.00',
      address: null,
      network,
      status: 'mainnet_pending_implementation'
    }
  }

  const wallet = createSepoliaWallet()
  try {
    const account = await wallet.getAccount(0)
    const address = await account.getAddress()
    const token = tokenAddress('sepolia')

    let usdt = '0.00'
    let native = '0.00'

    try {
      const tokenBal = await account.getTokenBalance(token)
      usdt = fromBaseUnits(tokenBal)
    } catch {
      // account may be undeployed or token unavailable
    }

    try {
      const nativeBal = await account.getBalance()
      native = fromBaseUnits(nativeBal)
    } catch {
      // ignore
    }

    return {
      safeModulesVersion: SAFE_MODULES_VERSION,
      usdt,
      native,
      address,
      network: 'sepolia',
      token,
      status: 'ok'
    }
  } finally {
    wallet.dispose()
  }
}

export async function quotePayment(params: {
  to?: string
  amount?: number
  network?: string
}) {
  const network = resolveNetwork(params.network)
  const key = `${params.to}:${params.amount}:${network}`
  const now = Date.now()

  if (quoteCache && quoteCache.key === key && quoteCache.expiresAt > now) {
    return { ...(quoteCache.result as object), cached: true }
  }

  if (network !== 'sepolia') {
    const result = {
      to: params.to,
      amount: params.amount,
      fee: '0.00',
      sponsored: true,
      paymaster: process.env.WDK_PAYMASTER_ADDRESS,
      safeModulesVersion: SAFE_MODULES_VERSION,
      network,
      status: 'mainnet_pending_implementation'
    }
    quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
    return result
  }

  if (!params.to || params.amount == null) {
    throw new Error('quotePayment requires to and amount')
  }

  if (!process.env.PIMLICO_API_KEY && !process.env.CANDIDE_API_KEY) {
    const result = {
      to: params.to,
      amount: params.amount,
      fee: '0.00',
      sponsored: true,
      network: 'sepolia',
      safeModulesVersion: SAFE_MODULES_VERSION,
      status: 'quote_skipped_no_api_key',
      hint: 'Set PIMLICO_API_KEY in .env for live gasless quote'
    }
    quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
    return result
  }

  const wallet = createSepoliaWallet()
  try {
    const account = await wallet.getAccount(0)
    const quote = await account.quoteTransfer({
      token: tokenAddress('sepolia'),
      recipient: params.to,
      amount: toBaseUnits(params.amount)
    })

    const result = {
      to: params.to,
      amount: params.amount,
      fee: fromBaseUnits(quote.fee),
      sponsored: true,
      paymaster: process.env.WDK_PAYMASTER_ADDRESS,
      safeModulesVersion: SAFE_MODULES_VERSION,
      network: 'sepolia',
      status: 'ok'
    }

    quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
    return result
  } finally {
    wallet.dispose()
  }
}

export async function executeGaslessPayment(params: {
  to?: string
  amount?: number
  dryRun?: boolean
  confirmed?: boolean
  network?: string
}) {
  const dryRun = params.dryRun !== false
  const network = resolveNetwork(params.network)

  if (dryRun) {
    return {
      dryRun: true,
      preview: await quotePayment({
        to: params.to,
        amount: params.amount,
        network
      }),
      hint: 'Set dryRun:false to execute'
    }
  }

  if (!params.to || params.amount == null) {
    throw new Error('executeGaslessPayment requires to and amount')
  }

  if (network !== 'sepolia') {
    return {
      dryRun: false,
      txHash: null,
      status: 'mainnet_pending_implementation',
      safeModulesVersion: SAFE_MODULES_VERSION
    }
  }

  if (!process.env.PIMLICO_API_KEY && !process.env.CANDIDE_API_KEY) {
    return {
      dryRun: false,
      txHash: null,
      status: 'execute_skipped_no_api_key',
      safeModulesVersion: SAFE_MODULES_VERSION,
      hint: 'Set PIMLICO_API_KEY in .env for live gasless execution'
    }
  }

  const wallet = createSepoliaWallet()
  try {
    const account = await wallet.getAccount(0)
    const result = await account.transfer({
      token: tokenAddress('sepolia'),
      recipient: params.to,
      amount: toBaseUnits(params.amount)
    })

    return {
      dryRun: false,
      txHash: result.hash,
      fee: fromBaseUnits(result.fee),
      network: 'sepolia',
      safeModulesVersion: SAFE_MODULES_VERSION,
      status: 'ok'
    }
  } finally {
    wallet.dispose()
  }
}
