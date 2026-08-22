# Hoja de ruta de ejecución — 24 horas

## [00:00 – 03:00] Setup base & Pear P2P

- [x] Esqueleto basado en `hello-pear-bare @ variant/daemon`
- [ ] `pear touch` → mint `pear://<key>` → reemplazar en `package.json`
- [ ] Configurar `pear.config.json` con `channel: alpha`
- [ ] Verificar compilación: `npm run make`
- [ ] Configurar `PEAR_PRIMARY_KEY` en GitHub Secrets para pear-ci

## [03:00 – 08:00] Modelos QVAC

- [ ] Descargar QWEN3_1_7B (~1.1 GB)
- [ ] Descargar OCR_3B_MULTIMODAL_Q4_0 (Path B)
- [ ] Descargar GTE_LARGE_FP16 (~670 MB)
- [ ] Validar `ctx_size=4096` en qvac.config
- [ ] Probar `qvac.ocr()` con PDF de muestra

## [08:00 – 12:00] WDK Gasless & Paymaster

- [ ] Obtener API key Pimlico o Candide
- [ ] Probar `wdk-wallet-evm-7702-gasless` mainnet ($1 USDt test)
- [ ] Probar `wdk-wallet-evm-erc-4337` Sepolia + MOCK USDt
- [ ] Fijar `safeModulesVersion: '0.3.0'`
- [ ] Verificar quote cache TTL 2 min

## [12:00 – 18:00] Plugins & Harness

- [ ] Integrar harness en `src/bin.ts` routing
- [ ] `plugin-invoice-ops`: OCR + RAG + Zod
- [ ] `plugin-procurement-forecast`: forecast + draft PO
- [ ] `plugin-wdk-settlement`: balance + pay + hook >$1k
- [ ] Test: `pearledger ingest ./factura.pdf`

## [18:00 – 21:00] OTA, señales & robustez

- [ ] Signal handlers SIGINT/SIGTERM + `swarm.destroy()`
- [ ] `pear stage alpha` + `pear provision` + multisig 2-of-3
- [ ] OTA con `delay:0` / `--update-window 0`
- [ ] `await pear.updater.applyUpdate()` awaited
- [ ] Logs en `<storage>/updates.log`

## [21:00 – 24:00] Demo, docs & submission

- [ ] Video demo 3 min (script en README principal)
- [ ] Permalinks verificados por track
- [ ] Checklist jurado completo
- [ ] Publicar `pear://<key>` estable vía pear-ci
- [ ] Documentar hardware/modelos usados
