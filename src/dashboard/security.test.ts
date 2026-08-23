/**
 * Saneado del nombre con el que llega una factura desde el navegador.
 *
 * Es la única parte de la subida donde el cliente elige algo que termina en el
 * sistema de archivos, así que se prueba sola: el resto de la ruta arma el
 * destino con `workspaceDir` y no acepta nada más de afuera.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { safeInvoiceName } from '@dashboard/security.js'

describe('safeInvoiceName', () => {
  it('SEC-U1: conserva un nombre normal, con espacios y acentos', () => {
    assert.equal(safeInvoiceName('Factura marzo 2026.pdf'), 'Factura marzo 2026.pdf')
    assert.equal(safeInvoiceName('facturación.png'), 'facturación.png')
  })

  it('SEC-U2: se queda con el último segmento de cualquier ruta', () => {
    assert.equal(safeInvoiceName('../../etc/passwd.pdf'), 'passwd.pdf')
    assert.equal(safeInvoiceName(String.raw`C:\Users\emanu\Desktop\f.pdf`), 'f.pdf')
    assert.equal(safeInvoiceName('/tmp/nested/dir/f.png'), 'f.png')
  })

  it('SEC-U3: rechaza lo que el OCR no sabe leer', () => {
    assert.equal(safeInvoiceName('script.sh'), null)
    assert.equal(safeInvoiceName('factura.pdf.exe'), null)
    assert.equal(safeInvoiceName('sin-extension'), null)
    assert.equal(safeInvoiceName('.pdf'), null)
  })

  it('SEC-U4: rechaza intentos de escapar del directorio', () => {
    assert.equal(safeInvoiceName('..'), null)
    assert.equal(safeInvoiceName('../'), null)
    assert.equal(safeInvoiceName(''), null)
    assert.equal(safeInvoiceName(null), null)
    assert.equal(safeInvoiceName(42), null)
  })

  it('SEC-U5: limpia caracteres de control y prohibidos de Windows', () => {
    assert.equal(safeInvoiceName('fac<tu>ra:2026.pdf'), 'factura2026.pdf')
    assert.equal(safeInvoiceName('linea\nrota.png'), 'linearota.png')
  })

  it('SEC-U6: rechaza los nombres reservados de Windows', () => {
    assert.equal(safeInvoiceName('CON.pdf'), null)
    assert.equal(safeInvoiceName('com1.png'), null)
  })

  it('SEC-U7: acota el largo sin perder la extensión', () => {
    const name = safeInvoiceName(`${'a'.repeat(400)}.pdf`)
    assert.ok(name !== null)
    assert.ok(name.length <= 120, `largo ${name.length}`)
    assert.ok(name.endsWith('.pdf'))
  })
})
