/**
 * Pipeline de hooks como función pura. Es la única lógica con ramas del núcleo
 * y la que los tests de bloqueo de pagos ejercitan de verdad, así que vive
 * aparte de la clase para poder probarse sin construir un harness.
 */

import type { HookFn, HookResult, Tool, ToolParams } from '@core/types.js'

export interface PipelineOutcome {
  proceed: boolean
  params: ToolParams
  /** Hook que detuvo la cadena, si alguno lo hizo. */
  stoppedAt?: number
}

/**
 * Ejecuta los hooks en orden. El primero que devuelve `proceed:false` detiene
 * la cadena. Cada hook recibe los params que produjo el anterior.
 *
 * Un hook mal escrito que devuelva `undefined` o sin `params` rompía la cadena
 * con un TypeError opaco; aquí se valida la forma del retorno y se falla con un
 * mensaje que identifica al hook culpable.
 */
export async function runHookPipeline(
  hooks: readonly HookFn[],
  tool: Tool,
  params: ToolParams
): Promise<PipelineOutcome> {
  let current: ToolParams = { ...params }

  for (const [index, hook] of hooks.entries()) {
    const result = (await hook(tool, current)) as HookResult | undefined

    if (!result || typeof result !== 'object' || typeof result.proceed !== 'boolean') {
      throw new Error(
        `Hook #${index} aplicado a "${tool.name}" devolvió un valor inválido: ` +
          'se esperaba { proceed: boolean, params: object }'
      )
    }

    current = result.params && typeof result.params === 'object' ? result.params : current

    if (!result.proceed) {
      return { proceed: false, params: current, stoppedAt: index }
    }
  }

  return { proceed: true, params: current }
}
