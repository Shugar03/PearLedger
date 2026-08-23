import { useEffect, useState, type ReactNode } from 'react'

import { Card } from '@dashboard/components/Card'
import { usePear } from '@dashboard/hooks/usePear'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import type { Dict } from '@dashboard/i18n'
import type { ToolDescriptor } from '@dashboard/lib/types'

/**
 * La descripción traducida de una tool.
 *
 * El harness las trae en español porque así están escritas en los plugins; las
 * ocho conocidas se traducen acá. Una tool nueva se muestra tal cual la
 * describe su plugin: mejor en un idioma que en blanco.
 */
function describe(tool: ToolDescriptor, t: Dict): string {
  const known = t.toolDescriptions as Record<string, string | undefined>
  return known[tool.name] ?? tool.description
}

/**
 * El catálogo que expone el harness.
 *
 * Es la misma llamada que ya hace el arranque para contar las tools de la
 * barra lateral; acá se muestra entera. No ejecuta nada: sólo dice qué hay.
 */
export function ToolsView(): ReactNode {
  const { bridge, meta } = usePear()
  const { t } = usePrefs()
  const [tools, setTools] = useState<ToolDescriptor[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    bridge.listTools().then(
      (list) => {
        if (alive) setTools(list)
      },
      (err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      }
    )
    return () => {
      alive = false
    }
  }, [bridge])

  return (
    <Card title={t.tools.title} lead={t.tools.lead(meta.tools ?? tools.length)}>
      <div className="card__body">
        {error ? <p className="placeholder">{error}</p> : null}
        {!error && tools.length === 0 ? <p className="placeholder">{t.tools.loading}</p> : null}

        <div className="tools">
          {tools.map((tool) => (
            <article className="tool" key={tool.name}>
              <span className="tool__name">{tool.name}</span>
              <span className="pill">{tool.plugin}</span>
              <p className="tool__desc">{describe(tool, t)}</p>
            </article>
          ))}
        </div>
      </div>
    </Card>
  )
}
