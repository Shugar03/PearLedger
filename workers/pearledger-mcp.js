/**
 * PearLedger MCP — expone las 8 tools del harness vía Model Context Protocol (stdio).
 *
 * CDD: schemas alineados a contracts/tools.contract.json (docs/PLUGIN_CONTRACT.md).
 * TDD: createPearledgerMcpServer() testeable in-process (tests/mcp.protocol.test.js).
 *
 * Uso:
 *   node workers/pearledger-mcp.js           # servidor stdio
 *   node workers/pearledger-mcp.js --status  # health + tools
 *   node workers/pearledger-mcp.js --setup   # guía de config
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { harness, loadPlugins, expectedToolNames } from '../dist/harness/loader.js'
import {
  contractTool,
  contractToolNames,
  loadToolsContract
} from '../contracts/load-contract.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
// Cursor MCP often ignores mcp.json `cwd`; pin process.cwd() to the repo root.
if (process.cwd() !== root) {
  process.chdir(root)
}

/** @type {Record<string, Record<string, z.ZodTypeAny>>} */
export const TOOL_INPUT = {
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

function jsonResult(data) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    ]
  }
}

function errorResult(err) {
  const message = err instanceof Error ? err.message : String(err)
  return {
    isError: true,
    content: [{ type: 'text', text: message }]
  }
}

/**
 * Zod schema from TOOL_INPUT shape + CDD requiredAnyOf (si aplica).
 * @param {string} toolName
 * @param {Record<string, z.ZodTypeAny>} shape
 */
export function schemaForTool(toolName, shape) {
  let schema = z.object(shape)
  const anyOf = contractTool(toolName).requiredAnyOf
  if (anyOf?.length) {
    schema = schema.refine(
      (data) =>
        anyOf.some((group) =>
          group.every((key) => {
            const v = data[key]
            return v !== undefined && v !== null && v !== ''
          })
        ),
      {
        message: `${toolName} requires one of: ${anyOf
          .map((g) => g.join('+'))
          .join(' | ')}`
      }
    )
  }
  return schema
}

function assertContractAlignment() {
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
  // Fail-soft plugins can leave live registry incomplete — do not advertise a partial MCP.
  if (JSON.stringify(fromContract) !== JSON.stringify(fromLive)) {
    throw new Error(
      `[pearledger-mcp] CDD drift: contract ≠ live harness.listTools()\ncontract=${fromContract}\nlive=${fromLive}`
    )
  }
}

/**
 * Construye el McpServer con tools del harness (sin conectar transporte).
 * Usado por stdio entrypoint y por tests TDD.
 */
export async function createPearledgerMcpServer() {
  await loadPlugins()
  assertContractAlignment()

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
      async (args) => {
        try {
          const params =
            args && typeof args === 'object'
              ? /** @type {Record<string, unknown>} */ (args)
              : {}
          const result = await harness.execute(tool.name, params)
          return jsonResult(result)
        } catch (err) {
          return errorResult(err)
        }
      }
    )
  }

  return server
}

function printSetupGuide() {
  const entry = path.join(root, 'workers', 'pearledger-mcp.js')
  console.error(`PearLedger MCP — setup

Cursor (~/.cursor/mcp.json) o Claude Desktop:

{
  "mcpServers": {
    "pearledger": {
      "command": "node",
      "args": ["--use-system-ca", "--env-file=.env", "${entry.replace(/\\/g, '/')}"],
      "cwd": "${root.replace(/\\/g, '/')}"
    }
  }
}

Opcional en paralelo (track WDK oficial):
  npm run wdk:mcp

Scripts:
  npm run mcp          # arranca este servidor (stdio)
  npm run mcp:status   # lista tools sin bloquear
  npm run test:mcp     # CDD + TDD
`)
}

async function printStatus() {
  await loadPlugins()
  assertContractAlignment()
  const tools = harness.listTools().map((t) => ({
    name: t.name,
    plugin: t.plugin,
    description: t.description
  }))
  console.log(
    JSON.stringify(
      {
        ready: tools.length > 0,
        server: 'pearledger-mcp',
        protocol: 'MCP stdio JSON-RPC',
        contract: loadToolsContract().version,
        root,
        expected: expectedToolNames(),
        tools
      },
      null,
      2
    )
  )
}

async function startServer() {
  const server = await createPearledgerMcpServer()
  console.error(
    `[pearledger-mcp] ${harness.listTools().length} tools ready (stdio) — cwd=${root}`
  )
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

const args = process.argv.slice(2)

if (args.includes('--setup') || args.includes('setup')) {
  printSetupGuide()
} else if (args.includes('--status') || args.includes('status')) {
  await printStatus()
} else if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer()
}

export { startServer, printStatus }
