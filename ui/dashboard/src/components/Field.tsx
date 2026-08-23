import type { InputHTMLAttributes, ReactNode } from 'react'

/** Etiqueta + control. El `<label>` envuelve al input: no hacen falta `id`s. */
export function Field({
  label,
  ...input
}: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input {...input} />
    </label>
  )
}

/**
 * Hueco con la misma pinta que un `Field` pero para un control que no es un
 * input — el botón que abre el diálogo nativo de Electron, por ejemplo. Como
 * no hay nada etiquetable dentro, no puede ser un `<label>`.
 */
export function FieldSlot({
  label,
  children
}: {
  label: ReactNode
  children: ReactNode
}): ReactNode {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {children}
    </div>
  )
}
