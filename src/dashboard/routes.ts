/**
 * Enrutado del dev server.
 *
 * Todo pasa por `guardRequest` antes de tocar el harness — incluidos los
 * estáticos, porque el chequeo de `Host` sólo sirve si no tiene excepciones.
 * La única relajación es el token: `/` y los ficheros de `web/` se sirven sin
 * él, porque el navegador tiene que poder cargar la página para *recibirlo*.
 * Los datos (`/api/*`) sí lo exigen siempre.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { executeTool, listTools } from '@ipc/bridge.js'
import { getLogger } from '@shared/logger.js'
import { META } from '@shared/meta.js'
import { workspaceDir } from '@shared/paths.js'

import type { EventHub } from './events.js'
import {
  MAX_BODY_BYTES,
  MAX_UPLOAD_BYTES,
  safeInvoiceName,
  TOKEN_PLACEHOLDER,
  contentTypeFor,
  gateToolCall,
  guardRequest,
  LOOPBACK_HOST,
  resolveStaticPath,
  sessionSecret
} from './security.js'

export interface RouteContext {
  port: number
  webRoot: string
  hub: EventHub
}

const log = getLogger('dashboard')

/**
 * Cabeceras de endurecimiento presentes en TODA respuesta.
 *
 * La CSP es deliberadamente estrecha: sin `unsafe-inline`, sin orígenes
 * externos y sin `frame-ancestors`, de modo que aunque alguien lograse inyectar
 * markup en un resultado de tool, no podría cargar ni exfiltrar nada.
 * Aquí NO se emite `Access-Control-Allow-Origin` en ningún caso.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
}

function applySecurityHeaders(res: ServerResponse): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value)
}

function sendJson(res: ServerResponse, status: number, payload: unknown, head = false): void {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  applySecurityHeaders(res)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.byteLength)
  })
  res.end(head ? undefined : body)
}

function sendText(res: ServerResponse, status: number, text: string, head = false): void {
  const body = Buffer.from(text, 'utf8')
  applySecurityHeaders(res)
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(body.byteLength)
  })
  res.end(head ? undefined : body)
}

type BodyResult = { ok: true; value: unknown } | { ok: false; message: string }

/** Lee el cuerpo con techo de tamaño: un dev server no negocia con streams. */
async function readJsonBody(req: IncomingMessage): Promise<BodyResult> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')
    size += buf.byteLength
    if (size > MAX_BODY_BYTES) {
      req.destroy()
      return { ok: false, message: `Cuerpo mayor que el límite de ${MAX_BODY_BYTES} bytes` }
    }
    chunks.push(buf)
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (raw === '') return { ok: true, value: {} }

  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false, message: 'El cuerpo no es JSON válido' }
  }
}

async function serveIndex(res: ServerResponse, ctx: RouteContext, head: boolean): Promise<void> {
  const indexPath = path.join(ctx.webRoot, 'index.html')
  let html: string
  try {
    html = await fs.promises.readFile(indexPath, 'utf8')
  } catch {
    sendText(
      res,
      500,
      `No se encontró el HTML del dashboard en ${indexPath}. ` +
        'Compilá el renderer con `npm run ui:install && npm run build:web`.',
      head
    )
    return
  }

  // El token se inyecta en el HTML servido, nunca en cookie ni en query string.
  const body = Buffer.from(html.split(TOKEN_PLACEHOLDER).join(sessionSecret()), 'utf8')
  applySecurityHeaders(res)
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': String(body.byteLength)
  })
  res.end(head ? undefined : body)
}

async function serveStatic(
  res: ServerResponse,
  ctx: RouteContext,
  pathname: string,
  head: boolean
): Promise<void> {
  const target = resolveStaticPath(ctx.webRoot, pathname)
  if (target === null) {
    sendText(res, 403, 'Ruta no permitida', head)
    return
  }

  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(target)
  } catch {
    sendText(res, 404, 'No encontrado', head)
    return
  }

  if (!stat.isFile()) {
    sendText(res, 404, 'No encontrado', head)
    return
  }

  applySecurityHeaders(res)
  res.writeHead(200, {
    'Content-Type': contentTypeFor(target),
    'Content-Length': String(stat.size)
  })

  if (head) {
    res.end()
    return
  }

  const body = await fs.promises.readFile(target)
  res.end(body)
}

function serveEvents(req: IncomingMessage, res: ServerResponse, ctx: RouteContext): void {
  applySecurityHeaders(res)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  // Nagle mantendría los frames en el buffer hasta llenar un paquete; en SSE
  // eso se traduce en un panel "en vivo" que llega a tirones.
  req.socket.setNoDelay(true)
  req.socket.setTimeout(0)

  const release = ctx.hub.subscribe(res)
  req.on('close', release)
  req.on('aborted', release)
}

async function serveHealth(res: ServerResponse): Promise<void> {
  let tools = 0
  try {
    tools = (await listTools()).length
  } catch (err) {
    log.warn(`health: el harness no está listo (${err instanceof Error ? err.message : String(err)})`)
  }
  sendJson(res, 200, { ok: true, version: META.version, tools })
}

async function serveTools(res: ServerResponse): Promise<void> {
  try {
    sendJson(res, 200, { tools: await listTools() })
  } catch (err) {
    sendJson(res, 503, {
      error: 'harness_unavailable',
      message: err instanceof Error ? err.message : String(err)
    })
  }
}

async function serveIngest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req)
  if (!body.ok) {
    sendJson(res, 400, { error: 'bad_request', message: body.message })
    return
  }

  const payload = body.value as { filePath?: unknown } | null
  const filePath = typeof payload?.filePath === 'string' ? payload.filePath.trim() : ''
  if (!filePath) {
    sendJson(res, 400, { error: 'bad_request', message: 'Se requiere { filePath }' })
    return
  }

  const wall0 = Date.now()
  try {
    const parsed = await executeTool('parse_invoice', { filePath })
    let match: unknown = null
    const invoice =
      parsed && typeof parsed === 'object' && 'invoice' in (parsed as object)
        ? (parsed as { invoice: Record<string, unknown> }).invoice
        : parsed

    if (invoice && typeof invoice === 'object') {
      const inv = invoice as Record<string, unknown>
      const invoiceId = String(inv.invoiceNumber ?? inv.invoiceId ?? 'unknown')
      match = await executeTool('match_purchase_order', { invoiceId, invoice: inv })
    }

    sendJson(res, 200, {
      filePath,
      timingMs: { total: Date.now() - wall0 },
      parsed,
      match
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendJson(res, 500, { error: 'ingest_failed', message })
  }
}

/** Lee el cuerpo entero en memoria, con techo. Devuelve `null` si se pasa. */
async function readBinaryBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')
    size += buf.byteLength
    if (size > MAX_UPLOAD_BYTES) {
      req.destroy()
      return null
    }
    chunks.push(buf)
  }

  return Buffer.concat(chunks)
}

/**
 * Deja una factura en el workspace y devuelve su ruta en disco.
 *
 * Existe porque el navegador no revela dónde vive el archivo que elegiste: sólo
 * da su nombre y sus bytes. Antes el dashboard adivinaba
 * `workspace/invoices/<nombre>` y fallaba si no estaba ahí; ahora se copia y la
 * ruta que devuelve es la de verdad.
 *
 * El nombre se sanea en `safeInvoiceName` y el destino se arma con
 * `workspaceDir`, así que nada de lo que mande el cliente elige el directorio.
 */
async function serveInvoiceUpload(
  req: IncomingMessage,
  res: ServerResponse,
  requested: string | null
): Promise<void> {
  const name = safeInvoiceName(requested)
  if (name === null) {
    sendJson(res, 400, {
      error: 'bad_request',
      message: 'Nombre de archivo no válido: se aceptan PDF, PNG, JPG y WEBP'
    })
    return
  }

  const body = await readBinaryBody(req)
  if (body === null) {
    sendJson(res, 413, {
      error: 'too_large',
      message: `El archivo supera el límite de ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`
    })
    return
  }
  if (body.byteLength === 0) {
    sendJson(res, 400, { error: 'bad_request', message: 'El archivo llegó vacío' })
    return
  }

  const target = workspaceDir('invoices', name)
  try {
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.writeFile(target, body)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn(`no se pudo guardar ${name}: ${message}`)
    sendJson(res, 500, { error: 'write_failed', message })
    return
  }

  log.info(`factura guardada en el workspace: ${target} (${body.byteLength} bytes)`)
  sendJson(res, 201, { path: target, name, bytes: body.byteLength })
}

async function serveExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req)
  if (!body.ok) {
    sendJson(res, 400, { error: 'bad_request', message: body.message })
    return
  }

  const payload = body.value as { name?: unknown; params?: unknown } | null
  if (typeof payload !== 'object' || payload === null) {
    sendJson(res, 400, { error: 'bad_request', message: 'Se esperaba un objeto {name, params}' })
    return
  }

  const gate = gateToolCall(payload.name, payload.params)
  if (!gate.allowed) {
    log.warn(`execute rechazado (${gate.code}): ${gate.message}`)
    sendJson(res, gate.status, { error: gate.code, message: gate.message })
    return
  }

  const { name, params, access, notes } = gate.call
  try {
    const result = await executeTool(name, params)
    sendJson(res, 200, { tool: name, access, notes, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn(`tool ${name} falló: ${message}`)
    sendJson(res, 500, { error: 'tool_failed', tool: name, message })
  }
}

/** Punto de entrada único: guardas primero, enrutado después. */
export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()
  const url = new URL(req.url ?? '/', `http://${LOOPBACK_HOST}:${ctx.port}`)
  const pathname = url.pathname
  const isApi = pathname === '/api' || pathname.startsWith('/api/')
  const head = method === 'HEAD'

  // Sin CORS significa sin preflight: OPTIONS no se responde jamás con 2xx.
  if (method === 'OPTIONS') {
    applySecurityHeaders(res)
    res.writeHead(405, { Allow: 'GET, HEAD, POST', 'Content-Length': '0' })
    res.end()
    return
  }

  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    sendText(res, 405, 'Método no permitido')
    return
  }

  const verdict = guardRequest(req, {
    port: ctx.port,
    mutating: method === 'POST',
    requiresToken: isApi,
    binaryBody: pathname === '/api/invoices'
  })

  if (!verdict.ok) {
    log.warn(`${method} ${pathname} → ${verdict.status} ${verdict.code}`)
    if (isApi) sendJson(res, verdict.status, { error: verdict.code, message: verdict.message }, head)
    else sendText(res, verdict.status, verdict.message, head)
    return
  }

  if (isApi) {
    if (method === 'POST') {
      if (pathname === '/api/execute') {
        await serveExecute(req, res)
        return
      }
      if (pathname === '/api/ingest') {
        await serveIngest(req, res)
        return
      }
      if (pathname === '/api/invoices') {
        await serveInvoiceUpload(req, res, url.searchParams.get('name'))
        return
      }
      sendJson(res, 404, { error: 'not_found', message: `Sin ruta POST para ${pathname}` })
      return
    }

    if (pathname === '/api/health') {
      await serveHealth(res)
      return
    }
    if (pathname === '/api/tools') {
      await serveTools(res)
      return
    }
    if (pathname === '/api/events') {
      if (head) {
        sendText(res, 200, '', true)
        return
      }
      serveEvents(req, res, ctx)
      return
    }

    sendJson(res, 404, { error: 'not_found', message: `Sin ruta para ${pathname}` }, head)
    return
  }

  if (method === 'POST') {
    sendText(res, 404, 'No encontrado', head)
    return
  }

  if (pathname === '/' || pathname === '/index.html') {
    await serveIndex(res, ctx, head)
    return
  }

  await serveStatic(res, ctx, pathname, head)
}
