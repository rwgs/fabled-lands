<#
  build-data.ps1
  ---------------
  Bundles the Fabled Lands source data (book section XML, per-book starting
  characters, and the rules) into the JSON files the web app loads at runtime,
  copies the world + regional maps, and refreshes the build stamp.

  Source of truth is left untouched:
    books/book1..book6/<n>.xml    -> web/data/book<n>.json  ( { "<section>": "<xml>" } )
    books/book<n>/Adventurers.xml -> folded into web/data/meta.json
    rules/*.xml                   -> folded into web/data/meta.json
    books/books.ini               -> book titles in meta.json
    images/world-map.jpg          -> web/assets/world-map.jpg
    books/book<n>/<Region>-Map.*  -> web/assets/maps/book<n>.jpg

  Run from the repository root:
      powershell -ExecutionPolicy Bypass -File build/build-data.ps1
#>

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot   # repo root (parent of build/)
$books  = Join-Path $root 'books'
$rules  = Join-Path $root 'rules'
$images = Join-Path $root 'images'
$out    = Join-Path $root 'web\data'
$assets = Join-Path $root 'web\assets'

New-Item -ItemType Directory -Force -Path $out    | Out-Null
New-Item -ItemType Directory -Force -Path $assets | Out-Null

function Read-Xml([string]$path) {
    $raw = Get-Content -Raw -Encoding UTF8 $path
    return ($raw -replace '(?s)^\s*<\?xml.*?\?>\s*', '').Trim()
}

# ---- Pregen starting characters --------------------------------------------
# Each book's Adventurers.xml <starting> block lists the six pre-made characters
# (name, profession, gender). Their bios live either inline in that element
# (book 5) or in a per-character file named after the character's first name
# (e.g. book1/Andriel.xml). We fold the first <p> of that prose into the bundled
# data so the create-character screen can offer each ready-made adventurer while
# still letting the player type a custom name.
function Get-Pregens([string]$dir, [string]$advXml) {
    $list = @()
    if (-not $advXml) { return $list }
    try {
        $doc = New-Object System.Xml.XmlDocument
        $doc.LoadXml($advXml)
    } catch { Write-Warning "  pregens: could not parse Adventurers.xml in $dir"; return $list }

    foreach ($a in $doc.SelectNodes('//starting/adventurer')) {
        $name = $a.GetAttribute('name')
        $prof = $a.GetAttribute('profession')
        $g    = $a.GetAttribute('gender')
        $gender = if ($g -and $g.Trim().ToLower().StartsWith('m')) { 'm' } else { 'f' }

        $bio = "$($a.InnerText)".Trim()   # inline prose (book 5)
        if (-not $bio) {
            $first = ($name -split '\s+')[0]
            $cf = Join-Path $dir ($first + '.xml')
            if (Test-Path $cf) {
                try {
                    $cdoc = New-Object System.Xml.XmlDocument
                    $cdoc.LoadXml((Read-Xml $cf))
                    $p = $cdoc.SelectSingleNode('//section/p[1]')
                    if ($p) { $bio = $p.InnerText }
                } catch { Write-Warning "  pregens: could not parse $cf" }
            }
        }
        $bio = ([regex]::Replace($bio, '\s+', ' ')).Trim()

        $list += [ordered]@{ name = $name; profession = $prof; gender = $gender; bio = $bio }
    }
    return $list
}

# ---- Parse books.ini for the canonical titles ------------------------------
$titles = @{}
$iniPath = Join-Path $books 'books.ini'
if (Test-Path $iniPath) {
    foreach ($line in Get-Content -Encoding UTF8 $iniPath) {
        if ($line -match '^\s*(\d+)\.Title\s*=\s*(.+?)\s*$') {
            $num = [int]$Matches[1]
            $t   = $Matches[2]
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

    # Numeric sections, plus lettered sub-sections like "448a"/"609a" that the
    # numbered sections link to (e.g. <success section="609a"/>). Sort by the
    # numeric prefix, then by name so "448" precedes "448a".
    $map = [ordered]@{}
    Get-ChildItem -Path $dir -Filter '*.xml' |
        Where-Object { $_.BaseName -match '^\d+[a-z]?$' } |
        Sort-Object @{ Expression = { [int]($_.BaseName -replace '[a-z]+$', '') } }, @{ Expression = { $_.BaseName } } |
        ForEach-Object { $map[$_.BaseName] = Read-Xml $_.FullName }

    $json = $map | ConvertTo-Json -Depth 4 -Compress
    $bookFile = Join-Path $out ("book{0}.json" -f $b)
    [System.IO.File]::WriteAllText($bookFile, $json, (New-Object System.Text.UTF8Encoding($false)))

    $advPath = Join-Path $dir 'Adventurers.xml'
    $advXml  = if (Test-Path $advPath) { Read-Xml $advPath } else { $null }
    $pregens = @(Get-Pregens $dir $advXml)

    $bookMeta += [ordered]@{
        number      = $b
        title       = if ($titles.ContainsKey($b)) { $titles[$b] } else { "Book $b" }
        sections    = $map.Count
        adventurers = $advXml
        pregens     = $pregens
    }
    Write-Host ("book{0}: {1} sections, {2} pregens -> {3:N0} bytes" -f $b, $map.Count, $pregens.Count, $json.Length)
}

# ---- Rules -----------------------------------------------------------------
$rulesXml      = if (Test-Path (Join-Path $rules 'Rules.xml'))      { Read-Xml (Join-Path $rules 'Rules.xml') }      else { $null }
$quickRulesXml = if (Test-Path (Join-Path $rules 'QuickRules.xml')) { Read-Xml (Join-Path $rules 'QuickRules.xml') } else { $null }

# ---- All 12 canonical titles ------------------------------------------------
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
    $rmap = Get-ChildItem -Path $dir -File | Where-Object { $_.BaseName -match '-Map$' } | Select-Object -First 1
    if ($rmap) {
        Copy-Item $rmap.FullName (Join-Path $mapsOut ("book{0}.jpg" -f $b)) -Force
        Write-Host ("book{0} map: {1}" -f $b, $rmap.Name)
    }
}
$mapsSrc = Join-Path $images 'maps'
if (Test-Path $mapsSrc) { Copy-Item (Join-Path $mapsSrc '*') $mapsOut -Force -ErrorAction SilentlyContinue }

# ---- Refresh the build stamp shown in-game ----------------------------------
& (Join-Path $PSScriptRoot 'stamp-version.ps1')

Write-Host 'Done.'
