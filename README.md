# 🍐 PearLedger

**Agente local de operaciones financieras, tesorería y logística P2P**

> Local-first · Gasless · P2P · Soberanía operativa

Proyecto para **Aleph Hackathon 2026**. Combina IA local (QVAC), pagos gasless en USDt (WDK) y distribución P2P sin servidores (Pear/Bare).

---

## Visión

Las operaciones financieras y logísticas siguen atrapadas entre burocracia manual y vulnerabilidad de la nube. PearLedger propone **operaciones agénticas soberanas**: OCR, conciliación y pagos P2P sin comisiones, sin servidor central, sin gas nativo y sin telemetría saliente.

| Principio | Descripción |
|-----------|-------------|
| **P1 — Privacidad** | Facturas e inventario nunca salen del dispositivo (`@qvac/sdk` 100% local) |
| **P2 — Gasless** | USDt patrocinado vía Pimlico/Candide (EIP-7702 / ERC-4337) |
| **P3 — P2P** | Distribución `pear://<key>`, OTA vía `pear stage` + `pear provision` |
| **P4 — Plugins** | Harness minimal estilo Cordis — lógica de negocio en plugins enchufables |

---

## Quickstart

### Requisitos

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 8 GB | 16 GB |
| Disco | 5 GB | 10 GB SSD |
| Node.js | ≥ 22.17 | 22.18 LTS |
| Pear CLI | v3 | [install.pears.com](https://install.pears.com) |

### Instalación

```bash
git clone https://github.com/Shugar03/PearLedger.git
cd PearLedger
cp .env.example .env
npm install
```

### Instalación P2P (producción)

```bash
pear install pear://<key>   # reemplazar tras pear touch
pearledger help
```

### Comandos CLI

```bash
npm run dev -- help
npm run dev -- ingest ./workspace/invoices/factura.pdf
npm run dev -- forecast --sku SKU-001
npm run dev -- pay --vendor 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb --amount 250
npm run dev -- tools
```

---

## Arquitectura

```
bin.mjs (CLI)
    │
    ├── harness/          ← Event Bus + hooks (filosofía Cordis)
    │   ├── core.ts
    │   ├── loader.ts
    │   └── hooks.ts      ← confirmación humana >$1k USDt
    │
    ├── workspace/plugins/
    │   ├── plugin-invoice-ops/       ← QVAC OCR + RAG 3-way match
    │   ├── plugin-procurement-forecast/ ← inventario + forecast
    │   └── plugin-wdk-settlement/    ← Pimlico gasless USDt
    │
    └── workers/
        ├── main.js       ← QVAC worker
        ├── wdk-worker.js ← WDK worker
        └── updater.js    ← OTA + signal handlers
```

**Template base:** [hello-pear-bare @ variant/daemon](https://github.com/holepunchto/hello-pear-bare/tree/variant/daemon) (short-lived CLI + daemon hooks).

---

## Stack tecnológico

| Componente | Tecnología | Rol |
|------------|------------|-----|
| Runtime P2P | Bare + Pear CLI v3 | Binario único, distribución `pear://` |
| IA local | `@qvac/sdk ^0.17` | OCR, LLM, embeddings, RAG |
| Pagos | `@tetherto/wdk-cli` + gasless modules | MCP + USDt sin gas |
| Gasless EVM | EIP-7702 (mainnet) / ERC-4337 (Sepolia) | Pimlico o Candide |
| Orquestador | Harness TypeScript custom | Registro de tools + hooks |

### Permalinks clave (tracks del jurado)

| Track | Archivo |
|-------|---------|
| **QVAC OCR** | [`workspace/plugins/plugin-invoice-ops/ocr.ts`](workspace/plugins/plugin-invoice-ops/ocr.ts) |
| **QVAC RAG** | [`workspace/plugins/plugin-invoice-ops/matcher.ts`](workspace/plugins/plugin-invoice-ops/matcher.ts) |
| **WDK Paymaster** | [`workspace/plugins/plugin-wdk-settlement/paymaster.ts`](workspace/plugins/plugin-wdk-settlement/paymaster.ts) |
| **Harness** | [`harness/core.ts`](harness/core.ts) |
| **Pear CLI entry** | [`bin.mjs`](bin.mjs) |
| **OTA updater** | [`workers/updater.js`](workers/updater.js) |
| **Pear CI** | [`.github/workflows/pear-ci.yml`](.github/workflows/pear-ci.yml) |

---

## Modelos QVAC (descarga local)

Colocar en `./models/` (no versionados):

- **QWEN3_1_7B-Q4_0** (~1.1 GB) — tool calling
- **OCR_3B_MULTIMODAL_Q4_0** (~3 GB + mmproj) — facturas reales (Path B)
- **GTE_LARGE_FP16** (~670 MB) — embeddings RAG

Configurar `ctx_size ≥ 4096` en [`qvac.config.ts`](qvac.config.ts).

---

## Tracks y premios (Aleph 2026)

| Track | Premio | Estado |
|-------|--------|--------|
| Pear P2P + OTA | $1,500 | 🟡 skeleton |
| QVAC OCR + LLM | $1,000 + $500 | 🟡 skeleton |
| WDK MCP (Pista 1) | $1,000 | 🟡 skeleton |
| WDK Gasless (Pista 2) | $500 | 🟡 skeleton |
| Vault Guardian | $500 | ⬜ pendiente |

Checklist completo: [`docs/CHECKLIST.md`](docs/CHECKLIST.md)  
Hoja de ruta 24h: [`docs/ROADMAP-24H.md`](docs/ROADMAP-24H.md)

---

## Configuración WDK

```bash
# .env
PIMLICO_API_KEY=tu_key
WDK_SEED_PHRASE="..."
WDK_SAFE_MODULES_VERSION=0.3.0
PAYMASTER_ADDRESS=0x8888888888888888888888888888888888882402
USDT_MAINNET=0xdAC17F958D2e523a2206206994597C13D831ec7
USDT_MOCK_SEPOLIA=0xd077a40066800590F633c0000900f7F6cD0A10dB
```

> ⚠️ `send_token` usa `dryRun:true` por default. Usar `--execute` o `dryRun:false` para transacciones reales.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `pear install` INVALID_URL | Reemplazar placeholder en `package.json` tras `pear touch` |
| OCR trunca factura | Subir `ctx_size` a 4096+ en `qvac.config.ts` |
| QVAC error 400 | No combinar structured output + tools en la misma llamada |
| OTA no llega | Usar `delay:0` en dev; `await pear.updater.applyUpdate()` |
| Corestore lock | Añadir SIGINT/SIGTERM + `swarm.destroy()` en updater |
| Sepolia USDt falla | Usar MOCK USDt, no USDT real |

---

## Equipo

**Aleph Hackathon 2026** — [Shugar03/PearLedger](https://github.com/Shugar03/PearLedger)

Licencia: Apache-2.0
