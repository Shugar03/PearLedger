# Demo invoice fixtures

- `sample.png` — factura nítida alineada a `PO-2026-001` (INV-001, Proveedor Demo S.A., total $100).
- `sample-invoice.txt` — mismo contenido en texto (referencia OCR / schema).
- `invoice-inv-001.png` — copia con nombre explícito.

OCR en Windows: Path A (`OCR_LATIN`) por defecto. Forzá multimodal con `QVAC_OCR_PATH=multimodal`.

```bash
npm run fixtures:seed
npm run dev -- ingest ./workspace/invoices/sample.png
```
