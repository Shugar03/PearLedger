/**
 * Las cuatro pantallas del dashboard, en un solo sitio.
 *
 * La barra lateral, el título de la cabecera y el `switch` de contenido leen de
 * aquí: añadir una vista es añadir una entrada y su componente, nunca tocar
 * tres archivos que se puedan desincronizar.
 */
export const VIEWS = [
  { key: 'inbox', label: 'Inbox', icon: '📄', title: 'Inbox de facturas' },
  { key: 'pay', label: 'Pagos', icon: '💸', title: 'Cola de pagos' },
  { key: 'forecast', label: 'Forecast', icon: '📈', title: 'Forecast de inventario' },
  { key: 'wallet', label: 'Wallet', icon: '👛', title: 'Wallet de tesorería' }
] as const

export type ViewKey = (typeof VIEWS)[number]['key']

export function titleOf(key: ViewKey): string {
  return VIEWS.find((view) => view.key === key)?.title ?? ''
}
