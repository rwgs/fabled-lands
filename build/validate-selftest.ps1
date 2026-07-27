#Requires -Version 7.0
<#
  validate-selftest.ps1
  ---------------------
  Drives validate-source.ps1's gate over a tiny fixture tree, once clean and then once per
  mutation, so the gate itself is tested instead of trusted. A validation that silently stops
  catching things looks exactly like a clean corpus (task 199).

  Each case mutates ONE file of an otherwise valid two-book fixture and asserts the reported
  error mentions the right file and reason. Nothing under books/ or web/ is touched: the
  fixture is built in a temp directory and removed afterwards.

  Run: pwsh -ExecutionPolicy Bypass -File build/validate-selftest.ps1   (exit 0 = pass)

  ASCII-only and OS-neutral (forward slashes), like the other build scripts.
#>
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'validate-source.ps1')

$pass = 0
$fail = 0
function Assert([string]$label, [bool]$cond, [string]$detail) {
    if ($cond) { $script:pass++; Write-Host "PASS $label" }
    else { $script:fail++; Write-Host "FAIL $label$(if ($detail) { " - $detail" })" }
}

# ---- The fixture -----------------------------------------------------------------------
# A valid miniature of the real tree: two "bundled" books, one with a pregen whose biography
# lives in its own file (as books 1-4 and 6 do) and one with inline prose (as book 5 does).
$FIXTURE = @{
    'books/book1/1.xml'    = '<section name="1" boxes="2"><p>Start. <goto section="2"/></p><choices><choice section="2">On</choice><choice book="7" section="500">Book 7</choice></choices></section>'
    'books/book1/2.xml'    = '<section name="2"><tick codeword="Ready" hidden="t"/><difficulty ability="scouting" level="10"/><outcomes><outcome range="1-6" section="1"/></outcomes></section>'
    'books/book1/2a.xml'   = '<section name="2a"><p>A continuation.</p><return/></section>'
    'books/book1/Adventurers.xml' = '<adventurers><starting><adventurer name="Andriel the Hammer" profession="Warrior" gender="m"/></starting></adventurers>'
    'books/book1/Andriel.xml'     = '<section name="Andriel"><p>A warrior of few words.</p></section>'
    'books/book2/1.xml'    = '<section name="1"><trade ship="brig" cargo="timb" buy="10"/><if crew="excellent"><p>Fine crew.</p></if></section>'
    'books/book2/Adventurers.xml' = '<adventurers><starting><adventurer name="Shen Darkeye" profession="Mage" gender="f">Born to the violet ocean.</adventurer></starting></adventurers>'
    'rules/Rules.xml'      = '<section name="rules"><h3>Rules</h3><p>Roll two dice.</p><table><tr><td>1</td></tr></table></section>'
    'rules/QuickRules.xml' = '<section name="quick"><p>Quick rules.</p></section>'
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('fl-validate-' + [System.Guid]::NewGuid().ToString('N'))
function Build-Fixture([hashtable]$overrides) {
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    foreach ($rel in $FIXTURE.Keys) {
        $text = if ($overrides -and $overrides.ContainsKey($rel)) { $overrides[$rel] } else { $FIXTURE[$rel] }
        if ($null -eq $text) { continue }   # $null = "delete this file"
        $path = Join-Path $tmp $rel
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
        [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
    }
    # A file the fixture does not name at all (extra pregen bios and the like) still needs the
    # two book dirs and rules dir to exist, which the loop above has created.
    return Test-SourceTree (Join-Path $tmp 'books') (Join-Path $tmp 'rules') @(1, 2)
}

# ---- 1. The clean fixture must pass ----------------------------------------------------
$clean = Build-Fixture $null
Assert 'a valid fixture tree reports no errors' ($clean.Errors.Count -eq 0) ($clean.Errors -join ' | ')
Assert 'every fixture file is actually checked (sections + adventurers + bio + rules)' ($clean.Checked -eq 9) "checked=$($clean.Checked)"

# ---- 2. One mutation per class of mistake ----------------------------------------------
# Each case: a label, the file it breaks, its replacement text, and a fragment the error must
# mention. `$null` text deletes the file.
$CASES = @(
    @{ label = 'not well-formed XML'
       file  = 'books/book1/1.xml'
       text  = '<section name="1"><p>Unclosed.</section>'
       want  = 'not well-formed' }

    @{ label = 'a section name that disagrees with its filename (task 78)'
       file  = 'books/book1/2.xml'
       text  = '<section name="22"><p>Wrong name.</p></section>'
       want  = 'does not match filename' }

    @{ label = 'a wrong root element in a section file'
       file  = 'books/book1/2.xml'
       text  = '<adventurers name="2"><p>Wrong root.</p></adventurers>'
       want  = 'expected <section>' }

    @{ label = 'a wrong root element in Adventurers.xml'
       file  = 'books/book1/Adventurers.xml'
       text  = '<section name="1"><starting><adventurer name="Andriel the Hammer" profession="Warrior" gender="m"/></starting></section>'
       want  = 'expected <adventurers>' }

    @{ label = 'a wrong root element in a rules file'
       file  = 'rules/QuickRules.xml'
       text  = '<rules><p>Quick rules.</p></rules>'
       want  = 'expected <section>' }

    @{ label = 'an unknown tag'
       file  = 'books/book1/1.xml'
       text  = '<section name="1"><p>Text.</p><gainn shards="5"/></section>'
       want  = 'unknown tag <gainn>' }

    @{ label = 'an unknown attribute (the historical safeAddGodd typo)'
       file  = 'books/book1/1.xml'
       text  = '<section name="1"><if safeAddGodd="Nagil"><p>Blessed.</p></if></section>'
       want  = 'unknown attribute safeAddGodd= on <if>' }

    @{ label = 'the singular tag= typo where the engine reads tags='
       file  = 'books/book1/1.xml'
       text  = '<section name="1"><item name="rope" tag="tool"/></section>'
       want  = 'unknown attribute tag= on <item>' }

    @{ label = 'a bad enumerated ability'
       file  = 'books/book1/2.xml'
       text  = '<section name="2"><difficulty ability="scouting|thievry" level="10"/></section>'
       want  = 'ability="thievry"' }

    @{ label = 'a bad enumerated cargo'
       file  = 'books/book2/1.xml'
       text  = '<section name="1"><trade ship="brig" cargo="tmber" buy="10"/></section>'
       want  = 'cargo="tmber"' }

    @{ label = 'a bad enumerated crew quality'
       file  = 'books/book2/1.xml'
       text  = '<section name="1"><if crew="exellent"><p>Fine crew.</p></if></section>'
       want  = 'crew="exellent"' }

    @{ label = 'a bad per-tag type value'
       file  = 'books/book1/2.xml'
       text  = '<section name="2"><item name="potion"><effect type="quaff" verb="Drink"/></item></section>'
       want  = 'type="quaff" is not a <effect> type' }

    @{ label = 'a truth flag that is not t/f'
       file  = 'books/book1/2.xml'
       text  = '<section name="2"><tick codeword="Ready" hidden="ture"/></section>'
       want  = 'hidden="ture" is not a truth flag' }

    @{ label = 'a dangling link inside a bundled book'
       file  = 'books/book1/1.xml'
       text  = '<section name="1"><p>Start. <goto section="999"/></p></section>'
       want  = 'link to section 1:999' }

    @{ label = 'a dangling cross-book link into another BUNDLED book'
       file  = 'books/book1/1.xml'
       text  = '<section name="1"><choices><choice book="2" section="404">Sail</choice></choices></section>'
       want  = 'link to section 2:404' }

    @{ label = 'a malformed referenced pregen biography'
       file  = 'books/book1/Andriel.xml'
       text  = '<section name="Andriel"><p>Unclosed bio.</section>'
       want  = 'not well-formed' }

    @{ label = 'a referenced pregen biography that is missing entirely'
       file  = 'books/book1/Andriel.xml'
       text  = $null
       want  = 'no inline bio and no Andriel.xml' }

    @{ label = 'a referenced pregen biography with no prose'
       file  = 'books/book1/Andriel.xml'
       text  = '<section name="Andriel"><p>   </p></section>'
       want  = 'no biography prose' }
)

foreach ($c in $CASES) {
    $res = Build-Fixture @{ $c.file = $c.text }
    $hit = @($res.Errors | Where-Object { $_ -like "*$($c.want)*" })
    Assert "the gate catches $($c.label)" ($hit.Count -ge 1) ("errors: " + (($res.Errors -join ' | ')))
}

# ---- 3. What must NOT be reported ------------------------------------------------------
# A link into an unbundled book (7-12) is how the series cross-references its sequels, and a
# named entry point is not a section id. Neither may be called dangling.
$ok1 = Build-Fixture @{ 'books/book1/1.xml' = '<section name="1"><choices><choice book="9" section="777">Book 9</choice></choices></section>' }
Assert 'a link into an unbundled book (7-12) is left alone' ($ok1.Errors.Count -eq 0) ($ok1.Errors -join ' | ')
$ok2 = Build-Fixture @{ 'books/book1/1.xml' = '<section name="1"><choices><choice section="2a">Continuation</choice></choices></section>' }
Assert 'a lettered continuation section resolves' ($ok2.Errors.Count -eq 0) ($ok2.Errors -join ' | ')
$ok3 = Build-Fixture @{ 'books/book1/2.xml' = '<section name="2"><if ability="?"><p>Any.</p></if><lose cargo="*"/><gain crew="-1"/></section>' }
Assert 'JaFL wildcards and a crew delta are accepted values' ($ok3.Errors.Count -eq 0) ($ok3.Errors -join ' | ')

if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }

Write-Host ''
Write-Host ("RESULT {0} pass={1} fail={2}" -f $(if ($fail) { 'FAILURES' } else { 'ALL PASS' }), $pass, $fail)
exit $(if ($fail) { 1 } else { 0 })
