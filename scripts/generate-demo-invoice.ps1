# Regenera tests/fixtures/demo/sample.png (factura nítida para OCR).
# Usage: powershell -File scripts/generate-demo-invoice.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -ErrorAction SilentlyContinue
if (-not $root) { $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outDir = Join-Path $root 'tests/fixtures/demo'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$w = 900
$h = 1200
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$fontTitle = New-Object System.Drawing.Font 'Arial', 28, ([System.Drawing.FontStyle]::Bold)
$font = New-Object System.Drawing.Font 'Consolas', 16
$fontSm = New-Object System.Drawing.Font 'Consolas', 14
$brush = [System.Drawing.Brushes]::Black
$y = 60
$g.DrawString('INVOICE', $fontTitle, $brush, 60, $y)
$y += 60
$lines = @(
  'Invoice number: INV-001',
  'Vendor: Proveedor Demo S.A.',
  'Date: 2026-08-22',
  'PO Reference: PO-2026-001',
  'Currency: USD',
  '',
  'Line items:',
  'Description                Qty   Unit Price   Total',
  'Material de oficina          1       100.00  100.00',
  '',
  'Subtotal: 100.00',
  'Tax: 0.00',
  'Total: 100.00 USD',
  '',
  'Status: pending payment'
)
foreach ($line in $lines) {
  $use = if ($line -match 'Line items|Description') { $fontSm } else { $font }
  $g.DrawString($line, $use, $brush, 60, $y)
  $y += 36
}
$g.Dispose()

$sample = Join-Path $outDir 'sample.png'
$named = Join-Path $outDir 'invoice-inv-001.png'
$bmp.Save($sample, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Copy-Item $sample $named -Force
$ws = Join-Path $root 'workspace/invoices/sample.png'
New-Item -ItemType Directory -Force -Path (Split-Path $ws) | Out-Null
Copy-Item $sample $ws -Force
Write-Host "Wrote $sample ($((Get-Item $sample).Length) bytes)"
