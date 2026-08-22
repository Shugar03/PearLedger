#!/usr/bin/env node
/**
 * Copia fixtures de demo a workspace/ (POs + invoice sample).
 * Seguro en clones limpios: purchase-orders/invoices están gitignore salvo samples.
 *
 * Usage: node scripts/seed-demo-fixtures.mjs
 */

import { copyFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'tests', 'fixtures', 'demo')

const FILES = [
  {
    from: 'PO-2026-001.json',
    to: path.join('workspace', 'purchase-orders', 'PO-2026-001.json')
  },
  {
    from: 'PO-2026-001.txt',
    to: path.join('workspace', 'purchase-orders', 'PO-2026-001.txt')
  },
  {
    from: 'sample.png',
    to: path.join('workspace', 'invoices', 'sample.png')
  },
  {
    from: 'sample.pdf',
    to: path.join('workspace', 'invoices', 'sample.pdf')
  }
]

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  let copied = 0
  for (const file of FILES) {
    const from = path.join(srcDir, file.from)
    const to = path.join(root, file.to)
    if (!(await exists(from))) {
      console.warn(`[seed] missing source: ${path.relative(root, from)}`)
      continue
    }
    await mkdir(path.dirname(to), { recursive: true })
    await copyFile(from, to)
    console.log(`[seed] ${file.to}`)
    copied++
  }
  console.log(`[seed] done — ${copied}/${FILES.length} fixtures in workspace/`)
}

await main()
