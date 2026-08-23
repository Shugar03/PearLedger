import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'

import type { QuickIngest } from '@dashboard/App'
import { Card } from '@dashboard/components/Card'
import { Field, FieldSlot } from '@dashboard/components/Field'
import { Icon } from '@dashboard/components/Icon'
import { JsonBlock } from '@dashboard/components/JsonBlock'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import { useToolResult } from '@dashboard/hooks/useToolResult'
import type { Dict } from '@dashboard/i18n'
import { verdictOf } from '@dashboard/lib/invoices'
import type { MatchResult, ParseInvoiceResult, ParsedInvoice, ToolParams } from '@dashboard/lib/types'

const DEMO_INVOICE = 'workspace/invoices/sample.png'

type Stage = 'idle' | 'reading' | 'matching' | 'done'

interface Summary {
  invoice: ParsedInvoice
  status: string
}

/** El resultado de `parse_invoice` a veces viene envuelto y a veces plano. */
function invoiceOf(parsed: ParseInvoiceResult | null): ParsedInvoice | null {
  if (!parsed || typeof parsed !== 'object') return null
  return parsed.invoice ?? (parsed as ParsedInvoice)
}

function totalOf(invoice: ParsedInvoice, t: Dict): string {
  if (invoice.total === undefined || invoice.total === null) return t.invoices.noTotal
  return `${invoice.total}${invoice.currency ? ` ${invoice.currency}` : ''}`
}

/**
 * Procesar una factura: OCR local y conciliación contra las órdenes de compra.
 *
 * `pending` es la orden inicial que se le asigna cuando la lectura terminó
 * pero la conciliación no llegó a correr — factura bloqueada, por ejemplo.
 */
export function InvoicesView({ quick }: { quick: QuickIngest | null }): ReactNode {
  const { bridge, runTool, setStatus, recordIngest } = usePear()
  const { t } = usePrefs()
  const { result, pending, run } = useToolResult()

  const [filePath, setFilePath] = useState(quick?.path ?? '')
  const [stage, setStage] = useState<Stage>('idle')
  const [summary, setSummary] = useState<Summary | null>(null)

  const canPickNatively = typeof bridge.pickInvoice === 'function'

  async function pickNatively(): Promise<void> {
    const chosen = await bridge.pickInvoice?.()
    if (chosen) setFilePath(chosen)
  }

  function pickFromBrowser(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    // El navegador no revela la ruta absoluta: proponemos la del workspace.
    if (file) setFilePath(`workspace/invoices/${file.name}`)
  }

  function ingest(override?: string): void {
    void run(async () => {
      const target = (override ?? filePath).trim()
      if (!target) return { error: t.invoices.needPath }

      setSummary(null)
      setStatus({ code: 'processing', tone: 'busy' })
      setStage('reading')

      try {
        const parsed = await runTool<ParseInvoiceResult>('parse_invoice', { filePath: target })
        setStage('matching')

        let match: MatchResult | null = null
        const invoice = invoiceOf(parsed)

        if (invoice && !parsed?.blocked) {
          const params: ToolParams = { invoice }
          const invoiceId = invoice.invoiceNumber ?? parsed?.invoiceId
          if (invoiceId) params.invoiceId = invoiceId
          match = await runTool<MatchResult>('match_purchase_order', params)
        }

        if (invoice) {
          const status = match?.status ?? 'pending'
          setSummary({ invoice, status })
          recordIngest({
            path: target,
            vendor: invoice.vendor ?? invoice.invoiceNumber ?? t.invoices.noVendor,
            total: totalOf(invoice, t),
            status
          })
        }

        setStage('done')
        return { parsed, match }
      } catch (err) {
        setStage('idle')
        throw err
      }
    })
  }

  // La cabecera manda ruta y token; el token es lo que dispara la ejecución,
  // así que pedir dos veces la misma factura vuelve a correr el flujo.
  const lastToken = useRef(0)
  useEffect(() => {
    if (!quick || quick.token === lastToken.current) return
    lastToken.current = quick.token
    setFilePath(quick.path)
    ingest(quick.path)
  })

  return (
    <>
      <Card
        title={t.invoices.title}
        lead={t.invoices.lead}
      >
        <div className="card__body">
          <div className="fields fields--two">
            <Field
              label={t.invoices.path}
              value={filePath}
              placeholder={t.invoices.pathPlaceholder}
              onChange={(event) => setFilePath(event.target.value)}
            />
            {canPickNatively ? (
              <FieldSlot label={t.invoices.pickNative}>
                <button type="button" className="btn" onClick={() => void pickNatively()}>
                  <Icon name="folder" size={16} />
                  {t.invoices.pickButton}
                </button>
              </FieldSlot>
            ) : (
              /* El input nativo se esconde detrás de la etiqueta: su botón lo
                 dibuja el navegador, con su propio idioma y su propio estilo. */
              <FieldSlot label={t.invoices.pickBrowser}>
                <label className="btn">
                  <Icon name="folder" size={16} />
                  {t.invoices.pickButton}
                  <input
                    className="sr-only"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={pickFromBrowser}
                  />
                </label>
              </FieldSlot>
            )}
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => ingest()}
              disabled={pending}
            >
              {t.invoices.process}
            </button>
            <button type="button" className="btn" onClick={() => setFilePath(DEMO_INVOICE)}>
              {t.invoices.demo}
            </button>
          </div>

          <p className="note">
            {t.invoices.note1} <code>workspace/invoices/</code> {t.invoices.note2}
          </p>
        </div>
      </Card>

      <Card title={t.invoices.resultTitle}>
        <div className="card__body">
          {stage !== 'idle' ? <Progress stage={stage} t={t} /> : null}
          {summary ? <InvoiceSummary summary={summary} t={t} /> : null}
          {stage === 'idle' && !result ? (
            <p className="placeholder">{t.invoices.resultEmpty}</p>
          ) : null}
          <JsonBlock value={result} />
        </div>
      </Card>
    </>
  )
}

function Progress({ stage, t }: { stage: Stage; t: Dict }): ReactNode {
  const steps = [
    { id: 'reading', label: t.invoices.stepReading, detail: t.invoices.stepReadingDetail },
    { id: 'matching', label: t.invoices.stepMatching, detail: t.invoices.stepMatchingDetail }
  ]

  const order: Stage[] = ['reading', 'matching', 'done']
  const current = order.indexOf(stage)

  return (
    <ol className="steps">
      {steps.map((step, index) => {
        const done = current > index
        const active = current === index
        return (
          <li
            key={step.id}
            className={done ? 'step is-done' : active ? 'step is-active' : 'step'}
            aria-current={active ? 'step' : undefined}
          >
            <span className="step__mark">{done ? <Icon name="check" size={12} /> : index + 1}</span>
            <span>
              <b>{step.label}</b> · {step.detail}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function InvoiceSummary({ summary, t }: { summary: Summary; t: Dict }): ReactNode {
  const { invoice, status } = summary
  const verdict = verdictOf(status)

  return (
    <div className={status === 'matched' ? 'summary is-ok' : 'summary is-warn'}>
      <div>
        <span className="summary__k">{t.invoices.vendor}</span>
        <span className="summary__v">{invoice.vendor ?? t.common.none}</span>
      </div>
      <div>
        <span className="summary__k">{t.invoices.total}</span>
        <span className="summary__v">{totalOf(invoice, t)}</span>
      </div>
      <div>
        <span className="summary__k">{t.invoices.number}</span>
        <span className="summary__v">{invoice.invoiceNumber ?? t.common.none}</span>
      </div>
      <div>
        <span className="summary__k">{t.invoices.verdict}</span>
        <span className="summary__v">
          <span className={verdict.pill}>{t.verdicts[verdict.key]}</span>
        </span>
      </div>
    </div>
  )
}
