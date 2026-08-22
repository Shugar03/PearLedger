/**
 * Resolución de red: qué chain, qué token, qué bundler y qué RPC.
 *
 * Todo sale de `getConfig()`. Las direcciones de token ya vienen validadas por
 * zod (regex de 40 hex), así que aquí sólo se normalizan; el entorno puede
 * *seleccionar* una dirección, nunca *inventarla* (CONVENTIONS §7).
 */

import { getConfig } from '@config/index.js'
import { normalizeAddress } from './units.js'
import type { GasMode, Network, WalletMode } from './types.js'

export const MAINNET_CHAIN_ID = 1
export const SEPOLIA_CHAIN_ID = 11155111

/** Fail-safe: cualquier valor desconocido cae en la testnet, no en mainnet. */
export function resolveNetwork(network?: string | null): Network {
  return network === 'mainnet' ? 'mainnet' : 'sepolia'
}

export function chainId(network: Network): number {
  return network === 'mainnet' ? MAINNET_CHAIN_ID : SEPOLIA_CHAIN_ID
}

export function safeModulesVersion(): string {
  return getConfig().wdk.safeModulesVersion
}

/** Clave del patrocinador (Pimlico o Candide). `undefined` si no hay ninguna. */
export function paymasterApiKey(): string | undefined {
  const { wdk } = getConfig()
  return wdk.pimlicoApiKey ?? wdk.candideApiKey
}

export function hasPaymasterKey(): boolean {
  return paymasterApiKey() !== undefined
}

export function paymasterAddress(): string {
  return normalizeAddress(getConfig().wdk.paymasterAddress)
}

export function delegationAddress(): string {
  return normalizeAddress(getConfig().wdk.delegationAddress)
}

export function sponsorshipPolicyId(): string | undefined {
  return getConfig().wdk.sponsorshipPolicyId
}

export function walletMode(network: Network): WalletMode {
  return network === 'mainnet' ? 'eip-7702' : 'erc-4337'
}

/** Dirección de USDt por red. Constante del código, seleccionable por entorno. */
export function tokenAddress(network: Network): string {
  const { wdk } = getConfig()
  return normalizeAddress(network === 'mainnet' ? wdk.usdtMainnet : wdk.usdtSepolia)
}

/** URLs RPC en orden de preferencia. Mainnet no tiene lista de respaldo. */
export function rpcUrls(network: Network): string[] {
  const { wdk } = getConfig()
  if (network === 'mainnet') return [wdk.mainnetRpcUrl]
  return [...wdk.sepoliaRpcUrls]
}

/**
 * Bundler a usar.
 *
 * Sepolia en modo `native` va al bundler público de Candide: Pimlico responde
 * a `pimlico_getUserOperationGasPrice` con error en el camino live y ese fallo
 * no se cura cambiando de RPC.
 */
export function bundlerUrl(network: Network, gasMode: GasMode = 'sponsored'): string {
  const { wdk } = getConfig()

  if (network === 'sepolia' && gasMode === 'native') {
    return wdk.bundlerCandideSepolia
  }

  const base = network === 'mainnet' ? wdk.bundlerMainnet : wdk.bundlerSepolia
  return withApiKey(normalizeBundlerPath(base))
}

/** Normaliza el alias antiguo `…/v2/sepolia/…` a la ruta por chainId. */
function normalizeBundlerPath(url: string): string {
  return url.includes('/v2/sepolia/') ? url.replace('/v2/sepolia/', `/v2/${SEPOLIA_CHAIN_ID}/`) : url
}

function withApiKey(url: string): string {
  const apiKey = paymasterApiKey()
  if (!apiKey) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}apikey=${apiKey}`
}
