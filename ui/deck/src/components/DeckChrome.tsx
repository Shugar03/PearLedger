import type { ReactNode } from 'react'

import type { Slide } from '@deck/slides'

/** Barra inferior: atajos a la izquierda, puntos al medio, contador a la derecha. */
export function DeckChrome({
  slides,
  current,
  onSelect
}: {
  slides: readonly Slide[]
  current: number
  onSelect(index: number): void
}): ReactNode {
  return (
    <div className="chrome">
      <span className="hint">← → o espacio · F pantalla completa</span>

      <div className="dots" role="tablist" aria-label="Slides">
        {slides.map((slide, index) => (
          <button
            key={slide.label}
            type="button"
            role="tab"
            aria-selected={index === current}
            aria-label={`${index + 1}. ${slide.label}`}
            className={index === current ? 'active' : undefined}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>

      <span>
        {current + 1} / {slides.length}
      </span>
    </div>
  )
}
