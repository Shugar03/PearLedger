/**
 * CDD helpers — contrato máquina de tools PearLedger.
 * Fuente: contracts/tools.contract.json ↔ docs/PLUGIN_CONTRACT.md
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { appRoot } from '@shared/paths.js'

export interface ToolSafety {
  confirmAboveUsdt?: number
  preferDryRun?: boolean
}

export interface ContractTool {
  required?: string[]
  optional?: string[]
  requiredAnyOf?: string[][]
  returnsHint?: string[]
  safety?: ToolSafety
}

export interface PearContract {
  version: string
  source: string
  server: string
  plugins: Record<
    string,
    {
      owner?: string
      tools: Record<string, ContractTool>
    }
  >
}

const CONTRACT_PATH = path.join(appRoot(), 'contracts', 'tools.contract.json')

let cached: PearContract | null = null

export function loadToolsContract(): PearContract {
  if (cached) return cached
  cached = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as PearContract
  return cached
}

/** Solo tests: olvida el cache. */
export function resetToolsContractCache(): void {
  cached = null
}

export function contractToolNames(contract: PearContract = loadToolsContract()): string[] {
  const names: string[] = []
  for (const plugin of Object.values(contract.plugins)) {
    names.push(...Object.keys(plugin.tools))
  }
  return names
}

export function contractFrozenByPlugin(
  contract: PearContract = loadToolsContract()
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [pluginId, plugin] of Object.entries(contract.plugins)) {
    out[pluginId] = Object.keys(plugin.tools)
  }
  return out
}

export function contractTool(
  toolName: string,
  contract: PearContract = loadToolsContract()
): ContractTool & { pluginId: string } {
  for (const [pluginId, plugin] of Object.entries(contract.plugins)) {
    const tool = plugin.tools[toolName]
    if (tool) return { ...tool, pluginId }
  }
  throw new Error(`Unknown tool in contract: ${toolName}`)
}

export function contractParamKeys(
  toolName: string,
  contract: PearContract = loadToolsContract()
): string[] {
  const t = contractTool(toolName, contract)
  const keys = new Set<string>()
  for (const k of t.required ?? []) keys.add(k)
  for (const k of t.optional ?? []) keys.add(k)
  for (const group of t.requiredAnyOf ?? []) {
    for (const k of group) keys.add(k)
  }
  return [...keys]
}
