/**
 * Cómo se lee un evento del harness.
 *
 * El motivo de un fallo viaja distinto según el evento: `tool:failed` manda el
 * error serializado (`{ error }`) y `tool:blocked` manda los params con los que
 * el hook rechazó la acción, donde el texto humano está en `message`. Sin esto,
 * la interfaz decía "Falló" y se guardaba el porqué.
 */
import type { ActivityEntry } from '@dashboard/context/pear-context'

export interface Look {
  badge: string
  icon: 'check' | 'play' | 'close'
  pill: string
  label: 'done' | 'running' | 'blocked' | 'failed' | 'registered'
}

const LOOKS: Record<string, Look> = {
  'tool:done': { badge: 'badge badge--done', icon: 'check', pill: 'pill pill--ok', label: 'done' },
  'tool:executing': {
    badge: 'badge badge--running',
    icon: 'play',
    pill: 'pill pill--wait',
    label: 'running'
  },
  'tool:blocked': {
    badge: 'badge badge--blocked',
    icon: 'close',
    pill: 'pill pill--warn',
    label: 'blocked'
  },
  'tool:failed': {
    badge: 'badge badge--failed',
    icon: 'close',
    pill: 'pill pill--warn',
    label: 'failed'
  },
  'tool:registered': { badge: 'badge', icon: 'check', pill: 'pill', label: 'registered' }
}

export function lookOf(entry: ActivityEntry): Look {
  return LOOKS[entry.event.type] ?? LOOKS['tool:registered']!
}

export function isAlert(entry: ActivityEntry): boolean {
  return entry.event.type === 'tool:blocked' || entry.event.type === 'tool:failed'
}

/** El hub SSE manda `detail`; el puente de Electron manda `payload`. */
function payloadOf(entry: ActivityEntry): unknown {
  return entry.event.detail ?? entry.event.payload
}

/**
 * El motivo, si el evento lo trae.
 *
 * Sólo tiene sentido en los eventos que salieron mal: en los demás el payload
 * es el resultado de la tool, que ya se ve en la pantalla que la ejecutó.
 */
export function reasonOf(entry: ActivityEntry): string | null {
  if (!isAlert(entry)) return null

  const raw = payloadOf(entry)
  if (typeof raw === 'string') return raw
  if (typeof raw !== 'object' || raw === null) return null

  const record = raw as Record<string, unknown>
  for (const key of ['error', 'message', 'reason']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  // Un bloqueo sin texto sigue siendo un bloqueo: mejor el volcado que nada.
  try {
    const dump = JSON.stringify(raw)
    return dump === '{}' ? null : dump
  } catch {
    return null
  }
}

/** Hora local del evento; los de Electron no la traen y se usa la de llegada. */
export function timeOf(entry: ActivityEntry, locale: string): string {
  const at = entry.event.at ? new Date(entry.event.at) : new Date()
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}
