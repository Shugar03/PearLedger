/**
 * Linked in-process MCP transports (TDD helper).
 * Client ↔ Server sin stdio real.
 */
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

export function createLinkedTransports(): {
  clientTransport: Transport
  serverTransport: Transport
} {
  const clientTransport: Transport = {
    onmessage: undefined,
    onclose: undefined,
    onerror: undefined,
    async start() {},
    async close() {
      this.onclose?.()
    },
    async send(message) {
      queueMicrotask(() => {
        serverTransport.onmessage?.(message)
      })
    }
  }

  const serverTransport: Transport = {
    onmessage: undefined,
    onclose: undefined,
    onerror: undefined,
    async start() {},
    async close() {
      this.onclose?.()
    },
    async send(message) {
      queueMicrotask(() => {
        clientTransport.onmessage?.(message)
      })
    }
  }

  return { clientTransport, serverTransport }
}
