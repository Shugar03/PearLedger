import type { ReactNode } from 'react'

/**
 * Volcado JSON del resultado de una tool.
 *
 * No se dibuja hasta que hay algo que mostrar: un `<pre>` vacío dejaba un
 * hueco raro debajo de los botones.
 */
export function JsonBlock({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined) return null
  return <pre className="result">{JSON.stringify(value, null, 2)}</pre>
}
