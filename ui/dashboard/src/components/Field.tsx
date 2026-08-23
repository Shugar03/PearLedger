import type { InputHTMLAttributes, ReactNode } from 'react'

/** Etiqueta + input. El `<label>` envuelve al control: no hacen falta `id`s. */
export function Field({
  label,
  ...input
}: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return (
    <label>
      {label}
      <input {...input} />
    </label>
  )
}
