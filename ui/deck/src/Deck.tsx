import { useCallback, useState, type ReactNode } from 'react'

import { DeckChrome } from '@deck/components/DeckChrome'
import { useSlideNavigation } from '@deck/hooks/useSlideNavigation'
import { SLIDES } from '@deck/slides'

export function Deck(): ReactNode {
  const [current, setCurrent] = useState(0)

  // Circular en los dos sentidos: `-1` cae en la última.
  const go = useCallback((index: number) => {
    setCurrent(((index % SLIDES.length) + SLIDES.length) % SLIDES.length)
  }, [])

  const next = useCallback(() => setCurrent((i) => (i + 1) % SLIDES.length), [])
  const previous = useCallback(
    () => setCurrent((i) => (i - 1 + SLIDES.length) % SLIDES.length),
    []
  )

  useSlideNavigation({ count: SLIDES.length, go, next, previous })

  const slide = SLIDES[current]
  if (!slide) return null
  const { Component } = slide

  return (
    <>
      <div className="hack">Aleph 2026 · Demo 3:00</div>

      <div className="deck">
        {/* La `key` fuerza el remontaje: es lo que dispara la animación de entrada. */}
        <section className="slide" key={current} aria-label={slide.label}>
          <Component />
        </section>
      </div>

      <DeckChrome slides={SLIDES} current={current} onSelect={go} />
    </>
  )
}
