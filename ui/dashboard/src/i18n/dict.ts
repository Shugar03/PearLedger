import type { es } from '@dashboard/i18n/es'

/**
 * La forma de un diccionario: la del español, que es el idioma de referencia.
 *
 * `es.ts` no lleva `as const` justamente para esto: sin él cada texto se
 * infiere como `string` y otro idioma puede tener las suyas. Lo que sí queda
 * fijado son las claves y las firmas de las funciones.
 */
export type Dict = typeof es

export type Locale = 'es' | 'en'
