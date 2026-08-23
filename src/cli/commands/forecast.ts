/**
 * Comando `forecast` — proyecta consumo y redacta borradores de pedido para los
 * SKUs en riesgo de quiebre.
 */
import type { Command } from '@cli/types.js'

interface ForecastItem {
  sku: string
  belowThreshold?: boolean
}

export const forecast: Command = async (input, ctx) => {
  const { harness } = ctx
  const raw = await harness.execute('run_usage_forecast', {
    sku: input.flags.sku,
    days: 30
  })

  const forecasts: ForecastItem[] = Array.isArray(raw)
    ? (raw as ForecastItem[])
    : raw
      ? [raw as ForecastItem]
      : []

  const drafts: Array<{ sku: string; draft: unknown }> = []
  for (const item of forecasts) {
    if (!item?.belowThreshold) continue
    drafts.push({
      sku: item.sku,
      draft: await harness.execute('draft_purchase_order', { forecast: item })
    })
  }

  return { forecasts: raw, drafts }
}
