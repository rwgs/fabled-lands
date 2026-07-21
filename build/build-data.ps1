#Requires -Version 7.0
# The build requires PowerShell 7 (pwsh). Under Windows PowerShell 5.1 the outputs
# diverge silently: ConvertTo-Json escapes non-ASCII differently and the culture-aware
# Sort-Object reorders the stamp inputs, so 5.1 would rewrite every book JSON and the
# version stamp. The #Requires line makes 5.1 refuse to run (with a clear message)
# instead of producing a divergent build. Run: pwsh -File build/build-data.ps1 (task 121)
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

  Run from the repository root (requires PowerShell 7 - see #Requires below):
      pwsh -ExecutionPolicy Bypass -File build/build-data.ps1
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

# ---- XML validation (task 13) ----------------------------------------------
# Parse a bundled fragment as strict XML so a malformed file is caught at build
# time rather than throwing at render time in the browser. Returns $null when
# valid, or an error string. `$expectRoot` (e.g. 'section') also checks the root
# element. NOTE: use .get_Name() - PowerShell's XML type adapter overrides plain
# .Name to return the `name` ATTRIBUTE, not the element's tag name.
function Test-XmlDoc([string]$xml, [string]$label, [string]$expectRoot, [string[]]$expectNames) {
    if (-not $xml) { return $null }   # an absent optional file is not an error
    try {
        $doc = New-Object System.Xml.XmlDocument
        $doc.LoadXml($xml)
    } catch {
        return "$label : not well-formed XML - $($_.Exception.Message)"
    }
    if ($expectRoot -and $doc.DocumentElement.get_Name() -ne $expectRoot) {
        return "$label : root is <$($doc.DocumentElement.get_Name())>, expected <$expectRoot>"
    }
    # A section file's <section name> must match its filename key (task 78). A purely
    # numeric file must match exactly; a lettered continuation may use either its full
    # name (448a -> "448a") or its printed parent number (609a -> "609"), so both are
    # passed in $expectNames. `.GetAttribute` is used deliberately - the plain .Name
    # property is overridden by PowerShell's XML adapter to return the `name` attribute.
    if ($expectNames -and $expectNames.Count -gt 0) {
        $actual = $doc.DocumentElement.GetAttribute('name')
        if ($expectNames -notcontains $actual) {
            return "$label : section name=`"$actual`", expected `"$($expectNames -join '" or "')`" (does not match filename)"
        }
    }
    return $null
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

# ---- Validate the source XML before bundling (task 13) ----------------------
# Every section is parsed as strict XML (well-formed + rooted at <section>), plus
# each book's Adventurers.xml and the rules files, BEFORE anything is written. A
# malformed file aborts the build here - with the file named - instead of shipping
# broken JSON that only throws when the browser renders that section. The runtime
# DOMParser is more lenient, so this is a deliberately stricter gate; the corpus
# is clean, so it never fires spuriously.
Write-Host 'Validating source XML...'
$xmlErrors = @()
$xmlChecked = 0
for ($b = 1; $b -le 6; $b++) {
    $dir = Join-Path $books ("book{0}" -f $b)
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Path $dir -Filter '*.xml' |
        Where-Object { $_.BaseName -match '^\d+[a-z]?$' } |
        ForEach-Object {
            $xmlChecked++
            # Accepted names: the full filename, and its numeric prefix for a lettered
            # continuation (609a -> "609" or "609a"). For a purely numeric file both are
            # the same, so the match is exact. (task 78)
            $expectNames = @($_.BaseName, ($_.BaseName -replace '[a-z]+$', '')) | Select-Object -Unique
            $e = Test-XmlDoc (Read-Xml $_.FullName) ("book{0}/{1}" -f $b, $_.Name) 'section' $expectNames
            if ($e) { $xmlErrors += $e }
        }
    $advPath = Join-Path $dir 'Adventurers.xml'
    if (Test-Path $advPath) {
        $xmlChecked++
        $e = Test-XmlDoc (Read-Xml $advPath) ("book{0}/Adventurers.xml" -f $b) $null
        if ($e) { $xmlErrors += $e }
    }
}
foreach ($rf in @('Rules.xml', 'QuickRules.xml')) {
    $rp = Join-Path $rules $rf
    if (Test-Path $rp) {
        $xmlChecked++
        $e = Test-XmlDoc (Read-Xml $rp) "rules/$rf" $null
        if ($e) { $xmlErrors += $e }
    }
}
if ($xmlErrors.Count -gt 0) {
    Write-Host ("XML validation FAILED - {0} of {1} file(s) malformed:" -f $xmlErrors.Count, $xmlChecked)
    $xmlErrors | ForEach-Object { Write-Host "  $_" }
    throw "Build aborted: fix the source XML above and re-run."
}
Write-Host ("XML OK: {0} files well-formed." -f $xmlChecked)

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
# No build date here: nothing in web/js reads it, and a per-run timestamp would
# make a no-op rebuild (unchanged books/rules) produce a different meta.json, a
# new version stamp, and a new service-worker cache key -- forcing every installed
# player to re-download a byte-identical app. meta.json is now purely content. (task 144)
$meta = [ordered]@{
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

# ---- Copy per-book section illustrations ------------------------------------
# A handful of sections show an in-text illustration via <image file="..."> (or a
# section image="..." attribute): the Forest of the Forsaken map, the map of
# Bazalek Isle, the Black Diptych. Each image file lives beside its book's XML.
# Copy every book-folder image that is NOT the "<Region>-Map" regional map into
# web/assets/illus/ under its own name, so render.js can resolve it there. (task 62)
$illusOut = Join-Path $assets 'illus'
New-Item -ItemType Directory -Force -Path $illusOut | Out-Null
for ($b = 1; $b -le 6; $b++) {
    $dir = Join-Path $books ("book{0}" -f $b)
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Path $dir -File |
        Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|gif)$' -and $_.BaseName -notmatch '-Map$' -and $_.BaseName -notmatch 'cover' } |
        ForEach-Object {
            Copy-Item $_.FullName (Join-Path $illusOut $_.Name) -Force
            Write-Host ("book{0} illustration: {1}" -f $b, $_.Name)
        }
}

# ---- Refresh the build stamp shown in-game ----------------------------------
& (Join-Path $PSScriptRoot 'stamp-version.ps1')

Write-Host 'Done.'
