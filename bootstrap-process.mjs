/** Debe importarse antes que harness/plugins en Bare (polyfill process.env). */
import process from 'bare-process'

globalThis.process = process
