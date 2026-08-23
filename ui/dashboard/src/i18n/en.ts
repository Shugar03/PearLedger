import type { Dict } from '@dashboard/i18n/dict'

/** English strings. Same shape as `es.ts`, enforced by the `Dict` type. */
export const en: Dict = {
  nav: {
    sections: 'Sections',
    harness: 'Harness',
    home: 'Home',
    invoices: 'Invoices',
    pay: 'Payments',
    forecast: 'Forecast',
    wallet: 'Wallet',
    tools: 'Tools'
  },

  sidebar: {
    tools: 'Tools',
    version: 'Version',
    harness: 'Harness',
    mode: 'Mode',
    dryRun: 'dry-run',
    harnessBusy: 'Starting…',
    harnessReady: 'Ready',
    harnessError: 'Unavailable'
  },

  topbar: {
    placeholder: 'Path to an invoice to process…',
    pathLabel: 'Invoice path',
    submit: 'Process',
    alerts: 'View alerts',
    theme: 'Switch to dark theme',
    themeLight: 'Switch to light theme',
    language: 'Language'
  },

  languages: {
    es: 'Español',
    en: 'English'
  },

  stream: {
    idle: 'Connecting',
    live: 'Live',
    reconnecting: 'Reconnecting',
    error: 'No stream'
  },

  status: {
    idle: 'Ready',
    ready: (tools: number) => `Ready · ${tools} tools`,
    running: (tool: string) => `Running ${tool}…`,
    loadingModels: 'Loading models…',
    processing: 'Processing invoice…',
    blocked: 'Action blocked: needs human approval',
    failed: 'The tool failed',
    cancelled: 'Simulation cancelled',
    policy: (note: string) => `Server policy: ${note}`,
    toolFailed: (tool: string) => `${tool} failed`,
    error: 'Harness unavailable'
  },

  rail: {
    title: 'Activity',
    session: (count: number) => `session · ${count}`,
    alertsOnly: (count: number) => `alerts · ${count}`,
    emptyAll: 'Every tool you run leaves its mark here.',
    emptyAlerts: 'No blocked or failed tools.',
    legendDone: 'done',
    legendRunning: 'running',
    legendAlerts: 'alerts',
    lastTools: 'Latest tools',
    clear: 'Clear',
    colTime: 'Time',
    colTool: 'Tool',
    colState: 'State',
    emptyTable: 'No runs yet.',
    page: (current: number, total: number) => `${current} / ${total}`,
    range: (from: number, to: number, total: number) => `${from}-${to} of ${total}`,
    previous: 'Previous runs',
    next: 'Next runs'
  },

  state: {
    done: 'Done',
    running: 'Running',
    blocked: 'Blocked',
    failed: 'Failed',
    registered: 'Registered'
  },

  home: {
    balance: 'USDt balance',
    balanceNote: 'Available to settle with vendors.',
    balanceEmpty: 'Not fetched yet: open Wallet and ask for it.',
    openWallet: 'Go to Wallet',
    reconciled: 'Reconciled invoices',
    reconciledNote: 'Of those processed this session, the ones matched to a purchase order.',
    allBadge: 'All',
    openInvoices: 'Go to Invoices',
    sessionInvoices: 'Invoices this session',
    newInvoice: 'Process an invoice',
    emptyNone: 'Process an invoice and it shows up here with its vendor, total and match.',
    emptyFilter: 'No invoice from this session matches the filter.',
    reconciliationOf: (vendor: string) => `Match for ${vendor}`
  },

  filters: {
    all: 'All',
    matched: 'Matched',
    mismatch: 'With differences',
    no_match: 'No order'
  },

  verdicts: {
    matched: 'Matched',
    vendor_mismatch: 'Vendor mismatch',
    amount_mismatch: 'Amount mismatch',
    no_match: 'No purchase order',
    pending: 'Read'
  },

  invoices: {
    title: 'Process an invoice',
    lead: 'OCR runs on this machine and the match compares against the purchase orders in the workspace.',
    path: 'File path',
    pathPlaceholder: 'workspace/invoices/sample.png',
    pickNative: 'Browse the disk',
    pickButton: 'Choose file',
    pickBrowser: 'Choose file',
    process: 'Process invoice',
    demo: 'Use the sample invoice',
    uploading: 'Copying…',
    note1: 'The browser never reveals where the file lives, so picking one copies it into',
    note2: 'and processes it from there. Electron needs none of this: its native dialog returns the real path.',
    needPath: 'Enter the path to the invoice file',
    resultTitle: 'Result',
    resultEmpty: 'Pick an invoice and the summary lands here: vendor, total and match verdict.',
    stepReading: 'Reading the invoice',
    stepReadingDetail: 'local OCR; the first run is slower',
    stepMatching: 'Matching',
    stepMatchingDetail: 'against the purchase orders',
    vendor: 'Vendor',
    total: 'Total',
    number: 'Invoice',
    verdict: 'Match',
    noTotal: 'no total',
    noVendor: 'Invoice with no vendor'
  },

  payments: {
    amount: 'Amount to simulate',
    amountAsks: 'Asks first',
    amountDirect: 'Direct',
    amountNoteOver: 'Above the threshold, the dashboard asks before simulating.',
    amountNoteUnder: 'Below the threshold, the simulation runs without asking.',
    threshold: 'Approval threshold',
    thresholdNote: 'Set by the harness human-approval hook.',
    title: 'Quote and simulate',
    lead: 'The dashboard quotes and simulates. Real signing lives in the CLI, which does have a human in the loop.',
    vendor: 'Vendor (0x…)',
    amountField: 'Amount in USDt',
    simulate: 'Simulate payment',
    quote: 'Quote only',
    note1: 'What the server enforces:',
    note2: 'is forced to',
    note3: 'are stripped from every request, whatever the client sends.',
    resultTitle: 'Result',
    resultEmpty: 'Quotes and simulations return the harness response here.',
    confirmTitle: 'Confirm the simulation',
    confirmBody: (amount: string, threshold: string) =>
      `Simulating ${amount} USDt is above the ${threshold} threshold. The dashboard only simulates: real signing needs the CLI.`,
    confirmCta: 'Simulate anyway',
    cancel: 'Cancel'
  },

  forecast: {
    title: 'Stock projection',
    lead: 'Projected consumption per SKU and estimated stockout date, over the workspace inventory.',
    sku: 'SKU (empty = all)',
    skuPlaceholder: 'MAT-001',
    days: 'Horizon in days',
    run: 'Project consumption',
    inventory: 'View inventory',
    resultForecast: 'Projection',
    resultInventory: 'Inventory',
    empty: 'Run a projection and every SKU shows up here with its stock and stockout date.',
    emptyRows: 'No SKUs to show with those filters.',
    restock: 'Restock',
    inRange: 'In range',
    belowThreshold: 'Below threshold',
    threshold: (qty: number, unit: string) => `threshold ${qty} ${unit}`.trim(),
    consumption: (qty: number, days: number | string) => `${qty} used in ${days} d`,
    reorder: (qty: number) => `reorder ${qty}`,
    breakAt: (date: string) => `out on ${date}`,
    noBreak: 'no stockout'
  },

  wallet: {
    balance: 'USDt balance',
    balanceNote: 'What is available to settle with vendors.',
    upToDate: 'Up to date',
    network: 'Network',
    networkNote: 'Selected by the chainId in the configuration.',
    native: 'Native',
    nativeNote: 'Informational: payments are gasless and do not spend it.',
    title: 'Wallet status',
    lead: 'The balance is fetched when you ask for it. The dashboard signs nothing.',
    refresh: 'Refresh balance',
    fetch: 'Fetch balance'
  },

  tools: {
    title: 'Harness tools',
    lead: (count: number | string) => `${count} tools registered by the local plugins.`,
    loading: 'Loading the catalogue…'
  },

  toolDescriptions: {
    parse_invoice: 'Local OCR and structured extraction of the invoice',
    match_purchase_order: '3-way match against the purchase orders, via RAG',
    check_inventory: 'Current stock by SKU',
    run_usage_forecast: 'Projects consumption and the stockout date',
    draft_purchase_order: 'Drafts a purchase proposal when stock falls below the threshold',
    get_wallet_balance: 'WDK wallet balance: USDt and native',
    quote_payment: 'Quotes a gasless USDt payment (2 min cache, successful quotes only)',
    execute_gasless_payment: 'Runs a gasless USDt transfer (needs an explicit dryRun:false)'
  },

  common: {
    raw: 'Harness response',
    failed: 'Failed:',
    blocked: 'Blocked:',
    noReason: 'the harness gave no reason.',
    none: '—'
  }
}
