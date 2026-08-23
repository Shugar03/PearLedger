/**
 * Los caminos de error de `ensurePdfRasterized`.
 *
 * Existen porque los dos daban el mensaje equivocado: un PDF que no estaba
 * culpaba al rasterizador ("PDF requiere raster previo"), y una extensión
 * cualquiera se trataba como imagen.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ensurePdfRasterized } from '@plugins/invoice-ops/image-input.js'

describe('ensurePdfRasterized', () => {
  it('IMG-01: un PDF que no existe se reporta como archivo faltante', async () => {
    await assert.rejects(
      () => ensurePdfRasterized('workspace/invoices/no-existe-jamas.pdf'),
      (err: Error) => {
        assert.match(err.message, /No se encontró el PDF/)
        assert.doesNotMatch(err.message, /raster/i, 'no debe culpar al rasterizador')
        return true
      }
    )
  })

  it('IMG-02: una imagen que no existe se reporta como imagen faltante', async () => {
    await assert.rejects(
      () => ensurePdfRasterized('workspace/invoices/no-existe-jamas.png'),
      /No se encontró la imagen/
    )
  })

  it('IMG-03: una extensión que el OCR no lee se rechaza por formato', async () => {
    await assert.rejects(
      () => ensurePdfRasterized('workspace/invoices/factura.docx'),
      /Formato no soportado/
    )
  })
})
