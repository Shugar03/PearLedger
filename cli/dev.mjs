#!/usr/bin/env node
/**
 * Dev entrypoint — Node + strip-types (sin módulos Bare).
 * Producción / OTA: bin.mjs vía Bare (npm start / pearledger.exe).
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pkg from '../package.json' with { type: 'json' }
import {
  routeBalance,
  routeForecast,
  routeIngest,
  routePay,
  routeTools
} from './routes-node.mjs'

/** Carga .env del repo sin dependencia extra (no loguea valores). */
function loadDotEnv() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const envPath = path.join(root, '.env')
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    const hash = value.indexOf(' #')
    if (hash >= 0) value = value.slice(0, hash).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

loadDotEnv()

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
    if (a === '--network' && argv[i + 1]) {
      flags.network = argv[++i]
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
        {
          vendor: flags.vendor,
          amount: flags.amount,
          dryRun,
          dryRunFlag: dryRun,
          network: flags.network
        },
        style
      )
      break
    }
    case 'balance':
      await routeBalance({ ...style, network: flags.network })
      break
    default:
      if (!json) {
        console.log('Comandos: ingest | forecast | pay | balance | tools')
        console.log('Flags: --json | --sku | --vendor | --amount | --dry-run | --network sepolia|mainnet')
      }
  }
} catch (err) {
  console.error('[pearledger]', err.message)
  process.exit(1)
}
