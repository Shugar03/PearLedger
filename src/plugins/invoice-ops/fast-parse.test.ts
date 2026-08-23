import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fastParseInvoice } from '@plugins/invoice-ops/fast-parse.js'

const FACTURA_1 = `FACTURA
SOCIEDAD
PEAR Factura: No 0001234
Fecha: 5 de Enero del 2030
INFORMACION DEL CLIENTE
Nombre: Andres Piraquive
DESCRIPCION PRECIO CANTIDAD TOTAL
lkg de peras $2500.34 1 $2500.34
Tarta de peras $5600.25 1 $5600.25
Helado sabor pera $8900.00 1 $8900.00
CONTACTO Sub-total $17000.59
Descuento (15%) 2550.08
TOTAL $14450.50`

const FACTURA_2 = `LARANAING
FACTURA
A #004
NOMBRE: Borcelle
FECHA: 02 Junio, 2023
DESCRIPCION PRECIO HORAS CANTIDAD
Servicio 1 $50/hora 4 $200.00
Servicio 2 $50/hora 2 $100.00
Diseno 1 $50/hora 5 $250.00
Sub-total $450.00
Descuento (30%) $135.00
TOTAL $315.00`

const FACTURA_3 = `FACTURA
No 7890
Proveedor: Acme Supplies
FECHA: 15/03/2026
DESCRIPCION CANTIDAD PRECIO TOTAL
Tornillos 100 0.50 50.00
Tuercas 200 0.25 50.00
Sub-total 100.00
IVA 21.00
TOTAL 121.00 USD`

const FACTURA_4 = `INVOICE
Invoice #INV-2026-042
Vendor: Global Parts Ltd
Date: 2026-03-20
Item Qty Price Amount
Widget A 10 25.00 250.00
Widget B 5 30.00 150.00
Subtotal 400.00
Tax 0.00
TOTAL 400.00`

describe('fastParseInvoice', () => {
  it('extrae factura-1 con confianza alta', () => {
    const result = fastParseInvoice(FACTURA_1, { minConfidence: 0.6 })
    assert.ok(result)
    assert.equal(result.invoice.invoiceNumber, '0001234')
    assert.equal(result.invoice.total, 14450.5)
    assert.ok(result.invoice.lineItems.length >= 2)
    assert.ok(result.confidence >= 0.75)
  })

  it('extrae factura-2 con total 315', () => {
    const result = fastParseInvoice(FACTURA_2, { minConfidence: 0.6 })
    assert.ok(result)
    assert.equal(result.invoice.total, 315)
    assert.ok(result.invoice.lineItems.length >= 2)
  })

  it('extrae factura-3 con total 121', () => {
    const result = fastParseInvoice(FACTURA_3, { minConfidence: 0.6 })
    assert.ok(result)
    assert.equal(result.invoice.total, 121)
    assert.ok(result.invoice.lineItems.length >= 1)
  })

  it('extrae factura-4 con total 400', () => {
    const result = fastParseInvoice(FACTURA_4, { minConfidence: 0.6 })
    assert.ok(result)
    assert.equal(result.invoice.total, 400)
    assert.equal(result.invoice.invoiceNumber, 'INV-2026-042')
  })

  it('devuelve null con texto vacío', () => {
    assert.equal(fastParseInvoice(''), null)
  })

  it('devuelve null sin número de factura ni total', () => {
    assert.equal(fastParseInvoice('FACTURA\nsin datos'), null)
  })
})
