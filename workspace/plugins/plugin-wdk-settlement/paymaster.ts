/**
 * Wrapper Pimlico/Candide — gasless USDt settlement
 * @see https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-7702-gasless/
 */

export interface PaymasterConfig {
  network: 'mainnet' | 'sepolia'
  bundlerUrl: string
  paymasterAddress: string
  usdtAddress: string
  safeModulesVersion: string
  delegationAddress: string
}

const QUOTE_CACHE = new Map<string, { quote: unknown; expiresAt: number }>()
const QUOTE_TTL_MS = 2 * 60 * 1000

export function getPaymasterConfig(network: 'mainnet' | 'sepolia' = 'mainnet'): PaymasterConfig {
  const isMainnet = network === 'mainnet'
  return {
    network,
    bundlerUrl:
      process.env.BUNDLER_URL ??
      `https://api.pimlico.io/v2/${isMainnet ? '1' : '11155111'}/rpc?apikey=${process.env.PIMLICO_API_KEY ?? ''}`,
    paymasterAddress: process.env.PAYMASTER_ADDRESS ?? '0x8888888888888888888888888888888888882402',
    usdtAddress: isMainnet
      ? (process.env.USDT_MAINNET ?? '0xdAC17F958D2e523a2206206994597C13D831ec7')
      : (process.env.USDT_MOCK_SEPOLIA ?? '0xd077a40066800590F633c0000900f7F6cD0A10dB'),
    safeModulesVersion: process.env.WDK_SAFE_MODULES_VERSION ?? '0.3.0',
    delegationAddress:
      process.env.WDK_DELEGATION_ADDRESS ?? '0xe6Cae83BdE06E4c305530e199D7217f42808555B',
  }
}

function cacheKey(vendor: string, amount: number): string {
  return `${vendor}:${amount}`
}

export async function quotePayment(vendor: string, amount: number) {
  const key = cacheKey(vendor, amount)
  const cached = QUOTE_CACHE.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.quote as object, cached: true }
  }

  const config = getPaymasterConfig()
  const quote = {
    vendor,
    amount,
    fee: 0,
    currency: 'USDT',
    paymaster: config.paymasterAddress,
    safeModulesVersion: config.safeModulesVersion,
    gasless: true,
  }

  QUOTE_CACHE.set(key, { quote, expiresAt: Date.now() + QUOTE_TTL_MS })
  return { ...quote, cached: false }
}

export async function executeGaslessPayment(params: {
  vendor: string
  amount: number
  dryRun?: boolean
  network?: 'mainnet' | 'sepolia'
}) {
  const { vendor, amount, dryRun = true, network = 'mainnet' } = params
  const config = getPaymasterConfig(network)

  if (dryRun) {
    return {
      status: 'dry_run',
      message: 'dryRun:true por default — usa dryRun:false o flag --execute para enviar',
      quote: await quotePayment(vendor, amount),
      config: { network, safeModulesVersion: config.safeModulesVersion },
    }
  }

  // TODO: integrar @tetherto/wdk-wallet-evm-7702-gasless (mainnet)
  // o @tetherto/wdk-wallet-evm-erc-4337 (Sepolia)
  //
  // import WalletManagerEvm7702Gasless from '@tetherto/wdk-wallet-evm-7702-gasless'
  // const wallet = new WalletManagerEvm7702Gasless(process.env.WDK_SEED_PHRASE!, {
  //   provider: process.env.ETH_MAINNET_RPC!,
  //   delegationAddress: config.delegationAddress,
  //   bundlerUrl: config.bundlerUrl,
  //   paymasterAddress: config.paymasterAddress,
  //   paymasterToken: { address: config.usdtAddress },
  //   safeModulesVersion: config.safeModulesVersion,
  // })
  // const account = await wallet.getAccount(0)
  // return account.transfer({ to: vendor, amount, token: config.usdtAddress, dryRun: false })

  return {
    status: 'submitted',
    vendor,
    amount,
    fee: 0,
    txHash: '0xSTUB_HASH_REPLACE_WITH_WDK',
    network,
    safeModulesVersion: config.safeModulesVersion,
  }
}

export async function getWalletBalance(network: 'mainnet' | 'sepolia' = 'mainnet') {
  return {
    network,
    usdt: '0.00',
    native: '0.00',
    address: '0xSTUB_ADDRESS',
    note: 'Conectar WDK_SEED_PHRASE en .env para balances reales',
  }
}
