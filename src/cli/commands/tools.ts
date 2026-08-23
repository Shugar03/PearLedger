/** Comando `tools` — lista las tools registradas en el harness. */
import type { Command } from '@cli/types.js'

export const tools: Command = async (_input, ctx) => {
  return { tools: ctx.harness.describeTools() }
}
