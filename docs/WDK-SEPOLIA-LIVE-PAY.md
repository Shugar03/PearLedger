# WDK — Pay live Sepolia (`dryRun:false`)

Guía para el track **P2 Gasless**: una transferencia real de MOCK USDt en Sepolia con smart account ERC-4337 + paymaster Pimlico.

> MOCK USDt **no tiene valor**. No es USDt mainnet.

## Prerrequisitos

| Item | Valor / dónde |
|------|----------------|
| `.env` | `PIMLICO_API_KEY` (obligatorio) |
| Seed demo | `WDK_SEED_PHRASE` en `.env` (default BIP39 `abandon…about`) |
| Token | `0xd077A400968890Eacc75cdc901F0356c943e4fDb` |
| Modules | `WDK_SAFE_MODULES_VERSION=0.3.0` |
| Node | `≥22.17` — scripts usan `--use-system-ca` |

### Wallet demo (seed abandon…about)

Tras `npm run build:ts` + balance:

```bash
npm run dev -- balance --network sepolia
```

Dirección esperada (account 0 / smart account ERC-4337):

```text
0x7E9faA956191d0e766Cc0702515715150a76F6F2
```

Si `usdt` es `0.00` → fondear (abajo). Si ves `rpc_unavailable` → RPC/TLS; ver PR de failover / `SEPOLIA_RPC_FALLBACKS`.

## 1. Fondear MOCK USDt

1. Copiá la address del balance (`0x7E9f…`).
2. Pedí MOCK USDt en faucet oficial WDK/Pimlico o Candide:
   - [Pimlico faucet](https://www.pimlico.io/faucet) (Sepolia USD₮ mock)
   - [Candide faucet](https://dashboard.candide.dev/) → faucet Sepolia
   - Conceptos WDK: [Testnet funds & faucets](https://docs.wdk.tether.io/resources-and-guides/concepts)
3. (Opcional) Un poco de ETH Sepolia en la misma account si el bundler lo pide en algún path no sponsored.
4. Verificá:

```bash
npm run test:p2-wdk
# o
npm run dev -- balance --network sepolia
```

Querés ver algo como `"usdt": "1020.000000"` (o > 1).

## 2. Dry-run primero (siempre)

```bash
npm run dev -- pay --vendor 0x0000000000000000000000000000000000000001 --amount 1 --network sepolia
```

Esperado: `dryRun: true`, `fee: "0.000000"`, `sponsored: true`.

## 3. Pay live (`--dry-run=false`)

**CLI (explícito):**

```bash
npm run dev -- pay --vendor 0x0000000000000000000000000000000000000001 --amount 1 --network sepolia --dry-run=false
```

**Script con candado** (no gasta sin confirmar):

```bash
# Solo chequea balance + quote (seguro)
npm run test:p2-live

# Ejecuta 1 USDt real en Sepolia
set CONFIRM_LIVE_PAY=1
npm run test:p2-live
```

En PowerShell:

```powershell
$env:CONFIRM_LIVE_PAY='1'
npm run test:p2-live
```

Éxito: `status: "ok"` + `txHash` (hash de userOperation / tx).  
Explorador: [Sepolia Etherscan](https://sepolia.etherscan.io/) → pegá el hash o la address de la smart account.

Monto **>$1000** queda bloqueado por el hook humano salvo `confirmed: true` (UI/modal).

## 4. Checklist jurado (30 s)

1. `balance` → MOCK USDt > 0, fee narrative $0  
2. `pay` dry-run → sponsored  
3. `pay --dry-run=false` → `txHash`  
4. Permalink código: `src/plugins/wdk-settlement/paymaster.ts`

## Troubleshooting

| Síntoma | Qué hacer |
|---------|-----------|
| `insufficient_token_balance` | Faucet MOCK USDt a la address del balance |
| `token_balance_unavailable` / `rpc_unavailable` | `npm run test:p2-wdk` (ya trae `--use-system-ca`); o `SEPOLIA_RPC_URL` / `SEPOLIA_RPC_FALLBACKS` |
| `execute_skipped_no_api_key` | `PIMLICO_API_KEY` en `.env` |
| `pimlico_getUserOperationGasPrice` failed | **Normal quirk:** dry-run/`quote` con `isSponsored` **no llama** a ese RPC (devuelve fee $0 al toque). El **live** sí lo llama al armar el UserOp. Causas: API key inválida/sin Sepolia, rate limit, o bundler. El código reintenta con **Candide + ETH nativo** (necesitás ~ETH en la smart account, ya tenés ~0.002). Forzá nativo: `WDK_SEPOLIA_GAS_MODE=native`. Revisá key en [Pimlico dashboard](https://dashboard.pimlico.io/). |
| Live OK pero `gasMode: "native"` | Transfer salió; gas pagado en ETH (no sponsorship). Quote sigue mostrando fee $0 para narrativa gasless. |
| `bad address checksum` | Usar MOCK oficial `0xd077A400968890Eacc75cdc901F0356c943e4fDb` (ya normalizado en paymaster) |

## Referencias

- [WDK ERC-4337 config (Sepolia)](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/configuration/)
- [PLUGIN_CONTRACT — dryRun](./PLUGIN_CONTRACT.md)
- Smoke seguro (sin live): `npm run test:p2-wdk`
