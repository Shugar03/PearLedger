/**
 * Mini-harness estilo Cordis — Event Bus + registro de tools.
 * Cordis NO se importa como dependencia; se replica el patrón desacoplado.
 */

export type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>

export interface Tool {
  name: string
  description: string
  handler: ToolHandler
  plugin: string
}

export type HookFn = (
  tool: Tool,
  params: Record<string, unknown>
) => Promise<{ proceed: boolean; params: Record<string, unknown> }>

type EventHandler = (...args: unknown[]) => void

export class Harness {
  private tools = new Map<string, Tool>()
  private hooks: HookFn[] = []
  private bus = new Map<string, Set<EventHandler>>()

  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
    this.emit('tool:registered', tool)
  }

  registerHook(fn: HookFn): void {
    this.hooks.push(fn)
  }

  on(event: string, handler: EventHandler): void {
    if (!this.bus.has(event)) this.bus.set(event, new Set())
    this.bus.get(event)!.add(handler)
  }

  emit(event: string, ...args: unknown[]): void {
    this.bus.get(event)?.forEach((h) => h(...args))
  }

  listTools(): Tool[] {
    return [...this.tools.values()]
  }

  async execute(name: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)

    let ctx = { proceed: true, params: { ...params } }
    for (const hook of this.hooks) {
      ctx = await hook(tool, ctx.params)
      if (!ctx.proceed) {
        this.emit('tool:blocked', tool, ctx.params)
        return {
          blocked: true,
          reason: (ctx.params.message as string) ?? 'hook rejected action',
          requiresConfirmation: ctx.params.requiresConfirmation ?? false
        }
      }
    }

    this.emit('tool:executing', tool, ctx.params)
    const result = await tool.handler(ctx.params)
    this.emit('tool:done', tool, result)
    return result
  }

  /** Solo para tests — limpia tools y hooks. */
  reset(): void {
    this.tools.clear()
    this.hooks = []
    this.bus.clear()
  }
}

export const harness = new Harness()
