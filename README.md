# 🍐 PearLedger

**Agente local de operaciones financieras, tesorería y logística P2P**

Hackathon Aleph 2026 — Local-first · Gasless · P2P · Soberanía operativa

> Las operaciones financieras y logísticas siguen atrapadas entre burocracia manual y vulnerabilidad de la nube. PearLedger propone operaciones agénticas soberanas: IA local ejecuta OCR, conciliación y pagos P2P sin comisiones, sin servidor central, sin gas nativo y sin telemetría saliente.

## Quickstart

```bash
# 1. Clonar e instalar
git clone https://github.com/Shugar03/PearLedger.git
cd PearLedger
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar: PIMLICO_API_KEY, SEPOLIA_RPC_URL, etc.

# 3. Descargar modelos QVAC (~5 GB)
npm run models:download

# 4. Mintear pear:// key (requiere Pear CLI v3)
pear touch
# → Reemplazar el campo `upgrade` de package.json con la clave obtenida

# 5. Desarrollo local (Node)
npm run dev -- ingest ./workspace/invoices/factura.pdf
npm run dev -- forecast --sku ABC-123
npm run dev -- pay --vendor 0x... --amount 250
npm run dev -- balance
npm run dev -- tools --json

# 6. Dashboard en vivo (dev server, http://127.0.0.1:7331)
npm run dashboard

# 7. Producción bajo Bare + binario standalone
npm start                # bare dist/bin.js
npm run make             # binario del host actual

# 8. Publicar e instalar vía P2P
npm run pear:build       # deployment/ con package.json + by-arch/<host>/app/
pear stage <link> ../pearledger-deployment
pear install pear://<key>
```

## Arquitectura

Basado en [hello-pear-bare @ `variant/daemon`](https://github.com/holepunchto/hello-pear-bare/tree/variant/daemon) — short-lived CLI con updater daemon detached.

Dos árboles de código, una frontera explícita entre ellos:

```
src/                el programa — TypeScript para Bare y Node, lo compila tsc
├── bin.ts          entrypoint Bare/Pear  →  dist/bin.js
├── dev.ts          entrypoint Node       →  dist/dev.js
├── core/      @core       harness: registro de tools, bus, pipeline de hooks
├── config/    @config     único punto de lectura del entorno (validado con zod)
├── shared/    @shared     logger (stderr), paths (sin cwd), metadatos
├── plugins/   @plugins    invoice-ops · procurement-forecast · wdk-settlement
├── cli/       @cli        comandos puros + un solo parser + presentación
├── dashboard/ @dashboard  dev server node:http + SSE — servidor, nada de HTML
├── ipc/       @ipc        fachada que consumen Electron y el dashboard
├── pear/      @pear       ciclo de vida del runtime Pear y del updater OTA
├── workers/   @workers    MCP server de WDK
└── scripts/               utilidades que se compilan y se ejecutan (smoke, seed…)

ui/                 la interfaz — React + Vite, tres superficies
├── dashboard/      el producto      → dist/dashboard/web/  (lo sirve el harness)
├── deck/           pitch 3 min      → dist/pitch/deck/
├── site/           landing pública  → dist/pitch/site/
└── electron/       shell de escritorio del dashboard (main + preload)

scripts/            tooling del repo, se ejecuta sin compilar (build, lint:rules)
contracts/          contrato de tools, congelado y verificado en tests
docs/               documentación y el pitch deck en .pptx
workspace/          SOLO datos del usuario (facturas, órdenes de compra, stock)
dist/               salida del build — es lo que ejecutan Bare y Node
                    dist/dashboard/web/ ← bundle del renderer, lo emite Vite
                    dist/pitch/        ← deck y landing, fuera del bundle P2P
```

La frontera entre los dos árboles es el puente `window.pear`, con dos
implementaciones — HTTP + SSE en el navegador, IPC en Electron — y un solo
bundle React para las dos superficies. `ui/` no importa nada de `src/` en
tiempo de ejecución, y `src/` no escribe una línea de HTML.

Los tests viven junto al código que prueban (`src/**/*.test.ts`) y corren con
`node:test` sobre `dist/`.

Capas: QVAC SDK para OCR/LLM/RAG local · WDK para pagos gasless en USDt · Bare
como runtime de producción (sin Node) · Pear `variant/daemon` para el OTA P2P.

Las reglas de código son obligatorias y se verifican en CI: ver
[`CONVENTIONS.md`](CONVENTIONS.md) y `npm run lint:rules`.

### Plugins (filosofía Cordis — sin dependencia)

| Plugin | Tools | Track |
|--------|-------|-------|
| `plugin-invoice-ops` | `parse_invoice`, `match_purchase_order` | QVAC |
| `plugin-procurement-forecast` | `check_inventory`, `run_usage_forecast`, `draft_purchase_order` | QVAC Pipeline |
| `plugin-wdk-settlement` | `get_wallet_balance`, `quote_payment`, `execute_gasless_payment` | WDK |

## Permalinks para el jurado

| Track | Archivo clave |
|-------|---------------|
| **QVAC OCR** | [`src/plugins/invoice-ops/ocr.ts`](src/plugins/invoice-ops/ocr.ts) |
| **QVAC RAG** | [`src/plugins/invoice-ops/matcher.ts`](src/plugins/invoice-ops/matcher.ts) |
| **WDK Paymaster** | [`src/plugins/wdk-settlement/paymaster.ts`](src/plugins/wdk-settlement/paymaster.ts) |
| **WDK Hooks >$1k** | [`src/core/hooks.ts`](src/core/hooks.ts) |
| **Pear daemon/OTA** | [`src/pear/app.ts`](src/pear/app.ts) |
| **Pear CLI entry** | [`src/bin.ts`](src/bin.ts) |
| **Harness core** | [`src/core/harness.ts`](src/core/harness.ts) |
| **Dashboard + dev server** | [`src/dashboard/server.ts`](src/dashboard/server.ts) |
| **Pear CI** | [`.github/workflows/pear-ci.yml`](.github/workflows/pear-ci.yml) |

## Stack tecnológico y factibilidad

### ✅ Factible para hackathon (24h)

| Componente | Versión | Factibilidad | Notas |
|------------|---------|--------------|-------|
| **Pear CLI v3 + variant/daemon** | Pear v3 | ✅ Alta | Template probado (`hello-pear-bare`). OTA con `delay:0` en dev. |
| **QVAC SDK** | `@qvac/sdk ^0.17` | ✅ Alta | OCR + LLM + embeddings en local. Node ≥22.17. ~5 GB modelos. |
| **WDK CLI + MCP** | `1.0.0-beta.2` | ✅ Alta | 9 tools MCP, daemon local. Integración Claude Desktop documentada. |
| **WDK Gasless 7702** | mainnet | ⚠️ Media | Requiere API key Pimlico/Candide + USDt real para demo mainnet. |
| **WDK ERC-4337 Sepolia** | testnet | ✅ Alta | MOCK USDt en Sepolia — ideal para tests sin valor. |
| **Mini-harness TypeScript** | custom | ✅ Alta | ~30 líneas event bus + hooks. Sin Cordis (incompatible Bare). |

### Requisitos de hardware

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 8 GB | 16 GB |
| Disco | 5 GB | 10 GB SSD |
| Node | ≥22.17 | 22.18 LTS |

### Facturas en PDF

El OCR trabaja sobre imágenes. Si la factura es un PDF, el harness rasteriza su
primera página con lo que encuentre, en este orden:

```bash
pip install pymupdf     # lo que usa por defecto
# o, si preferís poppler:
#   Linux   sudo apt install poppler-utils
#   macOS   brew install poppler
#   Windows scoop install poppler
```

Sin ninguna de las dos, el error dice qué intentó y con qué resultado
(`pdftoppm: no está instalado · python: sin PyMuPDF`) en vez de dejarte
adivinar. Las imágenes — PNG, JPG, WEBP — no necesitan nada de esto.

### Gotchas críticos (del manifesto)

- **`ctx_size` ≥ 4096** en `qvac.config.json` — default 1024 trunca facturas
- **No combinar** structured output + tools en la misma llamada QVAC (HTTP 400)
- **`dryRun:false` explícito** en WDK `send_token` — default es simulación
- **`safeModulesVersion: '0.3.0'`** obligatorio en config WDK
- **Sepolia usa MOCK USDt** (`0xd077A400968890Eacc75cdc901F0356c943e4fDb`) — no USDt real
- **Pear `variant/daemon`** — NO usar `main` ni `variant/single-thread`
- **OTA demo**: `--update-window 0` + `await pear.updater.applyUpdate()`
- **Pay live Sepolia**: ver [`docs/WDK-SEPOLIA-LIVE-PAY.md`](./docs/WDK-SEPOLIA-LIVE-PAY.md) (`--dry-run=false`, faucet, `npm run test:p2-live`)

## Documentación externa

- [QVAC SDK](https://docs.qvac.tether.io/js-ts-sdk/)
- [QVAC OCR](https://docs.qvac.tether.io/ai-capabilities/ocr/)
- [WDK CLI](https://docs.wdk.tether.io/cli/)
- [WDK EIP-7702 Gasless](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-7702-gasless/)
- [Pear CLI v3](https://docs.pears.com/reference/pear/cli/)
- [hello-pear-bare variant/daemon](https://github.com/holepunchto/hello-pear-bare/tree/variant/daemon)

## Hoja de ruta 24h

Ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para el plan hora a hora del hackathon.

## Equipo y asignación

| Persona | Principios | Área |
|---------|------------|------|
| **Sebastian** | P3, P4 | Pear P2P/OTA + harness/plugins |
| **Antony** | P1, P2 | QVAC local + WDK gasless |
| **Evelin** | UI | Frontend Electron (modo secundario) |

Seguimiento interno: [`docs/TEAM.md`](docs/TEAM.md) · Contrato plugins: [`docs/PLUGIN_CONTRACT.md`](docs/PLUGIN_CONTRACT.md)

## Tracks y premios (Aleph 2026)

| Track | Premio | Estado skeleton |
|-------|--------|-----------------|
| Pear P2P + OTA | $1,500 | 🟡 Estructura lista |
| QVAC OCR + LLM | $1,000 | 🟡 Stubs + permalinks |
| QVAC Pipeline agéntico | $500 | 🟡 Harness + plugins |
| WDK MCP (Pista 1) | $1,000 | 🟡 wdk-worker stub |
| WDK Gasless (Pista 2) | $500 | 🟡 paymaster.ts stub |
| Vault Guardian | $500 | 🟡 input sanitization hook |

## Licencia

Apache-2.0

---

🍐 **PearLedger** — Local-first · Gasless · P2P · Soberanía operativa
