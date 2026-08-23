/**
 * Estado del bloque de resultado de una vista.
 *
 * Sustituye al `guarded()` de `app.js`: un fallo se ve en pantalla, en el mismo
 * `<pre>` donde iría el resultado, y nunca sólo en la consola.
 */
import { useCallback, useState } from 'react'

export interface ToolResultState {
  /** `null` = todavía no se ejecutó nada; el bloque no se dibuja. */
  result: unknown
  pending: boolean
  /** Ejecuta y captura: el error termina como `{ error }` en el resultado. */
  run(task: () => Promise<unknown>): Promise<void>
  reset(): void
}

export function useToolResult(): ToolResultState {
  const [result, setResult] = useState<unknown>(null)
  const [pending, setPending] = useState(false)

  const run = useCallback(async (task: () => Promise<unknown>): Promise<void> => {
    setPending(true)
    try {
      setResult(await task())
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setPending(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
  }, [])

  return { result, pending, run, reset }
}
