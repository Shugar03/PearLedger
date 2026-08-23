import type { ReactNode } from 'react'

/**
 * Los catorce iconos de la landing, cada uno un solo trazo de 24×24.
 *
 * En el export cada aparición traía el `<svg>` entero repetido — 32 copias de
 * los mismos doce atributos. Acá el trazo es dato y el resto es el componente.
 */
const PATHS = {
  brain:
    'M9.5 5A2.5 2.5 0 0 0 7 7.5 2.5 2.5 0 0 0 5.5 12 2.5 2.5 0 0 0 7 16.4 2.5 2.5 0 0 0 12 17V5.6A2.5 2.5 0 0 0 9.5 5ZM14.5 5A2.5 2.5 0 0 1 17 7.5 2.5 2.5 0 0 1 18.5 12 2.5 2.5 0 0 1 17 16.4 2.5 2.5 0 0 1 12 17',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  chart: 'M4 20V9M10 20V4M16 20v-7M22 20H2',
  document: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4',
  wallet:
    'M4 7.5h13a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 17zM4 7.5V6a1.5 1.5 0 0 1 1.5-1.5H15M16 13.5h.01',
  bolt: 'M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z',
  cart:
    'M3 4h2.2l1.9 10.2a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.3L19.5 8H6M9 19.5h.01M17 19.5h.01',
  network:
    'M12 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5.5 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.5 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10.5 7.5 6.8 15M13.5 7.5 17.2 15M8 18h8',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  shield: 'M12 3l7.5 3v5.5c0 4.4-3 8.1-7.5 9.5-4.5-1.4-7.5-5.1-7.5-9.5V6z',
  device: 'M4 5.5h16v10H4zM9 19.5h6M12 15.5v4',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM7.5 7.5h.01M7.5 16.5h.01',
  cloudOff: 'M4 4l16 16M7.5 18h9a3.5 3.5 0 0 0 1.2-6.8A5.5 5.5 0 0 0 9 8.2M6.6 10.1A3.75 3.75 0 0 0 7.5 18',
  lock: 'M6.5 10.5h11v9h-11zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3'
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
