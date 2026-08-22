/**
 * Declaraciones para dependencias sin tipos propios.
 *
 * Se mantienen deliberadamente laxas: describen la superficie que consumimos,
 * no la librería entera. Si algún día publican tipos, este archivo desaparece.
 */

declare module 'paparam' {
  interface Flag {
    hide(): Flag
  }
  interface Cmd {
    parse(argv: string[]): unknown
    flags: Record<string, unknown>
  }
  const paparam: {
    command(name: string, ...parts: unknown[]): Cmd
    flag(spec: string, description?: string): Flag
    arg(spec: string, description?: string): unknown
    summary(text: string): unknown
    description(text: string): unknown
    rest(spec: string): unknown
    bail(...args: unknown[]): unknown
  }
  export default paparam
  export const command: (typeof paparam)['command']
  export const flag: (typeof paparam)['flag']
  export const arg: (typeof paparam)['arg']
  export const summary: (typeof paparam)['summary']
  export const rest: (typeof paparam)['rest']
}

declare module 'bare-storage' {
  export function persistent(): string
  export function temporary(): string
}

declare module 'bare-daemon' {
  export function spawn(command: string, args: string[], options?: unknown): unknown
}

declare module 'bare-file-logger' {
  export default class FileLog {
    constructor(path: string, options?: { maxSize?: number })
    close(): void
  }
}

declare module 'bare-console' {
  export default class Console {
    constructor(stream: unknown)
    log(...args: unknown[]): void
    error(...args: unknown[]): void
  }
}

declare module 'which-runtime' {
  export const isWindows: boolean
  export const isBare: boolean
  export const isNode: boolean
}

declare module 'fs-native-extensions' {
  export function tryLock(fd: number): boolean
  export function unlock(fd: number): void
}

declare module 'corestore' {
  export default class Corestore {
    constructor(storage: string)
    replicate(connection: unknown): unknown
    close(): Promise<void>
  }
}

declare module 'hyperswarm' {
  export default class Hyperswarm {
    on(event: string, handler: (...args: unknown[]) => void): void
    join(topic: unknown, options?: unknown): unknown
    destroy(): Promise<void>
  }
}

declare module 'pear-runtime' {
  export default class PearRuntime {
    constructor(options: Record<string, unknown>)
    updater: {
      on(event: string, handler: (...args: unknown[]) => void): void
      drive: { core: { discoveryKey: unknown } }
      applyUpdate(): Promise<void>
    }
    on(event: string, handler: (...args: unknown[]) => void): void
    ready(): Promise<void>
    close(): Promise<void>
  }
}

declare module 'ready-resource' {
  export default class ReadyResource {
    ready(): Promise<void>
    close(): Promise<void>
    on(event: string, handler: (...args: unknown[]) => void): this
    once(event: string, handler: (...args: unknown[]) => void): this
    emit(event: string, ...args: unknown[]): boolean
    removeListener(event: string, handler: (...args: unknown[]) => void): this
    _open?(): Promise<void>
    _close?(): Promise<void>
  }
}

declare module '@tetherto/wdk-wallet-evm-erc-4337' {
  const WalletManagerEvmErc4337: new (seed: string, config: Record<string, unknown>) => unknown
  export default WalletManagerEvmErc4337
}

declare module '@tetherto/wdk-wallet-evm-7702-gasless' {
  const WalletManagerEvm7702Gasless: new (seed: string, config: Record<string, unknown>) => unknown
  export default WalletManagerEvm7702Gasless
}

/** Global que Bare expone en su runtime; no existe bajo Node. */
declare const Bare:
  | {
      argv: string[]
      exit(code?: number): void
      exitCode: number
    }
  | undefined

declare module 'bare-os' {
  export function execPath(): string
  export function tmpdir(): string
  export function homedir(): string
}
