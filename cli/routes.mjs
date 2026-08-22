import process from 'bare-process'
import { harness, loadPlugins } from '../dist/harness/loader.js'

let harnessReady = false

async function resolveHarnessModule() {
  if (!harnessReady) {
    await loadPlugins()
    harnessReady = true
  }
  return { harness, loadPlugins }
}

export async function getHarness() {
  const mod = await resolveHarnessModule()
  return mod.harness
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (typeof result === 'object' && result !== null) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(result)
  }
}

async function promptConfirm(_message) {
  return false
}

async function executeWithConfirmation(toolName, params, { json }) {
  const { harness } = await resolveHarnessModule()
  let result = await harness.execute(toolName, params)

  if (
    result &&
    typeof result === 'object' &&
    result.blocked === true &&
    toolName === 'execute_gasless_payment' &&
    params.confirmed !== true
  ) {
    const amount = Number(params.amount ?? 0)
    const threshold = Number(process.env.HUMAN_CONFIRM_THRESHOLD_USDT || 1000)

    if (amount > threshold) {
      const ok = await promptConfirm(
        `\n⚠️  Confirmar pago gasless de $${amount} USDt a ${params.to}? [y/N] `
      )
      if (ok) {
        result = await harness.execute(toolName, { ...params, confirmed: true })
      } else {
        result = { blocked: true, reason: 'Pago cancelado por el usuario.' }
      }
    }
  }

  printResult(result, json)
  return result
}

export async function routeTools({ json }) {
  const { harness } = await resolveHarnessModule()
  const tools = harness.listTools().map((t) => ({
    name: t.name,
    plugin: t.plugin,
    description: t.description
  }))

  if (json) {
    console.log(JSON.stringify({ tools }, null, 2))
    return
  }

  for (const t of tools) {
    console.log(`- ${t.name} (${t.plugin}): ${t.description}`)
  }
}

/** parse_invoice returns { invoice, rawTextPreview }; match needs invoice object. */
function extractInvoice(parsed) {
  if (!parsed || typeof parsed !== 'object' || parsed.blocked) return null
  if (parsed.invoice && typeof parsed.invoice === 'object') return parsed.invoice
  if (parsed.invoiceNumber || parsed.vendor) return parsed
  return null
}

export async function routeIngest(file, { json, accent, dim, reset }) {
  if (!json) {
    console.log(`${accent}▸${reset} Ingesta: ${file}`)
    console.log(`${dim}  → parse_invoice + match_purchase_order${reset}`)
  }

  const { harness } = await resolveHarnessModule()
  const parsed = await harness.execute('parse_invoice', { filePath: file })

  let match = null
  const invoice = extractInvoice(parsed)
  if (invoice) {
    const invoiceId = invoice.invoiceNumber ?? invoice.invoiceId ?? 'unknown'
    match = await harness.execute('match_purchase_order', {
      invoiceId,
      invoice
    })
  }

  const result = { parsed, match }
  printResult(result, json)
  return result
}

export async function routeForecast(sku, { json, accent, dim, reset }) {
  if (!json) {
    console.log(`${accent}▸${reset} Forecast${sku ? `: ${sku}` : ' (todos los SKUs)'}`)
    console.log(`${dim}  → run_usage_forecast (+ draft_purchase_order si riesgo)${reset}`)
  }

  const { harness } = await resolveHarnessModule()
  const forecasts = await harness.execute('run_usage_forecast', { sku, days: 30 })

  const list = Array.isArray(forecasts) ? forecasts : forecasts ? [forecasts] : []
  const drafts = []
  for (const item of list) {
    if (item?.belowThreshold) {
      const draft = await harness.execute('draft_purchase_order', { forecast: item })
      drafts.push({ sku: item.sku, draft })
    }
  }

  const result = { forecasts, drafts }
  printResult(result, json)
  return result
}

export async function routePay(flags, { json, accent, dim, reset }) {
  const { vendor, amount, dryRun, dryRunFlag, network } = flags || {}
  if (!vendor || !amount) {
    throw new Error('Uso: pearledger pay --vendor 0x.. --amount 250 [--dry-run=false]')
  }

  const numAmount = Number(amount)
  const isDryRun = dryRunFlag === false ? false : dryRun !== false
  const net = network === 'mainnet' ? 'mainnet' : 'sepolia'

  if (!json) {
    console.log(`${accent}▸${reset} Pago gasless: ${numAmount} USDt → ${vendor} (${net})`)
    if (isDryRun) {
      console.log(`${dim}  Modo dry-run. Usar --dry-run=false para ejecutar.${reset}`)
    }
  }

  const { harness } = await resolveHarnessModule()
  const quote = await harness.execute('quote_payment', {
    to: vendor,
    amount: numAmount,
    network: net
  })

  const payParams = {
    to: vendor,
    amount: numAmount,
    dryRun: isDryRun,
    network: net
  }

  if (isDryRun) {
    const result = {
      quote,
      payment: await harness.execute('execute_gasless_payment', payParams)
    }
    printResult(result, json)
    return result
  }

  const payment = await executeWithConfirmation('execute_gasless_payment', payParams, { json })
  const result = { quote, payment }
  if (json && payment !== undefined) {
    console.log(JSON.stringify(result, null, 2))
  }
  return result
}

export async function routeBalance(opts) {
  const { json, accent, dim, reset, network } = opts || {}
  const net = network === 'mainnet' ? 'mainnet' : 'sepolia'

  if (!json) {
    console.log(`${accent}▸${reset} Consultando saldo WDK (${net})...`)
    console.log(`${dim}  → get_wallet_balance${reset}`)
  }

  const { harness } = await resolveHarnessModule()
  const result = await harness.execute('get_wallet_balance', { network: net })
  printResult(result, json)
  return result
}
