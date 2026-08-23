import { useState, type ChangeEvent, type ReactNode } from 'react'

import { Card } from '@ui/components/Card'
import { Field } from '@ui/components/Field'
import { JsonBlock } from '@ui/components/JsonBlock'
import { usePear } from '@ui/hooks/usePear'
import { useToolResult } from '@ui/hooks/useToolResult'
import type { MatchResult, ParseInvoiceResult, ParsedInvoice, ToolParams } from '@ui/lib/types'

const DEMO_INVOICE = 'workspace/invoices/sample.png'

const MATCH_LABEL: Record<string, string> = {
  matched: '✓ Conciliada',
  vendor_mismatch: '⚠ Proveedor no coincide',
  amount_mismatch: '⚠ Monto no coincide',
  no_match: 'Sin orden de compra'
}

interface Summary {
  invoice: ParsedInvoice
  status: string
}

/** El resultado de `parse_invoice` a veces viene envuelto y a veces plano. */
function invoiceOf(parsed: ParseInvoiceResult | null): ParsedInvoice | null {
  if (!parsed || typeof parsed !== 'object') return null
  return parsed.invoice ?? (parsed as ParsedInvoice)
}

export function InboxView(): ReactNode {
  const { bridge, runTool, setStatus } = usePear()
  const { result, pending, run } = useToolResult()

  const [filePath, setFilePath] = useState('')
  const [progress, setProgress] = useState('')
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

  function ingest(): void {
    void run(async () => {
      const target = filePath.trim()
      if (!target) return { error: 'Indicá la ruta del archivo de la factura' }

      setSummary(null)
      setStatus('Procesando factura…', 'busy')
      setProgress('OCR y extracción en curso (puede tardar en frío)…')

      try {
        const parsed = await runTool<ParseInvoiceResult>('parse_invoice', { filePath: target })
        setProgress('Conciliando contra órdenes de compra…')

        let match: MatchResult | null = null
        const invoice = invoiceOf(parsed)

        if (invoice && !parsed?.blocked) {
          const params: ToolParams = { invoice }
          const invoiceId = invoice.invoiceNumber ?? parsed?.invoiceId
          if (invoiceId) params.invoiceId = invoiceId
          match = await runTool<MatchResult>('match_purchase_order', params)
        }

        if (invoice) setSummary({ invoice, status: match?.status ?? 'sin match' })
        return { parsed, match }
      } finally {
        setProgress('')
      }
    })
  }

  return (
    <div className="view">
      <Card
        title="Facturas"
        description="OCR local + conciliación 3-way contra las órdenes de compra, vía harness."
      >
        <div className="form-grid">
          <Field
            label="Ruta absoluta del archivo"
            value={filePath}
            placeholder="/ruta/al/repo/workspace/invoices/sample.png"
            onChange={(event) => setFilePath(event.target.value)}
          />
          {canPickNatively ? (
            <div className="field">
              <span>Elegir archivo</span>
              <button type="button" className="btn" onClick={() => void pickNatively()}>
                Abrir diálogo nativo…
              </button>
            </div>
          ) : (
            <Field
              label="Elegir archivo"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={pickFromBrowser}
            />
          )}
        </div>

        <p className="note">
          <b>Nota navegador:</b> el diálogo nativo de Electron (<code>pear.pickInvoice()</code>)
          devuelve la ruta absoluta en disco; un <code>&lt;input type="file"&gt;</code> del
          navegador <em>no puede</em> por política de seguridad — sólo expone el nombre. Al elegir
          un archivo se propone la ruta dentro de <code>workspace/invoices/</code>; ajustala si vive
          en otro sitio. El harness lee del disco local, no se sube nada.
        </p>

        <div className="actions">
          <button type="button" className="btn primary" onClick={ingest} disabled={pending}>
            Procesar factura
          </button>
          <button type="button" className="btn" onClick={() => setFilePath(DEMO_INVOICE)}>
            Usar fixture demo
          </button>
        </div>

        {progress ? <p className="muted">{progress}</p> : null}
        {summary ? <InvoiceSummary summary={summary} /> : null}
        <JsonBlock value={result} />
      </Card>
    </div>
  )
}

function InvoiceSummary({ summary }: { summary: Summary }): ReactNode {
  const { invoice, status } = summary
  const slug = status.replace(/[^a-z_]/gi, '_')

  return (
    <p className={`note inbox-summary status-${slug}`}>
      <b>Proveedor:</b> {invoice.vendor ?? '—'} · <b>Total:</b>{' '}
      {invoice.total === undefined || invoice.total === null ? '—' : String(invoice.total)}
      {invoice.currency ? ` ${invoice.currency}` : ''} · <b>Conciliación:</b>{' '}
      {MATCH_LABEL[status] ?? status}
    </p>
  )
}
