import type { ReactNode } from 'react'

/** Contenedor estándar de cualquier bloque del dashboard. */
export function Card({
  title,
  description,
  className,
  children
}: {
  title?: string
  description?: ReactNode
  className?: string
  children?: ReactNode
}): ReactNode {
  return (
    <section className={className ? `card ${className}` : 'card'}>
      {title ? <h2>{title}</h2> : null}
      {description ? <p className="muted">{description}</p> : null}
      {children}
    </section>
  )
}
