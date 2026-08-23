import type { ReactNode } from 'react'

import { usePrefs } from '@dashboard/hooks/usePrefs'

/**
 * Respuesta cruda del harness, plegada.
 *
 * Cada vista muestra lo importante en pantalla; esto es para cuando hace falta
 * ver exactamente qué contestó la tool. Va cerrado por defecto: en una demo el
 * JSON en bruto distrae, y en una investigación es lo primero que se abre.
 */
export function JsonBlock({ value, label }: { value: unknown; label?: string }): ReactNode {
  const { t } = usePrefs()
  if (value === null || value === undefined) return null

  return (
    <details className="raw">
      <summary>{label ?? t.common.raw}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}
