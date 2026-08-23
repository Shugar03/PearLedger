# Regenera workspace/invoices/sample.png (factura nítida para OCR DocTR).
# Única copia: demo, smoke y dashboard leen de ahí. Alineada a PO-2026-001.
# Usage: powershell -File scripts/generate-demo-invoice.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outDir = Join-Path $root 'workspace/invoices'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$w = 1000
$h = 1400
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$fontTitle = New-Object System.Drawing.Font 'Arial', 36, ([System.Drawing.FontStyle]::Bold)
$font = New-Object System.Drawing.Font 'Arial', 22, ([System.Drawing.FontStyle]::Regular)
$fontSm = New-Object System.Drawing.Font 'Arial', 18, ([System.Drawing.FontStyle]::Regular)
$brush = [System.Drawing.Brushes]::Black

$y = 80
$g.DrawString('INVOICE', $fontTitle, $brush, 80, $y)
$y += 80

# Formato alineado a fast-parse (Invoice #… / Vendor: …) y a PO-2026-001
$lines = @(
  'Invoice #INV-001',
  'Vendor: Proveedor Demo S.A.',
  'Date: 2026-08-15',
  'PO Reference: PO-2026-001',
  'Currency: USD',
  '',
  'Description                Qty   Unit Price   Total',
  'Material de oficina          1       100.00  100.00',
  '',
  'Subtotal: 100.00',
  'Tax: 0.00',
  'TOTAL: 100.00 USD',
  '',
  'Status: pending payment'
)

foreach ($line in $lines) {
  $use = if ($line -match 'Description|Material') { $fontSm } else { $font }
  $g.DrawString($line, $use, $brush, 80, $y)
  $y += 48
}

$g.Dispose()

$sample = Join-Path $outDir 'sample.png'
$bmp.Save($sample, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Wrote $sample ($((Get-Item $sample).Length) bytes)"
