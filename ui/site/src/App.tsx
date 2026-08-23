import type { ReactNode } from 'react'

import { useReveal } from '@site/hooks/useReveal'
import { Architecture } from '@site/sections/Architecture'
import { Cta } from '@site/sections/Cta'
import { Dashboard } from '@site/sections/Dashboard'
import { Flow } from '@site/sections/Flow'
import { Footer } from '@site/sections/Footer'
import { Hero } from '@site/sections/Hero'
import { Nav } from '@site/sections/Nav'
import { Privacy } from '@site/sections/Privacy'

/**
 * La landing entera, en el orden en que se lee: qué es, cómo se ve, cómo
 * funciona, qué protege, cómo está hecho y por dónde se empieza.
 */
export function App(): ReactNode {
  useReveal()

  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Dashboard />
        <Flow />
        <Privacy />
        <Architecture />
        <Cta />
      </main>
      <Footer />
    </>
  )
}
