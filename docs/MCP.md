# PearLedger MCP

Servidor **Model Context Protocol** del producto: las mismas 8 tools del harness (`docs/PLUGIN_CONTRACT.md`) sobre stdio JSON-RPC.

| Servidor | Rol |
|----------|-----|
| `workers/pearledger-mcp.js` | Tools PearLedger (invoice, forecast, settlement) |
| `workers/wdk-worker.js` → `wdk-mcp` | Tools oficiales WDK (track hackathon) |

Pueden correr **en paralelo** en Cursor / Claude Desktop.

## Quick start

```bash
npm run mcp:status   # health + lista de tools
npm run mcp          # stdio (lo lanza el cliente MCP)
npm run mcp:setup    # imprime snippet de config
```

## Cursor

En `~/.cursor/mcp.json` (ajusta `cwd` a tu clone):

```json
{
  "mcpServers": {
    "pearledger": {
      "command": "node",
      "args": [
        "--use-system-ca",
        "--env-file=.env",
        "C:/Users/YOU/Downloads/pearledger/workers/pearledger-mcp.js"
      ],
      "cwd": "C:/Users/YOU/Downloads/pearledger"
    }
  }
}
```

Reinicia MCP / Cursor. Deberías ver tools: `parse_invoice`, `match_purchase_order`, `check_inventory`, `run_usage_forecast`, `draft_purchase_order`, `get_wallet_balance`, `quote_payment`, `execute_gasless_payment`.

## Claude Desktop

Misma forma en `claude_desktop_config.json` bajo `mcpServers`.

## Seguridad pagos

`execute_gasless_payment` respeta el hook del harness: montos altos piden `confirmed: true`. Preferí `dryRun: true` (o omitir `dryRun: false`) hasta validar quote.

## Relación con CLI / UI

```
Cliente MCP ──stdio──► pearledger-mcp ──► harness.execute()
CLI / Electron UI ─────────────────────► harness.execute()
```

Misma lógica; no duplicar handlers.

## CDD + TDD

| Enfoque | Artefacto | Qué garantiza |
|---------|-----------|---------------|
| **CDD** | `contracts/tools.contract.json` | Misma lista/params que `PLUGIN_CONTRACT` / `FROZEN_TOOLS` / `TOOL_INPUT` |
| **TDD** | `tests/mcp.protocol.test.js` | `tools/list` + `tools/call` reales vía Client↔Server in-process |

```bash
npm run test:mcp
```

Specs: `MCP-C01…C05` (contrato), `MCP-T01…T06` (protocolo), más smoke `--status`.
