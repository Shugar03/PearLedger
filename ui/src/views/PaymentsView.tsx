import { useState, type ReactNode } from 'react'

import { Card } from '@ui/components/Card'
import { ConfirmDialog } from '@ui/components/ConfirmDialog'
import { Field } from '@ui/components/Field'
import { JsonBlock } from '@ui/components/JsonBlock'
import { usePear } from '@ui/hooks/usePear'
import { useToolResult } from '@ui/hooks/useToolResult'
import { confirmThreshold } from '@ui/lib/bridge'

interface PendingConfirm {
  message: string
  resolve(confirmed: boolean): void
}

export function PaymentsView(): ReactNode {
  const { runTool, setStatus } = usePear()
  const { result, pending, run } = useToolResult()

  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('250')
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)

  const payload = { to: vendor.trim(), amount: Number(amount) || 0 }
  const threshold = confirmThreshold()

  /** Abre el modal y espera la respuesta humana. */
  function ask(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirm({ message, resolve })
    })
  }

  function quote(): void {
    void run(async () => ({ quote: await runTool('quote_payment', { ...payload }) }))
  }

  function payDryRun(): void {
    void run(async () => {
      if (payload.amount > threshold) {
        const approved = await ask(
          `La simulación de $${payload.amount} USDt supera el umbral de $${threshold}. ` +
            'El dashboard sólo puede simular: la firma real exige el CLI.'
        )
        if (!approved) {
          setStatus('Simulación cancelada', 'error')
          return { cancelled: true, amount: payload.amount, threshold }
        }
      }

      const quoted = await runTool('quote_payment', { ...payload })
      // `dryRun` va explícito por claridad, pero el servidor lo fuerza igual y
      // borra `confirmed`/`approvalId` aunque el cliente los mandase.
      const payment = await runTool('execute_gasless_payment', {
        to: payload.to,
        amount: payload.amount,
        dryRun: true
      })
      return { quote: quoted, payment }
    })
  }

  return (
    <div className="view">
      <Card
        title="Cola de pagos"
        description="El dashboard cotiza y simula. La firma real vive en el CLI, que sí tiene canal interactivo con un humano."
      >
        <div className="form-grid two">
          <Field
            label="Proveedor (0x…)"
            value={vendor}
            placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
            onChange={(event) => setVendor(event.target.value)}
          />
          <Field
            label="Monto USDt"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={quote} disabled={pending}>
            Cotizar
          </button>
          <button type="button" className="btn primary" onClick={payDryRun} disabled={pending}>
            Aprobar (dry-run)
          </button>
        </div>

        <p className="note">
          <b>Controles del servidor:</b> <code>dryRun</code> se fuerza a <code>true</code> y{' '}
          <code>confirmed</code> / <code>approvalId</code> se eliminan de cualquier petición HTTP,
          ignorando lo que mande el cliente.
        </p>

        <JsonBlock value={result} />
      </Card>

      {confirm ? (
        <ConfirmDialog
          message={confirm.message}
          onClose={(confirmed) => {
            confirm.resolve(confirmed)
            setConfirm(null)
          }}
        />
      ) : null}
    </div>
  )
}
