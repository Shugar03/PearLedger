# PearLedger — Video pitch 3:00 (deck + demo)

## Cómo abrir el deck

El deck es una app React (`ui/deck/`). Un comando lo compila y lo sirve:

```bash
npm run ui:install     # una vez
npm run pitch:deck     # http://localhost:4174
```

Abrilo en Chrome/Edge y poné pantalla completa con `F` (o F11). El HTML no se
abre con doble clic: el bundle son módulos ES y el navegador los bloquea por
`file://`.

| Tecla | Acción |
|-------|--------|
| `→` / Espacio | Siguiente slide |
| `←` | Anterior |
| `1`–`5` | Ir a slide |
| `F` | Fullscreen |

## Mapa tiempo ↔ pantalla

| Tiempo | Slide / pantalla | Notas de grabación |
|--------|------------------|--------------------|
| 0:00–0:08 | Slide 1 · Título | Brand grande; no apurar |
| 0:08–0:18 | Slide 2 · Problema | 4 pains; voz calmada |
| 0:18–0:30 | Slide 3 · Caso | Cut a terminal al terminar el flow |
| 0:30–2:30 | **Demo CLI** (no deck) | ingest → pay dry-run → Pear OTA |
| 2:30–2:45 | Slide 4 · Tracks | Volver al deck |
| 2:45–3:00 | Slide 5 · Permalinks + cierre | Tagline final; freeze en brand line |

## Caso bible (alta fidelidad, dry-run)

| Campo | Valor |
|-------|-------|
| Comprador | PearOps LatAm |
| Vendor | PackRight SA |
| Factura | `INV-2026-0847` |
| PO | `PO-2026-0312` |
| Monto | **250.00 USDt** |
| Modo pago | dry-run (mismo path que prod) |
| Key Pear | `pear://rxqrpu8fxa8fes4izqr8gprfq1facxnr9b37tinxdkrpad7bkq5o` |

## Copy de slides (voz sugerida)

### Slide 1 (~8 s)
> PearLedger. El sistema operativo de tesorería peer-to-peer: privado, local-first y sin comisiones de gas.

### Slide 2 (~10 s)
> Hoy la tesorería vive entre planillas, ERPs en la nube y gas que come margen. Las facturas salen del perímetro. La conciliación es humana y lenta.

### Slide 3 (~12 s)
> Caso en vivo: PearOps recibe la factura de PackRight, la concilia contra la orden de compra y liquida 250 USDt gasless. Todo en el dispositivo. Arrancamos.

### Slide 4 (~15 s)
> Tres tracks en un agente: QVAC con IA local, WDK con settlement gasless a comisión cero, y Pear con distribución e updates P2P.

### Slide 5 (~15 s)
> Permalinks al código para el jurado. Local-first. Gasless. P2P. Soberanía operativa.

## Guion demo CLI (placeholder — fixtures pendientes)

```bash
# 1 · QVAC
npm run dev -- ingest ./workspace/invoices/factura-demo.png

# 2 · WDK dry-run
npm run dev -- pay --vendor 0xVENDOR --amount 250 --usdt

# 3 · Pear (shot)
# mostrar pear.config.json + updates.log / --update-window 0
```

> Vendor address y fixtures se fijan cuando se generen `factura-demo.png` + `PO-2026-0312.json`.

## Owners (TEAM.md)

| Beat | Owner |
|------|-------|
| Voz deck | Una sola voz |
| CLI QVAC / WDK | Antony |
| Pear OTA | Sebastian |
| UI clip opcional | Evelin |
