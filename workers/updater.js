/**
 * OTA updater — variant/daemon
 * Signal handlers + await pear.updater.applyUpdate()
 * @see https://docs.pears.com/guides/release-and-distribute-your-app
 */
import fs from 'node:fs'
import path from 'node:path'

const STORAGE = process.env.PEAR_STORAGE ?? path.join(process.cwd(), '.storage')
const UPDATE_LOG = path.join(STORAGE, 'updates.log')

function logUpdate(message) {
  fs.mkdirSync(STORAGE, { recursive: true })
  const line = `[${new Date().toISOString()}] ${message}\n`
  fs.appendFileSync(UPDATE_LOG, line)
  console.log(`[updater] ${message}`)
}

let swarm = null

async function applyUpdate() {
  try {
    // En entorno Pear real:
    // await pear.updater.applyUpdate({ delay: 0 })
    logUpdate('applyUpdate() awaited — stub en dev sin Pear runtime')
  } catch (err) {
    logUpdate(`ERROR: ${err.message}`)
    throw err
  }
}

async function shutdown(signal) {
  logUpdate(`Received ${signal}, shutting down...`)
  if (swarm?.destroy) {
    await swarm.destroy()
    logUpdate('swarm.destroy() completed — Corestore lock released')
  }
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

export { applyUpdate, logUpdate }
