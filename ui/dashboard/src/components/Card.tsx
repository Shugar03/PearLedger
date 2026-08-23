import type { ReactNode } from 'react'

/** Contenedor estándar de cualquier bloque del dashboard. */
export function Card({
  title,
  lead,
  aside,
  className,
  children
}: {
  title?: string
  lead?: ReactNode
  /** Contenido alineado a la derecha del título: una píldora, un botón. */
  aside?: ReactNode
  className?: string
  children?: ReactNode
}): ReactNode {
  const hasHead = Boolean(title || lead || aside)

  return (
    <section className={className ? `card ${className}` : 'card'}>
      {hasHead ? (
        <div className="card__head">
          <div>
            {title ? <h2 className="card__title">{title}</h2> : null}
            {lead ? <p className="card__lead">{lead}</p> : null}
          </div>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  )
}
