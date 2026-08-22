# SPEC P4 — Harness PearLedger (SDD)

> Fuente de verdad para tests en `tests/`. Cualquier cambio de comportamiento actualiza esta spec **antes** del código.

## H-01 — Registro de tools

**Given** un harness vacío  
**When** se registra `{ name: 'demo', description: '...', handler, plugin: 'test' }`  
**Then** `listTools()` contiene exactamente una tool con ese nombre

## H-02 — Tool duplicada

**Given** una tool ya registrada con nombre `demo`  
**When** se intenta registrar otra con el mismo nombre  
**Then** lanza `Tool already registered: demo`

## H-03 — Hooks prev-acción

**Given** un hook que retorna `{ proceed: false, params }`  
**When** se ejecuta cualquier tool  
**Then** el handler no corre y el resultado es `{ blocked: true }`

## H-04 — Event bus

**Given** un listener en `tool:done`  
**When** se ejecuta una tool exitosamente  
**Then** el listener recibe `(tool, result)`

## H-05 — Carga de plugins (integración)

**Given** `npm run build:ts` completado  
**When** se llama `loadPlugins()` desde `dist/harness/loader.js`  
**Then** se registran **8 tools** con nombres congelados (ver contrato)

## H-06 — Tools congeladas (contrato)

| Plugin | Tools |
|--------|-------|
| plugin-invoice-ops | `parse_invoice`, `match_purchase_order` |
| plugin-procurement-forecast | `check_inventory`, `run_usage_forecast`, `draft_purchase_order` |
| plugin-wdk-settlement | `get_wallet_balance`, `quote_payment`, `execute_gasless_payment` |

## H-07 — Confirmación pago > umbral

**Given** `HUMAN_CONFIRM_THRESHOLD_USDT=1000`  
**When** se ejecuta `execute_gasless_payment` con `{ amount: 1500, dryRun: false }` sin `confirmed: true`  
**Then** el hook bloquea la ejecución (`blocked: true`)

## H-08 — Pago bajo umbral

**Given** umbral 1000  
**When** `execute_gasless_payment` con `{ amount: 250, dryRun: true }`  
**Then** no bloquea y retorna preview dry-run

## H-09 — IPC bridge

**Given** plugins cargados  
**When** `executeTool('get_wallet_balance', {})`  
**Then** retorna objeto con campo `usdt`

## H-10 — Fail-soft loader

**Given** un plugin corrupto o ausente  
**When** `loadPlugins()`  
**Then** no lanza — registra warning y continúa con plugins válidos

## CLI-01 — Comando tools (dev)

**Given** `node cli/dev.mjs tools --json`  
**Then** stdout es JSON con array `tools` de length 8

## P3-01 — Build Bare Windows

**Given** `npm run build:ts && npm run make:win32-x64`  
**Then** existe `out/win32-x64/pearledger.exe`

## P3-02 — OTA log path

**Given** updater en `app.js`  
**Then** escribe en `<storage>/updates.log` vía `bare-file-logger`
