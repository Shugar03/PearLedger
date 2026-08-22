import type { HookFn, Tool } from './core.js'

const THRESHOLD = Number(process.env.HUMAN_CONFIRM_THRESHOLD_USDT || 1000)

/** Bloquea pagos > umbral hasta confirmación humana explícita. */
export const paymentConfirmationHook: HookFn = async (tool, params) => {
  if (tool.name !== 'execute_gasless_payment') {
    return { proceed: true, params }
  }

  const amount = Number(params.amount ?? 0)
  if (amount <= THRESHOLD) {
    return { proceed: true, params }
  }

  if (params.confirmed === true) {
    return { proceed: true, params }
  }

  return {
    proceed: false,
    params: {
      ...params,
      requiresConfirmation: true,
      message: `Pago de $${amount} USDt supera umbral de $${THRESHOLD}. Requiere confirmación humana.`
    }
  }
}

/** Sanitiza inputs de facturas contra prompt injection básico. */
export const inputSanitizationHook: HookFn = async (tool, params) => {
  const textFields = ['rawText', 'invoiceText', 'prompt']
  const sanitized = { ...params }

  for (const field of textFields) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = (sanitized[field] as string)
        .replace(/<\/?system>/gi, '')
        .replace(/ignore (all )?previous instructions/gi, '[filtered]')
        .slice(0, 50_000)
    }
  }

  return { proceed: true, params: sanitized }
}

export function registerDefaultHooks(harness: {
  registerHook: (fn: HookFn) => void
}): void {
  harness.registerHook(inputSanitizationHook)
  harness.registerHook(paymentConfirmationHook)
}
