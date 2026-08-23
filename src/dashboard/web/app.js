/*
 * app.js — cliente del dashboard.
 *
 * Es el MISMO fichero para el navegador y para Electron: sólo habla con
 * `window.pear`, que uno u otro host provee con idéntica forma
 * (`ui/electron/preload.mjs` y `web/pear-web.js`). Nada aquí sabe de `fetch`,
 * de IPC ni de tokens.
 *
 * Todo acceso al DOM es defensivo (`if (el)`): el HTML de Electron no tiene el
 * panel de actividad en vivo y no debe romperse por eso.
 */

;(function () {
  'use strict'

  var $ = function (sel) {
    return document.querySelector(sel)
  }

  var pear = window.pear
  var statusPill = $('#status-pill')
  var streamPill = $('#stream-pill')

  var VIEWS = {
    inbox: { el: $('#view-inbox'), title: 'Inbox de facturas' },
    pay: { el: $('#view-pay'), title: 'Cola de pagos' },
    forecast: { el: $('#view-forecast'), title: 'Forecast de inventario' },
    wallet: { el: $('#view-wallet'), title: 'Wallet de tesorería' }
  }

  // ── Estado de la cabecera ─────────────────────────────────────────────

  function setStatus(text, kind) {
    if (!statusPill) return
    statusPill.textContent = text
    statusPill.classList.remove('busy', 'error')
    if (kind === 'busy') statusPill.classList.add('busy')
    if (kind === 'error') statusPill.classList.add('error')
  }

  function setStream(state) {
    if (!streamPill) return
    streamPill.classList.remove('dim', 'error', 'live')
    if (state === 'live') {
      streamPill.classList.add('live')
      streamPill.innerHTML = '<i class="dot"></i> en vivo'
    } else if (state === 'reconnecting') {
      streamPill.classList.add('dim')
      streamPill.innerHTML = '<i class="dot"></i> reconectando'
    } else if (state === 'error' || state === 'closed') {
      streamPill.classList.add('error')
      streamPill.innerHTML = '<i class="dot"></i> sin stream'
    } else {
      streamPill.classList.add('dim')
      streamPill.innerHTML = '<i class="dot"></i> SSE'
    }
  }

  function showView(name) {
    Object.keys(VIEWS).forEach(function (key) {
      if (VIEWS[key].el) VIEWS[key].el.classList.toggle('active', key === name)
    })
    var title = $('#view-title')
    if (title && VIEWS[name]) title.textContent = VIEWS[name].title
    document.querySelectorAll('.nav').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === name)
    })
  }

  function renderJson(sel, data) {
    var el = $(sel)
    if (el) el.textContent = JSON.stringify(data, null, 2)
  }

  async function runTool(name, params) {
    setStatus('Ejecutando ' + name + '…', 'busy')
    try {
      var result = await pear.execute(name, params)
      setStatus('Listo')
      return result
    } catch (err) {
      setStatus((err && err.message) || 'Error', 'error')
      throw err
    }
  }

  /** Envuelve un handler para que un fallo se vea en pantalla y no en la consola. */
  function guarded(sel, fn) {
    return function () {
      Promise.resolve()
        .then(fn)
        .catch(function (err) {
          renderJson(sel, { error: (err && err.message) || String(err) })
        })
    }
  }

  function on(sel, event, handler) {
    var el = $(sel)
    if (el) el.addEventListener(event, handler)
  }

  // ── Panel de actividad en vivo ────────────────────────────────────────

  var COUNTERS = {
    'tool:executing': '#c-executing',
    'tool:done': '#c-done',
    'tool:blocked': '#c-blocked',
    'tool:failed': '#c-failed'
  }
  var counts = { 'tool:executing': 0, 'tool:done': 0, 'tool:blocked': 0, 'tool:failed': 0 }
  var MAX_EVENTS = 120

  function bumpCounter(type) {
    if (!(type in counts)) return
    counts[type] += 1
    var el = $(COUNTERS[type])
    if (el) el.textContent = String(counts[type])
  }

  function shortDetail(event) {
    if (event.detail === undefined || event.detail === null) return ''
    if (typeof event.detail === 'string') return event.detail
    try {
      return JSON.stringify(event.detail)
    } catch (err) {
      return ''
    }
  }

  function pushEvent(event) {
    var list = $('#activity-list')
    if (!list) return

    var empty = $('#activity-empty')
    if (empty) empty.remove()

    var li = document.createElement('li')
    li.className = 'event'
    li.setAttribute('data-type', event.type)

    var top = document.createElement('div')
    top.className = 'event-top'

    var type = document.createElement('span')
    type.className = 'event-type'
    type.textContent = String(event.type).replace('tool:', '')
    top.appendChild(type)

    var time = document.createElement('span')
    time.className = 'event-time'
    time.textContent = new Date(event.at || Date.now()).toLocaleTimeString()
    top.appendChild(time)

    li.appendChild(top)

    var tool = document.createElement('div')
    tool.className = 'event-tool'
    tool.textContent = event.tool || (event.plugin ? event.plugin : '—')
    li.appendChild(tool)

    var detail = shortDetail(event)
    if (detail) {
      var pre = document.createElement('p')
      pre.className = 'event-detail'
      pre.textContent = detail
      li.appendChild(pre)
    }

    list.insertBefore(li, list.firstChild)
    while (list.childNodes.length > MAX_EVENTS) list.removeChild(list.lastChild)
    bumpCounter(event.type)
  }

  // ── Navegación ────────────────────────────────────────────────────────

  document.querySelectorAll('.nav').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showView(btn.dataset.view)
    })
  })

  on('#btn-clear-activity', 'click', function () {
    var list = $('#activity-list')
    if (list) list.innerHTML = ''
    Object.keys(counts).forEach(function (key) {
      counts[key] = 0
      var el = $(COUNTERS[key])
      if (el) el.textContent = '0'
    })
  })

  // ── Suscripción a eventos del harness ─────────────────────────────────

  pear.onEvent(function (event) {
    if (!event || !event.type) return
    if (event.type === 'dashboard:hello') {
      setStream('live')
      return
    }
    if (event.type === 'harness:loading') {
      setModelStatus('Cargando modelos…', 'busy')
      setStatus('Cargando modelos…', 'busy')
      return
    }
    if (event.type === 'harness:ready') {
      setModelStatus('Listos', 'ready')
      setStatus('Listo')
      return
    }
    pushEvent(event)
    if (event.type === 'tool:blocked') {
      setStatus('Acción bloqueada — requiere confirmación humana', 'error')
    }
    if (event.type === 'tool:failed') {
      setStatus('La tool falló', 'error')
    }
  })

  window.addEventListener('pear:stream-state', function (evt) {
    setStream(evt.detail ? evt.detail.state : 'idle')
  })

  window.addEventListener('pear:policy', function (evt) {
    var notes = evt.detail || []
    if (notes.length) setStatus('Política del servidor: ' + notes[0], 'busy')
  })

  function setModelStatus(text, kind) {
    var el = $('#meta-models')
    if (!el) return
    el.textContent = text
    el.classList.remove('busy', 'ready')
    if (kind === 'busy') el.classList.add('busy')
    if (kind === 'ready') el.classList.add('ready')
  }

  function matchLabel(status) {
    if (status === 'matched') return '✓ Conciliada'
    if (status === 'vendor_mismatch') return '⚠ Proveedor no coincide'
    if (status === 'amount_mismatch') return '⚠ Monto no coincide'
    if (status === 'no_match') return 'Sin orden de compra'
    return status || 'Sin conciliar'
  }

  function setInboxProgress(text, visible) {
    var el = $('#inbox-progress')
    if (!el) return
    if (visible === false) {
      el.hidden = true
      return
    }
    el.hidden = false
    el.textContent = text
  }

  function renderInboxSummary(parsed, match) {
    var el = $('#inbox-summary')
    if (!el) return

    var invoice = parsed && (parsed.invoice || parsed)
    if (!invoice || typeof invoice !== 'object') {
      el.hidden = true
      return
    }

    var vendor = invoice.vendor || '—'
    var total = invoice.total != null ? String(invoice.total) : '—'
    var currency = invoice.currency || ''
    var status = match && match.status ? String(match.status) : 'sin match'
    var badge = matchLabel(status)

    el.hidden = false
    el.className = 'note inbox-summary status-' + status.replace(/[^a-z_]/gi, '_')
    el.innerHTML =
      '<b>Proveedor:</b> ' +
      vendor +
      ' · <b>Total:</b> ' +
      total +
      (currency ? ' ' + currency : '') +
      ' · <b>Conciliación:</b> ' +
      badge
  }


  var DEMO_INVOICE = 'workspace/invoices/sample.png'

  function invoicePath() {
    var input = $('#inbox-path')
    return input ? input.value.trim() : ''
  }

  function setInvoicePath(value) {
    var input = $('#inbox-path')
    if (input) input.value = value
    var label = $('#inbox-file')
    if (label) label.textContent = value ? 'Ruta: ' + value : ''
  }

  // Electron: diálogo nativo con ruta absoluta real.
  // Navegador: `<input type="file">`, que sólo da el nombre del archivo.
  if (typeof pear.pickInvoice === 'function') {
    var picker = $('#inbox-file-input')
    if (picker) {
      picker.type = 'button'
      picker.value = 'Elegir archivo…'
      picker.addEventListener('click', function () {
        pear.pickInvoice().then(function (chosen) {
          if (chosen) setInvoicePath(chosen)
        })
      })
    }
  } else {
    on('#inbox-file-input', 'change', function (evt) {
      var file = evt.target.files && evt.target.files[0]
      if (!file) return
      // El navegador no revela la ruta absoluta: proponemos la del workspace.
      setInvoicePath('workspace/invoices/' + file.name)
    })
  }

  on('#btn-sample', 'click', function () {
    setInvoicePath(DEMO_INVOICE)
  })

  on(
    '#btn-ingest',
    'click',
    guarded('#inbox-result', async function () {
      var filePath = invoicePath()
      if (!filePath) {
        renderJson('#inbox-result', { error: 'Indicá la ruta del archivo de la factura' })
        return
      }

      setInboxProgress('OCR y extracción en curso (puede tardar en frío)…', true)
      renderInboxSummary(null, null)
      setStatus('Procesando factura…', 'busy')

      var parsed = await runTool('parse_invoice', { filePath: filePath })
      setInboxProgress('Conciliando contra órdenes de compra…', true)

      var match = null

      if (parsed && !parsed.blocked) {
        var invoice = parsed.invoice || parsed
        var invoiceId = invoice.invoiceNumber || parsed.invoiceId || undefined
        match = await runTool('match_purchase_order', {
          invoiceId: invoiceId,
          invoice: invoice
        })
      }

      setInboxProgress('', false)
      renderInboxSummary(parsed, match)
      renderJson('#inbox-result', { parsed: parsed, match: match })
    })
  )

  // ── Pagos ─────────────────────────────────────────────────────────────

  function payInput() {
    var vendor = $('#pay-vendor')
    var amount = $('#pay-amount')
    return {
      to: vendor ? vendor.value.trim() : '',
      amount: amount ? Number(amount.value) : 0
    }
  }

  on(
    '#btn-quote',
    'click',
    guarded('#pay-result', async function () {
      var input = payInput()
      renderJson('#pay-result', { quote: await runTool('quote_payment', input) })
    })
  )

  on(
    '#btn-pay-dry',
    'click',
    guarded('#pay-result', async function () {
      var input = payInput()
      var threshold = Number(window.__PEAR_THRESHOLD__ || 1000)

      if (input.amount > threshold) {
        var modal = $('#confirm-modal')
        var message = $('#confirm-message')
        if (message) {
          message.textContent =
            'La simulación de $' +
            input.amount +
            ' USDt supera el umbral de $' +
            threshold +
            '. El dashboard sólo puede simular: la firma real exige el CLI.'
        }
        if (modal && typeof modal.showModal === 'function') {
          modal.showModal()
          var confirmed = await new Promise(function (resolve) {
            modal.addEventListener(
              'close',
              function () {
                resolve(modal.returnValue === 'confirm')
              },
              { once: true }
            )
          })
          if (!confirmed) {
            setStatus('Simulación cancelada', 'error')
            renderJson('#pay-result', { cancelled: true, amount: input.amount, threshold: threshold })
            return
          }
        }
      }

      var quote = await runTool('quote_payment', input)
      // `dryRun` va explícito por claridad, pero el servidor lo fuerza igual y
      // borra `confirmed`/`approvalId` aunque el cliente los mandase.
      var payment = await runTool('execute_gasless_payment', {
        to: input.to,
        amount: input.amount,
        dryRun: true
      })
      renderJson('#pay-result', { quote: quote, payment: payment })
    })
  )

  // ── Forecast ──────────────────────────────────────────────────────────

  on(
    '#btn-forecast',
    'click',
    guarded('#forecast-result', async function () {
      var skuEl = $('#forecast-sku')
      var daysEl = $('#forecast-days')
      var params = {}
      if (skuEl && skuEl.value.trim()) params.sku = skuEl.value.trim()
      if (daysEl && daysEl.value) params.days = Number(daysEl.value)
      renderJson('#forecast-result', await runTool('run_usage_forecast', params))
    })
  )

  on(
    '#btn-inventory',
    'click',
    guarded('#forecast-result', async function () {
      var skuEl = $('#forecast-sku')
      var params = {}
      if (skuEl && skuEl.value.trim()) params.sku = skuEl.value.trim()
      renderJson('#forecast-result', await runTool('check_inventory', params))
    })
  )

  // ── Wallet ────────────────────────────────────────────────────────────

  on(
    '#btn-balance',
    'click',
    guarded('#wallet-result', async function () {
      var result = await runTool('get_wallet_balance', {})
      var usdt = $('#wallet-usdt')
      var network = $('#wallet-network')
      var native = $('#wallet-native')
      if (usdt) usdt.textContent = (result && result.usdt) || '—'
      if (network) network.textContent = (result && result.network) || '—'
      if (native) native.textContent = (result && (result.native || result.eth)) || '—'
      renderJson('#wallet-result', result)
    })
  )

  // ── Arranque ──────────────────────────────────────────────────────────

  async function boot() {
    setStream('idle')
    setModelStatus('Cargando modelos…', 'busy')
    try {
      var tools = await pear.listTools()
      var metaTools = $('#meta-tools')
      if (metaTools) metaTools.textContent = String(tools.length)
      setModelStatus('Listos', 'ready')
      setStatus('Listo · ' + tools.length + ' tools')
    } catch (err) {
      setModelStatus('Error', 'busy')
      setStatus((err && err.message) || 'Sin harness', 'error')
    }

    if (typeof pear.health === 'function') {
      try {
        var health = await pear.health()
        var metaVersion = $('#meta-version')
        if (metaVersion) metaVersion.textContent = 'v' + health.version
      } catch (err) {
        /* la cabecera puede vivir sin la versión */
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
