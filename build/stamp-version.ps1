<#
  stamp-version.ps1
  -----------------
  Writes web/js/version.js with a build stamp in the form yy.MM.dd.HH, derived
  from the most-recently-modified file under web/ (excluding version.js itself).
  Run after changing anything in web/ so the version shown in-game is current.

      powershell -ExecutionPolicy Bypass -File build/stamp-version.ps1
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
$content = "// Auto-generated build stamp -- run build/stamp-version.ps1 to refresh.`nexport const VERSION = '$stamp';`n"
[System.IO.File]::WriteAllText($verFile, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Stamped version $stamp (from $($latest.Name))"
