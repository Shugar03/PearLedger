/**
 * PearLedger MCP — expone las 8 tools del harness vía Model Context Protocol (stdio).
 *
 * CDD: schemas alineados a contracts/tools.contract.json (docs/PLUGIN_CONTRACT.md).
 * TDD: createPearledgerMcpServer() testeable in-process.
 *
 * Uso:
 *   node dist/workers/pearledger-mcp.js           # servidor stdio
 *   node dist/workers/pearledger-mcp.js --status  # health + tools
 *   node dist/workers/pearledger-mcp.js --setup   # guía de config
 */

import process from 'node:process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createHarness } from '@core/harness.js'
import type { Harness } from '@core/harness.js'
import { loadPlugins } from '@core/loader.js'
import { FROZEN_TOOLS } from '@core/frozen-tools.js'
import { appRoot } from '@shared/paths.js'
import { ensureWorkspace } from '@shared/bootstrap.js'
import { getLogger, writeOut } from '@shared/logger.js'
import {
  contractTool,
  contractToolNames,
  loadToolsContract
} from '@workers/mcp-contract.js'

const log = getLogger('pearledger-mcp')

export const TOOL_INPUT: Record<string, Record<string, z.ZodTypeAny>> = {
  parse_invoice: {
    filePath: z
      .string()
      .describe('Ruta absoluta o relativa al PDF/PNG/JPG de la factura')
  },
  match_purchase_order: {
    invoiceId: z.string().optional().describe('ID / número de factura'),
    invoice: z
      .record(z.unknown())
      .optional()
      .describe('Objeto invoice parseado (alternativa a invoiceId)')
  },
  check_inventory: {
    sku: z.string().optional().describe('SKU opcional; sin él lista todo')
  },
  run_usage_forecast: {
    sku: z.string().optional().describe('SKU opcional a proyectar')
  },
  draft_purchase_order: {
    forecast: z
      .record(z.unknown())
      .optional()
      .describe('Resultado de run_usage_forecast (un ítem)'),
    sku: z.string().optional(),
    days: z.number().optional()
  },
  get_wallet_balance: {
    network: z
      .enum(['mainnet', 'sepolia'])
      .optional()
      .describe('Red WDK (default: sepolia en demo)')
  },
  quote_payment: {
    to: z.string().describe('Address del vendor (0x…)'),
    amount: z.union([z.string(), z.number()]).describe('Monto USDt'),
    network: z.enum(['mainnet', 'sepolia']).optional()
  },
  execute_gasless_payment: {
    to: z.string().describe('Address del vendor (0x…)'),
    amount: z.union([z.string(), z.number()]).describe('Monto USDt'),
    network: z.enum(['mainnet', 'sepolia']).optional(),
    dryRun: z
      .boolean()
      .optional()
      .describe('true = simulación (default seguro); false = on-chain'),
    confirmed: z
      .boolean()
      .optional()
      .describe('Obligatorio true si monto > 1000 USDt')
  }
}

function expectedToolNames(): string[] {
  return Object.values(FROZEN_TOOLS).flat()
}

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    ]
  }
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }]
  }
}

/** Zod schema from TOOL_INPUT shape + CDD requiredAnyOf (si aplica). */
export function schemaForTool(toolName: string, shape: Record<string, z.ZodTypeAny>) {
  let schema: z.ZodTypeAny = z.object(shape)
  const anyOf = contractTool(toolName).requiredAnyOf
  if (anyOf?.length) {
    schema = (schema as z.ZodObject<z.ZodRawShape>).refine(
      (data: Record<string, unknown>) =>
        anyOf.some((group) =>
          group.every((key) => {
            const v = data[key]
            return v !== undefined && v !== null && v !== ''
          })
        ),
      {
        message: `${toolName} requires one of: ${anyOf.map((g) => g.join('+')).join(' | ')}`
      }
    )
  }
  return schema
}

function assertContractAlignment(harness: Harness): void {
  const fromContract = contractToolNames().sort()
  const fromFrozen = expectedToolNames().sort()
  const fromMcp = Object.keys(TOOL_INPUT).sort()
  const fromLive = harness
    .listTools()
    .map((t) => t.name)
    .sort()

  if (JSON.stringify(fromContract) !== JSON.stringify(fromFrozen)) {
    throw new Error(
      `[pearledger-mcp] CDD drift: contract ≠ FROZEN_TOOLS\ncontract=${fromContract}\nfrozen=${fromFrozen}`
    )
  }
  if (JSON.stringify(fromContract) !== JSON.stringify(fromMcp)) {
    throw new Error(
      `[pearledger-mcp] CDD drift: contract ≠ TOOL_INPUT\ncontract=${fromContract}\nmcp=${fromMcp}`
    )
  }
  if (JSON.stringify(fromContract) !== JSON.stringify(fromLive)) {
    throw new Error(
      `[pearledger-mcp] CDD drift: contract ≠ live harness.listTools()\ncontract=${fromContract}\nlive=${fromLive}`
    )
  }
}

export interface PearledgerMcpHandle {
  server: McpServer
  harness: Harness
}

/**
 * Construye el McpServer con tools del harness (sin conectar transporte).
 * Usado por stdio entrypoint y por tests TDD.
 */
export async function createPearledgerMcpServer(): Promise<PearledgerMcpHandle> {
  ensureWorkspace()
  const harness = await loadPlugins(createHarness(), { seal: true })
  assertContractAlignment(harness)

  const contract = loadToolsContract()
  const server = new McpServer({
    name: contract.server === 'pearledger-mcp' ? 'pearledger' : contract.server,
    version: contract.version || '0.1.0'
  })

  for (const tool of harness.listTools()) {
    const shape = TOOL_INPUT[tool.name]
    if (!shape) {
      throw new Error(`[pearledger-mcp] missing TOOL_INPUT for ${tool.name}`)
    }

    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description || `PearLedger harness tool: ${tool.name}`,
        inputSchema: schemaForTool(tool.name, shape),
        annotations: {
          readOnlyHint: !['execute_gasless_payment', 'draft_purchase_order'].includes(
            tool.name
          ),
          destructiveHint: tool.name === 'execute_gasless_payment',
          openWorldHint: tool.name === 'execute_gasless_payment'
        }
      },
      async (args: unknown) => {
        try {
          const params =
            args && typeof args === 'object'
              ? (args as Record<string, unknown>)
              : {}
          const result = await harness.execute(tool.name, params)
          return jsonResult(result)
        } catch (err) {
          return errorResult(err)
        }
      }
    )
  }

  return { server, harness }
}

function printSetupGuide(): void {
  const entry = path.join(appRoot(), 'dist', 'workers', 'pearledger-mcp.js')
  const root = appRoot().replace(/\\/g, '/')
  log.info(
    `PearLedger MCP — setup

Cursor (~/.cursor/mcp.json) o Claude Desktop:

{
  "mcpServers": {
    "pearledger": {
      "command": "node",
      "args": [
        "--use-system-ca",
        "--env-file=${root}/.env",
        "${entry.replace(/\\/g, '/')}"
      ],
      "cwd": "${root}"
    }
  }
}

Opcional en paralelo (track WDK oficial):
  npm run wdk:mcp

Scripts:
  npm run mcp          # arranca este servidor (stdio)
  npm run mcp:status   # lista tools sin bloquear
  npm run test:mcp     # CDD + TDD
`
  )
}

export async function printStatus(): Promise<void> {
  const { harness } = await createPearledgerMcpServer()
  const tools = harness.listTools().map((t) => ({
    name: t.name,
    plugin: t.plugin,
    description: t.description
  }))
  writeOut(
    JSON.stringify(
      {
        ready: tools.length > 0,
        server: 'pearledger-mcp',
        protocol: 'MCP stdio JSON-RPC',
        contract: loadToolsContract().version,
        root: appRoot(),
        expected: expectedToolNames(),
        tools
      },
      null,
      2
    )
  )
}

export async function startServer(): Promise<void> {
  const { server, harness } = await createPearledgerMcpServer()
  log.info(
    `${harness.listTools().length} tools ready (stdio) — root=${appRoot()}`
  )
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

const args = process.argv.slice(2)

if (args.includes('--setup') || args.includes('setup')) {
  printSetupGuide()
} else if (args.includes('--status') || args.includes('status')) {
  await printStatus()
} else if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await startServer()
}
