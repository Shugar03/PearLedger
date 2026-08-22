export interface InventoryItem {
  sku: string
  name: string
  stockActual: number
  consumoDiario: number
  umbralSeguridad: number
}

export interface ForecastResult {
  sku: string
  diasHastaQuiebre: number
  requierePedido: boolean
  cantidadSugerida: number
  propuesta?: string
}

const MOCK_INVENTORY: InventoryItem[] = [
  { sku: 'SKU-001', name: 'Toner HP', stockActual: 45, consumoDiario: 3, umbralSeguridad: 15 },
  { sku: 'SKU-002', name: 'Papel A4', stockActual: 120, consumoDiario: 8, umbralSeguridad: 30 },
]

export function checkInventory(sku?: string): InventoryItem[] {
  if (sku) return MOCK_INVENTORY.filter((i) => i.sku === sku)
  return MOCK_INVENTORY
}

export function runUsageForecast(sku?: string): ForecastResult[] {
  const items = checkInventory(sku)
  return items.map((item) => {
    const diasHastaQuiebre = Math.floor(item.stockActual / item.consumoDiario)
    const stockProyectado = item.stockActual - item.consumoDiario * 7
    const requierePedido = stockProyectado < item.umbralSeguridad
    const cantidadSugerida = requierePedido
      ? item.umbralSeguridad * 2 - item.stockActual
      : 0

    return {
      sku: item.sku,
      diasHastaQuiebre,
      requierePedido,
      cantidadSugerida: Math.max(0, cantidadSugerida),
      propuesta: requierePedido
        ? `Pedido sugerido: ${cantidadSugerida} uds de ${item.name} (${item.sku})`
        : undefined,
    }
  })
}

export function draftPurchaseOrder(forecast: ForecastResult): string {
  if (!forecast.requierePedido) return 'No se requiere pedido.'
  return [
    '--- ORDEN DE COMPRA AUTOMÁTICA ---',
    `SKU: ${forecast.sku}`,
    `Cantidad: ${forecast.cantidadSugerida}`,
    `Motivo: Stock proyectado bajo umbral de seguridad`,
    `Generado: ${new Date().toISOString()}`,
  ].join('\n')
}
