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

El dashboard es una app de marco fijo: todo vive dentro de un rectángulo
redondeado con un degradado pastel, y encima flotan tarjetas blancas. La barra
lateral y el riel de actividad son columnas de altura completa; sólo scrollea el
contenido del medio.

```
dashboard/src/
├── App.tsx          marco + navegación entre vistas
├── views/
│   ├── HomeView     portada: dos KPI y las facturas de la sesión
│   ├── InvoicesView OCR + conciliación, con sus pasos y su resumen
│   ├── PaymentsView cotizar y simular, con el modal de confirmación
│   ├── ForecastView proyección e inventario, en filas con medidor
│   ├── WalletView   saldo, red y nativo
│   └── ToolsView    el catálogo que expone el harness
├── components/      Sidebar · TopBar · Rail · Card · Kpi · ProgressBar · …
├── context/         puente, estado, eventos, facturas de la sesión
└── styles/          tokens.css (paleta) + app.css (layout)
```

La barra de la cabecera es la acción principal — pegar la ruta de una factura y
procesarla — y la campana cuenta las tools bloqueadas o fallidas. El riel
derecho es el mismo stream de eventos del harness en dos formas: un círculo por
ejecución y una tabla con las últimas.

El estado del stream sólo aparece cuando hay algo que decir: "en vivo" era ruido
permanente, "reconectando" y "sin stream" sí piden atención.

### Cuando algo sale mal

El motivo se muestra en los tres sitios donde hace falta, y nunca sólo en la
consola:

- **En la vista**, como aviso coral encima del volcado (`components/Notice.tsx`).
  Un `{ error }` devuelto cuenta igual que una excepción, y un resultado
  `blocked` sale como aviso celeste con la razón del hook.
- **En el riel**, bajo el nombre de la tool, recortado a dos líneas con el texto
  completo en el `title`.
- **En la cabecera**, que dice qué tool falló — no "harness no disponible", que
  es otra cosa — con el motivo en el `title`.

De dónde sale cada uno está en `lib/activity.ts`: `tool:failed` manda el error
serializado y `tool:blocked` manda los params del hook, donde el texto humano
vive en `message`.

### Paginación de la actividad

Las ejecuciones se acumulan durante toda la sesión, así que la tabla del riel
va paginada de a seis, con el rango a la izquierda (`1-6 de 22`) y la página a
la derecha. Filtrar por alertas vuelve a la primera página, y si la lista se
acorta — al limpiar, por ejemplo — la página actual se ajusta sola en vez de
quedar en blanco. El provider guarda como mucho 120 eventos: la memoria no
crece indefinidamente aunque la sesión dure horas.

La fila de la barra lateral dice **Harness**, no "Modelos": lo que sigue es si
el harness respondió, y cuando falla — dos instancias peleando por el lock del
worker, por ejemplo — el motivo real no eran los modelos. El mensaje que se
muestra está traducido; el texto crudo del error, que sale de una librería o
del sistema, queda en el `title` de la píldora.

El logo va en `src/assets/`, en dos versiones — tinta y blanca — y las dos se
montan siempre: la CSS esconde la que no corresponde, con el mismo criterio que
los tokens. Así el cambio de tema no depende de que React sepa cuál está
pintando el sistema.

### Movimiento

Todo lo que aparece, cambia o se abre tiene su animación, y todas viven juntas
al final de `app.css`:

- Las tarjetas de una vista entran escalonadas; las filas, los círculos de
  actividad y las filas de la tabla, al montarse.
- Las cifras de los KPI se remontan con una `key` cuando cambia el dato, y con
  eso repiten su entrada: el número nuevo llega, no aparece de golpe.
- La barra de progreso anima su ancho por CSS — `width` es propiedad geométrica
  de SVG y también propiedad CSS.
- El cambio de tema atenúa colores y bordes en vez de saltar.
- Todo se apaga entero bajo `prefers-reduced-motion`, con un bloque `!important`
  que va el último del archivo.

Una consecuencia práctica de su CSP (`style-src 'self'`, sin `unsafe-inline`):
**ningún componente del dashboard puede usar `style={{…}}`**, porque el
navegador descarta el atributo. Lo que depende de un dato, como el ancho de un
medidor, se dibuja en SVG, donde la medida es un atributo y no un estilo
(`components/MeterRow.tsx`, `components/ProgressBar.tsx`).

### Tema e idioma

Los dos se eligen desde la cabecera y se guardan en `localStorage`
(`context/PrefsProvider.tsx`):

- **Tema**: claro y oscuro, más un tercer estado — seguir al sistema — que es
  el de arranque. El botón alterna entre los dos explícitos; la preferencia
  viaja al `<html>` como `data-theme` y `tokens.css` la lee.
- **Idioma**: español e inglés. Al arrancar se mira `navigator.languages`.
  `i18n/es.ts` es el diccionario de referencia y `en.ts` se declara con su
  tipo, así que una clave que falte rompe el typecheck en vez de dejar un hueco
  en pantalla. Los textos con datos son funciones — el orden de las palabras
  cambia entre idiomas.

El estado que muestra la cabecera viaja como código, no como frase
(`lib/status.ts`): el provider no sabe en qué idioma está la interfaz, y así
cambiar de idioma no deja mensajes viejos colgados.

### Contraste

Los grises de la referencia de diseño no llegaban al 4.5:1 de WCAG AA. Los de
`tokens.css` están medidos par por par en los dos temas; el más justo es
`--text-faint` sobre `--surface-soft`, a 4.5:1. Dos reglas que salieron de ahí:

- Un acento tiene dos tintas: la que va **sobre su relleno** (`--lime-ink`) y
  la que va **sobre una superficie** (`--lime-text`). Confundirlas deja texto
  casi negro sobre tarjeta casi negra en el tema oscuro.
- Las píldoras de estado usan fondo suave con tinta oscura, no relleno saturado
  con texto blanco: blanco sobre coral no pasa de 2.2:1.

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
