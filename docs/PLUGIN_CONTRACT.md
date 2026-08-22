# Contrato de plugins — PearLedger harness (P4)

> Owner: **Sebastian**. Consumidores: **Antony** (handlers P1/P2), **Evelin** (UI vía CLI/IPC).  
> No cambiar nombres de tools ni shapes de params sin actualizar `docs/TEAM.md`.

---

## API del harness

```typescript
// harness/core.ts
harness.registerTool({ name, description, handler, plugin })
harness.registerHook(fn)
harness.execute(name, params) → Promise<unknown>
harness.listTools() → Tool[]
```

Hooks reciben `(tool, params)` y devuelven `{ proceed: boolean, params }`.

---

## Formato de plugin

Cada plugin vive en `workspace/plugins/<nombre>/` y exporta:

```typescript
export const name = 'plugin-xxx'

export async function register(h: Harness): Promise<void> {
  h.registerTool({
    name: 'tool_name',
    description: '...',
    plugin: name,
    handler: async (params) => { /* implementación */ },
  })
}
```

O usar helper:

```typescript
import { registerTools } from '../../../harness/loader.js'

export async function register() {
  registerTools([{ name, description, handler }], name)
}
```

---

## Tools registradas (congeladas)

### `plugin-invoice-ops` — Antony

| Tool | Params | Returns |
|------|--------|---------|
| `parse_invoice` | `{ filePath: string }` | `{ invoice, rawTextPreview? }` |
| `match_purchase_order` | `{ invoiceId: string }` o `{ invoice: object }` | `{ matched, purchaseOrderId?, confidence, discrepancies }` |

### `plugin-procurement-forecast` — Antony

| Tool | Params | Returns |
|------|--------|---------|
| `check_inventory` | `{ sku?: string }` | `InventoryItem[]` |
| `run_usage_forecast` | `{ sku?: string }` | `ForecastResult[]` |
| `draft_purchase_order` | `{ forecast: ForecastResult }` | `string` (texto PO) |

### `plugin-wdk-settlement` — Antony

| Tool | Params | Returns |
|------|--------|---------|
| `get_wallet_balance` | `{ network?: 'mainnet' \| 'sepolia' }` | `{ usdt, native, address, network }` |
| `quote_payment` | `{ to, amount, network? }` | `{ fee, sponsored, paymaster, ... }` |
| `execute_gasless_payment` | `{ to, amount, dryRun?, confirmed? }` | `{ status, txHash?, ... }` |

> Pagos > $1,000 USDt: hook de confirmación requiere `confirmed: true` o TTY interactivo.

---

## Mapeo CLI → tool (Sebastian)

| Comando CLI | Tool(s) |
|-------------|---------|
| `pearledger ingest <file>` | `parse_invoice` → opcional `match_purchase_order` |
| `pearledger forecast [--sku]` | `run_usage_forecast` |
| `pearledger pay --vendor --amount` | `quote_payment` → `execute_gasless_payment` |
| `pearledger balance` | `get_wallet_balance` |
| `pearledger tools` | `harness.listTools()` |

### Flag `--json`

Salida machine-readable para Evelin (UI / IPC):

```bash
npm run dev -- tools --json
npm run dev -- ingest ./factura.pdf --json
```

---

## IPC bridge (Evelin)

[`harness/ipc-bridge.ts`](../harness/ipc-bridge.ts) — importar desde Electron main o tests Node:

```typescript
import { executeTool, listTools, onHarnessEvent, ensureHarnessReady } from './harness/ipc-bridge.js'

await ensureHarnessReady()
const result = await executeTool('parse_invoice', { filePath: '/path/to.pdf' })
onHarnessEvent('tool:done', (tool, result) => { /* update UI */ })
```

**UI scaffold:** `ui/` — `npm run ui:dev` expone `window.pear.execute()` vía preload.

Guía equipo: [`docs/PHASE-B-INTEGRATION.md`](./PHASE-B-INTEGRATION.md).

---

## Reglas

1. **Handlers no importan** `bin.mjs` ni `app.js`.
2. **No llamadas cloud** en plugins P1 (QVAC local only).
3. **QVAC:** structured output y tool calls en **llamadas separadas** (evitar HTTP 400).
4. **WDK:** `dryRun: false` explícito para txs reales; Sepolia usa MOCK USDt.
5. Plugins que fallen al cargar → warning en loader, CLI sigue (fail-soft en dev).

---

*Ver asignación completa en [`TEAM.md`](./TEAM.md)*
