# Convenciones de PearLedger

Reglas obligatorias del proyecto. Se verifican en CI (`npm run lint:rules`).

## 1. Imports: alias `@`, nunca `../`

Todo import entre módulos usa alias, con extensión `.js` explícita (requisito de
`moduleResolution: NodeNext`):

```ts
import { createHarness } from '@core/harness.js'
import { getConfig }     from '@config/index.js'
import { getLogger }     from '@shared/logger.js'
import { ocrInvoice }    from '@plugins/invoice-ops/ocr.js'
```

| Alias | Apunta a |
|---|---|
| `@core/*` | `src/core/*` |
| `@config/*` | `src/config/*` |
| `@shared/*` | `src/shared/*` |
| `@plugins/*` | `src/plugins/*` |
| `@cli/*` | `src/cli/*` |
| `@dashboard/*` | `src/dashboard/*` |
| `@ipc/*` | `src/ipc/*` |
| `@workers/*` | `src/workers/*` |
| `@pear/*` | `src/pear/*` |
| `@assets/*` | `src/assets/*` |

`./mismo-directorio.js` está permitido. `../` está **prohibido** en `src/`.

El build es `tsc` seguido de `tsc-alias`, que reescribe los alias a rutas
relativas en `dist/`. Es lo que permite que el mismo `dist/` corra en Node, en
Bare y dentro del binario standalone: Node ignora las claves `@` del campo
`imports`, y `bare-pack` no lee `tsconfig.paths`.

## 2. Builtins: siempre con prefijo `node:`

```ts
import process from 'node:process'
import fs      from 'node:fs'
```

El campo `imports` de `package.json` los remapea a `bare-*` bajo Bare. Dos
consecuencias que muerden:

- **`process` no es global en Bare.** Hay que importarlo siempre, incluso para
  `process.env`.
- Si usás un builtin nuevo, **añadilo al mapa `imports`** o el binario standalone
  fallará con `MODULE_NOT_FOUND`.

## 3. stdout es sagrado

`stdout` transporta el resultado del comando y nada más. Todo diagnóstico va a
`stderr`.

```ts
import { getLogger } from '@shared/logger.js'
const log = getLogger('ocr')
log.info('Path B en 1200ms')      // ✅ stderr
console.log('Path B en 1200ms')   // ❌ rompe `--json`
```

`writeOut()` de `@shared/logger.js` es el **único** escritor de stdout y solo se
invoca desde `@cli/render.js`. Los módulos de dominio devuelven datos; no imprimen.

## 4. Nada de `process.cwd()`

El cwd es desde donde el usuario invocó el comando, no la raíz de la app. Una app
instalada con `pear install` se ejecuta desde el home del usuario.

```ts
import { workspaceDir, dataDir } from '@shared/paths.js'
workspaceDir('inventory', 'stock.json')   // ✅
path.join(process.cwd(), 'workspace')     // ❌
```

## 5. `process.env` se lee en un solo sitio

Únicamente `@config/index.ts`. El resto usa `getConfig()`, que es perezoso y
memoizado. Añadir una variable nueva = añadirla al esquema zod y a `.env.example`.

```ts
const { wdk } = getConfig()
wdk.safeModulesVersion            // ✅
process.env.WDK_SAFE_MODULES_VERSION   // ❌
```

## 6. Imports estáticos y literales

`bare-pack` sólo sigue especificadores literales. Un `await import(variable)` deja
el módulo fuera del binario standalone y falla en producción, no en el build.

```ts
import * as plugin from '@plugins/invoice-ops/index.js'          // ✅
const plugin = await import(`@plugins/${name}/index.js`)         // ❌
```

## 7. Dinero: fallar cerrado

- Sin seed configurada se lanza excepción; **nunca** se cae a una seed por defecto.
- Un pago en vivo exige orden de compra conciliada y destinatario que coincida
  con el `payoutAddress` de esa orden.
- Sólo se cachean cotizaciones exitosas. Cachear un error lo perpetúa.
- Las direcciones de token son constantes del código por chainId; el entorno
  puede seleccionar, no inventar.

## 8. Tipos

TypeScript en todo `src/` y `scripts/`. `strict` con `noUncheckedIndexedAccess`.
Los `.mjs` sueltos sólo se admiten en el borde de Bare y de Electron.

Los tests viven junto al código que prueban (`src/**/*.test.ts`, con
`node:test`), no en un árbol paralelo: el que rompe un módulo ve su test en la
misma carpeta.

## 9. Frontend: `ui/` es la única capa humana

`src/` es el programa (Bare/Node) y `ui/` es la interfaz. La frontera es el
puente `window.pear`; nada de `ui/` importa de `src/` en tiempo de ejecución, y
`src/` no sirve más HTML que el `index.html` que emite Vite.

| Carpeta | Qué es | Con qué se compila |
|---|---|---|
| `src/dashboard/` | servidor HTTP + SSE | `tsc` → `dist/dashboard/` |
| `ui/src/` | app React del renderer | Vite → `dist/dashboard/web/` |
| `ui/electron/` | shell de escritorio | se copia tal cual al empaquetar |

Reglas propias del renderer, verificadas por `npm run ui:typecheck`:

- Imports con el alias `@ui/*`; `./mismo-directorio` vale, `../` no.
- TypeScript estricto, igual que `src/`. Los `.mjs` de `ui/electron/` son la
  excepción: son el borde de Electron, como los de Bare.
- Sin atributos `style` en línea, sin CDNs y sin fuentes remotas: la CSP del dev
  server es `default-src 'self'` sin `unsafe-inline`. Todo el color sale de
  `ui/src/styles/tokens.css`.
- El bundle es un artefacto: `dist/dashboard/web/` no se commitea y se regenera
  con `npm run build:web`.
