/**
 * Hooks por defecto del harness.
 *
 * Se construyen con factories parametrizadas en vez de leer `process.env` en el
 * momento del import: así los tests fijan el umbral sin mutar el entorno global
 * y el composition root decide la política.
 */

import { getConfig } from '@config/index.js'
import { getLogger } from '@shared/logger.js'
import type { HookFn, HookHost, ToolParams } from '@core/types.js'

const PAYMENT_TOOL = 'execute_gasless_payment'

export interface PaymentConfirmationOptions {
  /** Umbral en USDt por encima del cual se exige confirmación humana. */
  threshold: number
}

/**
 * Exige confirmación humana explícita para pagos por encima del umbral.
 *
 * Un `dryRun` no toca la cadena, así que no se bloquea: bloquear simulaciones
 * generaba fatiga de alertas y enseñaba al operador a aprobar sin leer, además
 * de romper el flujo de la UI, que simula antes de pagar.
 */
export function createPaymentConfirmationHook(options: PaymentConfirmationOptions): HookFn {
  const { threshold } = options

  return async (tool, params) => {
    if (tool.name !== PAYMENT_TOOL) return { proceed: true, params }

    // `dryRun` sólo es falso cuando se pide explícitamente ejecutar.
    const isLive = params.dryRun === false
    if (!isLive) return { proceed: true, params }

    const amount = Number(params.amount ?? 0)
    if (!Number.isFinite(amount) || amount <= threshold) {
      return { proceed: true, params }
    }

    if (params.confirmed === true) {
      getLogger('hooks').warn(
        `pago de ${amount} USDt aprobado por confirmación humana (umbral ${threshold})`
      )
      return { proceed: true, params }
    }

    return {
      proceed: false,
      params: {
        ...params,
        requiresConfirmation: true,
        message:
          `Pago de $${amount} USDt supera el umbral de $${threshold}. ` +
          'Requiere confirmación humana.'
      }
    }
  }
}

const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/<\/?(system|instructions?)>/gi, ''],
  [/ignore\s+(all\s+)?previous\s+instructions/gi, '[filtrado]'],
  [/disregard\s+(all\s+)?(prior|previous)\s+/gi, '[filtrado]']
]

const MAX_TEXT_LENGTH = 50_000
const TEXT_FIELDS = ['rawText', 'invoiceText', 'prompt', 'note'] as const

/**
 * Higiene básica de los campos de texto que llegan por parámetros.
 *
 * Ojo con el alcance real: el texto que produce el OCR NO pasa por aquí, porque
 * `parse_invoice` sólo recibe una ruta de archivo. La defensa contra inyección
 * en el contenido de la factura vive en el prompt de extracción
 * (`@plugins/invoice-ops/schema`), que delimita el texto como datos. Este hook
 * cubre únicamente lo que un llamador inyecta por params.
 */
export const inputSanitizationHook: HookFn = async (_tool, params) => {
  const sanitized: ToolParams = { ...params }

  for (const field of TEXT_FIELDS) {
    const value = sanitized[field]
    if (typeof value !== 'string') continue

    let clean = value
    for (const [pattern, replacement] of INJECTION_PATTERNS) {
      clean = clean.replace(pattern, replacement)
    }
    sanitized[field] = clean.slice(0, MAX_TEXT_LENGTH)
  }

  return { proceed: true, params: sanitized }
}

/** Registra los hooks por defecto usando la configuración vigente. */
export function registerDefaultHooks(host: HookHost): void {
  const { security } = getConfig()
  host.registerHook(inputSanitizationHook)
  host.registerHook(
    createPaymentConfirmationHook({ threshold: security.humanConfirmThresholdUsdt })
  )
}
