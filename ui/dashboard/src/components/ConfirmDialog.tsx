import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Confirmación modal sobre `<dialog>` nativo.
 *
 * Se monta sólo cuando hace falta preguntar y se desmonta al responder, así el
 * evento `close` nativo se dispara una única vez y siempre por acción humana.
 * Si el host no implementa `showModal()` se resuelve que sí: el diálogo es una
 * cortesía de la UI, la barrera de verdad la pone el servidor.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onClose
}: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onClose(confirmed: boolean): void
}): ReactNode {
  const ref = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (typeof dialog.showModal !== 'function') {
      onClose(true)
      return
    }
    if (!dialog.open) dialog.showModal()
  }, [onClose])

  return (
    <dialog
      className="modal"
      ref={ref}
      onClose={() => onClose(ref.current?.returnValue === 'confirm')}
    >
      <form method="dialog" className="modal__card">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="actions">
          <button type="submit" value="cancel" className="btn">
            {cancelLabel}
          </button>
          <button type="submit" value="confirm" className="btn btn--primary">
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
