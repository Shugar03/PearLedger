/** Los importes de estos casos están copiados de las facturas de prueba. */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAmounts, parseAmount } from '@plugins/invoice-ops/amounts.js'

describe('parseAmount', () => {
  it('lee la coma como decimal cuando le siguen dos cifras', () => {
    assert.equal(parseAmount('2.500,34'), 2500.34)
    assert.equal(parseAmount('17.000,59'), 17000.59)
    assert.equal(parseAmount('8900,00'), 8900)
  })

  it('lee el punto como decimal cuando le siguen dos cifras', () => {
    assert.equal(parseAmount('450.00'), 450)
    assert.equal(parseAmount('1.234.567.89'), 1234567.89)
  })

  it('trata tres cifras finales como agrupación de miles', () => {
    assert.equal(parseAmount('20.000'), 20000)
    assert.equal(parseAmount('66.500'), 66500)
    assert.equal(parseAmount('1.234.567'), 1234567)
  })

  it('deja pasar los enteros sin separadores', () => {
    assert.equal(parseAmount('315'), 315)
    assert.equal(parseAmount('0'), 0)
  })

  it('rechaza lo que no es un importe', () => {
    assert.equal(parseAmount('TOTAL'), null)
    assert.equal(parseAmount(''), null)
    assert.equal(parseAmount('$50/hora'), null)
    assert.equal(parseAmount('1234-5678'), null)
  })
})

describe('normalizeAmounts', () => {
  it('normaliza una fila de la tabla conservando el resto del texto', () => {
    assert.equal(
      normalizeAmounts('Tarta de peras $5.600,25 1 $5600,25'),
      'Tarta de peras $5600.25 1 $5600.25'
    )
  })

  it('unifica las dos convenciones en el mismo documento', () => {
    assert.equal(normalizeAmounts('Sub-total $17.000,59'), 'Sub-total $17000.59')
    assert.equal(normalizeAmounts('Sub-total $450.00'), 'Sub-total $450.00')
  })

  it('corrige el total que antes se inflaba cien veces', () => {
    assert.equal(normalizeAmounts('TOTAL $14.450,50'), 'TOTAL $14450.50')
  })

  it('no toca las fechas', () => {
    assert.equal(normalizeAmounts('FECHA: 02.06.2023'), 'FECHA: 02.06.2023')
    assert.equal(normalizeAmounts('2 de Mayo de 2030'), '2 de Mayo de 2030')
    assert.equal(normalizeAmounts('12/06/2023'), '12/06/2023')
  })

  it('no toca teléfonos ni números de cuenta', () => {
    assert.equal(normalizeAmounts('(55) 1234-5678'), '(55) 1234-5678')
    assert.equal(normalizeAmounts('15-1234-5678'), '15-1234-5678')
    assert.equal(normalizeAmounts('0123 4567 8901'), '0123 4567 8901')
  })

  it('no toca porcentajes ni precios por hora', () => {
    assert.equal(normalizeAmounts('Descuento (15%)'), 'Descuento (15%)')
    assert.equal(normalizeAmounts('$50/hora 4 $200.00'), '$50/hora 4 $200.00')
  })

  it('respeta el punto final de una frase', () => {
    assert.equal(
      normalizeAmounts('El importe es 2.500,34. Gracias.'),
      'El importe es 2500.34. Gracias.'
    )
  })

  it('devuelve el texto intacto si no hay importes', () => {
    const text = 'INFORMACION DEL CLIENTE\nNombre: Andrés Piraquive'
    assert.equal(normalizeAmounts(text), text)
  })
})
