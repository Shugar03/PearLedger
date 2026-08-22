/**
 * Puente IPC para Evelin (Electron) — wrapper sobre harness P4.
 * Sin dependencia de Electron; importar desde el main process de la UI.
 */
import { harness, loadPlugins } from './loader.js'
import type { Tool } from './core.js'

let ready = false

export async function ensureHarnessReady(): Promise<void> {
  if (!ready) {
    await loadPlugins()
    ready = true
  }
}

/** Ejecuta una tool registrada (misma API que CLI). */
export async function executeTool(
  name: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  await ensureHarnessReady()
  return harness.execute(name, params)
}

export function listTools(): Tool[] {
  return harness.listTools()
}

export function onHarnessEvent(
  event: 'tool:registered' | 'tool:executing' | 'tool:done' | 'tool:blocked',
  handler: (...args: unknown[]) => void
): void {
  harness.on(event, handler)
}

export { harness }
