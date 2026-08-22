import type { Harness } from './core.ts'

const THRESHOLD = Number(process.env.PAYMENT_CONFIRM_THRESHOLD_USD ?? 1000)

/**
 * Hooks prev-a-acción — confirmación humana para pagos > $1,000 USDt.
 */
export function registerSecurityHooks(harness: Harness): void {
  harness.registerHook(async ({ tool, args }) => {
    if (tool !== 'execute_gasless_payment') {
      return { proceed: true }
    }

    const amount = Number(args.amount ?? 0)
    if (amount <= THRESHOLD) {
      return { proceed: true }
    }

    if (process.env.PEARLEDGER_AUTO_CONFIRM === '1') {
      return { proceed: true }
    }

    if (!process.stdin.isTTY) {
      return {
        proceed: false,
        reason: `Pago de $${amount} USDt requiere confirmación humana (>${THRESHOLD}). Ejecuta en TTY o usa PEARLEDGER_AUTO_CONFIRM=1 en dev.`,
      }
    }

    process.stdout.write(
      `\n⚠️  Confirmar pago gasless de $${amount} USDt a ${args.vendor}? [y/N] `
    )

    const answer = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => resolve(data.toString().trim().toLowerCase()))
    })

    if (answer === 'y' || answer === 'yes' || answer === 's' || answer === 'si') {
      return { proceed: true }
    }

    return { proceed: false, reason: 'Pago cancelado por el usuario.' }
  })
}
