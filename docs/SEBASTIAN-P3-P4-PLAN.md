# Plan de ejecución P3 + P4 — Sebastian

> Rama: `feat/p3-p4-pear-harness`  
> Owners: Sebastian · No mergear a `main` hasta smoke test E2E  
> Compañeros en paralelo: Antony (`feat/qvac-*`, `feat/wdk-*`), Evelin (`feat/ui-electron`)

---

## Objetivo del sprint

Entregar la **columna vertebral** de PearLedger:

| Principio | Entregable medible |
|-----------|-------------------|
| **P3** | `pear install pear://<key>` + OTA demo con `--update-window 0` + CI stage |
| **P4** | CLI cableado → `harness.execute()` + 8 tools registradas + hooks activos |

**Definition of Done (DoD):**

```bash
npm run dev -- tools                    # lista 8 tools
npm run dev -- ingest ./test.pdf        # ejecuta plugin (stub o real de Antony)
npm run dev -- pay --vendor 0x.. --amount 250  # dry-run vía harness
npm run make:win32-x64                  # binario Bare (tu OS)
# post pear touch:
pear install pear://<key>               # instalación P2P
```

---

## Fases (orden estricto)

### Fase 0 — Aislamiento (15 min) ✅

- [x] Branch `feat/p3-p4-pear-harness` creada
- [ ] Comunicar al equipo: *“Sebastian trabaja en feat/p3-p4-pear-harness — no tocar harness/app/bin”*
- [ ] Antony/Evelin crean sus ramas desde `main` actual

---

### Fase 1 — P4 Fundación: Harness operativo (2–3 h)

**Por qué primero:** desbloquea a Antony (handlers) y Evelin (IPC/eventos) sin esperar Pear OTA.

#### 1.1 Resolver carga de plugins (TypeScript → runtime)

**Problema actual:** `loader.ts` importa `.js` pero archivos son `.ts`; plugins no cargan en Bare.

**Opciones (elegir una):**

| Opción | Pros | Contras |
|--------|------|---------|
| A) `tsc` pre-build + import `.js` | Compatible Bare | Paso build extra |
| B) Plugins en `.js` puro | Simple en Bare | Pierdes types en plugins |
| C) `node --experimental-strip-types` solo dev | Rápido dev | No producción Bare |

**Recomendación senior:** **A** — `npm run build:ts` antes de `make`; loader importa `dist/workspace/plugins/...`

**Tareas:**

- [ ] Ajustar `tsconfig.json` (`outDir: dist`, paths plugins)
- [ ] `loader.ts` → cargar desde `dist/` en prod, `.ts` en dev
- [ ] `registerDefaultHooks(harness)` en loader (sanitización + pago >$1k)
- [ ] Comando `tools` en `bin.mjs` → `harness.listTools()`

#### 1.2 Cablear routing CLI → harness

Reemplazar stubs en `bin.mjs`:

| Ruta | Flujo |
|------|-------|
| `ingest <file>` | `parse_invoice` → opcional `match_purchase_order` |
| `forecast [--sku]` | `run_usage_forecast` |
| `pay --vendor --amount` | `quote_payment` → `execute_gasless_payment` |
| `balance` | `get_wallet_balance` |

- [ ] Extraer `runHarness.ts` o módulo `cli/routes.mjs` (mantener `bin.mjs` delgado)
- [ ] Fail-soft: si plugin falla al cargar, CLI sigue con warning
- [ ] Output JSON estable para Evelin (`--json` flag opcional)

#### 1.3 Contrato IPC para Evelin (mínimo viable)

- [ ] Exportar eventos documentados en `harness/core.ts` (ya existen)
- [ ] Crear `harness/ipc-bridge.ts` *(stub)* — wrapper `executeTool(name, params)` para Electron
- [ ] Actualizar `PLUGIN_CONTRACT.md` con flag `--json`

**Commit sugerido:** `feat(p4): wire CLI to harness + plugin loader`

---

### Fase 2 — P3 Pear: Submodule + dev loop (1–2 h)

#### 2.1 Submodule hello-pear-bare

```bash
git submodule update --init --recursive
cd vendor/hello-pear-bare
git checkout variant/daemon
```

- [ ] Verificar que `variant/daemon` tiene el patrón updater que replicamos en `app.js`
- [ ] Documentar en README cualquier diff vs vendor

#### 2.2 Pear key + config

```bash
pear touch                    # mint pear://<key>
# Editar package.json → "upgrade": "pear://<key>"
# Editar pear.config.json → "key": "<key>", "channel": "alpha"
```

- [ ] Reemplazar `<YOUR_KEY_HERE>` en ambos archivos
- [ ] Smoke: `npm run dev -- help` con banner PearLedger

#### 2.3 Dev vs Bare

| Comando | Entorno |
|---------|---------|
| `npm run dev -- ...` | Node + strip-types (desarrollo rápido) |
| `npm start` | Bare (`bare bin.mjs`) |
| `npm run make:win32-x64` | Binario standalone Windows |

- [ ] Probar `npm run dev` en Windows
- [ ] Probar `npm start` si Bare instalado (`curl install.pears.com`)

**Commit sugerido:** `feat(p3): pear touch key + submodule variant/daemon`

---

### Fase 3 — P3 Build + OTA local (2–3 h)

#### 3.1 Build binario

```bash
npm run build:ts          # si aplica Fase 1
npm run make:win32-x64    # o tu arquitectura
```

- [ ] Binario en `./out/win32-x64/pearledger.exe`
- [ ] Ejecutar `--help` desde el binario

#### 3.2 OTA demo (local)

```bash
# Terminal 1 — updater daemon
npm run dev -- --updater --update-window 0 --storage ./.storage-demo

# Terminal 2 — CLI normal (dispara spawn updater)
npm run dev -- ingest ./test.pdf --update-window 0
```

- [ ] Verificar `<storage>/updates.log` con entradas
- [ ] Confirmar `await pear.updater.applyUpdate()` en `app.js` (ya implementado)
- [ ] SIGINT limpio — sin Corestore lock al reiniciar

#### 3.3 Stage + provision (pre-CI)

```bash
pear stage alpha
pear provision alpha
# Opcional: pear multisig (2-of-3) si hay tiempo
```

- [ ] `pear install pear://<key>` en máquina limpia o VM

**Commit sugerido:** `feat(p3): bare build + OTA demo --update-window 0`

---

### Fase 4 — P3 CI + hardening (1–2 h)

#### 4.1 GitHub Actions

- [ ] Completar `.github/workflows/pear-ci.yml` (quitar TODO)
- [ ] Secret `PEAR_PRIMARY_KEY` en repo Settings
- [ ] Build linux-x64 en CI + stage alpha

#### 4.2 Robustez

- [ ] `workers/updater.js` alineado con `app.js` (evitar duplicación — consolidar si hace falta)
- [ ] Documentar troubleshooting en README (INVALID_URL, Corestore lock, delay OTA)

**Commit sugerido:** `feat(p3): pear-ci stage/provision + PEAR_PRIMARY_KEY`

---

### Fase 5 — Integración con equipo (continuo)

| Momento | Acción |
|---------|--------|
| Tras Fase 1 | Merge `feat/p3-p4-pear-harness` → `main` **solo harness + routing** (Antony puede rebasear) |
| Antony listo | Smoke E2E `ingest` + `pay` con handlers reales |
| Evelin lista | Conectar `harness/ipc-bridge.ts` desde Electron |
| Pre-demo | Tag `v0.1.0-demo` + pear:// estable |

**Regla de merge:** PR pequeño por fase; no mezclar P3 OTA roto con P4 harness roto.

---

## Archivos que TOCAS en esta rama

```
app.js
bin.mjs                    (+ cli/routes.* si extraes)
harness/core.ts
harness/loader.ts
harness/hooks.ts
harness/ipc-bridge.ts      (nuevo)
workers/updater.js
pear.config.json
package.json               (upgrade, scripts)
scripts/make.js
.github/workflows/pear-ci.yml
tsconfig.json
docs/PLUGIN_CONTRACT.md    (flag --json, IPC)
docs/SEBASTIAN-P3-P4-PLAN.md (este archivo)
```

**NO tocar:**

```
workspace/plugins/**/ocr.ts | paymaster.ts | algorithm.ts  → Antony
ui/ | electron/                                          → Evelin
qvac.config.json | models/                               → Antony
.env                                                     → Antony (local)
```

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Plugins TS no cargan en Bare | `tsc` → `dist/` + loader dual dev/prod |
| `pear touch` sin Pear CLI instalado | Instalar desde install.pears.com; documentar |
| Build Bare falla en Windows | Probar `make:win32-x64` temprano (Fase 3) |
| Antony mergea antes que harness | Comunicar: merge Fase 1 primero |
| OTA delay 1h | Siempre `--update-window 0` en demo |
| Conflicto bin.mjs | Solo Sebastian edita routing en esta rama |

---

## Cronograma sugerido (hoy)

| Hora | Fase | Output |
|------|------|--------|
| T+0 | Fase 1.1–1.2 | `npm run dev -- tools` muestra 8 tools |
| T+2h | Fase 1.3 + merge parcial | Evelin puede IPC; Antony rebasea plugins |
| T+3h | Fase 2 | pear:// key mintada |
| T+5h | Fase 3 | binario + OTA log |
| T+7h | Fase 4 | CI verde |

---

## Checklist jurado (tu responsabilidad directa)

### Track Pear ($1,500)

- [ ] hello-pear-bare @ variant/daemon verificable
- [ ] pear:// activo + pear install
- [ ] pear stage + pear provision (+ multisig si alcanza)
- [ ] --update-window 0 en demo
- [ ] applyUpdate awaited
- [ ] Signal handlers + updates.log

### Track P4 / Pipeline ($500 base)

- [ ] harness.execute conectado a CLI
- [ ] 8 tools registradas
- [ ] Hooks >$1k + sanitización activos
- [ ] Permalinks: harness/core.ts, bin.mjs, workers/updater.js

---

## Próximo paso inmediato

```bash
git checkout feat/p3-p4-pear-harness
npm install
# Empezar Fase 1.1: arreglar loader.ts + cablear bin.mjs
```

---

*Owner: Sebastian · Rama: feat/p3-p4-pear-harness · 2026-08-22*
