import { useState, type ReactNode } from 'react'

import { Card } from '@ui/components/Card'
import { Field } from '@ui/components/Field'
import { JsonBlock } from '@ui/components/JsonBlock'
import { usePear } from '@ui/hooks/usePear'
import { useToolResult } from '@ui/hooks/useToolResult'
import type { ToolParams } from '@ui/lib/types'

export function ForecastView(): ReactNode {
  const { runTool } = usePear()
  const { result, pending, run } = useToolResult()

  const [sku, setSku] = useState('')
  const [days, setDays] = useState('30')

  /** El SKU vacío significa "todos": no se manda el campo. */
  function baseParams(): ToolParams {
    const params: ToolParams = {}
    if (sku.trim()) params.sku = sku.trim()
    return params
  }

  function forecast(): void {
    void run(async () => {
      const params = baseParams()
      if (days) params.days = Number(days)
      return runTool('run_usage_forecast', params)
    })
  }

  function inventory(): void {
    void run(async () => runTool('check_inventory', baseParams()))
  }

  return (
    <div className="view">
      <Card
        title="Proyección de stock"
        description="Consumo proyectado y fecha estimada de quiebre por SKU."
      >
        <div className="form-grid two">
          <Field
            label="SKU (opcional)"
            value={sku}
            placeholder="SKU-001"
            onChange={(event) => setSku(event.target.value)}
          />
          <Field
            label="Horizonte (días)"
            type="number"
            min="1"
            step="1"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </div>

        <div className="actions">
          <button type="button" className="btn primary" onClick={forecast} disabled={pending}>
            Ejecutar forecast
          </button>
          <button type="button" className="btn" onClick={inventory} disabled={pending}>
            Ver inventario
          </button>
        </div>

        <JsonBlock value={result} />
      </Card>
    </div>
  )
}
