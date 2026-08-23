import type { ReactNode } from 'react'

/**
 * Iconos de trazo, 24×24, dibujados en el bundle.
 *
 * No hay librería de iconos ni fuente remota: la CSP del servidor no deja
 * cargar nada de la red, y una dependencia entera para una docena de trazos no
 * se paga sola. El trazo hereda `currentColor`.
 */
const PATHS = {
  home: 'M4 5.5h6.5v6H4zM13.5 5.5H20v6h-6.5zM4 14.5h6.5v4H4zM13.5 14.5H20v4h-6.5z',
  invoice: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4',
  bolt: 'M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z',
  chart: 'M4 20V9M10 20V4M16 20v-7M22 20H2',
  wallet:
    'M4 7.5h13a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 17zM4 7.5V6a1.5 1.5 0 0 1 1.5-1.5H15M16 13.5h.01',
  tools: 'M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6L21 13l-8 8-2-2 1.9-1.9a3.5 3.5 0 0 1-4.6-4.6L4 8l4-4z',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  shield: 'M12 3l7.5 3v5.5c0 4.4-3 8.1-7.5 9.5-4.5-1.4-7.5-5.1-7.5-9.5V6z',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4.5V9h-4.5',
  folder: 'M3 6h6l2 2.5h10V19H3zM3 6v13',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M8 16 16 8M9.5 8H16v6.5',
  alert: 'M12 4 3 20h18zM12 10.5v3.5M12 17h.01',
  bell: 'M12 3.5a5.5 5.5 0 0 1 5.5 5.5v4l1.5 3H5l1.5-3V9A5.5 5.5 0 0 1 12 3.5ZM10 19.5a2 2 0 0 0 4 0',
  play: 'M8 5.5 18 12 8 18.5z',
  pulse: 'M3 12h4l2.5-7 4 14 2.5-7h5',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  caret: 'M6.5 9.5 12 15l5.5-5.5',
  chevronLeft: 'M14.5 6.5 9 12l5.5 5.5',
  chevronRight: 'M9.5 6.5 15 12l-5.5 5.5',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18 }: { name: IconName; size?: number }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
