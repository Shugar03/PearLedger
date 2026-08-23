# PearLedger MCP

Servidor **Model Context Protocol** del producto: las mismas 8 tools del harness
(`docs/PLUGIN_CONTRACT.md`) sobre stdio JSON-RPC.

| Servidor | Rol |
|----------|-----|
| `dist/workers/pearledger-mcp.js` | Tools PearLedger (invoice, forecast, settlement) |
| `dist/workers/wdk-worker.js` → `wdk-mcp` | Tools oficiales WDK (track hackathon) |

Pueden correr **en paralelo** en Cursor / Claude Desktop.

## Quick start

```bash
npm run mcp:status   # health + lista de tools
npm run mcp          # stdio (lo lanza el cliente MCP)
npm run mcp:setup    # imprime snippet de config
```

## Cursor

En `~/.cursor/mcp.json` (usa rutas absolutas; Cursor a menudo ignora `cwd`):

```json
{
  "mcpServers": {
    "pearledger": {
      "command": "node",
      "args": [
        "--use-system-ca",
        "--env-file=C:/Users/YOU/Downloads/pearledger/.env",
        "C:/Users/YOU/Downloads/pearledger/dist/workers/pearledger-mcp.js"
      ],
      "cwd": "C:/Users/YOU/Downloads/pearledger"
    }
  }
}
```

Reinicia MCP / Cursor. Deberías ver tools: `parse_invoice`, `match_purchase_order`,
`check_inventory`, `run_usage_forecast`, `draft_purchase_order`, `get_wallet_balance`,
`quote_payment`, `execute_gasless_payment`.

## Seguridad pagos

`execute_gasless_payment` respeta el hook del harness: montos altos piden
`confirmed: true`. Preferí `dryRun: true` hasta validar quote.

## CDD + TDD

| Enfoque | Artefacto | Qué garantiza |
|---------|-----------|---------------|
| **CDD** | `contracts/tools.contract.json` | Misma lista/params que `FROZEN_TOOLS` / `TOOL_INPUT` |
| **TDD** | `src/workers/mcp.protocol.test.ts` | `tools/list` + `tools/call` reales vía Client↔Server in-process |

```bash
npm run test:mcp
```

Specs: `MCP-C01…C07`, `MCP-T01…T10` (incluye independencia de cwd vía `appRoot` /
`workspaceDir`), más smoke `--status`.
