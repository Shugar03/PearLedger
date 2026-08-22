/**
 * CDD helpers — contrato máquina de tools PearLedger.
 * Fuente: contracts/tools.contract.json ↔ docs/PLUGIN_CONTRACT.md
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT_PATH = path.join(root, 'contracts', 'tools.contract.json')

/** @typedef {{ required?: string[], optional?: string[], requiredAnyOf?: string[][], returnsHint?: string[], safety?: Record<string, unknown> }} ToolContract */
/** @typedef {{ version: string, source: string, server: string, plugins: Record<string, { owner?: string, tools: Record<string, ToolContract> }> }} PearContract */

/** @returns {PearContract} */
export function loadToolsContract() {
  return JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'))
}

/** @param {PearContract} [contract] */
export function contractToolNames(contract = loadToolsContract()) {
  /** @type {string[]} */
  const names = []
  for (const plugin of Object.values(contract.plugins)) {
    names.push(...Object.keys(plugin.tools))
  }
  return names
}

/** @param {PearContract} [contract] */
export function contractFrozenByPlugin(contract = loadToolsContract()) {
  /** @type {Record<string, string[]>} */
  const out = {}
  for (const [pluginId, plugin] of Object.entries(contract.plugins)) {
    out[pluginId] = Object.keys(plugin.tools)
  }
  return out
}

/**
 * @param {string} toolName
 * @param {PearContract} [contract]
 * @returns {ToolContract & { plugin: string }}
 */
export function contractTool(toolName, contract = loadToolsContract()) {
  for (const [pluginId, plugin] of Object.entries(contract.plugins)) {
    if (plugin.tools[toolName]) {
      return { plugin: pluginId, ...plugin.tools[toolName] }
    }
  }
  throw new Error(`Unknown tool in contract: ${toolName}`)
}

/**
 * Params declarados en el contrato (required + optional + requiredAnyOf flat).
 * @param {string} toolName
 * @param {PearContract} [contract]
 */
export function contractParamKeys(toolName, contract = loadToolsContract()) {
  const t = contractTool(toolName, contract)
  const keys = new Set([...(t.required ?? []), ...(t.optional ?? [])])
  for (const group of t.requiredAnyOf ?? []) {
    for (const k of group) keys.add(k)
  }
  return [...keys].sort()
}

export { CONTRACT_PATH }
