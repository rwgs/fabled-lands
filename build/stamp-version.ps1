<#
  stamp-version.ps1
  -----------------
  Writes web/js/version.js with a build stamp in the form yy.MM.dd.HH, derived
  from the most-recently-modified file under web/ (excluding the two generated
  version files themselves). Also bumps the service-worker cache key in
  web/sw.js to 'fl-<stamp>' so returning visitors drop the old cache and pick up
  fresh assets after a deploy. Run after changing anything in web/.

      powershell -ExecutionPolicy Bypass -File build/stamp-version.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web  = Join-Path $root 'web'
$verFile = Join-Path $web 'js\version.js'
$swFile  = Join-Path $web 'sw.js'

# Newest content file, ignoring the generated version.js and sw.js (so their own
# rewrites don't feed back into the stamp on the next run).
$latest = Get-ChildItem -Path $web -Recurse -File |
    Where-Object { $_.FullName -ne $verFile -and $_.FullName -ne $swFile } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$stamp = $latest.LastWriteTime.ToString('yy.MM.dd.HH')

# 1) in-game version stamp
$content = "// Auto-generated build stamp -- run build/stamp-version.ps1 to refresh.`nexport const VERSION = '$stamp';`n"
[System.IO.File]::WriteAllText($verFile, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Stamped version $stamp (from $($latest.Name))"

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
