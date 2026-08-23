# PearLedger UI — Evelin

Dashboard operativo Electron. Consume el harness vía IPC (sin duplicar lógica de plugins).

## Desarrollo

Desde la raíz del repo:

```bash
npm run ui:dev
```

Requiere `npm run build` (el script `ui:dev` lo ejecuta automáticamente).

El renderer vive en `src/dashboard/web/` — es el mismo HTML/JS que el dashboard web en
`http://127.0.0.1:7331`. Electron solo aporta `window.pear` vía preload y el diálogo
nativo `pickInvoice()`.

## Estructura

```
ui/
  electron/main.mjs    → ipcMain + dist/ipc/bridge.js
  electron/preload.mjs → window.pear API
src/dashboard/web/     → HTML/CSS/JS compartido (Bento MVP)
```

## Empaquetado (Windows)

```bash
npm run build
cd ui && npm install && npm run dist
```

Genera un instalador en `ui/dist/` vía `electron-builder`.

## Extender

- Estilos: `src/dashboard/web/styles.css`
- Nuevas pantallas: agregar sección en `index.html` + handler en `app.js`
- Eventos harness: `window.pear.onEvent(...)`

Ver `docs/PHASE-B-INTEGRATION.md` y `docs/TEAM.md`.
