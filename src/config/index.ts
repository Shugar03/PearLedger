/**
 * Punto único de lectura de `process.env` en todo el proyecto.
 *
 * Antes había 35 variables leídas en 14 archivos distintos, algunas congeladas
 * en el momento del import (`SAFE_MODULES_VERSION`, `DEFAULT_DELEGATION`), lo
 * que hacía imposible cambiarlas desde un test. Aquí la lectura es **perezosa y
 * memoizada**: se resuelve en el primer `getConfig()` y `resetConfig()` la
 * invalida.
 */

import process from 'node:process'
import { z } from 'zod'

/** Vector de test público de BIP-39. Cualquiera puede barrer sus fondos. */
export const PUBLIC_TEST_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

const addressSchema = z
  .string()
  .trim()
  .regex(EVM_ADDRESS, 'debe ser una dirección EVM de 40 dígitos hexadecimales')

/** Dirección real de USDt en mainnet. Fuente de verdad, no configurable. */
export const USDT_MAINNET = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
/** MOCK USDt oficial de WDK en Sepolia (wdk.tokens.json). */
export const USDT_SEPOLIA = '0xd077A400968890Eacc75cdc901F0356c943e4fDb'

const booleanish = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((raw) => {
      if (raw === undefined || raw.trim() === '') return fallback
      const value = raw.trim().toLowerCase()
      if (['1', 'true', 'yes', 'on'].includes(value)) return true
      if (['0', 'false', 'no', 'off'].includes(value)) return false
      return fallback
    })

const numeric = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (raw === undefined || raw.trim() === '') return fallback
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${raw}" no es un número` })
        return fallback
      }
      return value
    })

const csv = z
  .string()
  .optional()
  .transform((raw) =>
    (raw ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )

const envSchema = z.object({
  // ── Seguridad ────────────────────────────────────────────────────────────
  HUMAN_CONFIRM_THRESHOLD_USDT: numeric(1000),
  /** Habilita explícitamente la seed pública de test. Solo Sepolia. */
  WDK_ALLOW_TEST_SEED: booleanish(false),
  /** Doble confirmación fuera de banda para transferencias reales en smoke. */
  CONFIRM_LIVE_PAY: booleanish(false),

  // ── WDK ──────────────────────────────────────────────────────────────────
  WDK_SEED_PHRASE: z.string().trim().optional(),
  SEED_PHRASE: z.string().trim().optional(),
  WDK_SAFE_MODULES_VERSION: z.string().trim().default('0.3.0'),
  WDK_DELEGATION_ADDRESS: addressSchema.default('0xe6Cae83BdE06E4c305530e199D7217f42808555B'),
  WDK_PAYMASTER_ADDRESS: addressSchema.default('0x8888888888888888888888888888888888882402'),
  WDK_SPONSORSHIP_POLICY_ID: z.string().trim().optional(),
  WDK_SEPOLIA_GAS_MODE: z.enum(['sponsored', 'native']).optional(),
  WDK_USDT_MAINNET: addressSchema.default(USDT_MAINNET),
  WDK_MOCK_USDT_SEPOLIA: addressSchema.default(USDT_SEPOLIA),
  PIMLICO_API_KEY: z.string().trim().optional(),
  CANDIDE_API_KEY: z.string().trim().optional(),
  WDK_BUNDLER_URL: z.string().trim().default('https://api.pimlico.io/v2/1/rpc'),
  WDK_BUNDLER_URL_SEPOLIA: z.string().trim().default('https://api.pimlico.io/v2/11155111/rpc'),
  WDK_BUNDLER_URL_CANDIDE_SEPOLIA: z
    .string()
    .trim()
    .default('https://api.candide.dev/public/v3/11155111'),
  MAINNET_RPC_URL: z.string().trim().default('https://rpc.mevblocker.io/fast'),
  SEPOLIA_RPC_URL: z.string().trim().optional(),
  SEPOLIA_RPC_FALLBACKS: csv,

  // ── QVAC ─────────────────────────────────────────────────────────────────
  QVAC_CTX_SIZE: numeric(4096),
  QVAC_HOME: z.string().trim().optional(),
  QVAC_OCR_PATH: z.enum(['auto', 'latin', 'multimodal']).default('auto'),
  QVAC_OCR_PATH_B_TIMEOUT_MS: numeric(45_000),
  QVAC_OCR_MAX_EDGE: numeric(896),

  // ── Conciliación de facturas ─────────────────────────────────────────────
  PEARLEDGER_STRICT_INVOICE: booleanish(true),
  PEARLEDGER_VENDOR_MIN_SIM: numeric(0.34),
  /** Exige 3-way match conciliado antes de permitir un pago. */
  PEARLEDGER_REQUIRE_MATCH: booleanish(true),

  // ── Dashboard ────────────────────────────────────────────────────────────
  PEARLEDGER_DASHBOARD_PORT: numeric(7331),
  /** Permite ejecutar pagos reales desde el dashboard. Apagado por defecto. */
  PEARLEDGER_DASHBOARD_ALLOW_LIVE: booleanish(false),

  // ── Diagnóstico ──────────────────────────────────────────────────────────
  PEARLEDGER_LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info')
})

export type RawEnv = z.infer<typeof envSchema>

export interface SecurityConfig {
  humanConfirmThresholdUsdt: number
  allowTestSeed: boolean
  requireMatchBeforePayment: boolean
  /** Sólo los scripts de smoke la consultan para transferencias reales. */
  confirmLivePay: boolean
}

export interface WdkConfig {
  safeModulesVersion: string
  delegationAddress: string
  paymasterAddress: string
  sponsorshipPolicyId?: string
  sepoliaGasMode?: 'sponsored' | 'native'
  usdtMainnet: string
  usdtSepolia: string
  pimlicoApiKey?: string
  candideApiKey?: string
  bundlerMainnet: string
  bundlerSepolia: string
  bundlerCandideSepolia: string
  mainnetRpcUrl: string
  sepoliaRpcUrls: string[]
  /** `undefined` si no hay seed configurada: quien pague debe fallar, no asumir. */
  seedPhrase?: string
}

export interface QvacConfig {
  ctxSize: number
  home?: string
  ocrPath: 'auto' | 'latin' | 'multimodal'
  ocrPathBTimeoutMs: number
  ocrMaxEdge: number
}

export interface InvoiceConfig {
  strict: boolean
  vendorMinSimilarity: number
}

export interface DashboardConfig {
  port: number
  allowLivePayments: boolean
}

export interface AppConfig {
  security: SecurityConfig
  wdk: WdkConfig
  qvac: QvacConfig
  invoice: InvoiceConfig
  dashboard: DashboardConfig
  logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug'
}

const DEFAULT_SEPOLIA_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://1rpc.io/sepolia',
  'https://sepolia.drpc.org',
  'https://rpc.sepolia.org'
]

let cached: AppConfig | null = null

function build(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(source)

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Configuración inválida — ${detail}`)
  }

  const env = parsed.data

  return {
    security: {
      humanConfirmThresholdUsdt: env.HUMAN_CONFIRM_THRESHOLD_USDT,
      allowTestSeed: env.WDK_ALLOW_TEST_SEED,
      requireMatchBeforePayment: env.PEARLEDGER_REQUIRE_MATCH,
      confirmLivePay: env.CONFIRM_LIVE_PAY
    },
    wdk: {
      safeModulesVersion: env.WDK_SAFE_MODULES_VERSION,
      delegationAddress: env.WDK_DELEGATION_ADDRESS,
      paymasterAddress: env.WDK_PAYMASTER_ADDRESS,
      sponsorshipPolicyId: env.WDK_SPONSORSHIP_POLICY_ID || undefined,
      sepoliaGasMode: env.WDK_SEPOLIA_GAS_MODE,
      usdtMainnet: env.WDK_USDT_MAINNET,
      usdtSepolia: env.WDK_MOCK_USDT_SEPOLIA,
      pimlicoApiKey: env.PIMLICO_API_KEY || undefined,
      candideApiKey: env.CANDIDE_API_KEY || undefined,
      bundlerMainnet: env.WDK_BUNDLER_URL,
      bundlerSepolia: env.WDK_BUNDLER_URL_SEPOLIA,
      bundlerCandideSepolia: env.WDK_BUNDLER_URL_CANDIDE_SEPOLIA,
      mainnetRpcUrl: env.MAINNET_RPC_URL,
      sepoliaRpcUrls: [
        ...new Set([
          ...(env.SEPOLIA_RPC_URL ? [env.SEPOLIA_RPC_URL] : []),
          ...env.SEPOLIA_RPC_FALLBACKS,
          ...DEFAULT_SEPOLIA_RPCS
        ])
      ],
      seedPhrase: env.WDK_SEED_PHRASE || env.SEED_PHRASE || undefined
    },
    qvac: {
      ctxSize: env.QVAC_CTX_SIZE,
      home: env.QVAC_HOME || undefined,
      ocrPath: env.QVAC_OCR_PATH,
      ocrPathBTimeoutMs: env.QVAC_OCR_PATH_B_TIMEOUT_MS,
      ocrMaxEdge: env.QVAC_OCR_MAX_EDGE
    },
    invoice: {
      strict: env.PEARLEDGER_STRICT_INVOICE,
      vendorMinSimilarity: env.PEARLEDGER_VENDOR_MIN_SIM
    },
    dashboard: {
      port: env.PEARLEDGER_DASHBOARD_PORT,
      allowLivePayments: env.PEARLEDGER_DASHBOARD_ALLOW_LIVE
    },
    logLevel: env.PEARLEDGER_LOG_LEVEL
  }
}

/** Configuración memoizada. Primera llamada lee y valida el entorno. */
export function getConfig(): AppConfig {
  if (!cached) cached = build(process.env)
  return cached
}

/** Solo para tests: fuerza una relectura del entorno. */
export function resetConfig(): void {
  cached = null
}

/** Sustituye la configuración por una explícita. Solo para tests. */
export function setConfig(config: AppConfig): void {
  cached = config
}
