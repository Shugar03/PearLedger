# Análisis técnico del stack — PearLedger

Documento de referencia para el equipo de hackathon. Resume investigación de documentación oficial y evaluación de factibilidad.

## 1. Pear Runtime (Bare + P2P OTA)

**Qué es:** Pear v3 separa el CLI de despliegue del runtime embebible (`pear-runtime`). Las apps se distribuyen vía `pear://<key>` sin app stores ni servidores centrales.

**Branch crítico:** `variant/daemon` de hello-pear-bare. El CLI foreground ejecuta la operación y sale; un daemon detached (`bare-daemon`) maneja OTA en background. Ideal para comandos one-shot como `pearledger ingest`.

**Factibilidad:** ✅ Alta. Template oficial documentado. Requiere Pear CLI v3 instalado y `pear touch` para mintear key.

**Riesgos:**
- OTA default tiene delay aleatorio hasta 1h → usar `--update-window 0` en demos
- `pear stage` en v3 NO mueve release pointer → usar `pear provision + pear multisig`
- Corestore lock sin signal handlers → implementado en `workers/updater.js`

**Docs:** https://docs.pears.com/reference/pear/cli/

---

## 2. QVAC SDK (@qvac/sdk ^0.17)

**Qué es:** SDK unificado de Tether para IA local: LLM (llama.cpp), OCR (ONNX/GGML), embeddings, RAG, traducción, TTS. Corre en Node ≥22.17, Bare y Expo.

**Uso en PearLedger:**
- **OCR Path B:** `OCR_3B_MULTIMODAL_Q4_0` para facturas reales (multimodal, ~3B + 1GB mmproj)
- **LLM:** `QWEN3_1_7B` para tool calling (balance latencia/razonamiento)
- **Embeddings:** `GTE_LARGE_FP16` para RAG sobre purchase-orders
- **ctx_size:** mínimo 4096 para facturas largas

**Factibilidad:** ✅ Alta para demo. Los modelos suman ~5 GB de descarga. RAM mínima 8 GB.

**Riesgos:**
- HTTP 400 si combinas structured output + tools en una llamada → dos llamadas secuenciales
- Vector store rechaza binarios → siempre pasar por OCR primero
- En Bare hay que registrar plugins explícitamente o usar `@qvac/bare-sdk`

**Docs:** https://docs.qvac.tether.io/js-ts-sdk/

---

## 3. WDK — Wallet Development Kit

### Pista 1: MCP Server (@tetherto/wdk-cli 1.0.0-beta.2)

**Qué es:** CLI local con daemon de wallet + servidor MCP (`wdk-mcp`) que expone 9+ tools a Claude Desktop/Code/OpenClaw.

**Tools relevantes:** `get_balance`, `send_token`, `get_address`, `get_history`

**Factibilidad:** ✅ Alta. Setup documentado: `wdk mcp setup --ai claude-desktop`

### Pista 2: Gasless Modules

**Mainnet — EIP-7702 (`wdk-wallet-evm-7702-gasless`):**
- EOA delegada como smart account vía Pimlico/Candide paymaster
- USDt mainnet: `0xdAC17F958D2ee523468220AC697809737E73D23ec7` (6 dec)
- Paymaster: `0x8888888888888888888888888888888888882402`

**Sepolia — ERC-4337 (`wdk-wallet-evm-erc-4337`):**
- EntryPoint v0.7 + MOCK USDt: `0xd077A400968890Eacc75cdc901F0356c943e4fDb`
  (live pay: `docs/WDK-SEPOLIA-LIVE-PAY.md`)

**Factibilidad:** ⚠️ Media-Alta. Sepolia es straightforward. Mainnet requiere API key + fondos USDt reales para demo.

**Riesgos:**
- `dryRun:true` es default en `send_token`
- First delegation EOA tiene race condition en nonce → nonce manager del SDK
- `safeModulesVersion: '0.3.0'` obligatorio

**Docs:** https://docs.wdk.tether.io/cli/

---

## 4. Mini-Harness (filosofía Cordis)

**Qué es:** Orquestador ligero (~30 líneas) con event bus, registro de tools y hooks pre-acción. Cordis NO se importa porque asume Node.js, no Bare.

**Implementación:** `src/core/harness.ts` + `src/core/hooks.ts`

**Hooks de seguridad:**
- Confirmación humana para pagos > $1,000 USDt
- Sanitización básica anti prompt-injection (Vault Guardian track)

**Factibilidad:** ✅ Alta. Código custom mínimo, sin dependencias externas.

---

## 5. Recomendación de priorización para 24h

1. **Hora 0-3:** Pear P2P funcional (pear touch, build, pear-ci)
2. **Hora 3-8:** QVAC OCR de una factura real (track más visible)
3. **Hora 8-12:** WDK Sepolia gasless (sin riesgo de fondos)
4. **Hora 12-18:** Conectar plugins al harness + CLI routing
5. **Hora 18-21:** OTA demo + signal handlers
6. **Hora 21-24:** Video + permalinks + submission

**MVP mínimo viable para jurado:** OCR local de factura + pago gasless Sepolia + `pear install pear://<key>` funcional.
