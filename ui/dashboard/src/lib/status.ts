/**
 * El estado que muestra la cabecera, como código y no como frase.
 *
 * El provider no puede armar el texto: no sabe en qué idioma está la interfaz,
 * y traducirlo desde ahí obligaría a rearmar el estado al cambiar de idioma.
 * Emite un código con su dato y la cabecera lo traduce al pintar.
 */
import type { Dict } from '@dashboard/i18n'

export type StatusCode =
  | 'idle'
  | 'ready'
  | 'running'
  | 'loadingModels'
  | 'processing'
  | 'blocked'
  | 'failed'
  | 'cancelled'
  | 'policy'
  | 'error'

export interface Status {
  code: StatusCode
  /** Cómo se pinta la píldora. */
  tone: 'idle' | 'busy' | 'error'
  /** El dato del mensaje: nombre de tool, cantidad, nota del servidor. */
  detail?: string | number
}

export const READY: Status = { code: 'idle', tone: 'idle' }

export function statusText(status: Status, t: Dict): string {
  const { code, detail } = status

  if (code === 'ready') return t.status.ready(Number(detail ?? 0))
  if (code === 'running') return t.status.running(String(detail ?? ''))
  if (code === 'policy') return t.status.policy(String(detail ?? ''))
  if (code === 'error') return t.status.error
  return t.status[code]
}

/**
 * El texto crudo que devolvió el harness, para el `title` de la píldora.
 *
 * Va aparte del mensaje porque no está traducido — sale de una librería o del
 * sistema operativo — y porque en una cabecera no entra. Perderlo sería peor:
 * es lo único que dice si el problema fue un lock, un puerto o un modelo.
 */
export function statusDetail(status: Status): string | undefined {
  return status.code === 'error' && status.detail ? String(status.detail) : undefined
}
