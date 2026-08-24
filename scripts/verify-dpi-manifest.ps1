[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,

  [string]$ExecutablePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$manifestFile = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifest = Get-Content -LiteralPath $manifestFile -Raw
$dpiAwarenessPattern = '<dpiAwareness[^>]*>\s*PerMonitorV2\s*,\s*PerMonitor\s*</dpiAwareness>'
$legacyDpiAwarePattern = '<dpiAware[^>]*>\s*true/pm\s*</dpiAware>'

if ($manifest -notmatch $dpiAwarenessPattern) {
  throw "The manifest must declare PerMonitorV2 with a PerMonitor fallback."
}

if ($manifest -notmatch $legacyDpiAwarePattern) {
  throw "The manifest must include the legacy Per-Monitor DPI-aware fallback."
}

if ($ExecutablePath) {
  $executableFile = (Resolve-Path -LiteralPath $ExecutablePath).Path
  $mtPath = $null
  $mtCommand = Get-Command mt.exe -ErrorAction SilentlyContinue
  if ($mtCommand) {
    $mtPath = $mtCommand.Source
  }

  if (-not $mtPath -and ${env:ProgramFiles(x86)}) {
    $windowsKitsBin = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
    if (Test-Path -LiteralPath $windowsKitsBin) {
      $mtPath = Get-ChildItem -LiteralPath $windowsKitsBin -Filter mt.exe -File -Recurse |
        Where-Object { $_.FullName -match "\\x64\\mt\.exe$" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
    }
  }

  if (-not $mtPath) {
    throw "mt.exe was not found; run this verification from a Visual Studio developer environment."
  }

  $temporaryManifest = [System.IO.Path]::Combine(
    [System.IO.Path]::GetTempPath(),
    "lw-md-dpi-$([System.Guid]::NewGuid().ToString('N')).manifest")
  try {
    & $mtPath "-inputresource:$executableFile;#1" "-out:$temporaryManifest" | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "mt.exe could not extract the embedded manifest from '$executableFile'."
    }

    $embeddedManifest = Get-Content -LiteralPath $temporaryManifest -Raw
    if ($embeddedManifest -notmatch $dpiAwarenessPattern) {
      throw "The executable does not contain the PerMonitorV2 DPI declaration with fallback."
    }
    if ($embeddedManifest -notmatch $legacyDpiAwarePattern) {
      throw "The executable does not contain the legacy Per-Monitor DPI-aware fallback."
    }
  }
  finally {
    Remove-Item -LiteralPath $temporaryManifest -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "DPI manifest verification passed."
