/**
 * OTA updater worker — pear.updater.applyUpdate() awaited + signal handlers.
 * Permalink jurado Pear: workers/updater.js
 *
 * Basado en hello-pear-bare @ branch variant/daemon
 */

const path = require('bare-path')
const process = require('bare-process')
const App = require('../app.js')

async function main() {
  const dir = process.env.PEAR_STORAGE || path.join(require('bare-os').tmpdir(), 'pear', 'pearledger')

  const app = new App({
    dir,
    app: null,
    updates: true,
    version: require('../package.json').version,
    upgrade: require('../package.json').upgrade,
    name: 'pearledger'
  })

  const shutdown = (code) => {
    app.exit(code).catch(() => Bare.exit(code))
  }

  process.on('SIGHUP', () => shutdown(129))
  process.on('SIGINT', () => shutdown(130))
  process.on('SIGQUIT', () => shutdown(131))
  process.on('SIGTERM', () => shutdown(143))

  try {
    // delay:0 en dev — default random hasta 1h invalida demos
    const wait = Number(process.env.PEAR_UPDATE_WINDOW || 0)
    await app.updater(wait)
  } catch (err) {
    console.error('[updater:error]', err)
    Bare.exit(1)
  }
}

main()
