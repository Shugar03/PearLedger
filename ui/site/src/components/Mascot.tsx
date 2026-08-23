import type { CSSProperties, ReactNode } from 'react'

/**
 * La pera de la marca, apoyada en su mancha con forma de hoja.
 *
 * El tamaño viaja como custom property porque la CSS lo usa en dos sitios (la
 * caja y el recorte de la ilustración) y así no se pueden desincronizar.
 * Es decorativa: `alt=""` y `aria-hidden` en el contenedor.
 */
export function Mascot({
  image,
  size = 140,
  width,
  height,
  className
}: {
  image: string
  size?: number
  width: number
  height: number
  className?: string
}): ReactNode {
  return (
    <div
      className={className ? `mascot ${className}` : 'mascot'}
      style={{ '--mascot-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <img
        className="mascot__img"
        src={image}
        alt=""
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
