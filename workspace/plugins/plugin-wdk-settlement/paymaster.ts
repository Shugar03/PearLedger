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
  // Prefer chainId path (Pimlico dashboard “RPC URLs”); keep sepolia alias as fallback
  const base =
    network === 'mainnet'
      ? process.env.WDK_BUNDLER_URL || 'https://api.pimlico.io/v2/1/rpc'
      : process.env.WDK_BUNDLER_URL_SEPOLIA ||
        'https://api.pimlico.io/v2/11155111/rpc'

  if (!apiKey) return base
  // Normalize legacy …/v2/sepolia/rpc → chainId path
  const normalized = base.includes('/v2/sepolia/')
    ? base.replace('/v2/sepolia/', '/v2/11155111/')
    : base
  const separator = normalized.includes('?') ? '&' : '?'
  return `${normalized}${separator}apikey=${apiKey}`
}

/** Candide public bundler — used when Pimlico gasPrice RPC fails (quote≠live). */
function candideBundlerUrl(): string {
  return (
    process.env.WDK_BUNDLER_URL_CANDIDE_SEPOLIA ||
    'https://api.candide.dev/public/v3/11155111'
  )
}

function providerUrl(network: Network): string {
  if (network === 'mainnet') {
    return process.env.MAINNET_RPC_URL || 'https://rpc.mevblocker.io/fast'
  }
  return sepoliaRpcUrls()[0]
}

/** Ordered Sepolia RPC list — primary + fallbacks (TLS/outages). */
function sepoliaRpcUrls(): string[] {
  const primary = process.env.SEPOLIA_RPC_URL?.trim()
  const extras = (process.env.SEPOLIA_RPC_FALLBACKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const defaults = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://1rpc.io/sepolia',
    'https://sepolia.drpc.org',
    'https://rpc.sepolia.org'
  ]
  return [...new Set([...(primary ? [primary] : []), ...extras, ...defaults])]
}

function isRpcConnectivityError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase()
  return (
    msg.includes('certificate') ||
    msg.includes('ssl') ||
    msg.includes('tls') ||
    msg.includes('unable to verify') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up') ||
    msg.includes('bad gateway') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('429')
  )
}

/** Lowercase hex — ethers rejects mixed-case that fails EIP-55 checksum. */
function normalizeAddress(address: string): string {
  const trimmed = address.trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(`Invalid EVM address: ${address}`)
  }
  return trimmed.toLowerCase()
}

function tokenAddress(network: Network): string {
  if (network === 'mainnet') {
    return normalizeAddress(
      process.env.WDK_USDT_MAINNET || '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    )
  }
  // Official WDK Sepolia MOCK USDt (see @tetherto/wdk-cli wdk.tokens.json)
  const MOCK_USDT = '0xd077A400968890Eacc75cdc901F0356c943e4fDb'
  const LEGACY_BAD = '0xd077a40066800590f633c0000900f7f6cd0a10db'
  const fromEnv = process.env.WDK_MOCK_USDT_SEPOLIA?.trim()
  if (fromEnv && normalizeAddress(fromEnv) !== LEGACY_BAD) {
    return normalizeAddress(fromEnv)
  }
  return normalizeAddress(MOCK_USDT)
}

function paymasterAddress(): string {
  return normalizeAddress(
    process.env.WDK_PAYMASTER_ADDRESS || '0x8888888888888888888888888888888888882402'
  )
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

function createSepoliaWallet(
  provider?: string,
  mode: 'sponsored' | 'native' = 'sponsored'
): DisposableWallet {
  const bundlerUrl =
    mode === 'native' ? candideBundlerUrl() : pimlicoBundlerUrl('sepolia')
  const baseConfig = {
    chainId: SEPOLIA_CHAIN_ID,
    provider: provider || providerUrl('sepolia'),
    bundlerUrl,
    safeModulesVersion: SAFE_MODULES_VERSION
  }

  if (mode === 'native' || !hasPaymasterKey()) {
    return new WalletManagerEvmErc4337(requireSeed(), {
      ...baseConfig,
      useNativeCoins: true
    }) as DisposableWallet
  }

  const policyId = process.env.WDK_SPONSORSHIP_POLICY_ID?.trim()
  return new WalletManagerEvmErc4337(requireSeed(), {
    ...baseConfig,
    isSponsored: true,
    paymasterUrl: bundlerUrl,
    ...(policyId ? { sponsorshipPolicyId: policyId } : {})
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

function createWallet(
  network: Network,
  provider?: string,
  sepoliaMode: 'sponsored' | 'native' = 'sponsored'
): DisposableWallet {
  return network === 'mainnet'
    ? createMainnetWallet()
    : createSepoliaWallet(provider, sepoliaMode)
}

function isPimlicoGasPriceError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase()
  return (
    msg.includes('pimlico_getuseroperationgasprice') ||
    msg.includes('getuseroperationgasprice')
  )
}

/**
 * Run against Sepolia with RPC failover on TLS/network errors.
 * Mainnet uses a single provider (no failover list).
 */
async function withRpcFallback<T>(
  network: Network,
  run: (wallet: DisposableWallet, rpc: string) => Promise<T>,
  sepoliaMode: 'sponsored' | 'native' = 'sponsored'
): Promise<T> {
  if (network === 'mainnet') {
    const rpc = providerUrl('mainnet')
    const wallet = createWallet('mainnet')
    try {
      return await run(wallet, rpc)
    } finally {
      wallet.dispose()
    }
  }

  const urls = sepoliaRpcUrls()
  let lastErr: unknown
  for (let i = 0; i < urls.length; i++) {
    const rpc = urls[i]
    const wallet = createSepoliaWallet(rpc, sepoliaMode)
    try {
      return await run(wallet, rpc)
    } catch (err) {
      lastErr = err
      // Gas-price / sponsorship errors are not cured by swapping public RPC
      if (isPimlicoGasPriceError(err)) throw err
      if (!isRpcConnectivityError(err) || i === urls.length - 1) throw err
      console.warn(
        `[wdk] Sepolia RPC failed (${rpc}): ${errorMessage(err)} — fallback ${i + 2}/${urls.length}`
      )
    } finally {
      wallet.dispose()
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
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

  try {
    return await withRpcFallback(network, async (wallet, rpc) => {
      const account = await wallet.getAccount(0)
      const address = await account.getAddress()
      const token = tokenAddress(network)

      let usdt = '0.00'
      let native = '0.00'
      let tokenErr: unknown
      let nativeErr: unknown

      try {
        usdt = fromBaseUnits(await account.getTokenBalance(token))
      } catch (err) {
        tokenErr = err
      }

      try {
        const wei = await account.getBalance()
        native = (Number(wei) / 1e18).toFixed(6)
      } catch (err) {
        nativeErr = err
      }

      // Don't mask TLS/RPC failures as "0.00" — trigger failover
      if (tokenErr && isRpcConnectivityError(tokenErr)) throw tokenErr
      if (nativeErr && isRpcConnectivityError(nativeErr)) throw nativeErr

      return {
        safeModulesVersion: SAFE_MODULES_VERSION,
        usdt,
        native,
        address,
        network,
        token,
        rpc,
        mode: network === 'mainnet' ? 'eip-7702' : 'erc-4337',
        status: 'ok'
      }
    })
  } catch (err) {
    return {
      safeModulesVersion: SAFE_MODULES_VERSION,
      usdt: '0.00',
      native: '0.00',
      address: null,
      network,
      status: 'rpc_unavailable',
      error: errorMessage(err),
      hint:
        'Sepolia RPC/TLS falló en todos los endpoints. Probá NODE_OPTIONS=--use-system-ca o cambiá SEPOLIA_RPC_URL / SEPOLIA_RPC_FALLBACKS'
    }
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

  const recipient = normalizeAddress(params.to)

  if (!hasPaymasterKey()) {
    const result = {
      to: recipient,
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

  try {
    return await withRpcFallback(network, async (wallet, rpc) => {
      const account = await wallet.getAccount(0)
      const quote = await account.quoteTransfer({
        token: tokenAddress(network),
        recipient,
        amount: toBaseUnits(params.amount!)
      })

      const result = {
        to: recipient,
        amount: params.amount,
        fee: fromBaseUnits(quote.fee),
        sponsored: true,
        paymaster: paymasterAddress(),
        safeModulesVersion: SAFE_MODULES_VERSION,
        network,
        rpc,
        mode: network === 'mainnet' ? 'eip-7702' : 'erc-4337',
        status: 'ok'
      }

      quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
      return result
    })
  } catch (err) {
    const result = {
      to: recipient,
      amount: params.amount,
      fee: '0.00',
      sponsored: true,
      paymaster: paymasterAddress(),
      safeModulesVersion: SAFE_MODULES_VERSION,
      network,
      status: 'quote_failed',
      error: errorMessage(err),
      hint: isRpcConnectivityError(err)
        ? 'RPC/TLS — probá node --use-system-ca o SEPOLIA_RPC_FALLBACKS'
        : undefined
    }
    quoteCache = { key, result, expiresAt: now + QUOTE_TTL_MS }
    return result
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

  const recipient = normalizeAddress(params.to)

  if (!hasPaymasterKey() && network === 'mainnet') {
    return {
      dryRun: false,
      txHash: null,
      status: 'execute_skipped_no_api_key',
      safeModulesVersion: SAFE_MODULES_VERSION,
      hint: 'Set PIMLICO_API_KEY in .env for live gasless execution'
    }
  }

  const runTransfer = async (
    wallet: DisposableWallet,
    rpc: string,
    gasMode: 'sponsored' | 'native'
  ) => {
    const account = await wallet.getAccount(0)
    const token = tokenAddress(network)
    const amount = toBaseUnits(params.amount!)

    let bal: bigint
    try {
      bal = await account.getTokenBalance(token)
    } catch (err) {
      if (isRpcConnectivityError(err)) throw err
      return {
        dryRun: false,
        txHash: null,
        network,
        token,
        rpc,
        address: await account.getAddress(),
        safeModulesVersion: SAFE_MODULES_VERSION,
        status: 'token_balance_unavailable',
        error: errorMessage(err),
        hint: 'No se pudo leer saldo del token — verificá RPC Sepolia y la dirección MOCK USDt'
      }
    }

    if (bal < amount) {
      return {
        dryRun: false,
        txHash: null,
        network,
        rpc,
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

    const result = await account.transfer({
      token,
      recipient,
      amount
    })

    return {
      dryRun: false,
      txHash: result.hash,
      fee: fromBaseUnits(result.fee),
      network,
      rpc,
      mode: network === 'mainnet' ? 'eip-7702' : 'erc-4337',
      gasMode,
      sponsored: gasMode === 'sponsored',
      safeModulesVersion: SAFE_MODULES_VERSION,
      status: 'ok',
      hint:
        gasMode === 'native'
          ? 'Live tx usó ETH nativo (Candide bundler) — Pimlico gasPrice falló; quote sponsored sigue OK para demo fee $0'
          : undefined
    }
  }

  const preferNative =
    network === 'sepolia' &&
    (process.env.WDK_SEPOLIA_GAS_MODE === 'native' || !hasPaymasterKey())

  try {
    if (preferNative) {
      return await withRpcFallback(
        network,
        (wallet, rpc) => runTransfer(wallet, rpc, 'native'),
        'native'
      )
    }

    return await withRpcFallback(
      network,
      (wallet, rpc) => runTransfer(wallet, rpc, 'sponsored'),
      'sponsored'
    )
  } catch (err) {
    if (network === 'sepolia' && isPimlicoGasPriceError(err)) {
      console.warn(
        `[wdk] ${errorMessage(err)} — retry Sepolia live with Candide + native ETH gas`
      )
      try {
        return await withRpcFallback(
          network,
          (wallet, rpc) => runTransfer(wallet, rpc, 'native'),
          'native'
        )
      } catch (err2) {
        return {
          dryRun: false,
          txHash: null,
          network,
          safeModulesVersion: SAFE_MODULES_VERSION,
          status: 'execute_failed',
          error: errorMessage(err2),
          hint:
            'Pimlico gasPrice falló y el fallback nativo también. Revisá PIMLICO_API_KEY en dashboard, o fondeá ETH Sepolia en la smart account. Ver docs/WDK-SEPOLIA-LIVE-PAY.md'
        }
      }
    }

    return {
      dryRun: false,
      txHash: null,
      network,
      safeModulesVersion: SAFE_MODULES_VERSION,
      status: 'execute_failed',
      error: errorMessage(err),
      hint: isRpcConnectivityError(err)
        ? 'RPC/TLS — usá node --use-system-ca o SEPOLIA_RPC_FALLBACKS'
        : isPimlicoGasPriceError(err)
          ? 'Quote dry-run no llama a Pimlico gasPrice; el live sí. Revisá API key Sepolia / sponsorship policy.'
          : undefined
    }
  }
}
