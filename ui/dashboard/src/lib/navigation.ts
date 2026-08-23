/**
 * Las pantallas del dashboard, en un solo sitio.
 *
 * Sin etiquetas: el texto sale del diccionario del idioma activo, indexado por
 * la misma clave. Añadir una vista es añadir una entrada, su componente y su
 * texto en los dos idiomas — y el typecheck avisa si falta alguno.
 */
import type { IconName } from '@dashboard/components/Icon'

export interface ViewMeta {
  key: 'home' | 'invoices' | 'pay' | 'forecast' | 'wallet' | 'tools'
  icon: IconName
  /** Los dos bloques de la barra lateral. */
  group: 'main' | 'aside'
}

export const VIEWS: readonly ViewMeta[] = [
  { key: 'home', icon: 'home', group: 'main' },
  { key: 'invoices', icon: 'invoice', group: 'main' },
  { key: 'pay', icon: 'bolt', group: 'main' },
  { key: 'forecast', icon: 'chart', group: 'main' },
  { key: 'wallet', icon: 'wallet', group: 'main' },
  { key: 'tools', icon: 'tools', group: 'aside' }
]

export type ViewKey = ViewMeta['key']
