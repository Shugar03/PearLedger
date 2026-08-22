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

#### 1.1 Resolver carga de plugins (TypeScript → runtime) ✅

- [x] `harness/runtime.ts` + loader dual dev/prod
- [x] `registerDefaultHooks()` en loader
- [x] `cli/dev.mjs` para desarrollo Node (sin Bare)
- [x] Plugins `register(_h: Harness)` unificado

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

- [x] Submodule clonado @ `variant/daemon` (`1f0cebf`)
- [x] Patrón updater replicado en `app.js` (ESM + `bootstrap-process.mjs`)

#### 2.2 Pear key + config

```bash
pear touch                    # mint pear://<key>
```

- [x] Pear CLI v3.2.0 instalado (`C:\Users\Facundo\AppData\Local\Programs\pear\pear.exe`)
- [x] Key: `pear://48oa46fuax77q7973h33kuj5ywp1m9obw71fcu78rhptisjs3hoy` en `package.json` + `pear.config.json`
- [x] Smoke: `npm run dev -- tools --json` → 8 tools

#### 2.3 Dev vs Bare

| Comando | Entorno |
|---------|---------|
| `npm run dev -- ...` | Node (`cli/dev.mjs`) |
| `npm start` | Bare (`bare bin.mjs`) |
| `npm run make:win32-x64` | Binario standalone Windows |

- [x] `npm run dev` OK (13/13 tests)
- [x] `pearledger.exe --json tools` OK (Bare bundle)

**Commit sugerido:** `feat(p3): pear touch key + submodule variant/daemon`

---

### Fase 3 — P3 Build + OTA local (2–3 h)

#### 3.1 Build binario

- [x] Binario en `./out/win32-x64/pearledger.exe`
- [x] `./out/win32-x64/pearledger.exe -v` → `pearledger v0.1.0`

#### 3.2 OTA demo (local)

```bash
# Terminal 1
./out/win32-x64/pearledger.exe --updater --update-window 0 --storage ./.storage-demo

# Terminal 2
./out/win32-x64/pearledger.exe --update-window 0 --storage ./.storage-demo --json tools
```

- [x] `.storage-demo/updates.log` creado (vacío sin update remoto — esperado)
- [x] `await pear.updater.applyUpdate()` en `app.js`

#### 3.3 Stage + provision (pre-CI)

```bash
pear stage pear://48oa46... --ignore node_modules,.git,out,dist,.storage-demo,vendor
pear info pear://48oa46...
```

- [x] Stage v55: `pear://0.55.48oa46fuax77q7973h33kuj5ywp1m9obw71fcu78rhptisjs3hoy`
- [ ] `pear provision` (requiere production verlink / multisig — CI documentado)

**Commit sugerido:** `feat(p3): bare build + OTA demo --update-window 0`

---

### Fase 4 — P3 CI + hardening (1–2 h)

#### 4.1 GitHub Actions

- [x] `.github/workflows/pear-ci.yml` — build:ts, npm test, make:linux-x64, pear stage
- [ ] Secret `PEAR_PRIMARY_KEY` en repo Settings (pendiente equipo)

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
