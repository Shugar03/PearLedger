# `ui/` — capa humana de PearLedger

Todo lo que ve una persona vive acá. Tres superficies React + TypeScript, un
solo `package.json` y un shell de Electron. Ni una línea de lógica de negocio:
el harness se consume por el puente `window.pear`.

```
ui/
├── dashboard/     el producto      → dist/dashboard/web/   (lo sirve el harness y lo carga Electron)
├── deck/          pitch 3 min      → dist/pitch/deck/      (`npm run pitch:deck`, :4174)
├── site/          landing pública  → dist/pitch/site/      (`npm run pitch:site`, :4175)
├── electron/      shell de escritorio del dashboard
├── vite.shared.ts configuración común de las tres
└── tsconfig.json  un solo typecheck para las tres
```

Cada app tiene la misma forma por dentro:

```
<app>/
├── index.html        plantilla de Vite
├── vite.config.ts    root + destino del bundle
└── src/
    ├── main.tsx      monta la app
    ├── components/   piezas reutilizables
    ├── styles/       tokens.css + hoja base
    └── …             views/ (dashboard), slides/ (deck), sections/ + tiles/ (site)
```

El servidor HTTP del dashboard **no** está acá: vive en `src/dashboard/` con el
resto del programa Bare/Node.

## Dashboard: un renderer, dos hosts

`ui/dashboard/src` no sabe en qué host corre. Habla con `PearBridge`
(`src/lib/types.ts`), que implementan:

| Host | Implementación | Transporte |
|---|---|---|
| Navegador | `src/lib/pear-web.ts` | `fetch` + SSE sobre `fetch` contra `127.0.0.1:7331` |
| Electron | `../electron/preload.mjs` | IPC con el proceso principal |

Diferencias reales, resueltas por presencia y no por `if (electron)`:

- `pickInvoice()` sólo existe en Electron (diálogo nativo con ruta absoluta). En
  el navegador la vista de Inbox cae a un campo de ruta: un `<input type="file">`
  no expone rutas del disco.
- `onStreamState()` / `health()` sólo existen en la web: en Electron no hay
  stream HTTP que vigilar.

## Deck y landing

Los dos salieron de un export de diseño en HTML (`docs/pitch-deck/`, ya
borrado del repo) y hoy son componentes:

- **deck** — cinco diapositivas, navegación por teclado (`→`, `←`, `1`-`5`, `F`)
  y contador. El guion y los tiempos, en `docs/PITCH-VIDEO-3MIN.md`.
- **site** — landing en inglés: `sections/` para las seis secciones, `tiles/`
  para el bento del dashboard, `components/` para `Icon` y `Mascot`. Las nueve
  imágenes que venían en base64 dentro del HTML son archivos en `src/assets/`.

Los dos cargan fuentes remotas (Google Fonts, Fontshare) con respaldo del
sistema. Es material de presentación, no el producto: la regla local-first
aplica al dashboard, que no pide nada a la red.

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

**Deck y landing** — compilan y levantan su servidor:

```bash
npm run pitch:deck     # http://localhost:4174
npm run pitch:site     # http://localhost:4175
```

No los abras con doble clic sobre el HTML: los bundles son módulos ES y el
navegador los bloquea servidos por `file://`. Para iterar sobre el diseño,
`npm run pitch:deck:watch` / `pitch:site:watch` recompilan en cada cambio (con
el preview corriendo en otra terminal).

```bash
npm run pitch:build    # sólo compilar los dos, sin servidor
```

**Verificación**:

```bash
npm run ui:typecheck   # tsc estricto sobre las tres apps
npm run ui:build       # los tres bundles de producción
```

## Convenciones del frontend

- Imports con el alias de la app (`@dashboard/*`, `@deck/*`, `@site/*`), nunca
  `../` (mismo criterio que `src/`, ver [CONVENTIONS.md](../CONVENTIONS.md)).
  La excepción es `vite.config.ts`, que corre antes de que existan los alias.
- Todo color sale de `styles/tokens.css`. En el dashboard, además, nada de
  atributos `style` en línea ni recursos remotos: su CSP es `default-src 'self'`
  sin `unsafe-inline`.
- El orden de los `import` de CSS es parte del diseño: en `main.tsx` van primero
  los tokens y la hoja base, y después la app, para que la hoja de cada
  componente se apile detrás.
- React y Vite son `devDependencies`: el bundle se compila antes de empaquetar,
  así que no viajan dentro del instalador.

## Empaquetado (Windows)

```bash
npm run ui:pack:win    # harness + binario Bare + bundle + instalador NSIS
```

El instalador queda en `ui/release/` y lleva sólo el dashboard.
