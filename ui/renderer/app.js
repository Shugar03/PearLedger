const $ = (sel) => document.querySelector(sel)

const statusPill = $('#status-pill')
const views = {
  inbox: { el: $('#view-inbox'), title: 'Inbox de facturas' },
  pay: { el: $('#view-pay'), title: 'Cola de pagos' },
  forecast: { el: $('#view-forecast'), title: 'Forecast de inventario' },
  wallet: { el: $('#view-wallet'), title: 'Wallet tesorería' }
}

let selectedPdf = null

function setStatus(text, kind = 'ready') {
  statusPill.textContent = text
  statusPill.classList.remove('busy', 'error')
  if (kind === 'busy') statusPill.classList.add('busy')
  if (kind === 'error') statusPill.classList.add('error')
}

function showView(name) {
  for (const [key, v] of Object.entries(views)) {
    v.el.classList.toggle('active', key === name)
  }
  $('#view-title').textContent = views[name].title
  document.querySelectorAll('.nav').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === name)
  })
}

function renderJson(el, data) {
  el.textContent = JSON.stringify(data, null, 2)
}

async function runTool(name, params) {
  setStatus(`Ejecutando ${name}…`, 'busy')
  try {
    const result = await window.pear.execute(name, params)
    setStatus('Listo')
    return result
  } catch (err) {
    setStatus(err.message || 'Error', 'error')
    throw err
  }
}

document.querySelectorAll('.nav').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view))
})

window.pear.onEvent((evt) => {
  if (evt.type === 'tool:blocked') {
    setStatus('Acción bloqueada — requiere confirmación', 'error')
  }
})

$('#btn-pick-pdf').addEventListener('click', async () => {
  selectedPdf = await window.pear.pickPdf()
  $('#inbox-file').textContent = selectedPdf ? selectedPdf : 'Sin archivo'
  $('#btn-ingest').disabled = !selectedPdf
})

$('#btn-ingest').addEventListener('click', async () => {
  if (!selectedPdf) return
  const parsed = await runTool('parse_invoice', { filePath: selectedPdf })
  let match = null
  if (parsed && !parsed.blocked) {
    const invoiceId =
      parsed.invoiceId ?? parsed.invoice?.invoiceNumber ?? parsed.invoiceNumber ?? 'unknown'
    match = await runTool('match_purchase_order', { invoiceId, invoice: parsed })
  }
  renderJson($('#inbox-result'), { parsed, match })
})

$('#btn-quote').addEventListener('click', async () => {
  const to = $('#pay-vendor').value.trim()
  const amount = Number($('#pay-amount').value)
  const quote = await runTool('quote_payment', { to, amount })
  renderJson($('#pay-result'), { quote })
})

$('#btn-pay-dry').addEventListener('click', async () => {
  const to = $('#pay-vendor').value.trim()
  const amount = Number($('#pay-amount').value)
  const quote = await runTool('quote_payment', { to, amount })
  const payment = await runTool('execute_gasless_payment', { to, amount, dryRun: true })
  renderJson($('#pay-result'), { quote, payment })
})

$('#btn-forecast').addEventListener('click', async () => {
  const sku = $('#forecast-sku').value.trim() || undefined
  const result = await runTool('run_usage_forecast', { sku })
  renderJson($('#forecast-result'), result)
})

$('#btn-balance').addEventListener('click', async () => {
  const result = await runTool('get_wallet_balance', {})
  $('#wallet-usdt').textContent = result?.usdt ?? '—'
  $('#wallet-network').textContent = result?.network ?? '—'
  renderJson($('#wallet-result'), result)
})

window.addEventListener('DOMContentLoaded', async () => {
  const tools = await window.pear.listTools()
  console.log('[ui] tools registradas:', tools.length)
})
