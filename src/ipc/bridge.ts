/**
 * Fachada IPC — es el composition root de la UI.
 *
 * Electron (y el dashboard, y los tests de integración) hablan con el harness
 * únicamente a través de estas funciones. El harness se crea **una vez** aquí y
 * se memoiza: el proceso principal de la UI es de larga vida y recargar plugins
 * en cada llamada duplicaría registros.
 *
 * `listTools()` es asíncrona a propósito: necesita que los plugins estén
 * cargados antes de poder describir nada, y devuelve descriptores sin handlers
 * para que la respuesta sea serializable a través del canal IPC.
 */

import { createHarness, type Harness } from '@core/harness.js'
import { loadPlugins } from '@core/loader.js'
import type { HarnessEvent, ToolDescriptor, ToolParams } from '@core/types.js'

/**
 * Promesa memoizada, no un booleano `ready`: dos llamadas concurrentes durante
 * el arranque deben esperar a la misma carga, no lanzar dos.
 */
let bootstrap: Promise<Harness> | null = null

async function bootstrapHarness(): Promise<Harness> {
  const harness = createHarness()
  await loadPlugins(harness, { withDefaultHooks: true, seal: true })
  return harness
}

/** Harness compartido de la UI, creado y poblado una sola vez. */
export function getHarness(): Promise<Harness> {
  if (!bootstrap) {
    bootstrap = bootstrapHarness().catch((err) => {
      // Un arranque fallido no debe quedar cacheado: el siguiente intento
      // volvería a fallar para siempre sin haberlo reintentado nunca.
      bootstrap = null
      throw err
    })
  }
  return bootstrap
}

/** Espera a que el harness esté cargado. Útil antes de pintar la UI. */
export async function ensureHarnessReady(): Promise<void> {
  await getHarness()
}

/** Ejecuta una tool registrada. Misma semántica que el CLI, hooks incluidos. */
export async function executeTool(
  name: string,
  params: ToolParams = {}
): Promise<unknown> {
  const harness = await getHarness()
  return harness.execute(name, params)
}

/** Catálogo de tools sin handlers — serializable por IPC. */
export async function listTools(): Promise<ToolDescriptor[]> {
  const harness = await getHarness()
  return harness.describeTools()
}

/**
 * Suscribe un handler a un evento del harness y devuelve la función para
 * desuscribirlo. Sin ese retorno, cada ventana de Electron que se recargaba
 * dejaba su listener vivo en el bus y los handlers se acumulaban.
 *
 * La suscripción se resuelve de forma asíncrona (el harness puede no estar
 * listo aún), así que la baja se registra como intención y se aplica en cuanto
 * el harness existe, incluso si se llama antes de que termine el arranque.
 */
export function onHarnessEvent(
  event: HarnessEvent,
  handler: (...args: unknown[]) => void
): () => void {
  let unsubscribed = false

  const attached = getHarness().then((harness) => {
    if (!unsubscribed) harness.on(event, handler)
    return harness
  })

  // Un fallo de arranque ya se reporta por `getHarness()`; aquí sólo evitamos
  // un rechazo sin manejar por la rama de la suscripción.
  attached.catch(() => undefined)

  return () => {
    if (unsubscribed) return
    unsubscribed = true
    attached.then((harness) => harness.off(event, handler)).catch(() => undefined)
  }
}

/** Solo para tests: descarta el harness memoizado. */
export function resetHarness(): void {
  bootstrap = null
}
