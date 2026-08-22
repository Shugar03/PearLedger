#!/usr/bin/env node
/**
 * A1 — Arma pear-stage/ con solo lo necesario para OTA (sin .git, tests, docs).
 * Consumido por pear-ci en CI y usable localmente antes de pear stage manual.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const stageRoot = path.join(root, 'pear-stage')

/** Rutas relativas al repo incluidas en el drive OTA. */
const INCLUDE = [
  'bin.mjs',
  'bootstrap-process.mjs',
  'app.js',
  'package.json',
  'pear.config.json',
  'qvac.config.json',
  'cli',
  'dist',
  'workspace/invoices/.gitkeep',
  'workspace/purchase-orders/.gitkeep'
]

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

function copyEntry(rel) {
  const src = path.join(root, rel)
  if (!fs.existsSync(src)) {
    console.warn(`[pear-stage] skip missing: ${rel}`)
    return
  }
  const dest = path.join(stageRoot, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
  console.log(`[pear-stage] + ${rel}`)
}

function copyLinuxBinaryIfPresent() {
  const binDir = path.join(root, 'out/linux-x64')
  const binName = 'pearledger'
  const binPath = path.join(binDir, binName)
  if (!fs.existsSync(binPath)) return
  const destDir = path.join(stageRoot, 'out/linux-x64')
  fs.mkdirSync(destDir, { recursive: true })
  fs.cpSync(binPath, path.join(destDir, binName), { force: true })
  console.log('[pear-stage] + out/linux-x64/pearledger')
}

rmrf(stageRoot)
fs.mkdirSync(stageRoot, { recursive: true })

for (const rel of INCLUDE) copyEntry(rel)
copyLinuxBinaryIfPresent()

console.log(`[pear-stage] ready at ${stageRoot}`)
