/**
 * Teclado del deck: el presentador no toca el mouse.
 *
 * → / espacio / AvPág avanzan, ← / RePág retroceden, `F` alterna pantalla
 * completa y las teclas 1-9 saltan a una diapositiva. El avance es circular:
 * pasarse de la última vuelve a la primera, que en una demo en vivo es mejor
 * que quedarse trabado.
 */
import { useEffect } from 'react'

export interface SlideNavigation {
  count: number
  go(index: number): void
  next(): void
  previous(): void
}

export function useSlideNavigation({ count, go, next, previous }: SlideNavigation): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') {
        event.preventDefault()
        next()
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        previous()
        return
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        void toggleFullscreen()
        return
      }

      const digit = Number(event.key)
      if (Number.isInteger(digit) && digit >= 1 && digit <= count) {
        event.preventDefault()
        go(digit - 1)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [count, go, next, previous])
}

/** `requestFullscreen` rechaza si el navegador no lo permite: no es un error. */
async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    // Sin pantalla completa el deck se ve igual, sólo con la barra del navegador.
  }
}
