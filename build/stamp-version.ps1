<#
  stamp-version.ps1
  -----------------
  Writes web/js/version.js with a build stamp in the form yy.MM.dd.HH.<sha>
  (hourly date + the HEAD commit's short SHA), so the version changes on every
  commit rather than only when the clock hour rolls over. Also bumps the
  service-worker cache key in web/sw.js to 'fl-<stamp>' so returning visitors drop
  the old cache and pick up fresh assets after a deploy. Run after changing web/.

      powershell -ExecutionPolicy Bypass -File build/stamp-version.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web  = Join-Path $root 'web'
$verFile = Join-Path $web 'js\version.js'
$swFile  = Join-Path $web 'sw.js'

# Build stamp = hourly date + the HEAD commit's short SHA, e.g. 26.07.03.17.9f3a1c2.
# The SHA is what makes the version change on *every commit*: an mtime/date-only
# stamp repeats for two commits in the same hour (and mtimes are identical after a
# fresh checkout, since git doesn't preserve them), so the service-worker cache key
# never moved. Hourly granularity is kept for the date; the SHA guarantees a fresh
# key per commit. Falls back to date-only when git isn't available.
$stamp = (Get-Date).ToString('yy.MM.dd.HH')
try {
    $sha = (& git -C $root rev-parse --short HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $sha) { $stamp = "$stamp.$($sha.Trim())" }
} catch { }

# 1) in-game version stamp
$content = "// Auto-generated build stamp -- run build/stamp-version.ps1 to refresh.`nexport const VERSION = '$stamp';`n"
[System.IO.File]::WriteAllText($verFile, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Stamped version $stamp"

# 2) service-worker cache key -- only rewrite when it actually changes, so the
#    file's timestamp stays put between no-op builds.
if (Test-Path $swFile) {
    $sw = [System.IO.File]::ReadAllText($swFile)
    $swVersion = "fl-$stamp"
    $new = [regex]::Replace($sw, "const VERSION = '[^']*';", "const VERSION = '$swVersion';")
    if ($new -ne $sw) {
        [System.IO.File]::WriteAllText($swFile, $new, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Bumped service-worker cache -> $swVersion"
    } else {
        Write-Host "Service-worker cache already at $swVersion"
    }
}
