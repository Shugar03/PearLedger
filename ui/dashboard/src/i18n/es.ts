/**
 * Textos en español — el idioma de referencia.
 *
 * `en.ts` se declara con el tipo de este objeto, así que agregar una clave acá
 * y olvidarla allá rompe el typecheck en vez de dejar un hueco en pantalla.
 *
 * Los textos que llevan un dato son funciones, no plantillas con marcadores:
 * el orden de las palabras cambia entre idiomas y una función lo resuelve sin
 * inventar una mini sintaxis de interpolación.
 */
export const es = {
  nav: {
    sections: 'Secciones',
    harness: 'Harness',
    home: 'Inicio',
    invoices: 'Facturas',
    pay: 'Pagos',
    forecast: 'Forecast',
    wallet: 'Wallet',
    tools: 'Tools'
  },

  sidebar: {
    tools: 'Tools',
    version: 'Versión',
    harness: 'Harness',
    mode: 'Modo',
    dryRun: 'dry-run',
    harnessBusy: 'Arrancando…',
    harnessReady: 'Listo',
    harnessError: 'No disponible'
  },

  topbar: {
    placeholder: 'Ruta de una factura para procesar…',
    pathLabel: 'Ruta de la factura',
    submit: 'Procesar',
    alerts: 'Ver alertas',
    theme: 'Cambiar a tema oscuro',
    themeLight: 'Cambiar a tema claro',
    language: 'Idioma'
  },

  languages: {
    es: 'Español',
    en: 'English'
  },

  stream: {
    idle: 'Conectando',
    live: 'En vivo',
    reconnecting: 'Reconectando',
    error: 'Sin stream'
  },

  status: {
    idle: 'Listo',
    ready: (tools: number) => `Listo · ${tools} tools`,
    running: (tool: string) => `Ejecutando ${tool}…`,
    loadingModels: 'Cargando modelos…',
    processing: 'Procesando factura…',
    blocked: 'Acción bloqueada: requiere confirmación humana',
    failed: 'La tool falló',
    cancelled: 'Simulación cancelada',
    policy: (note: string) => `Política del servidor: ${note}`,
    error: 'Harness no disponible'
  },

  rail: {
    title: 'Actividad',
    session: (count: number) => `sesión · ${count}`,
    alertsOnly: (count: number) => `alertas · ${count}`,
    emptyAll: 'Cada tool que ejecutés deja su marca acá.',
    emptyAlerts: 'Ninguna tool bloqueada ni fallida.',
    legendDone: 'hechas',
    legendRunning: 'en curso',
    legendAlerts: 'alertas',
    lastTools: 'Últimas tools',
    clear: 'Limpiar',
    colTime: 'Hora',
    colTool: 'Tool',
    colState: 'Estado',
    emptyTable: 'Sin ejecuciones todavía.'
  },

  state: {
    done: 'Hecha',
    running: 'En curso',
    blocked: 'Bloqueada',
    failed: 'Falló',
    registered: 'Registrada'
  },

  home: {
    balance: 'Saldo USDt',
    balanceNote: 'Disponible para liquidar a proveedores.',
    balanceEmpty: 'Todavía no lo consultaste: abrí Wallet y pedilo.',
    openWallet: 'Ir a Wallet',
    reconciled: 'Facturas conciliadas',
    reconciledNote: 'De las procesadas en esta sesión, las que cerraron contra su orden de compra.',
    allBadge: 'Todas',
    openInvoices: 'Ir a Facturas',
    sessionInvoices: 'Facturas de la sesión',
    newInvoice: 'Procesar una factura',
    emptyNone: 'Procesá una factura y aparece acá con su proveedor, su total y su conciliación.',
    emptyFilter: 'Ninguna factura de la sesión cae en este filtro.',
    reconciliationOf: (vendor: string) => `Conciliación de ${vendor}`
  },

  filters: {
    all: 'Todas',
    matched: 'Conciliadas',
    mismatch: 'Con diferencias',
    no_match: 'Sin orden'
  },

  verdicts: {
    matched: 'Conciliada',
    vendor_mismatch: 'Proveedor no coincide',
    amount_mismatch: 'Monto no coincide',
    no_match: 'Sin orden',
    pending: 'Leída'
  },

  invoices: {
    title: 'Procesar factura',
    lead: 'El OCR corre en este equipo y la conciliación compara contra las órdenes de compra del workspace.',
    path: 'Ruta del archivo',
    pathPlaceholder: 'workspace/invoices/sample.png',
    pickNative: 'Buscar en el disco',
    pickButton: 'Elegir archivo',
    pickBrowser: 'Elegir archivo',
    process: 'Procesar factura',
    demo: 'Usar la factura de ejemplo',
    note1: 'El navegador no revela la ruta en disco, sólo el nombre: al elegir un archivo se propone',
    note2: 'y podés corregirla. El diálogo nativo de Electron sí devuelve la ruta completa.',
    needPath: 'Indicá la ruta del archivo de la factura',
    resultTitle: 'Resultado',
    resultEmpty:
      'Elegí una factura y el resumen aparece acá: proveedor, total y veredicto de la conciliación.',
    stepReading: 'Leyendo la factura',
    stepReadingDetail: 'OCR local; en frío puede tardar',
    stepMatching: 'Conciliando',
    stepMatchingDetail: 'contra las órdenes de compra',
    vendor: 'Proveedor',
    total: 'Total',
    number: 'Factura',
    verdict: 'Conciliación',
    noTotal: 'sin total',
    noVendor: 'Factura sin proveedor'
  },

  payments: {
    amount: 'Monto a simular',
    amountAsks: 'Pide confirmación',
    amountDirect: 'Directo',
    amountNoteOver: 'Por encima del umbral, el dashboard pregunta antes de simular.',
    amountNoteUnder: 'Por debajo del umbral, la simulación corre sin preguntar.',
    threshold: 'Umbral de confirmación',
    thresholdNote: 'Lo fija el hook de aprobación humana del harness.',
    title: 'Cotizar y simular',
    lead: 'El dashboard cotiza y simula. La firma real vive en el CLI, que sí tiene canal interactivo con una persona.',
    vendor: 'Proveedor (0x…)',
    amountField: 'Monto en USDt',
    simulate: 'Simular pago',
    quote: 'Sólo cotizar',
    note1: 'Lo que impone el servidor:',
    note2: 'se fuerza a',
    note3: 'se borran de cualquier petición, mande lo que mande el cliente.',
    resultTitle: 'Resultado',
    resultEmpty: 'La cotización y la simulación devuelven acá lo que respondió el harness.',
    confirmTitle: 'Confirmá la simulación',
    confirmBody: (amount: string, threshold: string) =>
      `La simulación de ${amount} USDt supera el umbral de ${threshold}. El dashboard sólo simula: la firma real exige el CLI.`,
    confirmCta: 'Simular igual',
    cancel: 'Cancelar'
  },

  forecast: {
    title: 'Proyección de stock',
    lead: 'Consumo proyectado por SKU y fecha estimada de quiebre, sobre el inventario del workspace.',
    sku: 'SKU (vacío = todos)',
    skuPlaceholder: 'MAT-001',
    days: 'Horizonte en días',
    run: 'Proyectar consumo',
    inventory: 'Ver inventario',
    resultForecast: 'Proyección',
    resultInventory: 'Inventario',
    empty: 'Pedí una proyección y cada SKU aparece acá con su stock y su fecha de quiebre.',
    emptyRows: 'Sin SKUs para mostrar con esos filtros.',
    restock: 'Reponer',
    inRange: 'En rango',
    belowThreshold: 'Bajo umbral',
    threshold: (qty: number, unit: string) => `umbral ${qty} ${unit}`.trim(),
    consumption: (qty: number, days: number | string) => `consumo ${qty} en ${days} d`,
    reorder: (qty: number) => `reponer ${qty}`,
    breakAt: (date: string) => `quiebre ${date}`,
    noBreak: 'sin quiebre'
  },

  wallet: {
    balance: 'Saldo USDt',
    balanceNote: 'Lo que hay disponible para liquidar a proveedores.',
    upToDate: 'Al día',
    network: 'Red',
    networkNote: 'La selecciona el chainId de la configuración.',
    native: 'Nativo',
    nativeNote: 'Informativo: los pagos son gasless y no lo consumen.',
    title: 'Estado de la wallet',
    lead: 'El saldo se consulta cuando lo pedís. El dashboard no firma nada.',
    refresh: 'Actualizar saldo',
    fetch: 'Consultar saldo'
  },

  tools: {
    title: 'Tools del harness',
    lead: (count: number | string) => `${count} tools registradas por los plugins locales.`,
    loading: 'Cargando el catálogo…'
  },

  toolDescriptions: {
    parse_invoice: 'OCR local y extracción estructurada de la factura',
    match_purchase_order: 'Match 3-way contra las órdenes de compra, vía RAG',
    check_inventory: 'Consulta el stock actual por SKU',
    run_usage_forecast: 'Proyecta consumo y fecha de quiebre de stock',
    draft_purchase_order: 'Redacta una propuesta de pedido si el stock baja del umbral',
    get_wallet_balance: 'Saldo de la wallet WDK: USDt y nativo',
    quote_payment: 'Cotiza un pago gasless en USDt (cache de 2 min, sólo cotizaciones válidas)',
    execute_gasless_payment: 'Ejecuta una transferencia gasless de USDt (exige dryRun:false explícito)'
  },

  common: {
    raw: 'Respuesta del harness',
    none: '—'
  }
}
