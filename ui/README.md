# `ui/` — capa humana de PearLedger

Todo lo que ve una persona vive acá: la app React del dashboard y el shell de
Electron que la empaqueta como app de escritorio. Ni una línea de lógica de
negocio — el harness se consume por el puente `window.pear`.

```
ui/
├── index.html            plantilla de Vite (aquí se inyecta el token de sesión)
├── vite.config.ts        build → ../dist/dashboard/web
├── src/                  app React (TypeScript estricto)
│   ├── main.tsx          monta <App> dentro de <PearProvider>
│   ├── App.tsx           layout de tres columnas + vista activa
│   ├── views/            Inbox · Pagos · Forecast · Wallet
│   ├── components/       Sidebar, TopBar, ActivityPanel, Card, Field…
│   ├── context/          PearProvider: puente, estado, eventos
│   ├── hooks/            usePear, useToolResult
│   ├── lib/              puente del navegador (fetch + SSE), tipos, navegación
│   └── styles/           tokens.css (paleta) + app.css (layout)
└── electron/
    ├── main.mjs          ipcMain → dist/ipc/bridge.js + diálogo nativo
    └── preload.mjs       window.pear sobre IPC
```

El servidor HTTP del dashboard **no** está aquí: vive en `src/dashboard/` con el
resto del programa Bare/Node.

## Un renderer, dos hosts

`ui/src` no sabe en qué host corre. Habla con `PearBridge`
(`src/lib/types.ts`), que implementan:

| Host | Implementación | Transporte |
|---|---|---|
| Navegador | `src/lib/pear-web.ts` | `fetch` + SSE sobre `fetch` contra `127.0.0.1:7331` |
| Electron | `electron/preload.mjs` | IPC con el proceso principal |

Diferencias reales, resueltas por presencia y no por `if (electron)`:

- `pickInvoice()` sólo existe en Electron (diálogo nativo con ruta absoluta). En
  el navegador la vista de Inbox cae a un campo de ruta: un `<input type="file">`
  no expone rutas del disco.
- `onStreamState()` / `health()` sólo existen en la web: en Electron no hay
  stream HTTP que vigilar.

## Desarrollo

```bash
npm run ui:install     # una vez: instala React, Vite y Electron
```

**Dashboard web** — dos terminales:

```bash
npm run dashboard      # servidor en http://127.0.0.1:7331
npm run ui:watch       # Vite recompila a dist/ ante cada cambio → recargá el navegador
```

No hay dev server de Vite a propósito: el token de sesión se inyecta al servir
`index.html`, así que la página tiene que salir del servidor real. Con
`ui:watch` el ciclo es guardar → refrescar.

**Escritorio (Electron)**:

```bash
npm run ui:dev         # instala, compila harness + bundle, y abre la app
```

**Verificación**:

```bash
npm run ui:typecheck   # tsc estricto sobre ui/src
npm run ui:build       # bundle de producción
```

## Convenciones del frontend

- Imports con el alias `@ui/*`, nunca `../` (mismo criterio que `src/`, ver
  [CONVENTIONS.md](../CONVENTIONS.md)).
- Nada de atributos `style` en línea ni recursos remotos: la CSP del servidor es
  `default-src 'self'` sin `unsafe-inline`. Todo color sale de `styles/tokens.css`.
- React y Vite son `devDependencies`: el bundle se compila antes de empaquetar,
  así que no viajan dentro del instalador.

## Empaquetado (Windows)

```bash
npm run ui:pack:win    # harness + binario Bare + bundle + instalador NSIS
```

El instalador queda en `ui/release/`.
