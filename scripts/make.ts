/** Compila el binario standalone para el host actual. */
import { execSync } from 'node:child_process'
import { arch, platform } from 'node:os'

const host = `${platform()}-${arch()}`
const script = `make:${host}`

process.stderr.write(`[make] host ${host} → npm run ${script}\n`)
try {
  execSync(`npm run ${script}`, { stdio: 'inherit' })
} catch {
  process.stderr.write(`[make] ${host} no está en la matriz — usá un make:* concreto\n`)
  process.exit(1)
}
