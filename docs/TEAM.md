# Equipo PearLedger — Asignación y seguimiento

> Documento interno. Actualizar al cerrar cada bloque horario del hackathon.  
> Aleph Hackathon 2026 · Repo: [Shugar03/PearLedger](https://github.com/Shugar03/PearLedger)

---

## Principios del producto (manifiesto)

| ID | Principio | Owner | Track hackathon |
|----|-----------|-------|-----------------|
| **P1** | Privacidad absoluta (Local-First) — IA/OCR 100% local vía `@qvac/sdk`, sin APIs cloud | **Antony** | QVAC ($1,000 + $500 pipeline) |
| **P2** | Cero comisiones nativas (Gasless) — USDt vía Pimlico/Candide (7702 mainnet) o ERC-4337 Sepolia | **Antony** | WDK MCP ($1,000) + Gasless ($500) |
| **P3** | Distribución soberana (P2P) — Bare + Pear `variant/daemon`, `pear://<key>`, OTA P2P | **Sebastian** | Pear ($1,500) |
| **P4** | Arquitectura extensible — mini-harness + plugins (filosofía Cordis, sin dependencia) | **Sebastian** | QVAC Pipeline + base integración |
| **UI** | Modo secundario Electron / dashboard Bento (opcional demo) | **Evelin** | Presentación demo / jurado |

---

## Responsables

| Persona | Rol | Principios | Rama sugerida |
|---------|-----|------------|---------------|
| **Sebastian Villarreal Paz** | Infra Pear + Orquestador | P3, P4 | `feat/p3-pear-ota`, `feat/p4-harness` |
| **Antony** | IA local + Pagos gasless | P1, P2 | `feat/qvac-invoice-ops`, `feat/wdk-settlement` |
| **Evelin** | Frontend / UI demo | UI (Electron opcional) | `feat/ui-electron` |

---

## Mapa de archivos (quién toca qué)

### Sebastian — P3 + P4

| Archivo / carpeta | Responsabilidad |
|-------------------|-----------------|
| `app.js` | PearRuntime, Corestore, Hyperswarm, OTA |
| `bin.mjs` | CLI shell, routing → `harness.execute()`, spawn updater |
| `harness/core.ts` | Event bus, registro tools, `execute()` |
| `harness/loader.ts` | Carga plugins, fail-soft |
| `harness/hooks.ts` | Hooks genéricos (sanitización, confirmación >$1k) |
| `workers/updater.js` | Signal handlers, `updates.log` |
| `pear.config.json` | Channel + key Pear |
| `package.json` | Campo `upgrade`, scripts `make:*` |
| `scripts/make.js` | Build binarios Bare |
| `.github/workflows/pear-ci.yml` | Stage + provision CI |
| `.gitmodules` | Submodule `hello-pear-bare @ variant/daemon` |
| `docs/PLUGIN_CONTRACT.md` | Contrato de integración (crear/mantener) |

**No tocar sin avisar a Sebastian:** lo anterior + merges a `main` de infra Pear.

---

### Antony — P1 + P2

| Archivo / carpeta | Responsabilidad |
|-------------------|-----------------|
| **P1 — QVAC** | |
| `workspace/plugins/plugin-invoice-ops/ocr.ts` | OCR Path B, `@qvac/sdk` |
| `workspace/plugins/plugin-invoice-ops/matcher.ts` | RAG / 3-way match |
| `workspace/plugins/plugin-invoice-ops/schema.ts` | Zod structured output |
| `workspace/plugins/plugin-procurement-forecast/algorithm.ts` | Forecast + draft PO |
| `workspace/plugins/plugin-procurement-forecast/index.ts` | Handlers QVAC (solo lógica) |
| `workers/main.js` | Worker QVAC si aplica |
| `qvac.config.json` | `ctx_size ≥ 4096`, paths modelos |
| `models/` | Descarga y paths locales (~5 GB) |
| `scripts/download-models.mjs` | Automatizar descarga si es posible |
| **P2 — WDK** | |
| `workspace/plugins/plugin-wdk-settlement/paymaster.ts` | Pimlico/Candide, 7702 + 4337 |
| `workspace/plugins/plugin-wdk-settlement/index.ts` | Handlers WDK (solo lógica) |
| `workspace/plugins/plugin-wdk-settlement/hooks.ts` | Hooks específicos WDK si hace falta |
| `workers/wdk-worker.js` | MCP server `wdk-mcp` |
| `.env` / `.env.example` | Keys Pimlico, seed, RPC (nunca commitear `.env`) |

**Reglas P1:** cero llamadas a OpenAI/Anthropic/cloud. Inferencia solo `@qvac/sdk`.  
**Reglas P2:** `dryRun:false` explícito en demo; `safeModulesVersion: '0.3.0'`; Sepolia = MOCK USDt.

**No tocar:** `app.js`, `harness/core.ts`, `bin.mjs` (routing lo cablea Sebastian).

---

### Evelin — Frontend (modo secundario)

| Archivo / carpeta | Responsabilidad |
|-------------------|-----------------|
| `ui/` o `electron/` *(a crear)* | Dashboard Bento, sidebar, KPI cards |
| Paleta manifiesto | `#C4F53C` accent, `#F3F4F6` canvas, Inter/Plus Jakarta |
| Integración | Consumir mismos comandos/API del harness vía IPC o spawn CLI |

**Reglas UI:** modo secundario — el **modo primario es CLI**. La demo de 3 min puede mostrar 30 s de UI al final.  
**No duplicar lógica:** OCR, pagos y forecast viven en plugins; la UI solo visualiza resultados.

**Coordinación con Sebastian:** acordar contrato IPC/eventos antes de implementar pantallas.

---

## Contrato de integración (plugins ↔ harness)

Tools con nombres **congelados** — no renombrar sin acuerdo del equipo:

| Plugin | Tools | Owner handler |
|--------|-------|---------------|
| `plugin-invoice-ops` | `parse_invoice`, `match_purchase_order` | Antony |
| `plugin-procurement-forecast` | `check_inventory`, `run_usage_forecast`, `draft_purchase_order` | Antony |
| `plugin-wdk-settlement` | `get_wallet_balance`, `quote_payment`, `execute_gasless_payment` | Antony |

Sebastian cablea `bin.mjs` → `harness.execute('<tool>', params)`.  
Antony implementa el `handler` dentro de cada plugin.

Ver detalle en [`PLUGIN_CONTRACT.md`](./PLUGIN_CONTRACT.md) *(pendiente — owner: Sebastian)*.

---

## Flujo Git (evitar conflictos)

```
main
├── feat/p3-pear-ota          ← Sebastian
├── feat/p4-harness-wire      ← Sebastian  (mergear antes que plugins)
├── feat/qvac-invoice-ops     ← Antony
├── feat/wdk-settlement       ← Antony
└── feat/ui-electron          ← Evelin
```

1. Sebastian mergea **P4 (harness + routing)** primero.
2. Antony rebasea plugins encima.
3. Evelin rebasea UI cuando exista contrato IPC.
4. PRs pequeños (< 400 líneas ideal). Un track por PR si se puede.

---

## Seguimiento por bloque (24h)

Marcar `[x]` al completar. Actualizar fecha en el commit o comentario de PR.

### Bloque 0–3h — Setup

| Tarea | Owner | Estado |
|-------|-------|--------|
| `pear touch` + `pear://<key>` en package.json | Sebastian | [ ] |
| Submodule `hello-pear-bare` init | Sebastian | [ ] |
| Descargar modelos QVAC (~5 GB) | Antony | [ ] |
| API key Pimlico/Candide + `.env` | Antony | [ ] |
| Scaffold carpeta `ui/` o `electron/` | Evelin | [ ] |

### Bloque 3–8h — Core por track

| Tarea | Owner | Estado |
|-------|-------|--------|
| Harness → bin.mjs cableado | Sebastian | [ ] |
| `qvac.ocr()` factura real | Antony | [ ] |
| WDK Sepolia gasless smoke test | Antony | [ ] |
| Wireframes / layout Bento | Evelin | [ ] |

### Bloque 8–12h — Integración

| Tarea | Owner | Estado |
|-------|-------|--------|
| OTA demo `--update-window 0` | Sebastian | [ ] |
| RAG 3-way match | Antony | [ ] |
| WDK mainnet o Sepolia demo estable | Antony | [ ] |
| Pantallas Inbox / Pay / Forecast (mock → real) | Evelin | [ ] |

### Bloque 12–18h — End-to-end

| Tarea | Owner | Estado |
|-------|-------|--------|
| `pearledger ingest` E2E | Sebastian + Antony | [ ] |
| `pearledger pay` E2E | Sebastian + Antony | [ ] |
| UI conectada a resultados reales | Evelin | [ ] |

### Bloque 18–24h — Demo + submission

| Tarea | Owner | Estado |
|-------|-------|--------|
| `pear stage` + `provision` + CI | Sebastian | [ ] |
| Permalinks QVAC/WDK verificados | Antony | [ ] |
| Clip UI 30 s en video | Evelin | [ ] |
| Video 3 min completo | Todos | [ ] |
| Submission DoraHacks | Todos | [ ] |

---

## Segmentos del video demo (3 min)

| Tiempo | Contenido | Owner |
|--------|-----------|-------|
| 0:00–0:30 | Gancho / problema | Todos (1 voz) |
| 0:30–1:15 | Track QVAC — `ingest` local | Antony (CLI) |
| 1:15–2:00 | Track WDK — `pay` gasless | Antony (CLI) |
| 2:00–2:30 | Track Pear — OTA + `pear install` | Sebastian |
| 2:30–3:00 | Cierre + permalinks (+ UI 30 s opcional) | Sebastian + Evelin |

---

## Comunicación rápida

- **Cambio de nombre de tool o params** → ping en chat + actualizar este doc.
- **Bloqueo > 15 min** → avisar en chat, no improvisar en archivos ajenos.
- **Merge a `main`** → solo después de smoke test del comando afectado.

---

## Premios objetivo (referencia)

| Track | USD | Owner principal |
|-------|-----|-----------------|
| Pear P2P + OTA | $1,500 | Sebastian |
| QVAC OCR + LLM | $1,000 | Antony |
| QVAC Pipeline agéntico | $500 | Antony (+ harness Sebastian) |
| WDK MCP | $1,000 | Antony |
| WDK Gasless | $500 | Antony |
| Vault Guardian | $500 | Antony (wallet Bare) + Sebastian (hooks) |

---

*Última actualización: 2026-08-22 · Mantenedor: Sebastian*
