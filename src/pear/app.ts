/**
 * Ciclo de vida del runtime Pear: corestore + hyperswarm + actualizador OTA.
 *
 * Sigue la variante `variant/daemon` del template hello-pear-bare: el updater
 * corre en un proceso desacoplado y el comando en primer plano retorna al
 * instante, que es la forma correcta para un CLI de vida corta.
 *
 * Este módulo sólo se carga desde el entrypoint de Bare: depende de módulos que
 * no existen bajo Node (`bare-daemon`, `fs-native-extensions`).
 */

import fs from 'node:fs'
import path from 'node:path'
import fsx from 'fs-native-extensions'
import daemon from 'bare-daemon'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import PearRuntime from 'pear-runtime'
import ReadyResource from 'ready-resource'

export interface AppOptions {
  dir: string
  app: string | null
  updates: boolean
  version: string
  upgrade: string
  name: string
}

export class App extends ReadyResource {
  readonly dir: string
  private readonly app: string | null
  private readonly updates: boolean
  private readonly version: string
  private readonly upgrade: string
  private readonly name: string

  private store: Corestore | null = null
  private swarm: Hyperswarm | null = null
  private pear: PearRuntime | null = null
  private timeout: ReturnType<typeof setTimeout> | null = null
  private lock: number | null = null
  private downloading = false

  /** Relanza el propio ejecutable en modo updater, desacoplado del terminal. */
  static spawnUpdater(
    dir: string,
    executable: string,
    entrypoint: string | null,
    updateWindow?: number
  ): unknown {
    const args = entrypoint === null ? [] : [entrypoint]
    args.push('--updater', '--storage', dir)
    if (updateWindow !== undefined) args.push('--update-window', String(updateWindow))
    return daemon.spawn(executable, args)
  }

  constructor(options: AppOptions) {
    super()
    fs.mkdirSync(options.dir, { recursive: true })

    this.dir = options.dir
    this.app = options.app
    this.updates = options.updates
    this.version = options.version
    this.upgrade = options.upgrade
    this.name = options.name
  }

  override async _open(): Promise<void> {
    const store = new Corestore(path.join(this.dir, 'pear-runtime', 'corestore'))
    const swarm = new Hyperswarm()

    this.store = store
    this.swarm = swarm

    try {
      const pear = new PearRuntime({
        dir: this.dir,
        app: this.app,
        updates: this.updates,
        version: this.version,
        upgrade: this.upgrade,
        name: this.name,
        store,
        swarm
      })

      this.pear = pear

      pear.on('error', (err: unknown) => this.emit('error', err))
      pear.updater.on('error', (err: unknown) => this.emit('error', err))

      if (this.updates !== false) {
        pear.updater.on('updating', () => {
          this.downloading = true
          this.clearTimer()
          this.emit('updating')
        })
        pear.updater.on('updating-delta', (delta: unknown) => this.emit('updating-delta', delta))
        pear.updater.on('updated', () => {
          this.downloading = false
          void this.applyUpdate()
        })
      }

      await pear.ready()

      if (this.updates === false) return

      swarm.on('connection', (connection: unknown) => store.replicate(connection))
      swarm.join(pear.updater.drive.core.discoveryKey, { client: true, server: false })
    } catch (err) {
      await this.teardown().catch(() => {})
      throw err
    }
  }

  override async _close(): Promise<void> {
    await this.teardown()
  }

  private clearTimer(): void {
    if (this.timeout !== null) clearTimeout(this.timeout)
    this.timeout = null
  }

  private async teardown(): Promise<void> {
    this.clearTimer()
    this.downloading = false

    const { store, swarm, pear, lock } = this
    this.store = null
    this.swarm = null
    this.pear = null
    this.lock = null

    try {
      await swarm?.destroy()
      await pear?.close()
      await store?.close()
    } finally {
      if (lock !== null) {
        fsx.unlock(lock)
        fs.closeSync(lock)
      }
    }
  }

  private async applyUpdate(): Promise<void> {
    this.emit('updated')
    if (this.pear === null) return
    try {
      await this.pear.updater.applyUpdate()
      this.emit('update-applied')
    } catch (err) {
      this.emit('error', err)
    }
  }

  /**
   * Espera a que el OTA aplique una actualización, como mucho `wait` ms.
   * Un lock de fichero garantiza un solo updater por directorio de storage.
   */
  async updater(wait = 30_000): Promise<void> {
    if (this.updates === false) return

    const lock = fs.openSync(path.join(this.dir, 'updater.lock'), 'a+')
    if (fsx.tryLock(lock) === false) {
      fs.closeSync(lock)
      return
    }
    this.lock = lock

    let completed = false
    let resolveCompletion: () => void = () => {}
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve
    })

    const complete = (): void => {
      completed = true
      this.clearTimer()
      resolveCompletion()
    }

    this.once('update-applied', complete)
    this.once('error', complete)
    this.once('close', complete)

    try {
      await this.ready()
      if (completed === false && this.downloading === false) {
        this.timeout = setTimeout(complete, wait)
      }
      await completion
    } finally {
      this.removeListener('update-applied', complete)
      this.removeListener('error', complete)
      this.removeListener('close', complete)
    }
  }

  async exit(code = 0): Promise<void> {
    if (typeof Bare !== 'undefined') Bare.exitCode = code
    await this.close()
  }
}

export default App
