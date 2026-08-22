/**
 * Contratos del harness. Las capas de arriba (CLI, dashboard, IPC) dependen de
 * estas interfaces y no de la clase concreta — es lo que permite sustituir el
 * harness en tests sin tocar estado global.
 */

export type ToolParams = Record<string, unknown>

export type ToolHandler = (params: ToolParams) => Promise<unknown>

export interface Tool {
  name: string
  description: string
  handler: ToolHandler
  plugin: string
}

/** Descripción de una tool sin su implementación — lo que se expone a la UI. */
export interface ToolDescriptor {
  name: string
  description: string
  plugin: string
}

export interface HookResult {
  proceed: boolean
  params: ToolParams
}

export type HookFn = (tool: Tool, params: ToolParams) => Promise<HookResult>

export type HarnessEvent =
  | 'tool:registered'
  | 'tool:executing'
  | 'tool:done'
  | 'tool:blocked'
  | 'tool:failed'

export type EventHandler = (...args: unknown[]) => void

/** Resultado devuelto cuando un hook detiene la ejecución. */
export interface BlockedResult {
  blocked: true
  reason: string
  requiresConfirmation: boolean
}

export function isBlocked(value: unknown): value is BlockedResult {
  return typeof value === 'object' && value !== null && (value as BlockedResult).blocked === true
}

export interface ToolRegistry {
  registerTool(tool: Tool): void
  listTools(): Tool[]
  getTool(name: string): Tool | undefined
}

export interface EventBus {
  on(event: HarnessEvent, handler: EventHandler): void
  off(event: HarnessEvent, handler: EventHandler): void
  emit(event: HarnessEvent, ...args: unknown[]): void
}

export interface ToolExecutor {
  execute(name: string, params?: ToolParams): Promise<unknown>
}

export interface HookHost {
  registerHook(fn: HookFn): void
}

/** Lo que un plugin recibe para registrarse. Interfaz mínima → ISP. */
export type PluginHost = ToolRegistry & HookHost

export interface PluginModule {
  readonly name: string
  register(host: PluginHost): void | Promise<void>
}
