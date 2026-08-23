/** Las coordenadas de estos casos salen de las facturas de prueba reales. */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { layoutOcrBlocks, type OcrBlock } from '@plugins/invoice-ops/ocr-layout.js'

/** Palabra con caja de 20 px de alto en la fila `y`. */
function word(text: string, x: number, y: number, height = 20): OcrBlock {
  return { text, bbox: [x, y, x + text.length * 10, y + height], confidence: 0.9 }
}

describe('layoutOcrBlocks', () => {
  it('reconstruye una fila de la tabla a partir de palabras sueltas', () => {
    const blocks = [
      word('Tarta', 100, 500),
      word('de', 170, 500),
      word('peras', 200, 500),
      word('$5.600,25', 600, 502),
      word('1', 800, 500),
      word('$5600,25', 900, 501)
    ]

    const layout = layoutOcrBlocks(blocks)

    assert.equal(layout.rows.length, 1)
    assert.equal(layout.rows[0], 'Tarta de peras $5.600,25 1 $5600,25')
    assert.equal(layout.layoutReconstructed, true)
  })

  it('ordena por posición horizontal, no por orden de llegada', () => {
    const layout = layoutOcrBlocks([word('TOTAL', 900, 300), word('Sub-total', 100, 300)])
    assert.equal(layout.rows[0], 'Sub-total TOTAL')
  })

  it('separa filas distintas y las devuelve de arriba abajo', () => {
    const layout = layoutOcrBlocks([
      word('segunda', 100, 400),
      word('primera', 100, 100),
      word('tercera', 100, 700)
    ])
    assert.deepEqual(layout.rows, ['primera', 'segunda', 'tercera'])
    assert.equal(layout.text, 'primera\nsegunda\ntercera')
  })

  it('agrupa una etiqueta con su total aunque tengan tamaños distintos', () => {
    // "TOTAL" en cuerpo pequeño junto a un importe en negrita más alto.
    const blocks = [word('TOTAL', 100, 600, 14), word('$14450,50', 700, 596, 26)]
    const layout = layoutOcrBlocks(blocks)
    assert.equal(layout.rows.length, 1)
    assert.equal(layout.rows[0], 'TOTAL $14450,50')
  })

  it('cuenta los bloques de baja confianza sin descartarlos', () => {
    const blocks: OcrBlock[] = [
      { text: 'FACTURA', bbox: [0, 0, 100, 20], confidence: 0.98 },
      { text: 'ilegible', bbox: [0, 40, 100, 60], confidence: 0.21 }
    ]

    const layout = layoutOcrBlocks(blocks, { minConfidence: 0.5 })

    assert.equal(layout.lowConfidenceCount, 1)
    assert.equal(layout.blockCount, 2)
    assert.match(layout.text, /ilegible/)
    assert.equal(layout.averageConfidence?.toFixed(3), '0.595')
  })

  it('degrada a concatenación simple si el pipeline no devuelve bbox', () => {
    const layout = layoutOcrBlocks([{ text: 'FACTURA' }, { text: 'N 0001234' }])

    assert.equal(layout.layoutReconstructed, false)
    assert.deepEqual(layout.rows, ['FACTURA', 'N 0001234'])
    assert.equal(layout.averageConfidence, null)
  })

  it('tolera bloques vacíos y bbox con valores no finitos', () => {
    const layout = layoutOcrBlocks([
      word('válido', 100, 100),
      { text: '   ', bbox: [200, 100, 260, 120] },
      { text: 'roto', bbox: [Number.NaN, 100, 260, 120] }
    ])

    assert.equal(layout.rows[0], 'válido')
  })

  it('no devuelve filas si no hay bloques', () => {
    const layout = layoutOcrBlocks([])
    assert.deepEqual(layout.rows, [])
    assert.equal(layout.text, '')
    assert.equal(layout.averageConfidence, null)
  })
})
