#!/usr/bin/env node
/**
 * Dev entrypoint — Node + strip-types (sin módulos Bare).
 * Producción / OTA: bin.mjs vía Bare (npm start / pearledger.exe).
 */
import pkg from '../package.json' with { type: 'json' }
import {
  routeBalance,
  routeForecast,
  routeIngest,
  routePay,
  routeTools
} from './routes-node.mjs'

const ACCENT = '\x1b[38;2;196;245;60m'
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const appName = pkg.productName || pkg.name

function banner() {
  console.log(`${ACCENT}🍐 PearLedger${RESET} ${DIM}— Local-first · Gasless · P2P (dev)${RESET}\n`)
}

function parseArgs(argv) {
  const json = argv.includes('--json')
  const flags = {}
  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') continue
    if (a === '--sku' && argv[i + 1]) {
      flags.sku = argv[++i]
      continue
    }
    if (a === '--vendor' && argv[i + 1]) {
      flags.vendor = argv[++i]
      continue
    }
    if (a === '--amount' && argv[i + 1]) {
      flags.amount = argv[++i]
      continue
    }
    if (a.startsWith('--dry-run')) {
      const next = argv[i + 1]
      if (next === 'false') {
        flags.dryRun = false
        i++
      } else if (next === 'true') {
        flags.dryRun = true
        i++
      } else {
        flags.dryRun = true
      }
      continue
    }
    if (a.startsWith('-')) continue
    positional.push(a)
  }

  return { json, flags, sub: positional[0], rest: positional.slice(1) }
}

const argv = process.argv.slice(2)
if (argv.includes('--version') || argv.includes('-v')) {
  console.log(`${appName} v${pkg.version}`)
  process.exit(0)
}

const { json, flags, sub, rest } = parseArgs(argv)
const style = { json, accent: ACCENT, dim: DIM, reset: RESET }

if (!json && sub) banner()

try {
  switch (sub) {
    case 'tools':
      await routeTools(style)
      break
    case 'ingest': {
      const file = rest[0]
      if (!file) {
        console.error('Uso: npm run dev -- ingest <file.pdf>')
        process.exit(1)
      }
      await routeIngest(file, style)
      break
    }
    case 'forecast':
      await routeForecast(flags.sku, style)
      break
    case 'pay': {
      if (!flags.vendor || !flags.amount) {
        console.error('Uso: npm run dev -- pay --vendor 0x.. --amount 250')
        process.exit(1)
      }
      const dryRun = flags.dryRun === false ? false : true
      await routePay(
        { vendor: flags.vendor, amount: flags.amount, dryRun, dryRunFlag: dryRun },
        style
      )
      break
    }
    case 'balance':
      await routeBalance(style)
      break
    default:
      if (!json) {
        console.log('Comandos: ingest | forecast | pay | balance | tools')
        console.log('Flags globales: --json')
      }
  }
} catch (err) {
  console.error('[pearledger]', err.message)
  process.exit(1)
}
