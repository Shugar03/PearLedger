/**
 * Harness — registro de tools, bus de eventos y ejecución con hooks.
 *
 * Se mantiene como fachada con la misma API pública que la versión anterior
 * (`registerTool` / `registerHook` / `on` / `emit` / `listTools` / `execute` /
 * `reset`) para no romper a los consumidores, pero la lógica del pipeline vive
 * fuera y las capas superiores dependen de las interfaces de `@core/types`.
 */

import { runHookPipeline } from '@core/hook-pipeline.js'
import type {
  BlockedResult,
  EventBus,
  EventHandler,
  HarnessEvent,
  HookFn,
  HookHost,
  Tool,
  ToolDescriptor,
  ToolExecutor,
  ToolParams,
  ToolRegistry
} from '@core/types.js'

export class Harness implements ToolRegistry, EventBus, ToolExecutor, HookHost {
  private readonly tools = new Map<string, Tool>()
  private hooks: HookFn[] = []
  private readonly bus = new Map<string, Set<EventHandler>>()
  private hooksSealed = false

  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
    this.emit('tool:registered', tool)
  }

  registerHook(fn: HookFn): void {
    if (this.hooksSealed) {
      throw new Error('No se pueden registrar hooks después de sellar el harness')
    }
    this.hooks.push(fn)
  }

  /**
   * Cierra el registro de hooks. Tras cargar los plugins nadie debería poder
   * inyectar un hook que se salte la confirmación humana de pagos.
   */
  seal(): void {
    this.hooksSealed = true
  }

  on(event: HarnessEvent, handler: EventHandler): void {
    if (!this.bus.has(event)) this.bus.set(event, new Set())
    this.bus.get(event)!.add(handler)
  }

  off(event: HarnessEvent, handler: EventHandler): void {
    this.bus.get(event)?.delete(handler)
  }

  emit(event: HarnessEvent, ...args: unknown[]): void {
    const handlers = this.bus.get(event)
    if (!handlers) return
    // Copia defensiva: un handler puede desuscribirse durante la emisión.
    for (const handler of [...handlers]) handler(...args)
  }

  listTools(): Tool[] {
    return [...this.tools.values()]
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /** Vista sin handlers, apta para serializar hacia la UI o el CLI. */
  describeTools(): ToolDescriptor[] {
    return this.listTools().map(({ name, description, plugin }) => ({
      name,
      description,
      plugin
    }))
  }

  async execute(name: string, params: ToolParams = {}): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)

    const outcome = await runHookPipeline(this.hooks, tool, params)

    if (!outcome.proceed) {
      this.emit('tool:blocked', tool, outcome.params)
      const blocked: BlockedResult = {
        blocked: true,
        reason: (outcome.params.message as string) ?? 'hook rejected action',
        requiresConfirmation: outcome.params.requiresConfirmation === true
      }
      return blocked
    }

    this.emit('tool:executing', tool, outcome.params)
    try {
      const result = await tool.handler(outcome.params)
      this.emit('tool:done', tool, result)
      return result
    } catch (err) {
      this.emit('tool:failed', tool, err)
      throw err
    }
  }

  /** Solo para tests — limpia tools, hooks y suscriptores. */
  reset(): void {
    this.tools.clear()
    this.hooks = []
    this.bus.clear()
    this.hooksSealed = false
  }
}

/** Factory: cada llamada produce un harness aislado. Preferido en tests. */
export function createHarness(): Harness {
  return new Harness()
}
