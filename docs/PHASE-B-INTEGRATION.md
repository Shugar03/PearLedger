# Fase B — Integración equipo

> **Estado:** scaffold listo en `main`. Antony y Evelin trabajan en ramas propias.

## Quick start

```bash
git pull origin main
npm ci
npm run build:ts
npm test
```

---

## Antony — P1 QVAC + P2 WDK

**Ramas sugeridas:**
- `feat/qvac-invoice-ops` → `ocr.ts`, `matcher.ts`, `schema.ts`
- `feat/wdk-settlement` → `paymaster.ts`
- `feat/procurement-forecast` → `algorithm.ts`

**Archivos tuyos (no tocar infra):**

| Archivo | Tool(s) |
|---------|---------|
| `src/plugins/invoice-ops/ocr.ts` | `parse_invoice` |
| `src/plugins/invoice-ops/matcher.ts` | `match_purchase_order` |
| `src/plugins/procurement-forecast/algorithm.ts` | `run_usage_forecast`, `check_inventory` |
| `src/plugins/wdk-settlement/paymaster.ts` | `get_wallet_balance`, `quote_payment`, `execute_gasless_payment` |

**Contrato congelado:** `docs/PLUGIN_CONTRACT.md` — no renombrar tools ni cambiar params sin avisar.

**Smoke tests (desde `main` + tu rama):**

```bash
cp .env.example .env          # completar PIMLICO_API_KEY, etc.
npm run models:download       # cuando QVAC esté listo
npm run dev -- tools --json
npm run dev -- ingest ./test.pdf
npm run dev -- forecast --sku SKU-001
npm run dev -- pay --vendor 0x742d35Cc6634C0532925a3b844Bc454e4438f44e --amount 250
npm run dev -- balance
```

**Reglas:**
- No editar `src/bin.ts`, `harness/`, `src/pear/app.ts`, `ui/`
- `dryRun: false` explícito para txs reales
- QVAC: structured output y tool calls en llamadas **separadas**

**Merge:** PR pequeño por plugin → rebase sobre `main` → `npm test` debe seguir en verde.

---

## Evelin — UI Electron

**Rama sugerida:** `feat/ui-electron`

**Scaffold:** `ui/` (React + Vite, dashboard Bento MVP)

```bash
npm run ui:install     # una vez
npm run ui:dev         # Electron
npm run ui:watch       # bundle en watch, para el dashboard web
```

**Arquitectura:**
- `ui/src/` — app React: `views/` (Inbox, Pagos, Forecast, Wallet), `components/`,
  `context/PearProvider.tsx`, `lib/pear-web.ts` (puente del navegador)
- `ui/electron/main.mjs` — IPC → `dist/ipc/bridge.js`
- `ui/electron/preload.mjs` — `window.pear.*` seguro
- `src/dashboard/` — servidor HTTP + SSE; sirve el bundle desde `dist/dashboard/web/`

**API disponible en renderer:**

```javascript
await window.pear.listTools()
await window.pear.execute('parse_invoice', { filePath: '...' })
await window.pear.pickInvoice()
window.pear.onEvent(({ type, tool, payload }) => { /* ... */ })
```

**MVP hackathon (must):**
1. Inbox + detalle factura
2. Modal aprobar pago >$1k (reemplazar prompt CLI)
3. Wallet con fee $0.00 visible

**Reglas:**
- No duplicar lógica OCR/pagos — solo invocar tools
- Lenguaje de negocio en UI (no mostrar nombres internos de tools al usuario)
- No tocar plugins ni harness core

---

## Sebastian — facilitación

- Code review: ¿rompe contrato de tools?
- Merges de infra en `main` solo por Sebastian
- CI verde antes de merge de integración

---

## Checklist integración E2E

- [x] Antony: `parse_invoice` retorna JSON usable por UI *(requiere `npm run models:download`)*
- [x] Antony: `pay` dry-run OK en Sepolia/mainnet stub *(código en main; smoke CLI OK)*
- [x] Evelin: Inbox procesa PDF/PNG vía `window.pear.execute` (Electron rasteriza PDF automáticamente)
- [x] Evelin: Modal confirmación >$1k con `confirmed: true` *(scaffold en `ui/`)*
- [x] Demo: CLI (jurado técnico) + UI 30–60 s (jurado producto) con fixture `workspace/invoices/sample.png`
