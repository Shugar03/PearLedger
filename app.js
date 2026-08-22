/**
 * PearLedger — Bare app wrapper
 * Basado en hello-pear-bare @ branch variant/daemon
 * @see https://github.com/holepunchto/hello-pear-bare/tree/variant/daemon
 */
import './workers/updater.js'

console.log('🍐 PearLedger daemon started')

// En producción Bare, el CLI se invoca vía bin.mjs como short-lived process.
// El daemon mantiene OTA + Corestore lock management.
