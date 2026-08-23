/**
 * Failover de RPC.
 *
 * Depende de la interfaz `WalletProvider`, no de la fábrica concreta: un test
 * puede inyectar un provider que falle con TLS en los dos primeros endpoints y
 * responda en el tercero, sin abrir un socket.
 */

import { getLogger } from '@shared/logger.js'
import type { Logger } from '@shared/logger.js'
import {
  ConfigurationError,
  errorMessage,
  isConfigurationError,
  isPimlicoGasPriceError,
  isRpcConnectivityError
} from './errors.js'
import type { DisposableWallet, GasMode, Network, WalletProvider } from './types.js'

export interface RpcFallbackOptions {
  gasMode?: GasMode
  logger?: Logger
}

export type RpcRunner<T> = (wallet: DisposableWallet, rpc: string) => Promise<T>

/**
 * Ejecuta `run` recorriendo los RPC de la red hasta que uno responda.
 *
 * Sólo se reintenta ante errores de conectividad (TLS, DNS, 5xx, 429). Un
 * fallo de gas-price del bundler o un error de configuración se propagan tal
 * cual: cambiar de RPC no los cura y reintentar sólo retrasa el diagnóstico.
 * La wallet se libera siempre, incluso en el camino de error.
 */
export async function withRpcFallback<T>(
  provider: WalletProvider,
  network: Network,
  run: RpcRunner<T>,
  options: RpcFallbackOptions = {}
): Promise<T> {
  const log = options.logger ?? getLogger('wdk')
  const gasMode: GasMode = options.gasMode ?? 'sponsored'
  const urls = provider.rpcUrls(network)

  if (urls.length === 0) {
    throw new ConfigurationError(`No hay ninguna URL RPC configurada para ${network}`)
  }

  let lastError: unknown

  for (let index = 0; index < urls.length; index++) {
    const rpc = urls[index]
    if (!rpc) continue

    const isLast = index === urls.length - 1
    const wallet = provider.create(network, { rpcUrl: rpc, gasMode })

    try {
      return await run(wallet, rpc)
    } catch (err) {
      lastError = err
      if (isConfigurationError(err)) throw err
      if (isPimlicoGasPriceError(err)) throw err
      if (!isRpcConnectivityError(err) || isLast) throw err
      log.warn(
        `RPC ${network} falló (${rpc}): ${errorMessage(err)} — probando ${index + 2}/${urls.length}`
      )
    } finally {
      safeDispose(wallet, log)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError))
}

/** Un `dispose()` que revienta no debe tapar el error real de la operación. */
function safeDispose(wallet: DisposableWallet, log: Logger): void {
  try {
    wallet.dispose()
  } catch (err) {
    log.debug(`dispose() falló: ${errorMessage(err)}`)
  }
}
