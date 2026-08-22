/**
 * PearLedger — Mini-Harness (filosofía Cordis, sin dependencia)
 * Event Bus minimal (~30 líneas) para registro de tools y hooks prev-a-acción.
 */

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

export interface ToolDefinition {
  name: string
  description: string
  handler: ToolHandler
  plugin: string
}

export type HookHandler = (context: {
  tool: string
  args: Record<string, unknown>
}) => Promise<{ proceed: boolean; reason?: string }>

export class Harness {
  private tools = new Map<string, ToolDefinition>()
  private hooks: HookHandler[] = []

  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
  }

  registerHook(hook: HookHandler): void {
    this.hooks.push(hook)
  }

  listTools(): ToolDefinition[] {
    return [...this.tools.values()]
  }

  async execute(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`)
    }

    for (const hook of this.hooks) {
      const result = await hook({ tool: toolName, args })
      if (!result.proceed) {
        throw new Error(result.reason ?? `Hook blocked execution of ${toolName}`)
      }
    }

    return tool.handler(args)
  }
}

export const harness = new Harness()
