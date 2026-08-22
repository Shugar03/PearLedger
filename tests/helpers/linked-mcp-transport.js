/**
 * Linked in-process MCP transports (TDD helper).
 * Client ↔ Server sin stdio real.
 */

/** @returns {{ clientTransport: import('@modelcontextprotocol/sdk/shared/transport.js').Transport, serverTransport: import('@modelcontextprotocol/sdk/shared/transport.js').Transport }} */
export function createLinkedTransports() {
  /** @type {any} */
  const clientTransport = {
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

  /** @type {any} */
  const serverTransport = {
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
