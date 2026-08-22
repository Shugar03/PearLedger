/**
 * Adaptadores de runtime para el CLI.
 *
 * Es lo único que difiere de verdad entre Bare y Node, así que se inyecta desde
 * el entrypoint en lugar de duplicar 200 líneas de rutas por runtime.
 *
 * La versión anterior bajo Bare devolvía `false` sin preguntar nada y reportaba
 * "Pago cancelado por el usuario": todo pago sobre el umbral se cancelaba en
 * silencio y el registro de auditoría mentía. Aquí `interactive` expone si hay
 * canal con el humano, y quien llama distingue "dijo que no" de "no se pudo
 * preguntar".
 */

import process from 'node:process'
import type { CliHost } from '@cli/types.js'

const AFFIRMATIVE = new Set(['y', 'yes', 's', 'si', 'sí'])

function hasTty(): boolean {
  try {
    return process.stdin?.isTTY === true
  } catch {
    return false
  }
}

/**
 * Lee una línea de stdin sin depender de `node:readline`, que en Bare no
 * siempre está disponible. Funciona igual en ambos runtimes.
 */
function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin
    let buffer = ''
    let settled = false

    const finish = (value: string): void => {
      if (settled) return
      settled = true
      stdin.removeListener('data', onData)
      stdin.removeListener('end', onEnd)
      try {
        stdin.pause()
      } catch {
        // el stream puede estar cerrado
      }
      resolve(value)
    }

    const onData = (chunk: Buffer | string): void => {
      buffer += chunk.toString()
      const newline = buffer.indexOf('\n')
      if (newline >= 0) finish(buffer.slice(0, newline).trim())
    }

    const onEnd = (): void => finish(buffer.trim())

    process.stderr.write(prompt)
    try {
      stdin.resume()
      stdin.on('data', onData)
      stdin.on('end', onEnd)
    } catch {
      finish('')
    }
  })
}

/** Host interactivo: hay una terminal y se puede preguntar al humano. */
export function createInteractiveHost(): CliHost {
  return {
    interactive: true,
    async confirm(message: string): Promise<boolean> {
      const answer = await readLine(`${message} [y/N] `)
      return AFFIRMATIVE.has(answer.toLowerCase())
    },
    exit(code: number): void {
      process.exit(code)
    }
  }
}

/**
 * Host no interactivo: sin TTY (pipes, CI, daemon). `confirm` no miente,
 * simplemente no hay canal; quien llama debe consultar `interactive`.
 */
export function createNonInteractiveHost(): CliHost {
  return {
    interactive: false,
    async confirm(): Promise<boolean> {
      return false
    },
    exit(code: number): void {
      process.exit(code)
    }
  }
}

/** Elige el host según haya o no terminal. */
export function createCliHost(): CliHost {
  return hasTty() ? createInteractiveHost() : createNonInteractiveHost()
}
