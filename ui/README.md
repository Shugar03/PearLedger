# PearLedger UI — Evelin

Dashboard operativo Electron. Consume el harness vía IPC (sin duplicar lógica de plugins).

## Desarrollo

Desde la raíz del repo:

```bash
npm run ui:dev
```

Requiere `npm run build:ts` (el script `ui:dev` lo ejecuta automáticamente).

## Estructura

```
ui/
  electron/main.mjs    → ipcMain + dist/harness/ipc-bridge.js
  electron/preload.mjs → window.pear API
  renderer/            → HTML/CSS/JS (Bento MVP)
```

## Extender

- Estilos: `renderer/styles.css` (lime `#c4f53c` del manifiesto)
- Nuevas pantallas: agregar sección en `index.html` + handler en `app.js`
- Eventos harness: `window.pear.onEvent(...)`

Ver `docs/PHASE-B-INTEGRATION.md` y `docs/TEAM.md` (MVP completo).
