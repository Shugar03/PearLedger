#!/usr/bin/env node
/**
 * PearLedger CLI — entry point
 * Comandos: ingest | forecast | pay | tools
 */
import { loadPlugins, harness } from './harness/loader.ts'

const [, , command, ...rest] = process.argv

const HELP = `
🍐 PearLedger — Agente local de tesorería P2P

Uso:
  pearledger ingest <factura.pdf>     OCR + 3-way match local (QVAC)
  pearledger forecast [--sku SKU]     Proyección de quiebre de stock
  pearledger pay --vendor 0x.. --amount N [--usdt] [--dry-run]
  pearledger tools                    Lista tools registradas
  pearledger help                     Muestra esta ayuda

Instalación P2P:
  pear install pear://<key>
`.trim()

async function main() {
  await loadPlugins()

  switch (command) {
    case 'ingest': {
      const file = rest[0]
      if (!file) throw new Error('Uso: pearledger ingest <factura.pdf>')
      const result = await harness.execute('parse_invoice', { file })
      console.log(JSON.stringify(result, null, 2))
      break
    }
    case 'forecast': {
      const skuFlag = rest.indexOf('--sku')
      const sku = skuFlag >= 0 ? rest[skuFlag + 1] : undefined
      const result = await harness.execute('run_usage_forecast', { sku })
      console.log(JSON.stringify(result, null, 2))
      break
    }
    case 'pay': {
      const vendorIdx = rest.indexOf('--vendor')
      const amountIdx = rest.indexOf('--amount')
      const vendor = vendorIdx >= 0 ? rest[vendorIdx + 1] : undefined
      const amount = amountIdx >= 0 ? Number(rest[amountIdx + 1]) : undefined
      const dryRun = !rest.includes('--execute')

      if (!vendor || !amount) {
        throw new Error('Uso: pearledger pay --vendor 0x.. --amount N [--execute]')
      }

      const result = await harness.execute('execute_gasless_payment', {
        vendor,
        amount,
        dryRun,
      })
      console.log(JSON.stringify(result, null, 2))
      break
    }
    case 'tools': {
      for (const tool of harness.listTools()) {
        console.log(`- ${tool.name} (${tool.plugin}): ${tool.description}`)
      }
      break
    }
    case 'help':
    case undefined:
      console.log(HELP)
      break
    default:
      throw new Error(`Comando desconocido: ${command}`)
  }
}

main().catch((err) => {
  console.error(`[pearledger] ${err.message}`)
  process.exit(1)
})
