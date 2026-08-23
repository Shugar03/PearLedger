/**
 * Las cinco diapositivas, en orden y con su etiqueta accesible.
 *
 * El contenido es el del guion de `docs/PITCH-VIDEO-3MIN.md`: título (0:00),
 * problema (0:08), caso en vivo (0:18 → corte a demo), tracks (2:30) y cierre
 * con permalinks (2:45).
 */
import type { ReactNode } from 'react'

import { CaseSlide } from '@deck/slides/CaseSlide'
import { CloseSlide } from '@deck/slides/CloseSlide'
import { ProblemSlide } from '@deck/slides/ProblemSlide'
import { ProofSlide } from '@deck/slides/ProofSlide'
import { TitleSlide } from '@deck/slides/TitleSlide'

export interface Slide {
  /** Va al `aria-label` de la sección y al del punto de navegación. */
  label: string
  Component(): ReactNode
}

export const SLIDES: readonly Slide[] = [
  { label: 'Título', Component: TitleSlide },
  { label: 'Problema', Component: ProblemSlide },
  { label: 'Caso demo', Component: CaseSlide },
  { label: 'Tracks demostrados', Component: ProofSlide },
  { label: 'Cierre', Component: CloseSlide }
]
