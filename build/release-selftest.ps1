#Requires -Version 7.0
<#
  release-selftest.ps1
  --------------------
  Drives release.ps1 over fixtures so the edition manifest is tested instead of trusted
  (task 209). Three parts:

    1. books.ini validation - one case per class of malformed, duplicated or dangling
       Published= entry, plus the shapes that must still be accepted.
    2. The service worker's generated offline inventory - a publish set in, the three
       precache lists out, byte-identical on a no-op re-run.
    3. A REAL build of a fixture tree, both directions of a next-book transition: adding
       book 7 must reach meta.json, its bundled data and the offline inventory; withdrawing
       it must delete exactly its own generated files and nothing else.

  Nothing under books/ or web/ is touched: every fixture is built in a temp directory and
  removed afterwards (build-data.ps1 takes -Root for exactly this).

  Run: pwsh -ExecutionPolicy Bypass -File build/release-selftest.ps1   (exit 0 = pass)

  ASCII-only and OS-neutral (forward slashes), like the other build scripts.
#>
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'release.ps1')

$pass = 0
$fail = 0
function Assert([string]$label, [bool]$cond, [string]$detail) {
    if ($cond) { $script:pass++; Write-Host "PASS $label" }
    else { $script:fail++; Write-Host "FAIL $label$(if ($detail) { " - $detail" })" }
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('fl-release-' + [System.Guid]::NewGuid().ToString('N'))
function Reset-Tmp {
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
}
function Write-Text([string]$path, [string]$text) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

# =========================================================================================
# 1. books.ini validation
# =========================================================================================
# A registry fixture: the ini text, and the book directories that exist beside it.
function Test-Ini([string[]]$lines, [string[]]$dirs) {
    Reset-Tmp
    $booksDir = Join-Path $tmp 'books'
    New-Item -ItemType Directory -Force -Path $booksDir | Out-Null
    foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path (Join-Path $booksDir $d) | Out-Null }
    $ini = Join-Path $booksDir 'books.ini'
    Write-Text $ini (($lines -join "`n") + "`n")
    return Get-BookRegistry $ini $booksDir
}

$GOOD = @('Books=1,2', 'Published=1,2', '1.Path=book1', '1.Title=One', '2.Path=book2', '2.Title=Two')
$GOOD_DIRS = @('book1', 'book2')

$clean = Test-Ini $GOOD $GOOD_DIRS
Assert 'a valid registry reports no errors' ($clean.Errors.Count -eq 0) ($clean.Errors -join ' | ')
Assert 'it normalises Published= to the publish set' (($clean.Published -join ',') -eq '1,2') ($clean.Published -join ',')
Assert 'it resolves each published book to its source directory' `
    ($clean.Dirs.Count -eq 2 -and (Split-Path -Leaf $clean.Dirs[2]) -eq 'book2') ($clean.Dirs.Keys -join ',')
Assert 'it keeps the titles the picker shows' ($clean.Titles[1] -eq 'One' -and $clean.Titles[2] -eq 'Two') ($clean.Titles[1])

# Path= is honoured rather than assumed to be "book<N>", so a renamed folder is a one-line
# registry change and a Path= that points nowhere is an error (below) instead of a silent
# fall back to the conventional name.
$alt = Test-Ini @('Published=1', '1.Path=serpent-domain', '1.Title=One') @('serpent-domain')
Assert 'Path= names the source folder, not a book<N> convention' `
    ($alt.Errors.Count -eq 0 -and (Split-Path -Leaf $alt.Dirs[1]) -eq 'serpent-domain') ($alt.Errors -join ' | ')

$order = Test-Ini @('Published= 2 , 1 ', '1.Path=book1', '1.Title=One', '2.Path=book2', '2.Title=Two') $GOOD_DIRS
Assert 'a padded, out-of-order Published= is accepted and sorted' `
    ($order.Errors.Count -eq 0 -and ($order.Published -join ',') -eq '1,2') ($order.Errors -join ' | ')

# books.ini stays ASCII (5.1 misreads a raw non-ASCII byte), so a curly apostrophe is written
# as a backslash-u escape and decoded here - char 16 of the decoded title must be U+2019
# itself. The escape is spelled in two pieces to keep THIS file ASCII-only too.
$escTitle = '1.Title=The Serpent-King' + '\' + 'u2019s Domain'
$esc = Test-Ini @('Published=1', '1.Path=book1', $escTitle) @('book1')
Assert 'a \uXXXX escape in a title is decoded to the character' `
    ($esc.Titles[1].Length -eq 25 -and [int][char]$esc.Titles[1][16] -eq 0x2019) ("[$($esc.Titles[1])] len=$($esc.Titles[1].Length)")

# Each case: a label, the registry lines, the directories present, and a fragment the error
# must mention. Every one of these used to be skipped, defaulted or cast-crashed.
$CASES = @(
    @{ label = 'no Published= line at all'
       lines = @('Books=1,2', '1.Path=book1', '1.Title=One'); dirs = $GOOD_DIRS
       want  = 'no Published= line' }

    @{ label = 'an empty Published= line'
       lines = @('Published=', '1.Path=book1', '1.Title=One'); dirs = $GOOD_DIRS
       want  = 'Published= is empty' }

    @{ label = 'a non-numeric Published= entry'
       lines = @('Published=1,two', '1.Path=book1', '1.Title=One'); dirs = $GOOD_DIRS
       want  = 'entry "two" is not a book number' }

    @{ label = 'a zero Published= entry'
       lines = @('Published=0', '1.Path=book1', '1.Title=One'); dirs = $GOOD_DIRS
       want  = 'entry "0" is not a book number' }

    @{ label = 'a duplicated Published= entry'
       lines = @('Published=1,2,1', '1.Path=book1', '1.Title=One', '2.Path=book2', '2.Title=Two'); dirs = $GOOD_DIRS
       want  = 'lists book 1 more than once' }

    @{ label = 'a published book with no title'
       lines = @('Published=1,2', '1.Path=book1', '1.Title=One', '2.Path=book2'); dirs = $GOOD_DIRS
       want  = 'published book 2 has no 2.Title=' }

    @{ label = 'a published book whose title is blank (it used to become "Book N")'
       lines = @('Published=1,2', '1.Path=book1', '1.Title=One', '2.Path=book2', '2.Title='); dirs = $GOOD_DIRS
       want  = 'published book 2 has no 2.Title=' }

    @{ label = 'a published book with no path'
       lines = @('Published=1,2', '1.Path=book1', '1.Title=One', '2.Title=Two'); dirs = $GOOD_DIRS
       want  = 'published book 2 has no 2.Path=' }

    @{ label = 'a published book whose source directory is missing'
       lines = @('Published=1,2', '1.Path=book1', '1.Title=One', '2.Path=book9', '2.Title=Two'); dirs = @('book1')
       want  = 'source directory books/book9 not found' }
)

foreach ($c in $CASES) {
    $res = Test-Ini $c.lines $c.dirs
    $hit = @($res.Errors | Where-Object { $_ -like "*$($c.want)*" })
    Assert "the registry gate catches $($c.label)" ($hit.Count -ge 1) ("errors: " + ($res.Errors -join ' | '))
}

# A rejected entry must not reach the publish set, or the build would carry on with it.
$bad = Test-Ini @('Published=1,two,1', '1.Path=book1', '1.Title=One') @('book1')
Assert 'a rejected entry is left out of the publish set' (($bad.Published -join ',') -eq '1') ($bad.Published -join ',')

# =========================================================================================
# 2. The service worker's generated offline inventory
# =========================================================================================
$SW_TEMPLATE = (@(
    "const VERSION = 'fl-fixture';",
    '// BEGIN GENERATED BOOK INVENTORY',
    '// END GENERATED BOOK INVENTORY',
    "const REQUIRED = ['./', './data/meta.json', ...BOOK_DATA];",
    'const OPTIONAL = [...BOOK_MAPS, ...BOOK_ILLUS];'
) -join "`n") + "`n"

Reset-Tmp
$swPath = Join-Path $tmp 'sw.js'
Write-Text $swPath $SW_TEMPLATE
$changed = Set-BookInventory $swPath @(1, 7) @('Art One.jpg', 'Art Seven.jpg')
$sw = [System.IO.File]::ReadAllText($swPath)
Assert 'writing the inventory reports the file changed' ($changed -eq $true)
Assert 'the publish set becomes the REQUIRED book data' `
    ($sw -like "*'./data/book1.json',*" -and $sw -like "*'./data/book7.json',*") $sw
Assert 'and the OPTIONAL regional maps' `
    ($sw -like "*'./assets/maps/book1.jpg',*" -and $sw -like "*'./assets/maps/book7.jpg',*") $sw
Assert 'illustration URLs are encoded the way the runtime requests them' `
    ($sw -like "*'./assets/illus/Art%20Seven.jpg',*") $sw
Assert 'the code around the generated region is untouched' `
    ($sw.StartsWith("const VERSION = 'fl-fixture';") -and $sw -like '*const OPTIONAL = `[...BOOK_MAPS, ...BOOK_ILLUS`];*') $sw

Assert 'rewriting the same inventory is a no-op (a rebuild must leave the tree clean)' `
    ((Set-BookInventory $swPath @(1, 7) @('Art One.jpg', 'Art Seven.jpg')) -eq $false)

# Withdrawing a book must restore exactly the smaller inventory, not leave its entries behind.
[void](Set-BookInventory $swPath @(1) @('Art One.jpg'))
$sw1 = [System.IO.File]::ReadAllText($swPath)
Assert 'withdrawing a book drops all three of its inventory entries' `
    ($sw1 -notlike '*book7*' -and $sw1 -notlike '*Art%20Seven*' -and $sw1 -like "*'./data/book1.json',*") $sw1

# Losing the markers must fail loudly: silently shipping an inventory that no longer tracks
# the publish set is the failure this whole file exists to prevent.
Write-Text $swPath "const VERSION = 'fl-fixture';`n"
$threw = $false
try { [void](Set-BookInventory $swPath @(1) @()) } catch { $threw = $true }
Assert 'a missing generated-inventory marker throws instead of passing silently' $threw

# =========================================================================================
# 3. A real build: both directions of a next-book transition
# =========================================================================================
# A miniature repo - two book folders (each with a regional map and one illustration), the
# rules, and just enough of web/ for the stamp step. build-data.ps1 runs against it with
# -Root, so this exercises the actual validation, bundling, copy, reconcile and inventory
# steps rather than a re-implementation of them.
$E2E = @{
    'books/book1/1.xml'           = '<section name="1"><p>Fixture one. <goto section="2"/></p></section>'
    'books/book1/2.xml'           = '<section name="2"><p>Second.</p><return/></section>'
    'books/book1/Adventurers.xml' = '<adventurers><starting><adventurer name="Ona Fixture" profession="warrior" gender="f">A fixture warrior.</adventurer></starting></adventurers>'
    'books/book1/Sokara-Map.jpg'  = 'MAP1'
    'books/book1/Art One.jpg'     = 'ART1'
    'books/book7/1.xml'           = '<section name="1"><p>Fixture seven.</p><return/></section>'
    'books/book7/Adventurers.xml' = '<adventurers><starting><adventurer name="Sev Fixture" profession="mage" gender="m">A fixture mage.</adventurer></starting></adventurers>'
    'books/book7/Serpent-Map.jpg' = 'MAP7'
    'books/book7/Art Seven.jpg'   = 'ART7'
    'rules/Rules.xml'             = '<section name="rules"><p>Roll two dice.</p></section>'
    'rules/QuickRules.xml'        = '<section name="quick"><p>Quick.</p></section>'
    'web/css/style.css'           = 'body{}'
    'web/js/app.js'               = 'export const app = 1;'
}

Reset-Tmp
foreach ($rel in $E2E.Keys) { Write-Text (Join-Path $tmp $rel) $E2E[$rel] }
Write-Text (Join-Path $tmp 'web/sw.js') $SW_TEMPLATE
function Set-Published([string]$published) {
    Write-Text (Join-Path $tmp 'books/books.ini') (@(
        'Books=1,7', "Published=$published",
        '1.Path=book1', '1.Title=Fixture One',
        '7.Path=book7', '7.Title=Fixture Seven'
    ) -join "`n")
}
function Invoke-FixtureBuild {
    # 6>$null: the build's own progress lines would drown the assertions.
    & (Join-Path $PSScriptRoot 'build-data.ps1') -Root $tmp 6>$null
}

# ---- forwards: publishing book 7 -------------------------------------------------------
Set-Published '1,7'
Invoke-FixtureBuild
$meta = [System.IO.File]::ReadAllText((Join-Path $tmp 'web/data/meta.json'))
$sw = [System.IO.File]::ReadAllText((Join-Path $tmp 'web/sw.js'))
Assert 'publishing a book reaches meta.json with its title' `
    ($meta -like '*"number":7,"title":"Fixture Seven"*') $meta
Assert 'publishing a book generates its bundled section data' (Test-Path (Join-Path $tmp 'web/data/book7.json'))
Assert 'publishing a book copies its regional map and illustration' `
    ((Test-Path (Join-Path $tmp 'web/assets/maps/book7.jpg')) -and (Test-Path (Join-Path $tmp 'web/assets/illus/Art Seven.jpg')))
Assert 'publishing a book puts its data in the REQUIRED offline inventory' ($sw -like "*'./data/book7.json',*") $sw
Assert 'publishing a book puts its art in the OPTIONAL offline inventory' `
    ($sw -like "*'./assets/maps/book7.jpg',*" -and $sw -like "*'./assets/illus/Art%20Seven.jpg',*") $sw

# ---- backwards: withdrawing it, with a manual drop-in present --------------------------
# The README invites players to drop general per-section art (e.g. 142.jpg) into
# web/assets/illus/. It matches no book folder's image, so the reconcile must not touch it.
Write-Text (Join-Path $tmp 'web/assets/illus/142.jpg') 'DROPIN'
Set-Published '1'
Invoke-FixtureBuild
$meta = [System.IO.File]::ReadAllText((Join-Path $tmp 'web/data/meta.json'))
$sw = [System.IO.File]::ReadAllText((Join-Path $tmp 'web/sw.js'))
Assert 'withdrawing a book removes its bundled section data' (-not (Test-Path (Join-Path $tmp 'web/data/book7.json')))
Assert 'withdrawing a book removes its copied regional map' (-not (Test-Path (Join-Path $tmp 'web/assets/maps/book7.jpg')))
Assert 'withdrawing a book removes its copied illustration' (-not (Test-Path (Join-Path $tmp 'web/assets/illus/Art Seven.jpg')))
# meta.books is the publish set; meta.titles deliberately keeps ALL series titles, so a
# choice leading into an unpublished book can still name it in the "not in this edition"
# message. Only the books array may lose book 7.
Assert 'withdrawing a book leaves meta.json books and the offline inventory' `
    ($meta -notlike '*"number":7*' -and $meta -like '*"7":"Fixture Seven"*' `
     -and $sw -notlike '*book7*' -and $sw -notlike '*Art%20Seven*') "$meta`n$sw"
Assert 'the still-published book keeps every one of its outputs' `
    ((Test-Path (Join-Path $tmp 'web/data/book1.json')) -and (Test-Path (Join-Path $tmp 'web/assets/maps/book1.jpg')) `
     -and (Test-Path (Join-Path $tmp 'web/assets/illus/Art One.jpg')) -and $sw -like "*'./data/book1.json',*")
Assert 'a manual illustration drop-in is NOT build-owned and survives' (Test-Path (Join-Path $tmp 'web/assets/illus/142.jpg'))

if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }

Write-Host ''
Write-Host ("RESULT {0} pass={1} fail={2}" -f $(if ($fail) { 'FAILURES' } else { 'ALL PASS' }), $pass, $fail)
exit $(if ($fail) { 1 } else { 0 })
