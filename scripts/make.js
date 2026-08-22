#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { platform, arch } from 'node:os'

const host = `${platform()}-${arch()}`
const script = `make:${host}`

console.log(`[make] Building for ${host} → npm run ${script}`)
try {
  execSync(`npm run ${script}`, { stdio: 'inherit' })
} catch {
  console.warn(`[make] Host ${host} not in matrix — run a specific make:* script`)
  process.exit(1)
}
