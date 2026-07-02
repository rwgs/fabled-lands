<#
  build-data.ps1
  ---------------
  Bundles the Fabled Lands source data (the book section XML files, the
  per-book starting-character definitions, and the rules) into a small set of
  JSON files that the web app loads at runtime.

  Source of truth is left untouched:
    books/book1..book6/<n>.xml   -> web/data/book<n>.json   ( { "<section>": "<xml>" } )
    books/book<n>/Adventurers.xml -> folded into web/data/meta.json
    rules/*.xml                   -> folded into web/data/meta.json
    books/books.ini               -> book titles in meta.json
    images/world-map.jpg          -> web/assets/world-map.jpg

  Non-numeric section files (*temp.xml, *old.xml, pregen character files, etc.)
  are intentionally skipped -- they are editing leftovers / not real sections.

  Run from the repository root:
      powershell -ExecutionPolicy Bypass -File tools/build-data.ps1
#>

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot   # repo root (parent of tools/)
$books  = Join-Path $root 'books'
$rules  = Join-Path $root 'rules'
$images = Join-Path $root 'images'
$out    = Join-Path $root 'web\data'
$assets = Join-Path $root 'web\assets'

New-Item -ItemType Directory -Force -Path $out    | Out-Null
New-Item -ItemType Directory -Force -Path $assets | Out-Null

function Read-Xml([string]$path) {
    # Read raw, drop the XML prolog (the browser DOMParser does not need it and
    # a stray BOM/encoding declaration can trip fragment parsing).
    $raw = Get-Content -Raw -Encoding UTF8 $path
    return ($raw -replace '(?s)^\s*<\?xml.*?\?>\s*', '').Trim()
}

# ---- Parse books.ini for the canonical titles ------------------------------
$titles = @{}
$iniPath = Join-Path $books 'books.ini'
if (Test-Path $iniPath) {
    foreach ($line in Get-Content -Encoding UTF8 $iniPath) {
        if ($line -match '^\s*(\d+)\.Title\s*=\s*(.+?)\s*$') {
            $num = [int]$Matches[1]
            $t   = $Matches[2]
            # decode \uXXXX escapes found in the ini (e.g. the curly apostrophe)
            $t = [regex]::Replace($t, '\\u([0-9A-Fa-f]{4})', { param($m) [char][int]('0x' + $m.Groups[1].Value) })
            $titles[$num] = $t
        }
    }
}

# ---- Bundle each book -------------------------------------------------------
$bookMeta = @()
for ($b = 1; $b -le 6; $b++) {
    $dir = Join-Path $books ("book{0}" -f $b)
    if (-not (Test-Path $dir)) { continue }

    $map = [ordered]@{}
    Get-ChildItem -Path $dir -Filter '*.xml' |
        Where-Object { $_.BaseName -match '^\d+$' } |
        Sort-Object { [int]$_.BaseName } |
        ForEach-Object { $map[$_.BaseName] = Read-Xml $_.FullName }

    $json = $map | ConvertTo-Json -Depth 4 -Compress
    $bookFile = Join-Path $out ("book{0}.json" -f $b)
    [System.IO.File]::WriteAllText($bookFile, $json, (New-Object System.Text.UTF8Encoding($false)))

    # starting-character data for this book
    $advPath = Join-Path $dir 'Adventurers.xml'
    $advXml  = if (Test-Path $advPath) { Read-Xml $advPath } else { $null }

    $bookMeta += [ordered]@{
        number    = $b
        title     = if ($titles.ContainsKey($b)) { $titles[$b] } else { "Book $b" }
        sections  = $map.Count
        adventurers = $advXml
    }
    Write-Host ("book{0}: {1} sections -> {2:N0} bytes" -f $b, $map.Count, $json.Length)
}

# ---- Rules -----------------------------------------------------------------
$rulesXml      = if (Test-Path (Join-Path $rules 'Rules.xml'))      { Read-Xml (Join-Path $rules 'Rules.xml') }      else { $null }
$quickRulesXml = if (Test-Path (Join-Path $rules 'QuickRules.xml')) { Read-Xml (Join-Path $rules 'QuickRules.xml') } else { $null }

# ---- All 12 canonical titles (books 7-12 have no data but may be linked to) --
$allTitles = [ordered]@{}
foreach ($k in ($titles.Keys | Sort-Object)) { $allTitles["$k"] = $titles[$k] }

# ---- Meta -------------------------------------------------------------------
$meta = [ordered]@{
    generated  = (Get-Date).ToString('yyyy-MM-dd')
    books      = $bookMeta
    titles     = $allTitles
    rules      = $rulesXml
    quickRules = $quickRulesXml
}
$metaJson = $meta | ConvertTo-Json -Depth 6 -Compress
$metaFile = Join-Path $out 'meta.json'
[System.IO.File]::WriteAllText($metaFile, $metaJson, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("meta.json -> {0:N0} bytes" -f $metaJson.Length)

# ---- Copy the world map -----------------------------------------------------
$mapSrc = Join-Path $images 'world-map.jpg'
if (Test-Path $mapSrc) {
    Copy-Item $mapSrc (Join-Path $assets 'world-map.jpg') -Force
    Write-Host 'copied world-map.jpg'
}

# ---- Copy per-book regional maps --------------------------------------------
# Each book folder holds its regional map named "<Region>-Map.jpg". Copy it to
# web/assets/maps/book<N>.jpg for the in-game "Maps" viewer. Extra drop-ins in
# images/maps/ are copied too. (Section illustrations go in web/assets/illus/.)
$mapsOut = Join-Path $assets 'maps'
New-Item -ItemType Directory -Force -Path $mapsOut | Out-Null
for ($b = 1; $b -le 6; $b++) {
    $dir = Join-Path $books ("book{0}" -f $b)
    if (-not (Test-Path $dir)) { continue }
    $map = Get-ChildItem -Path $dir -File | Where-Object { $_.BaseName -match '-Map$' } | Select-Object -First 1
    if ($map) {
        Copy-Item $map.FullName (Join-Path $mapsOut ("book{0}.jpg" -f $b)) -Force
        Write-Host ("book{0} map: {1}" -f $b, $map.Name)
    }
}
$mapsSrc = Join-Path $images 'maps'
if (Test-Path $mapsSrc) { Copy-Item (Join-Path $mapsSrc '*') $mapsOut -Force -ErrorAction SilentlyContinue }

# ---- Refresh the build stamp shown in-game ----------------------------------
& (Join-Path $PSScriptRoot 'stamp-version.ps1')

Write-Host 'Done.'
