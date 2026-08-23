/**
 * Controles de seguridad del dev server.
 *
 * Este servidor expone el harness completo por HTTP y el harness sabe mover
 * dinero. La superficie es `localhost`, que es exactamente el escenario que los
 * navegadores tratan como "de confianza" y los atacantes como puerta trasera:
 * cualquier pestaña abierta en cualquier sitio puede emitir peticiones a
 * `http://127.0.0.1:7331` sin que el usuario se entere.
 *
 * Por eso la política es *fail-closed* y en capas; ninguna de estas defensas
 * basta por sí sola:
 *
 *  1. Bind exclusivo a loopback: nadie fuera de la máquina llega al socket.
 *  2. Validación del `Host`: mata DNS rebinding, donde un dominio del atacante
 *     resuelve a 127.0.0.1 y el navegador considera la petición same-origin.
 *  3. Validación del `Origin` en toda mutación: mata el CSRF clásico.
 *  4. `Content-Type: application/json` obligatorio: los tres tipos "simple"
 *     (`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`)
 *     son los únicos que un formulario o un `fetch` cross-origin puede enviar
 *     sin preflight. Rechazarlos fuerza el preflight, y como aquí no se emite
 *     ninguna cabecera CORS, el navegador aborta antes de tocar el harness.
 *  5. Token de sesión por proceso en cabecera propia. En cabecera y NO en
 *     cookie: una cookie viaja sola en cada petición del navegador, que es
 *     precisamente el mecanismo que hace posible el CSRF. Tampoco en query
 *     string, donde acabaría en logs, historial y cabeceras `Referer`.
 *  6. Cero CORS: nunca se responde `Access-Control-Allow-Origin`.
 *  7. Allowlist de tools: el dashboard es de sólo lectura y dry-run. Un pago en
 *     vivo se firma desde el CLI, que tiene canal interactivo con el humano.
 */

import crypto from 'node:crypto'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'

import { getConfig } from '@config/index.js'
import type { ToolParams } from '@core/types.js'

/** Única interfaz de escucha admitida. No hay flag para cambiarla. */
export const LOOPBACK_HOST = '127.0.0.1'

/** Cabecera que transporta el token de sesión. Nunca cookie, nunca query. */
export const TOKEN_HEADER = 'x-pearledger-token'

/** Marcador que el HTML servido lleva y que el servidor sustituye al vuelo. */
export const TOKEN_PLACEHOLDER = '__PEARLEDGER_SESSION_TOKEN__'

/** Techo del cuerpo aceptado en `/api/execute`. */
export const MAX_BODY_BYTES = 256 * 1024

/**
 * Techo de una factura subida.
 *
 * Un escaneo grande ronda los pocos MB; 20 deja margen de sobra y mantiene
 * acotado lo que un cliente puede hacer escribir en disco de una sola vez.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

/**
 * Content-Types que un contexto cross-origin puede enviar sin preflight.
 * Rechazarlos explícitamente es lo que convierte el preflight en obligatorio.
 */
const SIMPLE_CONTENT_TYPES: readonly string[] = [
  'text/plain',
  'application/x-www-form-urlencoded',
  'multipart/form-data'
]

/** Claves que jamás se aceptan por HTTP: son el camino a un pago firmado. */
const STRIPPED_PARAMS: readonly string[] = ['confirmed', 'approvalId']

/** Claves que envenenarían el prototipo si se copiaran a un objeto. */
const POISON_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype']

let sessionToken: string | null = null

/**
 * Token de sesión del proceso: 32 bytes de `randomBytes` en hex.
 *
 * Se genera una sola vez y muere con el proceso. Reiniciar el dashboard
 * invalida cualquier token filtrado, que es justo lo que se quiere.
 */
export function sessionSecret(): string {
  if (sessionToken === null) sessionToken = crypto.randomBytes(32).toString('hex')
  return sessionToken
}

/** Sólo para tests: fuerza un token nuevo. */
export function resetSessionSecret(): void {
  sessionToken = null
}

/**
 * Comparación en tiempo constante.
 *
 * `timingSafeEqual` exige buffers de igual longitud y lanza si no lo son, con
 * lo que la propia excepción filtraría la longitud del secreto. Comparar los
 * digests SHA-256 normaliza la longitud sin perder la propiedad de timing.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const left = crypto.createHash('sha256').update(a, 'utf8').digest()
  const right = crypto.createHash('sha256').update(b, 'utf8').digest()
  return crypto.timingSafeEqual(left, right)
}

/** El `Host` debe ser literalmente el loopback y el puerto en escucha. */
export function isAllowedHost(hostHeader: string | undefined, port: number): boolean {
  if (typeof hostHeader !== 'string' || hostHeader === '') return false
  return hostHeader === `${LOOPBACK_HOST}:${port}` || hostHeader === `localhost:${port}`
}

/** Orígenes admitidos. Sólo loopback sobre http, sólo el puerto en escucha. */
export function allowedOrigins(port: number): readonly string[] {
  return [`http://${LOOPBACK_HOST}:${port}`, `http://localhost:${port}`]
}

export function isAllowedOrigin(origin: string | undefined, port: number): boolean {
  if (typeof origin !== 'string' || origin === '') return false
  return allowedOrigins(port).includes(origin)
}

export function isJsonContentType(value: string | undefined): boolean {
  if (typeof value !== 'string' || value === '') return false
  const mime = (value.split(';')[0] ?? '').trim().toLowerCase()
  if (SIMPLE_CONTENT_TYPES.includes(mime)) return false
  return mime === 'application/json'
}

/**
 * Tipo de una subida.
 *
 * `application/octet-stream` no está en la lista de tipos "simples" de CORS, así
 * que fuerza el preflight igual que el JSON: un origen ajeno no puede mandarlo
 * sin que el navegador pregunte antes, y aquí no se contesta ningún preflight.
 */
export function isUploadContentType(value: string | undefined): boolean {
  if (typeof value !== 'string' || value === '') return false
  const mime = (value.split(';')[0] ?? '').trim().toLowerCase()
  return mime === 'application/octet-stream'
}

/** Extensiones que el OCR sabe leer. Lo demás no entra al workspace. */
const UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp'
])

/** Un nombre de archivo no puede pasar de esto, contando la extensión. */
const MAX_NAME_LENGTH = 120

/**
 * Convierte el nombre que manda el navegador en uno seguro para el workspace.
 *
 * Devuelve `null` si no hay forma de hacerlo seguro. Lo que se defiende:
 *
 *  · Rutas: sólo se conserva el último segmento, así que `../../.ssh/id_rsa` se
 *    queda en `id_rsa` — y sin extensión válida, se rechaza.
 *  · Nombres reservados de Windows (`CON`, `PRN`, `COM1`…), que abren un
 *    dispositivo en vez de crear un archivo.
 *  · Caracteres de control y los que Windows prohíbe en un nombre.
 *  · Extensión: sólo lo que el OCR sabe leer, para que esto no se convierta en
 *    un sitio donde dejar cualquier cosa.
 */
export function safeInvoiceName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  // `basename` de las dos familias: el navegador puede mandar cualquiera.
  const last = raw.split(/[/\\]/).pop() ?? ''
  const trimmed = last.trim()
  if (trimmed === '' || trimmed === '.' || trimmed === '..') return null

  const extension = path.extname(trimmed).toLowerCase()
  if (!UPLOAD_EXTENSIONS.has(extension)) return null

  const stem = trimmed
    .slice(0, trimmed.length - extension.length)
    // eslint-disable-next-line no-control-regex -- el rango es justo lo que se filtra
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  if (stem === '') return null

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) return null

  const name = `${stem.slice(0, MAX_NAME_LENGTH - extension.length)}${extension}`
  return name === extension ? null : name
}

export interface RequestVerdict {
  ok: boolean
  status: number
  code: string
  message: string
}

const ALLOWED: RequestVerdict = { ok: true, status: 200, code: 'ok', message: 'ok' }

function deny(status: number, code: string, message: string): RequestVerdict {
  return { ok: false, status, code, message }
}

export interface GuardOptions {
  port: number
  /** Mutadora: exige `Origin` presente y un `Content-Type` que fuerce preflight. */
  mutating: boolean
  /** La ruta recibe bytes, no JSON: se admite `application/octet-stream`. */
  binaryBody?: boolean
  /** Endpoints de datos (`/api/*`). Los estáticos se sirven sin token. */
  requiresToken: boolean
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

/**
 * Puerta única de entrada. Devuelve el primer motivo de rechazo, en orden de
 * más estructural a más específico, para que un atacante no pueda usar el
 * código de estado como oráculo del token.
 */
export function guardRequest(req: IncomingMessage, options: GuardOptions): RequestVerdict {
  const { port, mutating, requiresToken } = options

  // 1. DNS rebinding. Si el Host no es el loopback exacto, no hay conversación.
  if (!isAllowedHost(header(req, 'host'), port)) {
    return deny(403, 'bad_host', 'Host no permitido: el dashboard sólo responde en loopback')
  }

  // 2. Un Origin presente y ajeno se rechaza siempre, no sólo en mutaciones:
  //    un GET cross-origin también filtraría datos si se respondiera.
  const origin = header(req, 'origin')
  if (origin !== undefined && !isAllowedOrigin(origin, port)) {
    return deny(403, 'bad_origin', `Origin no permitido: ${origin}`)
  }

  // 3. Señal del navegador moderno. `none` es navegación directa del usuario.
  const fetchSite = header(req, 'sec-fetch-site')
  if (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return deny(403, 'bad_fetch_site', `Petición cross-site rechazada (${fetchSite})`)
  }

  if (mutating) {
    // 4. En una mutación el Origin es obligatorio: su ausencia es sospechosa.
    if (origin === undefined) {
      return deny(403, 'missing_origin', 'Falta la cabecera Origin en una petición mutadora')
    }
    // 5. Fuerza el preflight CORS, que sin cabeceras CORS el navegador aborta.
    const contentType = header(req, 'content-type')
    const acceptable = options.binaryBody
      ? isUploadContentType(contentType) || isJsonContentType(contentType)
      : isJsonContentType(contentType)
    if (!acceptable) {
      return deny(
        415,
        'bad_content_type',
        options.binaryBody
          ? 'Se exige Content-Type: application/octet-stream'
          : 'Se exige Content-Type: application/json'
      )
    }
  }

  if (requiresToken) {
    const provided = header(req, TOKEN_HEADER)
    if (typeof provided !== 'string' || provided === '') {
      return deny(401, 'missing_token', `Falta la cabecera ${TOKEN_HEADER}`)
    }
    if (!constantTimeEquals(provided, sessionSecret())) {
      return deny(401, 'bad_token', 'Token de sesión inválido')
    }
  }

  return ALLOWED
}

// ── Allowlist de tools ─────────────────────────────────────────────────────

/** `read-only` no mueve dinero; `dry-run` sí podría, y por eso se degrada. */
export type ToolAccess = 'read-only' | 'dry-run'

/**
 * Allowlist explícita. Es una lista blanca a propósito: una tool nueva no queda
 * expuesta por HTTP hasta que alguien la añada aquí conscientemente.
 */
export const TOOL_ALLOWLIST: ReadonlyMap<string, ToolAccess> = new Map<string, ToolAccess>([
  ['parse_invoice', 'read-only'],
  ['match_purchase_order', 'read-only'],
  ['check_inventory', 'read-only'],
  ['run_usage_forecast', 'read-only'],
  ['draft_purchase_order', 'read-only'],
  ['get_wallet_balance', 'read-only'],
  ['quote_payment', 'read-only'],
  ['execute_gasless_payment', 'dry-run']
])

export interface SanitizedCall {
  name: string
  params: ToolParams
  access: ToolAccess
  /** Qué reescribió el servidor. Se devuelve al cliente para que sea visible. */
  notes: string[]
}

export type ToolGate =
  | { allowed: true; call: SanitizedCall }
  | { allowed: false; status: number; code: string; message: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Aplica la allowlist y sanea los parámetros.
 *
 * Reglas innegociables:
 *  - `confirmed` y `approvalId` se eliminan de TODA petición HTTP. La
 *    confirmación humana de un pago no puede originarse en un `fetch`.
 *  - `execute_gasless_payment` corre siempre con `dryRun: true`, se mande lo
 *    que se mande en el cuerpo.
 *  - Con `allowLivePayments` en false (el default) un intento explícito de pago
 *    en vivo no se degrada en silencio: se rechaza con 403.
 */
export function gateToolCall(name: unknown, rawParams: unknown): ToolGate {
  if (typeof name !== 'string' || name.trim() === '') {
    return { allowed: false, status: 400, code: 'bad_request', message: 'Falta el nombre de la tool' }
  }

  const toolName = name.trim()
  const access = TOOL_ALLOWLIST.get(toolName)
  if (access === undefined) {
    return {
      allowed: false,
      status: 403,
      code: 'tool_not_allowed',
      message: `La tool "${toolName}" no está expuesta por HTTP. El dashboard es de sólo lectura y dry-run.`
    }
  }

  if (rawParams !== undefined && !isPlainObject(rawParams)) {
    return { allowed: false, status: 400, code: 'bad_params', message: 'params debe ser un objeto' }
  }

  const source: Record<string, unknown> = isPlainObject(rawParams) ? rawParams : {}
  const notes: string[] = []
  const params: ToolParams = {}

  for (const key of Object.keys(source)) {
    if (POISON_KEYS.includes(key)) continue
    if (STRIPPED_PARAMS.includes(key)) {
      notes.push(`"${key}" eliminado: la confirmación humana no viaja por HTTP`)
      continue
    }
    params[key] = source[key]
  }

  if (access === 'dry-run') {
    const requestedLive = Object.hasOwn(source, 'dryRun') && source['dryRun'] !== true
    if (requestedLive) {
      const { allowLivePayments } = getConfig().dashboard
      if (!allowLivePayments) {
        return {
          allowed: false,
          status: 403,
          code: 'live_payment_blocked',
          message:
            'Pago en vivo bloqueado: el dashboard no firma transacciones reales. ' +
            'Usá el CLI (`pearledger pay`), que exige confirmación humana interactiva.'
        }
      }
      notes.push('dryRun forzado a true: el dashboard nunca ejecuta un pago en vivo')
    }
    params['dryRun'] = true
  }

  return { allowed: true, call: { name: toolName, params, access, notes } }
}

// ── Estáticos ──────────────────────────────────────────────────────────────

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
}

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

/** Segmento que sale del directorio actual. Se compara sin escribirlo inline. */
const PARENT_SEGMENT = String.fromCharCode(46, 46)

/**
 * Traduce una ruta de URL a una ruta de disco dentro de `webRoot`.
 *
 * Devuelve `null` ante cualquier intento de salir del directorio. La defensa es
 * doble: se rechazan los segmentos de ascenso ya decodificados (que atrapa
 * `%2e%2e` y `%2f`) y además se comprueba que la ruta resuelta siga estando
 * bajo la raíz, que atrapa symlinks y rarezas de plataforma.
 */
export function resolveStaticPath(webRoot: string, urlPath: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }

  if (decoded.includes('\0')) return null

  const segments = decoded.split(/[/\\]+/).filter((segment) => segment !== '' && segment !== '.')
  if (segments.some((segment) => segment === PARENT_SEGMENT)) return null
  if (segments.length === 0) return null

  const root = path.resolve(webRoot)
  const target = path.resolve(root, ...segments)

  if (target !== root && !target.startsWith(root + path.sep)) return null
  return target
}
