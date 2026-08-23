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
| **UI** | Capa humana — dashboard operativo (Electron secundario, mismo harness) | **Evelin** | Narrativa producto + demo jurado |

---

## Responsables

| Persona | Rol | Principios | Rama sugerida |
|---------|-----|------------|---------------|
| **Sebastian Villarreal Paz** | Infra Pear + Orquestador | P3, P4 | `feat/p3-p4-pear-harness` |
| **Antony** | IA local + Pagos gasless | P1, P2 | `feat/qvac-invoice-ops`, `feat/wdk-settlement` |
| **Evelin** | Frontend / UX operativo | UI (Electron) | `feat/ui-electron` |

---

## Mapa de archivos (quién toca qué)

### Sebastian — P3 + P4

| Archivo / carpeta | Responsabilidad |
|-------------------|-----------------|
| `src/pear/app.ts` | PearRuntime, Corestore, Hyperswarm, OTA |
| `src/bin.ts` | CLI shell, routing → `harness.execute()`, spawn updater |
| `src/core/harness.ts` | Event bus, registro tools, `execute()` |
| `src/core/loader.ts` | Carga plugins, fail-soft |
| `src/core/hooks.ts` | Hooks genéricos (sanitización, confirmación >$1k) |
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
| `src/plugins/invoice-ops/ocr.ts` | OCR Path B, `@qvac/sdk` |
| `src/plugins/invoice-ops/matcher.ts` | RAG / 3-way match |
| `src/plugins/invoice-ops/schema.ts` | Zod structured output |
| `src/plugins/procurement-forecast/algorithm.ts` | Forecast + draft PO |
| `src/plugins/procurement-forecast/index.ts` | Handlers QVAC (solo lógica) |
| `workers/main.js` | Worker QVAC si aplica |
| `qvac.config.json` | `ctx_size ≥ 4096`, paths modelos |
| `models/` | Descarga y paths locales (~5 GB) |
| `scripts/download-models.mjs` | Automatizar descarga si es posible |
| **P2 — WDK** | |
| `src/plugins/wdk-settlement/paymaster.ts` | Pimlico/Candide, 7702 + 4337 |
| `src/plugins/wdk-settlement/index.ts` | Handlers WDK (solo lógica) |
| `src/plugins/wdk-settlement/hooks.ts` | Hooks específicos WDK si hace falta |
| `workers/wdk-worker.js` | MCP server `wdk-mcp` |
| `.env` / `.env.example` | Keys Pimlico, seed, RPC (nunca commitear `.env`) |

**Reglas P1:** cero llamadas a OpenAI/Anthropic/cloud. Inferencia solo `@qvac/sdk`.  
**Reglas P2:** `dryRun:false` explícito en demo; `safeModulesVersion: '0.3.0'`; Sepolia = MOCK USDt.

**No tocar:** `src/pear/app.ts`, `src/core/harness.ts`, `src/bin.ts` (routing lo cablea Sebastian).

---

### Evelin — Frontend / UX (capa humana)

> **Nota de producto (UX senior):** CLI-first es correcto para P3/P4, hackathon y operación agéntica.  
> **Pero** un gerente de contabilidad o tesorero **no usará la consola** en el día a día.  
> La UI no es “nice to have”: es la capa que hace **creíble y usable** la visión del manifiesto para usuarios de negocio.  
> En el hackathon: CLI demuestra tracks técnicos; **UI cierra la historia** (“el tesorero aprueba con un clic”).

#### Por qué CLI + UI (no uno u otro)

| Dimensión | CLI (modo técnico) | UI (modo humano) |
|-----------|-------------------|------------------|
| **Usuario** | Dev, integrador, agente autónomo, jurado técnico | Gerente financiero, contador, tesorero |
| **Para qué** | Pear P2P, OTA, MCP, scripts, demo tracks | Revisar, aprobar, auditar, confiar |
| **Mental model** | “Ejecuto una operación” | “Veo estado → decido → confirmo” |
| **Barrera** | Baja para builders | **Alta** para contabilidad sin perfil técnico |

#### Arquitectura de capas (Evelin no duplica lógica)

```
┌─────────────────────────────────────────────────────────┐
│  CAPA HUMANA — Evelin (ui/ o electron/)                  │
│  Inbox · KPI tesorería · Aprobar pagos · Preview OCR    │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC / harness.execute() / eventos
┌───────────────────────▼─────────────────────────────────┐
│  CAPA AGENTE — Sebastian (harness/ P4)                  │
│  Orquestador · hooks · confirmación humana >$1k           │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│  CAPA INFRA — Sebastian (Pear/Bare P3)                  │
│  pear:// · OTA · local-first                              │
└─────────────────────────────────────────────────────────┘
         ↑ Antony implementa handlers en plugins (P1/P2)
```

- **Contador / gerente** → UI  
- **Agente + integraciones (MCP, scripts)** → CLI  
- **Hackathon / jurado** → CLI en video (QVAC, WDK, Pear) + **30–60 s UI al cierre**

#### Archivos y alcance

| Archivo / carpeta | Responsabilidad |
|-------------------|-----------------|
| `ui/` o `electron/` *(a crear)* | App Electron + dashboard Bento |
| `ui/dashboard/src/views/` | Pantallas (ver MVP abajo) |
| `ui/dashboard/src/components/` | Cards, sidebar, badges, modales |
| `ui/dashboard/src/lib/` | Puente a harness — **sin lógica OCR/pagos** |

**Reglas estrictas:**
- **No duplicar lógica:** OCR, RAG, pagos y forecast viven en plugins (Antony). La UI solo invoca y visualiza.
- **No tocar:** `src/pear/app.ts`, `src/core/harness.ts`, `src/bin.ts`, plugins de Antony.
- **Lenguaje de negocio en UI:** “Proveedor”, “Aprobar pago” — nunca `execute_gasless_payment` visible al usuario.
- **Modo secundario en arquitectura**, pero **must-have en narrativa de producto** para demo y usuarios reales.

#### MVP de UI (suficiente para hackathon + creíble para contabilidad)

No construir un ERP. Es un **dashboard de operaciones** (Bento del manifiesto):

| # | Pantalla | Propósito | Tool / dato del harness |
|---|----------|-----------|-------------------------|
| 1 | **Inbox** | Facturas PDF (drag & drop); estados: pendiente → parseada → conciliada → pagada | `parse_invoice`, `match_purchase_order` |
| 2 | **Detalle factura** | Preview PDF + campos OCR; discrepancias 3-way match; badge confianza | Resultado de plugins invoice-ops |
| 3 | **Pay queue** | Pagos propuestos por el agente; aprobar / rechazar (especialmente >$1k) | `quote_payment`, `execute_gasless_payment` + hook confirmación |
| 4 | **Forecast** | Cards SKU en riesgo de quiebre; propuesta de pedido | `run_usage_forecast`, `draft_purchase_order` |
| 5 | **Wallet** | Saldo USDt, última tx; **fee $0.00 visible** (refuerza P2 gasless) | `get_wallet_balance` |

**Priorización:**

| Nivel | Entregable |
|-------|------------|
| **Must (hackathon)** | Inbox + detalle factura + modal aprobar pago + clip 30–60 s en video |
| **Should** | Forecast cards + wallet |
| **Could (post-hackathon)** | Settings, multi-usuario, historial completo |

#### Principios UX (persona: tesorería / contabilidad)

1. **Confianza antes que velocidad** — Mostrar badge: “100% local · ningún byte salió del dispositivo” (P1).
2. **Confirmación explícita** — Reemplazar `[y/N]` de terminal por modal con monto, vendor y factura vinculada (> $1,000 USDt).
3. **Estados claros** — El usuario no ve “plugins”; ve flujos: *Recibida → Validada → Pagada*.
4. **Trazabilidad** — Quién aprobó, cuándo, hash/ID de factura asociada al pago.
5. **Errores en lenguaje humano** — No stack traces; mensajes accionables (“Revisar factura”, “Reintentar pago”).

#### Sistema de diseño (manifiesto — usar tal cual)

**Layout Bento (referencia):**

```
+-------------------+----------------------------------------+
|  [Sidebar]        |  [Pill Header & Status]   [Avatar]    |
|  - Inbox          |  +-----------+ +-----------+           |
|  - Pay            |  | KPI Card  | | KPI Card  |  (Bento)  |
|  - Forecast       |  +-----------+ +-----------+           |
|  - Settings       |  +----------------------+ +--------+  |
|                   |  | OCR Invoice (LIME)   | | Wallet |  |
|                   |  +----------------------+ +--------+  |
+-------------------+----------------------------------------+
```

**Paleta:**

| Rol | HEX | Uso |
|-----|-----|-----|
| Canvas | `#F3F4F6` / `#F8F9FA` | Fondo base |
| Surface (cards) | `#FFFFFF` | Cards con borde `#E5E7EB` 1px |
| Primary accent | `#C4F53C` / `#CCFF00` | Badges gasless, toggles, KPIs, banner OTA en terminal |
| Text primary | `#111315` / `#18181B` | Títulos, botones |
| Text muted | `#6B7280` / `#9CA3AF` | Subtítulos, ejes |

**Tipografía:** Inter o Plus Jakarta Sans · **Radius:** `rounded-2xl` / `rounded-3xl` (16–24px) · **Badges:** `rounded-full` (pills).

#### Contrato UI ↔ harness (coordinar con Sebastian)

Evelin **no espera** a que P3/P4 estén 100% — puede arrancar con **mocks** y conectar cuando Sebastian cablee el harness.

**Fase 1 — Mocks (bloque 0–8h):** UI con datos estáticos / JSON de ejemplo en `workspace/purchase-orders/`.

**Fase 2 — Integración (bloque 8–18h):** IPC Electron → backend que llama `harness.execute(tool, params)`.

Eventos útiles del harness (P4 — Sebastian los expone):

| Evento | Cuándo | Uso en UI |
|--------|--------|-----------|
| `tool:executing` | Antes del handler | Loading / spinner |
| `tool:done` | Handler OK | Actualizar pantalla con resultado |
| `tool:blocked` | Hook rechazó (ej. >$1k sin confirmar) | Abrir modal de confirmación |
| `tool:registered` | Plugin cargado | Debug / estado “agente listo” |

**Acciones UI → tools (mapeo):**

| Acción usuario | Tool |
|----------------|------|
| Subir / seleccionar PDF | `parse_invoice` → `match_purchase_order` |
| Ver inventario / forecast | `run_usage_forecast` |
| Aprobar pago | `execute_gasless_payment` con `{ confirmed: true }` |
| Ver saldo | `get_wallet_balance` |

Detalle técnico: [`PLUGIN_CONTRACT.md`](./PLUGIN_CONTRACT.md).

#### Checklist Evelin (24h)

| Bloque | Tarea | Estado |
|--------|-------|--------|
| 0–3h | Scaffold `ui/` o `electron/` + paleta/tokens CSS | [ ] |
| 3–8h | Wireframes Bento + Inbox + detalle factura (mock) | [ ] |
| 8–12h | Pay queue + modal confirmación >$1k | [ ] |
| 12–18h | Conectar IPC a harness (resultados reales) | [ ] |
| 18–24h | Pulido visual + clip 30–60 s para video | [ ] |

**Coordinación:** ping a Sebastian cuando necesites un endpoint IPC o evento nuevo en el harness — no improvisar llamadas directas a QVAC/WDK desde la UI.

---

## Contrato de integración (plugins ↔ harness)

Tools con nombres **congelados** — no renombrar sin acuerdo del equipo:

| Plugin | Tools | Owner handler |
|--------|-------|---------------|
| `plugin-invoice-ops` | `parse_invoice`, `match_purchase_order` | Antony |
| `plugin-procurement-forecast` | `check_inventory`, `run_usage_forecast`, `draft_purchase_order` | Antony |
| `plugin-wdk-settlement` | `get_wallet_balance`, `quote_payment`, `execute_gasless_payment` | Antony |

Sebastian cablea `src/bin.ts` → `harness.execute('<tool>', params)`.  
Antony implementa el `handler` dentro de cada plugin.

Ver detalle en [`PLUGIN_CONTRACT.md`](./PLUGIN_CONTRACT.md) *(pendiente — owner: Sebastian)*.

---

## Flujo Git (evitar conflictos)

```
main
├── feat/p3-p4-pear-harness   ← Sebastian (P3 + P4 — rama activa)
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
| 2:30–3:00 | Cierre + permalinks + **UI 30–60 s** (“tesorero aprueba con un clic”) | Sebastian + Evelin |

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

*Última actualización: 2026-08-22 · Mantenedor: Sebastian · Guía UX/UI Evelin: sección “Frontend / UX”*
