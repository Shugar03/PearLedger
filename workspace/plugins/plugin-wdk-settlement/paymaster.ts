/**
 * Wrapper Pimlico/Candide + WDK gasless modules.
 * Mainnet: wdk-wallet-evm-7702-gasless (EIP-7702)
 * Sepolia: wdk-wallet-evm-erc-4337 (EntryPoint v0.7 + MOCK USDt)
 *
 * safeModulesVersion: '0.3.0' obligatorio
 *
 * Permalink jurado WDK: workspace/plugins/plugin-wdk-settlement/paymaster.ts
 */

import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'
import WalletManagerEvm7702Gasless from '@tetherto/wdk-wallet-evm-7702-gasless'

const SAFE_MODULES_VERSION = process.env.WDK_SAFE_MODULES_VERSION || '0.3.0'
const QUOTE_TTL_MS = 2 * 60 * 1000
const SEPOLIA_CHAIN_ID = 11155111
const USDT_DECIMALS = 6
const DEFAULT_DELEGATION =
  process.env.WDK_DELEGATION_ADDRESS || '0xe6Cae83BdE06E4c305530e199D7217f42808555B'

interface QuoteCache {
  key: string
  result: unknown
  expiresAt: number
}

let quoteCache: QuoteCache | null = null

type Network = 'mainnet' | 'sepolia'

type DisposableWallet = {
  getAccount: (index?: number) => Promise<{
    getAddress: () => Promise<string>
    getBalance: () => Promise<bigint>
    getTokenBalance: (token: string) => Promise<bigint>
    quoteTransfer: (opts: {
      token: string
      recipient: string
      amount: bigint
    }) => Promise<{ fee: bigint }>
    transfer: (opts: {
      token: string
      recipient: string
      amount: bigint
    }) => Promise<{ hash: string; fee: bigint }>
  }>
  dispose: () => void
}

function requireSeed(): string {
  return (
    process.env.WDK_SEED_PHRASE ||
    process.env.SEED_PHRASE ||
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  )
}

function resolveNetwork(network?: string): Network {
  return network === 'mainnet' ? 'mainnet' : 'sepolia'
}

function hasPaymasterKey(): boolean {
  return Boolean(process.env.PIMLICO_API_KEY?.trim() || process.env.CANDIDE_API_KEY?.trim())
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
    return process.env.MAINNET_RPC_URL || 'https://rpc.mevblocker.io/fast'
  }
  return process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
}

function tokenAddress(network: Network): string {
  if (network === 'mainnet') {
    return process.env.WDK_USDT_MAINNET || '0xdAC17F958D2ee523468220AC697809737E73D23ec7'
  }
  return process.env.WDK_MOCK_USDT_SEPOLIA || '0xd077a40066800590F633c0000900f7F6cD0A10dB'
}

function paymasterAddress(): string {
  return process.env.WDK_PAYMASTER_ADDRESS || '0x8888888888888888888888888888888888882402'
}

function toBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDT_DECIMALS))
}

function fromBaseUnits(value: bigint): string {
  const whole = value / BigInt(10 ** USDT_DECIMALS)
  const frac = value % BigInt(10 ** USDT_DECIMALS)
  return `${whole}.${frac.toString().padStart(USDT_DECIMALS, '0')}`
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function createSepoliaWallet(): DisposableWallet {
  const bundlerUrl = pimlicoBundlerUrl('sepolia')
  const baseConfig = {
    chainId: SEPOLIA_CHAIN_ID,
    provider: providerUrl('sepolia'),
    bundlerUrl,
    safeModulesVersion: SAFE_MODULES_VERSION
  }

  if (hasPaymasterKey()) {
    return new WalletManagerEvmErc4337(requireSeed(), {
      ...baseConfig,
      isSponsored: true,
      paymasterUrl: bundlerUrl
    }) as DisposableWallet
  }

  return new WalletManagerEvmErc4337(requireSeed(), {
    ...baseConfig,
    useNativeCoins: true
  }) as DisposableWallet
}

function createMainnetWallet(): DisposableWallet {
  const bundlerUrl = pimlicoBundlerUrl('mainnet')
  const policyId = process.env.WDK_SPONSORSHIP_POLICY_ID

  if (policyId) {
    return new WalletManagerEvm7702Gasless(requireSeed(), {
      provider: providerUrl('mainnet'),
      delegationAddress: DEFAULT_DELEGATION,
      bundlerUrl,
      isSponsored: true,
      sponsorshipPolicyId: policyId
    }) as DisposableWallet
  }

  return new WalletManagerEvm7702Gasless(requireSeed(), {
    provider: providerUrl('mainnet'),
    delegationAddress: DEFAULT_DELEGATION,
    bundlerUrl,
    isSponsored: true
  }) as DisposableWallet
}

function createWallet(network: Network): DisposableWallet {
  return network === 'mainnet' ? createMainnetWallet() : createSepoliaWallet()
}

export async function getWalletBalance(params: { network?: string } = {}) {
  const network = resolveNetwork(params.network)

  if (network === 'mainnet' && !hasPaymasterKey()) {
    return {
      safeModulesVersion: SAFE_MODULES_VERSION,
      usdt: '0.00',
      native: '0.00',
      address: null,
      network,
      status: 'mainnet_needs_api_key',
      hint: 'Set PIMLICO_API_KEY for mainnet EIP-7702'
    }
  }

  const wallet = createWallet(network)
  try {
    const account = await wallet.getAccount(0)
    const address = await account.getAddress()
    const token = tokenAddress(network)

    let usdt = '0.00'
    let native = '0.00'

    try {
      usdt = fromBaseUnits(await account.getTokenBalance(token))
    } catch {
      // undeployed / no token yet
    }

    try {
      // native wei — report as ETH-ish decimal with 6 places for demo readability
      const wei = await account.getBalance()
      native = (Number(wei) / 1e18).toFixed(6)
    } catch {
      // ignore
    }

    return {
      safeModulesVersion: SAFE_MODULES_VERSION,
      usdt,
      native,
      address,
      network,
      token,
      mode: network === 'mainnet' ? 'eip-7702' : 'erc-4337',
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

  if (!params.to || params.amount == null) {
    throw new Error('quotePayment requires to and amount')
  }

  if (!hasPaymasterKey()) {
    const result = {
      to: params.to,
      amount: params.amount,
      fee: '0.00',
      sponsored: true,
      network,
      safeModulesVersion: SAFE_MODULES_VERSION,
      status: 'quote_skipped_no_api_key',
      hint: 'Set PIMLICO_API_KEY in .env for live gasless quote'
    }
    quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
    return result
  }

  const wallet = createWallet(network)
  try {
    const account = await wallet.getAccount(0)
    const quote = await account.quoteTransfer({
      token: tokenAddress(network),
      recipient: params.to,
      amount: toBaseUnits(params.amount)
    })

    const result = {
      to: params.to,
      amount: params.amount,
      fee: fromBaseUnits(quote.fee),
      sponsored: true,
      paymaster: paymasterAddress(),
      safeModulesVersion: SAFE_MODULES_VERSION,
      network,
      mode: network === 'mainnet' ? 'eip-7702' : 'erc-4337',
      status: 'ok'
    }

    quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
    return result
  } catch (err) {
    const result = {
      to: params.to,
      amount: params.amount,
      fee: '0.00',
      sponsored: true,
      paymaster: paymasterAddress(),
      safeModulesVersion: SAFE_MODULES_VERSION,
      network,
      status: 'quote_failed',
      error: errorMessage(err)
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

  if (!hasPaymasterKey()) {
    return {
      dryRun: false,
      txHash: null,
      status: 'execute_skipped_no_api_key',
      safeModulesVersion: SAFE_MODULES_VERSION,
      hint: 'Set PIMLICO_API_KEY in .env for live gasless execution'
    }
  }

  const wallet = createWallet(network)
  try {
    const account = await wallet.getAccount(0)
    const token = tokenAddress(network)
    const amount = toBaseUnits(params.amount)

    try {
      const bal = await account.getTokenBalance(token)
      if (bal < amount) {
        return {
          dryRun: false,
          txHash: null,
          network,
          address: await account.getAddress(),
          usdt: fromBaseUnits(bal),
          required: fromBaseUnits(amount),
          safeModulesVersion: SAFE_MODULES_VERSION,
          status: 'insufficient_token_balance',
          hint:
            network === 'sepolia'
              ? `Fondeá MOCK USDt (${token}) en la smart account`
              : 'Fondeá USDt mainnet en la EOA antes de dryRun:false'
        }
      }
    } catch {
      // continue — transfer may still fail with clearer RPC error
    }

    const result = await account.transfer({
      token,
      recipient: params.to,
      amount
    })

    return {
      dryRun: false,
      txHash: result.hash,
      fee: fromBaseUnits(result.fee),
      network,
      mode: network === 'mainnet' ? 'eip-7702' : 'erc-4337',
      safeModulesVersion: SAFE_MODULES_VERSION,
      status: 'ok'
    }
  } catch (err) {
    return {
      dryRun: false,
      txHash: null,
      network,
      safeModulesVersion: SAFE_MODULES_VERSION,
      status: 'execute_failed',
      error: errorMessage(err)
    }
  } finally {
    wallet.dispose()
  }
}
