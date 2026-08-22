# Checklist Aleph Hackathon — PearLedger

## Genéricos
- [ ] Repositorio público con permalinks a QVAC, WDK y Pear
- [ ] README con quickstart (`pear install pear://<key>`)
- [ ] Inferencia 100% local — sin APIs cloud
- [ ] Hardware/modelos reportados en README

## Track Pear ($1,500)
- [ ] Basado en hello-pear-bare @ variant/daemon
- [ ] `pear://<key>` activo
- [ ] OTA: pear stage + provision + multisig 2-of-3
- [ ] delay:0 en demo
- [ ] Signal handlers SIGINT/SIGTERM + swarm.destroy()
- [ ] await pear.updater.applyUpdate()
- [ ] updates.log en troubleshooting

## Track WDK — Pista 1 MCP ($1,000)
- [ ] @tetherto/wdk-cli@1.0.0-beta.2 + wdk-mcp
- [ ] ≥3 tools: get_wallet_balance, quote_payment, execute_gasless_payment
- [ ] Conexión Claude Desktop/Code documentada

## Track WDK — Pista 2 Gasless ($500)
- [ ] wdk-wallet-evm-7702-gasless mainnet (Pimlico/Candide)
- [ ] wdk-wallet-evm-erc-4337 Sepolia (MOCK USDt)
- [ ] safeModulesVersion '0.3.0'
- [ ] send_token dryRun:false en demo
- [ ] Hook >$1,000 USDt confirmación humana

## Track QVAC — OCR + LLM ($1,500)
- [ ] @qvac/sdk ^0.17.x, Node ≥22.17
- [ ] OCR Path B (OCR_3B_MULTIMODAL_Q4_0)
- [ ] ctx_size ≥ 4096
- [ ] QWEN3_1_7B o QWEN3_4B
- [ ] GTE_LARGE_FP16 en ragSearch
- [ ] Structured output y tool calls en llamadas separadas

## Track Vault Guardian ($500)
- [ ] Defender AI + WDK wallet en Bare (no Electron)
- [ ] Prompt injection mitigation documentada
