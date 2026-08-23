/**
 * Lista congelada de tools por plugin.
 *
 * Declarada a mano a propósito: derivarla de los plugins convertiría el test
 * de contrato en una tautología. Añadir una tool implica actualizar este
 * archivo y `contracts/tools.contract.json` en el mismo commit.
 */
export const FROZEN_TOOLS: Record<string, string[]> = {
  'plugin-invoice-ops': ['parse_invoice', 'match_purchase_order'],
  'plugin-procurement-forecast': [
    'check_inventory',
    'run_usage_forecast',
    'draft_purchase_order'
  ],
  'plugin-wdk-settlement': [
    'get_wallet_balance',
    'quote_payment',
    'execute_gasless_payment'
  ]
}
