/**
 * Comando `pay` — cotiza y, si se pide explícitamente, ejecuta un pago gasless.
 *
 * Dos bugs verificados que se corrigen aquí:
 *  - En `--json` el resultado se imprimía DOS veces (una en el helper de
 *    confirmación y otra en el caller), produciendo un stream con dos
 *    documentos JSON que `JSON.parse` rechaza. Ahora el comando **devuelve** y
 *    sólo `@cli/render.js` imprime, una vez.
 *  - Bajo Bare la confirmación se resolvía siempre como "cancelado por el
 *    usuario" sin preguntar. Ahora se distingue no-hay-canal de dijo-que-no.
 */

import { getConfig } from '@config/index.js'
import { isBlocked } from '@core/types.js'
import { resolveNetwork } from '@cli/types.js'
import type { Command } from '@cli/types.js'

export interface PayResult {
  quote: unknown
  payment: unknown
}

export const pay: Command = async (input, ctx) => {
  const { vendor, amount, network, purchaseOrderId, payoutAddress } = input.flags
  const { harness, host } = ctx

  if (!vendor || amount === undefined || amount === '') {
    throw new Error('Uso: pearledger pay --vendor 0x… --amount 250 [--dry-run=false]')
  }

  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(`Monto inválido: ${String(amount)}`)
  }

  // Dry-run es el valor por defecto: sólo se ejecuta si se pide sin ambigüedad.
  const isDryRun = input.flags.dryRun !== false
  const net = resolveNetwork(network)

  const quote = await harness.execute('quote_payment', {
    to: vendor,
    amount: numericAmount,
    network: net
  })

  const paymentParams: Record<string, unknown> = {
    to: vendor,
    amount: numericAmount,
    dryRun: isDryRun,
    network: net,
    ...(purchaseOrderId ? { purchaseOrderId } : {}),
    ...(payoutAddress ? { payoutAddress } : {})
  }

  if (isDryRun) {
    return {
      quote,
      payment: await harness.execute('execute_gasless_payment', paymentParams)
    } satisfies PayResult
  }

  let payment = await harness.execute('execute_gasless_payment', paymentParams)

  // El harness bloqueó por superar el umbral: hay que preguntarle al humano.
  if (isBlocked(payment) && payment.requiresConfirmation) {
    const { security } = getConfig()

    if (!host.interactive) {
      return {
        quote,
        payment: {
          blocked: true,
          reason:
            `Pago de ${numericAmount} USDt supera el umbral de ` +
            `${security.humanConfirmThresholdUsdt} y no hay terminal para confirmarlo.`,
          status: 'confirmation_channel_unavailable'
        }
      } satisfies PayResult
    }

    const approved = await host.confirm(
      `\n⚠️  Confirmar pago gasless de $${numericAmount} USDt a ${vendor} en ${net}?`
    )

    payment = approved
      ? await harness.execute('execute_gasless_payment', {
          ...paymentParams,
          confirmed: true
        })
      : { blocked: true, reason: 'Pago cancelado por el usuario.', status: 'user_declined' }
  }

  return { quote, payment } satisfies PayResult
}
