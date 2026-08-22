param(
  [string]$Source = "assets\branding\lw-md-app-icon.png",
  [string]$Destination = "resources\lw-md.ico"
)

Add-Type -AssemblyName System.Drawing
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$destinationPath = Join-Path (Get-Location) $Destination
$destinationDirectory = Split-Path -Parent $destinationPath
New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$entries = @()
try {
  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
    $graphics.Dispose()
    $png = New-Object System.IO.MemoryStream
    $bitmap.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    $entries += ,@($size, $png.ToArray())
    $png.Dispose()
  }
} finally {
  $sourceImage.Dispose()
}

$writer = New-Object System.IO.BinaryWriter([System.IO.File]::Open($destinationPath, [System.IO.FileMode]::Create))
try {
  $writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$entries.Count)
  $offset = 6 + (16 * $entries.Count)
  foreach ($entry in $entries) {
    $size = $entry[0]; $bytes = $entry[1]
    $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
    $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
    $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([UInt16]1); $writer.Write([UInt16]32)
    $writer.Write([UInt32]$bytes.Length); $writer.Write([UInt32]$offset); $offset += $bytes.Length
  }
  foreach ($entry in $entries) { $writer.Write($entry[1]) }
} finally {
  $writer.Dispose()
}
