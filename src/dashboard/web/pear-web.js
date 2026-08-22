/*
 * pear-web.js — fachada `window.pear` para el navegador.
 *
 * Expone EXACTAMENTE la misma forma que el preload de Electron
 * (`ui/electron/preload.mjs`):
 *
 *     host                   -> 'web' | 'electron'
 *     listTools()            -> Promise<ToolDescriptor[]>
 *     execute(name, params)  -> Promise<unknown>
 *     onEvent(handler)       -> () => void        (devuelve el desenganche)
 *
 * Gracias a eso `app.js` es el MISMO fichero en el dashboard web y en Electron:
 * no pregunta en qué runtime está, sólo habla con `window.pear`.
 *
 * Diferencias inevitables del navegador, documentadas:
 *
 *   · `pickInvoice()` NO existe aquí. En Electron abre un diálogo nativo y devuelve
 *     la ruta absoluta en disco; el navegador no expone rutas reales de un
 *     `<input type="file">` (daría al sitio la topología del sistema de
 *     ficheros). `app.js` detecta su ausencia y usa un campo de ruta.
 *
 *   · El stream de eventos NO usa `EventSource`. `EventSource` no admite
 *     cabeceras propias, así que el token de sesión sólo podría viajar en la
 *     query string o en una cookie — y ambas están prohibidas por diseño (la
 *     query acaba en logs e historial; la cookie viaja sola y habilita CSRF).
 *     En su lugar se consume el mismo `text/event-stream` con `fetch` +
 *     `ReadableStream`, que sí acepta cabeceras. El formato del cable es SSE
 *     estándar y `PearEventStream` replica la semántica de `EventSource`,
 *     reconexión con backoff incluida.
 */

(function () {
  'use strict'

  // En Electron el preload ya definió window.pear: no lo pisamos.
  if (window.pear && typeof window.pear.execute === 'function') return

  var TOKEN_HEADER = 'X-PearLedger-Token'
  var PLACEHOLDER = '__PEARLEDGER' + '_SESSION_TOKEN__'

  function readToken() {
    var meta = document.querySelector('meta[name="pearledger-token"]')
    var value = meta ? meta.getAttribute('content') : ''
    if (!value || value === PLACEHOLDER) return ''
    return value
  }

  var token = readToken()

  function authHeaders(extra) {
    var headers = { Accept: 'application/json' }
    if (token) headers[TOKEN_HEADER] = token
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) headers[key] = extra[key]
      }
    }
    return headers
  }

  async function readError(response) {
    var message = 'HTTP ' + response.status
    try {
      var payload = await response.json()
      if (payload && payload.message) message = payload.message
      else if (payload && payload.error) message = payload.error
    } catch (err) {
      /* respuesta sin JSON: nos quedamos con el código */
    }
    var error = new Error(message)
    error.status = response.status
    return error
  }

  async function getJson(path) {
    var response = await fetch(path, {
      method: 'GET',
      headers: authHeaders(),
      credentials: 'omit',
      cache: 'no-store'
    })
    if (!response.ok) throw await readError(response)
    return response.json()
  }

  /**
   * Lector de SSE sobre `fetch`. Misma semántica que `EventSource` pero con
   * cabecera de autenticación y reconexión con backoff exponencial acotado.
   */
  function PearEventStream(path, handlers) {
    var closed = false
    var controller = null
    var delay = 1000
    var timer = null

    function emitState(state, detail) {
      if (handlers.onState) handlers.onState(state, detail)
    }

    function dispatchFrame(frame) {
      var lines = frame.replace(/\r\n/g, '\n').split('\n')
      var data = []
      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i]
        if (line === '' || line.charAt(0) === ':') continue // comentario/heartbeat
        var colon = line.indexOf(':')
        var field = colon === -1 ? line : line.slice(0, colon)
        var value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'data') data.push(value)
      }
      if (data.length === 0) return
      try {
        handlers.onMessage(JSON.parse(data.join('\n')))
      } catch (err) {
        /* un frame corrupto no debe tumbar el stream */
      }
    }

    async function pump() {
      controller = new AbortController()
      var response = await fetch(path, {
        method: 'GET',
        headers: authHeaders({ Accept: 'text/event-stream' }),
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      })

      if (!response.ok) throw await readError(response)
      if (!response.body) throw new Error('El navegador no expone el cuerpo del stream')

      emitState('live')
      delay = 1000

      var reader = response.body.getReader()
      var decoder = new TextDecoder()
      var buffer = ''

      for (;;) {
        var chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        var split = buffer.indexOf('\n\n')
        while (split >= 0) {
          dispatchFrame(buffer.slice(0, split))
          buffer = buffer.slice(split + 2)
          split = buffer.indexOf('\n\n')
        }
      }
    }

    function schedule() {
      if (closed) return
      emitState('reconnecting', delay)
      timer = setTimeout(loop, delay)
      delay = Math.min(delay * 2, 15000)
    }

    function loop() {
      if (closed) return
      pump().then(
        function () {
          schedule()
        },
        function (err) {
          if (closed) return
          emitState('error', err && err.message ? err.message : String(err))
          schedule()
        }
      )
    }

    loop()

    return function close() {
      closed = true
      if (timer) clearTimeout(timer)
      if (controller) controller.abort()
      emitState('closed')
    }
  }

  var listeners = new Set()
  var stream = null
  var streamState = 'idle'

  function ensureStream() {
    if (stream) return
    stream = PearEventStream('/api/events', {
      onMessage: function (event) {
        listeners.forEach(function (handler) {
          try {
            handler(event)
          } catch (err) {
            /* un handler roto no debe cortar la difusión al resto */
          }
        })
      },
      onState: function (state, detail) {
        streamState = state
        listeners.forEach(function (handler) {
          if (handler.onState) handler.onState(state, detail)
        })
        window.dispatchEvent(
          new CustomEvent('pear:stream-state', { detail: { state: state, info: detail } })
        )
      }
    })
  }

  window.pear = {
    /** Marca de host, igual que el preload de Electron. */
    host: 'web',

    /** Igual que en Electron: catálogo de tools sin handlers. */
    listTools: async function () {
      var payload = await getJson('/api/tools')
      return payload.tools || []
    },

    /**
     * Igual que en Electron, pero el servidor aplica su allowlist: sólo tools
     * de lectura y `execute_gasless_payment` en dry-run forzado.
     */
    execute: async function (name, params) {
      var response = await fetch('/api/execute', {
        method: 'POST',
        // Content-Type JSON obligatorio: fuerza el preflight CORS, que sin
        // cabeceras CORS el navegador aborta para cualquier origen ajeno.
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify({ name: name, params: params || {} })
      })
      if (!response.ok) throw await readError(response)
      var payload = await response.json()
      if (payload && payload.notes && payload.notes.length) {
        window.dispatchEvent(new CustomEvent('pear:policy', { detail: payload.notes }))
      }
      return payload ? payload.result : undefined
    },

    /** Igual que en Electron: devuelve la función de desuscripción. */
    onEvent: function (handler) {
      listeners.add(handler)
      ensureStream()
      return function () {
        listeners.delete(handler)
      }
    },

    // ── Extras exclusivos del navegador ─────────────────────────────────
    health: function () {
      return getJson('/api/health')
    },
    streamState: function () {
      return streamState
    }
    // `pickInvoice` NO se define aquí: ver la nota de cabecera.
  }
})()
