/**
 * Revelado al hacer scroll.
 *
 * Cada bloque con la clase `reveal` entra cuando asoma en pantalla. Tres
 * detalles que el original ya resolvía y acá se conservan:
 *
 *  · Sin `IntersectionObserver` se revela todo de una: nunca se deja contenido
 *    invisible por una API que falta.
 *  · Cada bloque se deja de observar al entrar; la animación no se repite.
 *  · Un segundo y medio después de `load` se revela lo que quede pendiente. Si
 *    algo quedó fuera del cálculo del observer, no se pierde.
 */
import { useEffect } from 'react'

const SETTLE_MS = 1500

export function useReveal(): void {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.reveal'))
    const revealAll = (): void => nodes.forEach((node) => node.classList.add('is-in'))

    if (!('IntersectionObserver' in window)) {
      revealAll()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    )

    nodes.forEach((node) => observer.observe(node))

    const timer = setTimeout(() => {
      revealAll()
      observer.disconnect()
    }, SETTLE_MS)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])
}
