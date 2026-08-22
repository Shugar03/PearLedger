/**
 * Construcción de wallets WDK.
 *
 * Mainnet → `wdk-wallet-evm-7702-gasless` (EIP-7702 sobre la EOA).
 * Sepolia → `wdk-wallet-evm-erc-4337` (EntryPoint v0.7 + MOCK USDt).
 *
 * Los imports son estáticos a propósito: `bare-pack` sólo sigue especificadores
 * literales (CONVENTIONS §6).
 */

import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'
import WalletManagerEvm7702Gasless from '@tetherto/wdk-wallet-evm-7702-gasless'

import { getConfig, PUBLIC_TEST_SEED } from '@config/index.js'
import { getLogger } from '@shared/logger.js'
import { ConfigurationError } from './errors.js'
import {
  bundlerUrl,
  chainId,
  delegationAddress,
  hasPaymasterKey,
  rpcUrls,
  safeModulesVersion,
  sponsorshipPolicyId
} from './networks.js'
import type {
  DisposableWallet,
  GasMode,
  Network,
  WalletCreateOptions,
  WalletProvider
} from './types.js'

const log = getLogger('wdk')

/**
 * Seed de la wallet. **Falla cerrado** (CONVENTIONS §7).
 *
 * La versión anterior caía en silencio al vector de test público de BIP-39
 * cuando faltaba `WDK_SEED_PHRASE`: cualquiera con esa frase puede barrer los
 * fondos, y en mainnet eso es una pérdida real. Ahora:
 *
 * - sin seed configurada → excepción;
 * - seed pública de test → sólo en Sepolia y sólo con `WDK_ALLOW_TEST_SEED`,
 *   con aviso por el logger. En mainnet, jamás.
 */
export function resolveSeed(network: Network): string {
  const { wdk, security } = getConfig()
  const seed = wdk.seedPhrase?.trim()

  if (!seed) {
    throw new ConfigurationError(
      'No hay seed configurada: definí WDK_SEED_PHRASE (o SEED_PHRASE) en .env. ' +
        'PearLedger nunca usa una seed por defecto.'
    )
  }

  if (normalizeSeed(seed) === normalizeSeed(PUBLIC_TEST_SEED)) {
    if (network === 'mainnet') {
      throw new ConfigurationError(
        'La seed configurada es el vector de test público de BIP-39. ' +
          'Está prohibida en mainnet: sus fondos son barribles por cualquiera.'
      )
    }
    if (!security.allowTestSeed) {
      throw new ConfigurationError(
        'La seed configurada es el vector de test público de BIP-39. ' +
          'Para usarla en Sepolia hay que activar WDK_ALLOW_TEST_SEED=true de forma explícita.'
      )
    }
    log.warn(
      'usando el vector de test público de BIP-39 en sepolia (WDK_ALLOW_TEST_SEED activo): ' +
        'los fondos de esta wallet son públicos'
    )
  }

  return seed
}

function normalizeSeed(seed: string): string {
  return seed.trim().toLowerCase().split(/\s+/).join(' ')
}

/** Wallet ERC-4337 de Sepolia. `native` usa ETH propio en vez de paymaster. */
export function createSepoliaWallet(options: WalletCreateOptions = {}): DisposableWallet {
  const gasMode: GasMode = options.gasMode ?? 'sponsored'
  const seed = resolveSeed('sepolia')
  const bundler = bundlerUrl('sepolia', gasMode)

  const base = {
    chainId: chainId('sepolia'),
    provider: options.rpcUrl ?? firstRpc('sepolia'),
    bundlerUrl: bundler,
    safeModulesVersion: safeModulesVersion()
  }

  // Sin clave de patrocinador no hay gasless posible: se paga con ETH nativo.
  if (gasMode === 'native' || !hasPaymasterKey()) {
    return asDisposable(new WalletManagerEvmErc4337(seed, { ...base, useNativeCoins: true }))
  }

  const policyId = sponsorshipPolicyId()
  return asDisposable(
    new WalletManagerEvmErc4337(seed, {
      ...base,
      isSponsored: true,
      paymasterUrl: bundler,
      ...(policyId ? { sponsorshipPolicyId: policyId } : {})
    })
  )
}

/** Wallet EIP-7702 de mainnet. Siempre patrocinada. */
export function createMainnetWallet(options: WalletCreateOptions = {}): DisposableWallet {
  const seed = resolveSeed('mainnet')
  const policyId = sponsorshipPolicyId()

  return asDisposable(
    new WalletManagerEvm7702Gasless(seed, {
      provider: options.rpcUrl ?? firstRpc('mainnet'),
      delegationAddress: delegationAddress(),
      bundlerUrl: bundlerUrl('mainnet'),
      isSponsored: true,
      ...(policyId ? { sponsorshipPolicyId: policyId } : {})
    })
  )
}

export function createWallet(
  network: Network,
  options: WalletCreateOptions = {}
): DisposableWallet {
  return network === 'mainnet' ? createMainnetWallet(options) : createSepoliaWallet(options)
}

/** Provider por defecto: el real. Los tests inyectan el suyo. */
export const wdkWalletProvider: WalletProvider = {
  rpcUrls,
  create: createWallet
}

function firstRpc(network: Network): string {
  const [first] = rpcUrls(network)
  if (!first) {
    throw new ConfigurationError(`No hay ninguna URL RPC configurada para ${network}`)
  }
  return first
}

/**
 * Los tipos de WDK exponen mucha más superficie de la que usamos; el plugin
 * sólo depende de `DisposableWallet` (ISP), así que el estrechamiento ocurre
 * en este único punto.
 */
function asDisposable(wallet: unknown): DisposableWallet {
  return wallet as DisposableWallet
}
