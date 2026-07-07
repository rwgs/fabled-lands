<#
  stamp-version.ps1
  -----------------
  Writes web/js/version.js with a build stamp of the form yy.MM.dd.<hash>, where
  <hash> is a short digest of the deployed app's source. Because the stamp is
  derived from *content*, it changes whenever the app changes -- on any edit, not
  only on a new git commit. This fixes the version freezing: the previous stamp
  used the HEAD commit's short SHA and was only re-run by build-data.ps1 (which
  is only needed when books/ or rules/ change), so pure web/ or engine commits
  never moved the version at all.

  It also bumps the service-worker cache key in web/sw.js to 'fl-<stamp>', so
  returning visitors drop the old cache and pick up fresh assets after a deploy.
  Run after changing anything under web/ (build-data.ps1 calls this for you when
  it rebuilds the bundled data):

      powershell -ExecutionPolicy Bypass -File build/stamp-version.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web  = Join-Path $root 'web'
$verFile = Join-Path $web 'js\version.js'
$swFile  = Join-Path $web 'sw.js'

# ---- Content hash of the shipped app ---------------------------------------
# Hash every source file that makes up the deployed app, except the two files
# this script rewrites (version.js and sw.js) -- including them would be
# circular. _test.html is a dev-only harness and is left out on purpose. The
# per-file SHA1s are sorted by path and re-hashed, so the digest is stable
# across machines and file orderings and moves whenever any byte changes.
$files = @()
$files += Get-ChildItem -Path (Join-Path $web 'js')   -Filter '*.js'   -File | Where-Object { $_.Name -ne 'version.js' }
$files += Get-ChildItem -Path (Join-Path $web 'css')  -Filter '*.css'  -File
$files += Get-ChildItem -Path (Join-Path $web 'data') -Filter '*.json' -File
foreach ($f in 'index.html', 'manifest.webmanifest') {
    $p = Join-Path $web $f
    if (Test-Path $p) { $files += Get-Item $p }
}

$joined = ($files | Sort-Object FullName | ForEach-Object { (Get-FileHash -Algorithm SHA1 -LiteralPath $_.FullName).Hash }) -join ''
$stream = [System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($joined))
$hash   = (Get-FileHash -Algorithm SHA1 -InputStream $stream).Hash.Substring(0, 7).ToLower()
$stream.Dispose()

$stamp = "$((Get-Date).ToString('yy.MM.dd')).$hash"

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
