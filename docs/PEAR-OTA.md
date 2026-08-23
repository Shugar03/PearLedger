# Pear OTA — distribución e instalación

PearLedger se distribuye como binario standalone vía la red P2P de Pear (Hyperswarm).
El link estable de instalación es:

```
pear://rxqrpu8fxa8fes4izqr8gprfq1facxnr9b37tinxdkrpad7bkq5o
```

Coincide con el campo `upgrade` en `package.json`.

## Prerrequisitos

1. **Secret de CI:** configurar `PEAR_PRIMARY_KEY` en GitHub → Settings → Secrets and variables → Actions.
   Sin este secret el job `stage` en `main` no puede publicar releases.
2. **Pear CLI** instalado localmente para `pear install` y pruebas OTA.
3. **Node ≥ 22.18** para desarrollo y builds locales.

## Build local (Windows on-premise)

```powershell
npm ci
npm run build
npm run make:win32-x64
.\out\win32-x64\pearledger.exe --no-updates --json tools
```

Debe devolver 8 tools en JSON válido.

## Preparar deployment dir

```bash
chmod +x out/linux-x64/pearledger   # Linux/macOS
npx pear build --target ../pearledger-deployment
```

El directorio `pearledger-deployment/` contiene `package.json` y `by-arch/<host>/app/<bin>`.

## Demo OTA local (dos terminales)

Terminal 1 — daemon de actualizaciones:

```powershell
.\out\win32-x64\pearledger.exe --updater --update-window 0 --storage .\.storage-demo
```

Terminal 2 — aplicación:

```powershell
.\out\win32-x64\pearledger.exe --update-window 0 --storage .\.storage-demo --json tools
```

Verificar que `.storage-demo/updates.log` registra eventos. Tras un `pear stage` exitoso en CI,
la segunda terminal debería recibir el delta en el próximo arranque.

## Instalación E2E (`pear install`)

1. Merge a `main` con `PEAR_PRIMARY_KEY` configurado → CI stage verde.
2. En máquina limpia:

   ```bash
   pear install pear://rxqrpu8fxa8fes4izqr8gprfq1facxnr9b37tinxdkrpad7bkq5o
   ```

3. Ejecutar ingest desde la instalación Pear (no desde `npm run dev`):

   ```bash
   pearledger ingest workspace/invoices/sample.png --json
   ```

### Troubleshooting P2P

| Síntoma | Acción |
|---------|--------|
| Timeout en `pear install` | Verificar firewall UDP/TCP; reintentar con red distinta |
| Stage falla en CI | Confirmar que `PEAR_PRIMARY_KEY` está en secrets del repo |
| Binario no arranca tras install | `pearledger --no-updates --json tools` para aislar OTA |
| 8 tools no aparecen | Rebuild con `npm run make:<host>` y repetir `pear build` |

## CI

- **PRs:** `pear stage` en modo `dry-run: true` (valida el deployment sin publicar).
- **main:** stage real con `PEAR_PRIMARY_KEY`; post-stage ejecuta `pear info` sobre el link.
- Artifacts: `pearledger-linux-x64`, `pearledger-win32-x64`, `pearledger-deployment`.
