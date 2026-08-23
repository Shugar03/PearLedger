import { useState, type ReactNode } from 'react'

import { Card } from '@dashboard/components/Card'
import { Field } from '@dashboard/components/Field'
import { JsonBlock } from '@dashboard/components/JsonBlock'
import { MeterRow } from '@dashboard/components/MeterRow'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { useToolResult } from '@dashboard/hooks/useToolResult'
import type { Dict, Locale } from '@dashboard/i18n'
import type { ForecastResult, InventoryItem, ToolParams } from '@dashboard/lib/types'

type Mode = 'forecast' | 'inventory'

export function ForecastView(): ReactNode {
  const { runTool } = usePear()
  const { t, locale } = usePrefs()
  const { result, pending, run } = useToolResult()

  const [sku, setSku] = useState('')
  const [days, setDays] = useState('30')
  const [mode, setMode] = useState<Mode>('forecast')

  /** El SKU vacío significa "todos": no se manda el campo. */
  function baseParams(): ToolParams {
    const params: ToolParams = {}
    if (sku.trim()) params.sku = sku.trim()
    return params
  }

  function forecast(): void {
    setMode('forecast')
    void run(async () => {
      const params = baseParams()
      if (days) params.days = Number(days)
      return runTool('run_usage_forecast', params)
    })
  }

  function inventory(): void {
    setMode('inventory')
    void run(async () => runTool('check_inventory', baseParams()))
  }

  const rows =
    mode === 'forecast' ? asForecast(result, t, locale) : asInventory(result, t)

  return (
    <>
      <Card title={t.forecast.title} lead={t.forecast.lead}>
        <div className="card__body">
          <div className="fields fields--two">
            <Field
              label={t.forecast.sku}
              value={sku}
              placeholder={t.forecast.skuPlaceholder}
              onChange={(event) => setSku(event.target.value)}
            />
            <Field
              label={t.forecast.days}
              type="number"
              min="1"
              step="1"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </div>

          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={forecast} disabled={pending}>
              {t.forecast.run}
            </button>
            <button type="button" className="btn" onClick={inventory} disabled={pending}>
              {t.forecast.inventory}
            </button>
          </div>
        </div>
      </Card>

      <Card title={mode === 'inventory' ? t.forecast.resultInventory : t.forecast.resultForecast}>
        <div className="card__body">
          {rows && rows.length > 0 ? <div className="rows">{rows}</div> : null}
          {!result ? <p className="placeholder">{t.forecast.empty}</p> : null}
          {result && (!rows || rows.length === 0) ? (
            <p className="placeholder">{t.forecast.emptyRows}</p>
          ) : null}
          <JsonBlock value={result} />
        </div>
      </Card>
    </>
  )
}

/** `check_inventory` devuelve el inventario tal cual: SKU, stock y umbral. */
function asInventory(value: unknown, t: Dict): ReactNode[] | null {
  if (!Array.isArray(value)) return null

  return value.flatMap((raw) => {
    if (!isRecord(raw) || typeof raw.sku !== 'string' || typeof raw.stock !== 'number') return []
    const item = raw as unknown as InventoryItem
    const threshold = typeof item.safetyThreshold === 'number' ? item.safetyThreshold : 0
    const low = threshold > 0 && item.stock <= threshold
    const scale = Math.max(item.stock, threshold * 2, 1)

    const meta = [item.description, threshold > 0 ? t.forecast.threshold(threshold, item.unit ?? '') : '']
      .filter(Boolean)
      .join(' · ')

    return [
      <MeterRow
        key={item.sku}
        name={item.sku}
        meta={meta}
        value={`${item.stock} ${item.unit ?? ''}`.trim()}
        ratio={item.stock / scale}
        low={low}
        badge={low ? <span className="pill pill--warn">{t.forecast.belowThreshold}</span> : undefined}
      />
    ]
  })
}

/** `run_usage_forecast` devuelve una proyección por SKU dentro del horizonte. */
function asForecast(value: unknown, t: Dict, locale: Locale): ReactNode[] | null {
  if (!Array.isArray(value)) return null

  return value.flatMap((raw) => {
    if (!isRecord(raw) || typeof raw.sku !== 'string' || typeof raw.currentStock !== 'number') {
      return []
    }
    const item = raw as unknown as ForecastResult
    const consumption = typeof item.projectedConsumption === 'number' ? item.projectedConsumption : 0
    const scale = Math.max(item.currentStock, consumption, 1)

    const meta = [
      item.description,
      t.forecast.consumption(consumption, item.daysHorizon ?? t.common.none),
      item.recommendedOrderQty > 0 ? t.forecast.reorder(item.recommendedOrderQty) : ''
    ]
      .filter(Boolean)
      .join(' · ')

    return [
      <MeterRow
        key={item.sku}
        name={item.sku}
        meta={meta}
        value={
          item.breakDate ? t.forecast.breakAt(formatDate(item.breakDate, locale)) : t.forecast.noBreak
        }
        ratio={item.currentStock / scale}
        low={item.belowThreshold}
        badge={
          item.belowThreshold ? (
            <span className="pill pill--warn">{t.forecast.restock}</span>
          ) : (
            <span className="pill pill--ok">{t.forecast.inRange}</span>
          )
        }
      />
    ]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Fecha corta y local; si el harness manda algo raro, se muestra tal cual. */
function formatDate(value: string, locale: Locale): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}
