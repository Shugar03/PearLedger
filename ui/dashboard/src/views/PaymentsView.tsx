import { useState, type ReactNode } from 'react'

import { Card } from '@dashboard/components/Card'
import { ConfirmDialog } from '@dashboard/components/ConfirmDialog'
import { Field } from '@dashboard/components/Field'
import { JsonBlock } from '@dashboard/components/JsonBlock'
import { Kpi } from '@dashboard/components/Kpi'
import { Notice } from '@dashboard/components/Notice'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { useToolResult } from '@dashboard/hooks/useToolResult'
import { confirmThreshold } from '@dashboard/lib/bridge'

interface PendingConfirm {
  message: string
  resolve(confirmed: boolean): void
}

export function PaymentsView(): ReactNode {
  const { runTool, setStatus } = usePear()
  const { t, locale } = usePrefs()
  const { result, problem, pending, run } = useToolResult()

  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('250')
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)

  const money = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  const payload = { to: vendor.trim(), amount: Number(amount) || 0 }
  const threshold = confirmThreshold()
  const overThreshold = payload.amount > threshold

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
      if (overThreshold) {
        const approved = await ask(
          t.payments.confirmBody(money.format(payload.amount), money.format(threshold))
        )
        if (!approved) {
          setStatus({ code: 'cancelled', tone: 'error' })
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
    <>
      <div className="kpis">
        <Kpi
          label={t.payments.amount}
          value={`${money.format(payload.amount)} USDt`}
          badge={overThreshold ? t.payments.amountAsks : t.payments.amountDirect}
          tone={overThreshold ? 'wait' : 'ok'}
          note={overThreshold ? t.payments.amountNoteOver : t.payments.amountNoteUnder}
        />
        <Kpi
          label={t.payments.threshold}
          value={`${money.format(threshold)} USDt`}
          note={t.payments.thresholdNote}
        />
      </div>

      <Card title={t.payments.title} lead={t.payments.lead}>
        <div className="card__body">
          <div className="fields fields--two">
            <Field
              label={t.payments.vendor}
              value={vendor}
              placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
              onChange={(event) => setVendor(event.target.value)}
            />
            <Field
              label={t.payments.amountField}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={payDryRun}
              disabled={pending}
            >
              {t.payments.simulate}
            </button>
            <button type="button" className="btn" onClick={quote} disabled={pending}>
              {t.payments.quote}
            </button>
          </div>

          <p className="note">
            <b>{t.payments.note1}</b> <code>dryRun</code> {t.payments.note2} <code>true</code>{' '}
            {locale === 'es' ? 'y' : 'and'} <code>confirmed</code> / <code>approvalId</code>{' '}
            {t.payments.note3}
          </p>
        </div>
      </Card>

      <Card title={t.payments.resultTitle}>
        <div className="card__body">
          {result ? null : <p className="placeholder">{t.payments.resultEmpty}</p>}
          {problem ? <Notice problem={problem} /> : null}
          <JsonBlock value={result} />
        </div>
      </Card>

      {confirm ? (
        <ConfirmDialog
          title={t.payments.confirmTitle}
          message={confirm.message}
          confirmLabel={t.payments.confirmCta}
          cancelLabel={t.payments.cancel}
          onClose={(confirmed) => {
            confirm.resolve(confirmed)
            setConfirm(null)
          }}
        />
      ) : null}
    </>
  )
}
