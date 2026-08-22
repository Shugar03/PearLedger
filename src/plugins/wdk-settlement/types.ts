/**
 * Contratos del plugin de liquidación.
 *
 * Todo lo que toca la red se expresa como interfaz (`WalletProvider`, `Clock`)
 * para que los casos de uso de `paymaster.ts` se puedan probar con dobles y sin
 * abrir un socket. Las formas de resultado viven aquí porque son el contrato
 * público que consumen la UI, el CLI y los tests.
 */

export type Network = 'mainnet' | 'sepolia'

/** Quién paga el gas: el paymaster patrocinador o ETH nativo de la cuenta. */
export type GasMode = 'sponsored' | 'native'

/** Modo de cuenta según la red: EIP-7702 en mainnet, ERC-4337 en Sepolia. */
export type WalletMode = 'eip-7702' | 'erc-4337'

export interface TransferRequest {
  token: string
  recipient: string
  amount: bigint
}

export interface TransferQuote {
  fee: bigint
}

export interface TransferReceipt {
  hash: string
  fee: bigint
}

/** Subconjunto mínimo de la cuenta WDK que este plugin usa (ISP). */
export interface WalletAccount {
  getAddress(): Promise<string>
  getBalance(): Promise<bigint>
  getTokenBalance(token: string): Promise<bigint>
  quoteTransfer(request: TransferRequest): Promise<TransferQuote>
  transfer(request: TransferRequest): Promise<TransferReceipt>
}

export interface DisposableWallet {
  getAccount(index?: number): Promise<WalletAccount>
  dispose(): void
}

export interface WalletCreateOptions {
  /** RPC concreto a usar; si falta, el provider elige el primero de su lista. */
  rpcUrl?: string
  gasMode?: GasMode
}

/**
 * Fábrica de wallets inyectable. `rpc-failover.ts` sólo depende de esto, así
 * que el failover se prueba con un provider falso que rompe a voluntad.
 */
export interface WalletProvider {
  /** URLs candidatas, en orden de preferencia, para la red dada. */
  rpcUrls(network: Network): string[]
  create(network: Network, options?: WalletCreateOptions): DisposableWallet
}

/** Reloj inyectable: el cache de cotizaciones no llama a `Date.now()` directo. */
export interface Clock {
  now(): number
}

export interface BalanceResult {
  safeModulesVersion: string
  /** Siempre presente, incluso al fallar. Contrato con la UI. */
  usdt: string
  native: string
  address: string | null
  network: Network
  status: string
  token?: string
  rpc?: string
  mode?: WalletMode
  hint?: string
  error?: string
}

export interface QuoteResult {
  to: string
  amount: number
  /** `null` cuando no hubo cotización real: nunca fingir "gasless, fee $0". */
  fee: string | null
  sponsored: boolean | null
  network: Network
  safeModulesVersion: string
  status: string
  paymaster?: string
  rpc?: string
  mode?: WalletMode
  hint?: string
  error?: string
  cached?: boolean
}

export interface PaymentResult {
  dryRun: boolean
  txHash: string | null
  status: string
  safeModulesVersion: string
  network?: Network
  fee?: string | null
  sponsored?: boolean | null
  gasMode?: GasMode
  mode?: WalletMode
  rpc?: string
  token?: string
  address?: string
  usdt?: string
  required?: string
  purchaseOrderId?: string
  payoutAddress?: string
  hint?: string
  error?: string
}

export interface DryRunResult {
  dryRun: true
  preview: QuoteResult
  hint: string
}

export type ExecuteResult = PaymentResult | DryRunResult
