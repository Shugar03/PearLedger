/**
 * Casos de uso de liquidación gasless en USDt.
 *
 * Este módulo orquesta; no construye wallets ni lee el entorno. Recibe un
 * `WalletProvider` y un `QuoteCache` inyectables (por defecto los reales), de
 * modo que los tres casos de uso se prueban de punta a punta sin red.
 */

import { getConfig } from '@config/index.js'
import { getLogger } from '@shared/logger.js'
import type { Logger } from '@shared/logger.js'
import {
  errorMessage,
  isConfigurationError,
  isPimlicoGasPriceError,
  isRpcConnectivityError
} from './errors.js'
import {
  hasPaymasterKey,
  paymasterAddress,
  resolveNetwork,
  safeModulesVersion,
  tokenAddress,
  walletMode
} from './networks.js'
import { QuoteCache } from './quote-cache.js'
import { withRpcFallback } from './rpc-failover.js'
import { formatNative, fromBaseUnits, normalizeAddress, sameAddress, toBaseUnits } from './units.js'
import { wdkWalletProvider } from './wallet-factory.js'
import type {
  BalanceResult,
  DisposableWallet,
  DryRunResult,
  ExecuteResult,
  GasMode,
  Network,
  PaymentResult,
  QuoteResult,
  WalletProvider
} from './types.js'

const RPC_HINT =
  'RPC/TLS de Sepolia falló en todos los endpoints. Probá NODE_OPTIONS=--use-system-ca ' +
  'o cambiá SEPOLIA_RPC_URL / SEPOLIA_RPC_FALLBACKS'

export interface PaymasterDeps {
  provider?: WalletProvider
  cache?: QuoteCache<QuoteResult>
  logger?: Logger
}

export interface BalanceParams {
  network?: string
}

export interface QuoteParams {
  to?: string
  amount?: number
  network?: string
}

export interface PaymentParams extends QuoteParams {
  dryRun?: boolean
  confirmed?: boolean
  /** Orden de compra conciliada que respalda el pago (opcional). */
  purchaseOrderId?: string
  /** Destinatario esperado según esa orden. Debe coincidir con `to`. */
  payoutAddress?: string
}

/** Cache compartido del proceso. Los tests inyectan el suyo por `deps`. */
const defaultCache = new QuoteCache<QuoteResult>()

/** Sólo para tests: vacía el cache del módulo. */
export function clearQuoteCache(): void {
  defaultCache.clear()
}

function resolveDeps(deps: PaymasterDeps): Required<PaymasterDeps> {
  return {
    provider: deps.provider ?? wdkWalletProvider,
    cache: deps.cache ?? defaultCache,
    logger: deps.logger ?? getLogger('wdk')
  }
}

// ── get_wallet_balance ──────────────────────────────────────────────────────

export async function getWalletBalance(
  params: BalanceParams = {},
  deps: PaymasterDeps = {}
): Promise<BalanceResult> {
  const { provider, logger } = resolveDeps(deps)
  const network = resolveNetwork(params.network)
  const version = safeModulesVersion()

  if (network === 'mainnet' && !hasPaymasterKey()) {
    return {
      safeModulesVersion: version,
      usdt: '0.00',
      native: '0.00',
      address: null,
      network,
      status: 'mainnet_needs_api_key',
      hint: 'Configurá PIMLICO_API_KEY para operar mainnet con EIP-7702'
    }
  }

  try {
    return await withRpcFallback<BalanceResult>(
      provider,
      network,
      async (wallet, rpc) => {
        const account = await wallet.getAccount(0)
        const address = await account.getAddress()
        const token = tokenAddress(network)

        let usdt = '0.00'
        let native = '0.00'
        let tokenError: unknown
        let nativeError: unknown

        try {
          usdt = fromBaseUnits(await account.getTokenBalance(token))
        } catch (err) {
          tokenError = err
        }

        try {
          native = formatNative(await account.getBalance())
        } catch (err) {
          nativeError = err
        }

        // Un fallo de TLS/RPC no puede disfrazarse de saldo 0: hay que fallar
        // para que el failover pruebe el siguiente endpoint.
        if (tokenError && isRpcConnectivityError(tokenError)) throw tokenError
        if (nativeError && isRpcConnectivityError(nativeError)) throw nativeError

        return {
          safeModulesVersion: version,
          usdt,
          native,
          address,
          network,
          token,
          rpc,
          mode: walletMode(network),
          status: 'ok'
        }
      },
      { logger }
    )
  } catch (err) {
    // `usdt` está presente incluso al fallar: es contrato con la UI.
    return {
      safeModulesVersion: version,
      usdt: '0.00',
      native: '0.00',
      address: null,
      network,
      status: isConfigurationError(err) ? 'config_error' : 'rpc_unavailable',
      error: errorMessage(err),
      hint: isConfigurationError(err) ? 'Revisá la configuración de WDK en .env' : RPC_HINT
    }
  }
}

// ── quote_payment ───────────────────────────────────────────────────────────

export async function quotePayment(
  params: QuoteParams = {},
  deps: PaymasterDeps = {}
): Promise<QuoteResult> {
  const { provider, cache, logger } = resolveDeps(deps)
  const network = resolveNetwork(params.network)
  const version = safeModulesVersion()

  if (!params.to || params.amount == null) {
    throw new Error('quotePayment requiere `to` y `amount`')
  }

  const recipient = normalizeAddress(params.to)
  const amount = params.amount
  const key = `${network}:${recipient}:${amount}`

  const hit = cache.get(key)
  if (hit) return { ...hit, cached: true }

  if (!hasPaymasterKey()) {
    // Sin clave no se cotizó nada: `fee: null` en vez de fingir "$0 gasless".
    return {
      to: recipient,
      amount,
      fee: null,
      sponsored: null,
      network,
      safeModulesVersion: version,
      status: 'quote_skipped_no_api_key',
      hint: 'Configurá PIMLICO_API_KEY en .env para obtener una cotización gasless real'
    }
  }

  try {
    const result = await withRpcFallback<QuoteResult>(
      provider,
      network,
      async (wallet, rpc) => {
        const account = await wallet.getAccount(0)
        const quote = await account.quoteTransfer({
          token: tokenAddress(network),
          recipient,
          amount: toBaseUnits(amount)
        })

        return {
          to: recipient,
          amount,
          fee: fromBaseUnits(quote.fee),
          sponsored: true,
          paymaster: paymasterAddress(),
          safeModulesVersion: version,
          network,
          rpc,
          mode: walletMode(network),
          status: 'ok'
        }
      },
      { logger }
    )

    // El cache admite únicamente `status === 'ok'` (ver quote-cache.ts).
    cache.set(key, result)
    return result
  } catch (err) {
    return {
      to: recipient,
      amount,
      fee: null,
      sponsored: null,
      paymaster: paymasterAddress(),
      safeModulesVersion: version,
      network,
      status: isConfigurationError(err) ? 'config_error' : 'quote_failed',
      error: errorMessage(err),
      hint: quoteFailureHint(err)
    }
  }
}

function quoteFailureHint(err: unknown): string | undefined {
  if (isConfigurationError(err)) return 'Revisá la configuración de WDK en .env'
  if (isRpcConnectivityError(err)) return RPC_HINT
  return undefined
}

// ── execute_gasless_payment ─────────────────────────────────────────────────

export async function executeGaslessPayment(
  params: PaymentParams = {},
  deps: PaymasterDeps = {}
): Promise<ExecuteResult> {
  const { provider, logger } = resolveDeps(deps)
  const { security } = getConfig()
  const network = resolveNetwork(params.network)
  const version = safeModulesVersion()

  // Fail-safe: sólo `dryRun === false` explícito ejecuta de verdad.
  const dryRun = params.dryRun !== false

  if (dryRun) {
    const preview = await quotePayment({ to: params.to, amount: params.amount, network }, deps)
    return {
      dryRun: true,
      preview,
      hint: 'Pasá dryRun:false para ejecutar el pago'
    } satisfies DryRunResult
  }

  if (!params.to || params.amount == null) {
    throw new Error('executeGaslessPayment requiere `to` y `amount`')
  }

  const recipient = normalizeAddress(params.to)
  const amount = params.amount

  // ── Defensa en profundidad ────────────────────────────────────────────────
  // El hook del harness ya exige confirmación humana, pero esta función es
  // importable directamente: quien se salte el harness no se salta el umbral.
  if (amount > security.humanConfirmThresholdUsdt && params.confirmed !== true) {
    return {
      dryRun: false,
      txHash: null,
      network,
      safeModulesVersion: version,
      status: 'requires_confirmation',
      fee: null,
      sponsored: null,
      hint:
        `El pago de ${amount} USDt supera el umbral de ${security.humanConfirmThresholdUsdt} USDt. ` +
        'Repetí la llamada con confirmed:true tras la aprobación humana.'
    }
  }

  // ── Pago atado a la orden de compra ──────────────────────────────────────
  // No se leen órdenes del disco: el llamador aporta los datos ya conciliados.
  // Así el módulo de dinero no queda acoplado al plugin de facturas.
  if (security.requireMatchBeforePayment && !params.purchaseOrderId) {
    return {
      dryRun: false,
      txHash: null,
      network,
      safeModulesVersion: version,
      status: 'purchase_order_required',
      fee: null,
      sponsored: null,
      hint:
        'Un pago en vivo exige la orden de compra conciliada que lo respalda: ' +
        'pasá purchaseOrderId (o desactivá PEARLEDGER_REQUIRE_MATCH bajo tu responsabilidad).'
    }
  }

  if (params.payoutAddress && !sameAddress(params.payoutAddress, recipient)) {
    return {
      dryRun: false,
      txHash: null,
      network,
      safeModulesVersion: version,
      status: 'payout_address_mismatch',
      fee: null,
      sponsored: null,
      address: recipient,
      payoutAddress: params.payoutAddress,
      ...(params.purchaseOrderId ? { purchaseOrderId: params.purchaseOrderId } : {}),
      hint:
        'El destinatario no coincide con el payoutAddress de la orden de compra. ' +
        'Pago abortado sin tocar la red.'
    }
  }

  if (network === 'mainnet' && !hasPaymasterKey()) {
    return {
      dryRun: false,
      txHash: null,
      network,
      safeModulesVersion: version,
      status: 'execute_skipped_no_api_key',
      fee: null,
      sponsored: null,
      hint: 'Configurá PIMLICO_API_KEY en .env para ejecutar pagos gasless en mainnet'
    }
  }

  const runTransfer = async (
    wallet: DisposableWallet,
    rpc: string,
    gasMode: GasMode
  ): Promise<PaymentResult> => {
    const account = await wallet.getAccount(0)
    const token = tokenAddress(network)
    const base = toBaseUnits(amount)

    let balance: bigint
    try {
      balance = await account.getTokenBalance(token)
    } catch (err) {
      if (isRpcConnectivityError(err)) throw err
      return {
        dryRun: false,
        txHash: null,
        network,
        token,
        rpc,
        address: await account.getAddress(),
        safeModulesVersion: version,
        status: 'token_balance_unavailable',
        fee: null,
        sponsored: null,
        error: errorMessage(err),
        hint: 'No se pudo leer el saldo del token — verificá el RPC y la dirección de USDt'
      }
    }

    if (balance < base) {
      return {
        dryRun: false,
        txHash: null,
        network,
        token,
        rpc,
        address: await account.getAddress(),
        usdt: fromBaseUnits(balance),
        required: fromBaseUnits(base),
        safeModulesVersion: version,
        status: 'insufficient_token_balance',
        fee: null,
        sponsored: null,
        hint:
          network === 'sepolia'
            ? `Fondeá MOCK USDt (${token}) en la smart account`
            : 'Fondeá USDt de mainnet antes de ejecutar con dryRun:false'
      }
    }

    const receipt = await account.transfer({ token, recipient, amount: base })

    return {
      dryRun: false,
      txHash: receipt.hash,
      fee: fromBaseUnits(receipt.fee),
      network,
      rpc,
      mode: walletMode(network),
      gasMode,
      sponsored: gasMode === 'sponsored',
      safeModulesVersion: version,
      status: 'ok',
      ...(params.purchaseOrderId ? { purchaseOrderId: params.purchaseOrderId } : {}),
      hint:
        gasMode === 'native'
          ? 'La transacción usó ETH nativo (bundler Candide): Pimlico falló al cotizar gas'
          : undefined
    }
  }

  const { wdk } = getConfig()
  const preferNative =
    network === 'sepolia' && (wdk.sepoliaGasMode === 'native' || !hasPaymasterKey())
  const firstMode: GasMode = preferNative ? 'native' : 'sponsored'

  try {
    return await withRpcFallback(
      provider,
      network,
      (wallet, rpc) => runTransfer(wallet, rpc, firstMode),
      { gasMode: firstMode, logger }
    )
  } catch (err) {
    // Pimlico no cotiza gas en el camino live: reintento con Candide + ETH.
    if (network === 'sepolia' && firstMode === 'sponsored' && isPimlicoGasPriceError(err)) {
      logger.warn(`${errorMessage(err)} — reintentando Sepolia con Candide y gas nativo`)
      try {
        return await withRpcFallback(
          provider,
          network,
          (wallet, rpc) => runTransfer(wallet, rpc, 'native'),
          { gasMode: 'native', logger }
        )
      } catch (retryErr) {
        return failedPayment(network, version, retryErr, {
          hint:
            'Pimlico falló al cotizar gas y el respaldo nativo también. ' +
            'Revisá PIMLICO_API_KEY / la política de sponsorship, o fondeá ETH de Sepolia.'
        })
      }
    }

    return failedPayment(network, version, err)
  }
}

function failedPayment(
  network: Network,
  version: string,
  err: unknown,
  overrides: { hint?: string } = {}
): PaymentResult {
  return {
    dryRun: false,
    txHash: null,
    network,
    safeModulesVersion: version,
    status: isConfigurationError(err) ? 'config_error' : 'execute_failed',
    fee: null,
    sponsored: null,
    error: errorMessage(err),
    hint: overrides.hint ?? executeFailureHint(err)
  }
}

function executeFailureHint(err: unknown): string | undefined {
  if (isConfigurationError(err)) return 'Revisá la configuración de WDK en .env'
  if (isRpcConnectivityError(err)) return RPC_HINT
  if (isPimlicoGasPriceError(err)) {
    return 'El dry-run no llama a Pimlico para cotizar gas; el pago en vivo sí. Revisá la API key.'
  }
  return undefined
}
