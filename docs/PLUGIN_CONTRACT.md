# Contrato de plugins

Cómo se escribe un plugin de PearLedger. Las reglas transversales (alias `@`,
logging, rutas, configuración) están en [`../CONVENTIONS.md`](../CONVENTIONS.md)
y se verifican con `npm run lint:rules`.

## Forma de un plugin

Cada plugin vive en `src/plugins/<nombre>/` y exporta dos cosas:

```ts
// src/plugins/mi-plugin/index.ts
import { registerTools } from '@core/loader.js'
import type { PluginHost } from '@core/types.js'

export const name = 'plugin-mi-plugin'

export async function register(host: PluginHost): Promise<void> {
  registerTools(host, name, [
    {
      name: 'mi_tool',
      description: 'Qué hace, en una línea',
      handler: async (params) => {
        // Devolvé datos. No imprimas: de la presentación se encarga @cli/render.
        return { ok: true }
      }
    }
  ])
}
```

El plugin **recibe su host** en vez de importar un singleton. Antes existía un
ciclo `loader → plugin → loader.registerTools`; ahora la dependencia va en un
solo sentido y cada test puede construir su propio harness aislado.

## Alta en el loader

Los imports de `src/core/loader.ts` son **estáticos a propósito**:

```ts
import * as miPlugin from '@plugins/mi-plugin/index.js'
```

`bare-pack` sólo sigue especificadores literales. Un loader dinámico por
filesystem dejaría el plugin fuera del binario standalone, y el fallo no
aparecería hasta que alguien ejecutara el ejecutable ya distribuido.

## Interfaces del harness

```ts
interface Tool {
  name: string
  description: string
  handler: (params: Record<string, unknown>) => Promise<unknown>
  plugin: string
}

type HookFn = (tool: Tool, params: ToolParams) => Promise<{
  proceed: boolean
  params: ToolParams
}>
```

Eventos emitidos: `tool:registered`, `tool:executing`, `tool:done`,
`tool:blocked`, `tool:failed`. El dashboard y Electron los consumen para mostrar
actividad en vivo.

## Hooks

Los hooks corren en cadena antes de cada `execute`. El primero que devuelve
`proceed:false` detiene la ejecución y el harness responde
`{blocked:true, reason, requiresConfirmation}`.

Se construyen con factories parametrizadas, no leyendo el entorno al importar:

```ts
export function createPaymentConfirmationHook({ threshold }: { threshold: number }): HookFn
```

Así un test fija el umbral sin mutar `process.env`, y el composition root decide
la política. Tras `loadPlugins(..., {seal:true})` el harness queda **sellado**:
nadie puede inyectar después un hook que se salte la confirmación de pagos.

## Reglas para handlers

1. **Devolvé datos, no imprimas.** El único escritor de stdout del proyecto es
   `writeOut()` en `@cli/render.js`. Un `console.log` en un handler rompe
   `--json` y con ello el contrato con la UI.
2. **Nada de `process.cwd()`.** Usá `workspaceDir()` / `dataDir()` de
   `@shared/paths.js`. La app se ejecuta desde el directorio del usuario.
3. **Nada de `process.env`.** Usá `getConfig()` de `@config/index.js`. Variables
   nuevas: añadilas al esquema zod y a `.env.example`.
4. **Fallá cerrado con dinero.** Sin credenciales, lanzá; no asumas un valor por
   defecto. Un pago en vivo exige orden de compra conciliada.
5. **Sin estado global entre ejecuciones.** Si cacheás, exponé un `reset…()`
   para los tests.

## Consumir el harness desde fuera

```ts
import { ensureHarnessReady, executeTool, listTools, onHarnessEvent } from '@ipc/bridge.js'

await ensureHarnessReady()
const tools = await listTools()               // async; devuelve ToolDescriptor[]
const result = await executeTool('mi_tool', { a: 1 })
const off = onHarnessEvent('tool:done', (tool, res) => { /* … */ })
off()                                          // devuelve su desuscripción
```

`listTools()` entrega `ToolDescriptor` (`{name, description, plugin}`), sin el
handler: el objeto `Tool` lleva una función y no sobrevive a la serialización
por IPC.

## Contrato de tools congelado

`src/core/tool-contract.test.ts` fija la lista de tools esperadas por plugin. Se
declara a mano **a propósito**: derivarla de los plugios convertiría el test en
una tautología que pasaría aunque un plugin dejara de registrar sus tools.
Añadir una tool implica actualizar ese archivo en el mismo commit.
