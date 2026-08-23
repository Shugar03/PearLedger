/**
 * Estado del bloque de resultado de una vista.
 *
 * Sustituye al `guarded()` del dashboard viejo: un fallo se ve en pantalla y
 * nunca sólo en la consola. Y no se ve enterrado en el JSON plegado — el
 * motivo sale como aviso, que es lo primero que hace falta cuando algo no
 * salió.
 */
import { useCallback, useState } from 'react'

export interface Problem {
  /** `error` es un fallo; `warn`, una acción que el harness frenó a propósito. */
  tone: 'error' | 'warn'
  message: string
}

export interface ToolResultState {
  /** `null` = todavía no se ejecutó nada; el bloque no se dibuja. */
  result: unknown
  /** El motivo, cuando la tool falló o quedó bloqueada. */
  problem: Problem | null
  pending: boolean
  run(task: () => Promise<unknown>): Promise<void>
  reset(): void
}

/** Un `{ error }` devuelto vale lo mismo que una excepción: algo salió mal. */
function problemOf(value: unknown): Problem | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>

  if (typeof record.error === 'string' && record.error.trim()) {
    return { tone: 'error', message: record.error }
  }
  if (record.blocked === true) {
    const reason = typeof record.reason === 'string' ? record.reason : ''
    return { tone: 'warn', message: reason }
  }
  return null
}

export function useToolResult(): ToolResultState {
  const [result, setResult] = useState<unknown>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [pending, setPending] = useState(false)

  const run = useCallback(async (task: () => Promise<unknown>): Promise<void> => {
    setPending(true)
    setProblem(null)
    try {
      const value = await task()
      setResult(value)
      setProblem(problemOf(value))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setResult({ error: message })
      setProblem({ tone: 'error', message })
    } finally {
      setPending(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setProblem(null)
  }, [])

  return { result, problem, pending, run, reset }
}
