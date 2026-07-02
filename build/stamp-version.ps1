<#
  stamp-version.ps1
  -----------------
  Writes web/js/version.js with a build stamp in the form yy.MM.dd.HH.mm,
  derived from the most-recently-modified file under web/ (excluding the
  generated version.js itself). Run this after changing anything in web/ so the
  version shown at the bottom of the in-game menu reflects the current build.

      powershell -ExecutionPolicy Bypass -File tools/stamp-version.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web  = Join-Path $root 'web'
$verFile = Join-Path $web 'js\version.js'

$latest = Get-ChildItem -Path $web -Recurse -File |
    Where-Object { $_.FullName -ne $verFile } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$stamp = $latest.LastWriteTime.ToString('yy.MM.dd.HH')
$content = "// Auto-generated build stamp -- run tools/stamp-version.ps1 to refresh.`nexport const VERSION = '$stamp';`n"
[System.IO.File]::WriteAllText($verFile, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Stamped version $stamp (from $($latest.Name))"
