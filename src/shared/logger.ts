/**
 * Logger mínimo con una regla innegociable: **el diagnóstico va a stderr**.
 *
 * stdout está reservado para el resultado del comando. Es lo que hace que
 * `pearledger ingest factura.pdf --json | jq .` funcione y que la UI pueda
 * parsear la salida. Un solo `console.log` en el pipeline de OCR rompía el
 * contrato: la salida dejaba de ser JSON válido.
 *
 * Por eso `writeOut()` es el ÚNICO escritor de stdout de todo el proyecto y
 * solo debe invocarse desde la capa de presentación (`@cli/render`).
 */

import process from 'node:process'

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
}

export interface Logger {
  error(message: string, ...rest: unknown[]): void
  warn(message: string, ...rest: unknown[]): void
  info(message: string, ...rest: unknown[]): void
  debug(message: string, ...rest: unknown[]): void
  child(scope: string): Logger
  readonly level: LogLevel
}

export interface LoggerOptions {
  level?: LogLevel
  scope?: string
  /** Inyectable para tests; por defecto stderr. */
  write?: (line: string) => void
}

function defaultWrite(line: string): void {
  process.stderr.write(line + '\n')
}

function format(scope: string | undefined, message: string, rest: unknown[]): string {
  const prefix = scope ? `[${scope}] ` : ''
  if (rest.length === 0) return prefix + message
  const tail = rest
    .map((value) => {
      if (typeof value === 'string') return value
      if (value instanceof Error) return value.message
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    })
    .join(' ')
  return `${prefix}${message} ${tail}`
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info'
  const scope = options.scope
  const write = options.write ?? defaultWrite
  const threshold = LEVEL_RANK[level]

  const emit = (at: LogLevel, message: string, rest: unknown[]): void => {
    if (LEVEL_RANK[at] > threshold) return
    write(format(scope, message, rest))
  }

  return {
    level,
    error: (message, ...rest) => emit('error', message, rest),
    warn: (message, ...rest) => emit('warn', message, rest),
    info: (message, ...rest) => emit('info', message, rest),
    debug: (message, ...rest) => emit('debug', message, rest),
    child: (childScope) =>
      createLogger({
        level,
        write,
        scope: scope ? `${scope}:${childScope}` : childScope
      })
  }
}

let rootLogger: Logger = createLogger()

/** Configura el logger raíz. Lo llama el composition root (bin/CLI/dashboard). */
export function configureLogger(options: LoggerOptions): Logger {
  rootLogger = createLogger(options)
  return rootLogger
}

/** Logger con scope. Todo módulo de dominio debe usar esto, nunca `console`. */
export function getLogger(scope?: string): Logger {
  return scope ? rootLogger.child(scope) : rootLogger
}

/**
 * ÚNICO escritor de stdout del proyecto. Solo desde la capa de presentación.
 * Un grep en CI verifica que no aparezca `console.log` en `src/`.
 */
export function writeOut(text: string): void {
  process.stdout.write(text.endsWith('\n') ? text : text + '\n')
}
