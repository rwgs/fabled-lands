#Requires -Version 7.0
<#
  validate-source.ps1
  -------------------
  The source-XML gate the build runs BEFORE writing any generated file, and the reader
  both phases share. Dot-sourced by build-data.ps1 (which owns the bundling) and by
  validate-selftest.ps1 (which drives it over mutation fixtures).

  Task 13 added well-formedness + a numeric <section name> check. That accepted every
  mistake that does not break the parser: an unknown tag or attribute (the historical
  `safeAddGodd` and `tag`/`tags` typos), an invalid enumerated value, a link to a section
  that does not exist in a bundled book, a malformed pregen biography, and a wrong root
  element (Adventurers.xml and the rules files were passed no expected root at all). Each
  of those reaches the browser as silently missing behaviour rather than a build failure,
  so this file closes the vocabulary (task 199).

  The vocabulary is deliberately a CLOSED allowlist of what the corpus and the engine use
  today. A genuinely new tag/attribute/value must be added here in the same change that
  teaches the engine to read it - which is the point: a typo cannot ship as a silent no-op.

  ASCII-only and OS-neutral (forward slashes) like the other build scripts: CI runs them
  on Linux and greps them for non-ASCII bytes, which break Windows PowerShell 5.1 parsing.
#>

# The bundled text is LF-normalised so the JSON is a pure function of the source CONTENT.
# Without this a core.autocrlf=true checkout (CRLF working tree) bundles "\r\n" where an LF
# checkout bundles "\n" - ~8,500 differing escapes per book - so the committed data could not
# be checked against a rebuild in CI, and the same content produced two different version
# stamps. Nothing is lost: both XmlDocument here and the browser's DOMParser normalise CRLF
# to LF while parsing, so this only strips the builder's platform out of the output. (task 197)
function Read-Xml([string]$path) {
    $raw = (Get-Content -Raw -Encoding UTF8 $path) -replace "`r`n", "`n"
    return ($raw -replace '(?s)^\s*<\?xml.*?\?>\s*', '').Trim()
}

# ---- The vocabulary --------------------------------------------------------------------
# tag -> every attribute that tag may carry, across all four kinds of source file (book
# sections, Adventurers.xml, the rules prose, and the pregen biographies). A union rather
# than one table per kind: the root check below already separates the kinds, and a stray
# <gold> in a section file is harmless, while a MISSPELLED tag or attribute is not.
$script:FL_TAG_ATTRS = @{
    # -- prose / structure (the rules files add h3/h4/table/tr/td) --
    'p' = ''; 'b' = ''; 'i' = ''; 'h3' = ''; 'h4' = ''; 'table' = ''; 'tr' = ''; 'td' = ''
    'desc' = ''; 'text' = ''; 'flee' = ''; 'reroll' = ''; 'else' = ''; 'choices' = ''
    'section' = 'boxes dock image name profession start tag todock'
    'sectionview' = 'random title'
    'header' = 'header1 header2 header3 type'
    'image' = 'book file title'
    'field' = 'label name text'
    # -- navigation and conditions --
    'choice' = 'book box currency dead flee god item pay profession revisit sail section shards tags'
    'goto' = 'book dead force hidden price sail section visit'
    'extrachoice' = 'atbook atsection book key remove section tag text'
    'if' = 'ability armour blessing bonus book cache cargo codeword crew curse dead dice disease docked equals gender god greaterthan group item lessthan modifier name not poison profession resurrection safeAddGod shards ship tags ticks title tool using var weapon'
    'elseif' = 'codeword crew equals god hidden item lessthan profession ship ticks title var weapon'
    'group' = 'force'
    'while' = 'var'
    'return' = 'force'
    'include' = 'armour weapon'
    'exclude' = 'bonus item reason tags'
    # -- rolls --
    'random' = 'dice flag force type var'
    'difficulty' = 'ability flag force hidden level modifier var'
    'rankcheck' = 'add dice'
    'training' = 'ability add dice var'
    'outcomes' = 'flag var'
    'outcome' = 'blessing book codeword flag range section var'
    'success' = 'ability book section var'
    'failure' = 'book section var'
    # -- rewards, costs and state --
    'gain' = 'ability amount blessing codeword crew flag force hidden price shards title'
    'lose' = 'ability amount armour blessing bonus cache cargo chance codeword crew curse disease fatal flag force god group hidden item itemAt multiple poison price resurrection shards ship stamina staminato tags title using weapon'
    'tick' = 'ability addbonus addtag amount blessing bonus cache cargo codeword count crew effect flag force god hidden item name permanent price profession quantity removetag shards special tags title titleAdjust titlePattern titleValue using weapon'
    'set' = 'cache codeword dock force hidden item modifier tags value var weapon'
    'adjust' = 'ability amount codeword crew default god greaterthan item modifier name profession ship tags title titleVal value'
    'adjustmoney' = 'cache force multiply name'
    'transfer' = 'armour bonus force from hidden item limit price shards to weapon xarmour xgroup xitem'
    'rest' = 'hidden shards stamina'
    'resurrection' = 'book flag god hidden section shards supplemental text'
    'curse' = 'cumulative lift name'
    'disease' = 'name'
    'poison' = 'name'
    'effect' = 'ability bonus description divide target text type uses verb'
    # -- possessions, markets and caches --
    'item' = 'buy buytags flag force group hidden name quantity replace sell tags verb'
    'items' = 'group limit'
    'weapon' = 'bonus buy buytags flag force group name profession quantity replace sell tags'
    'armour' = 'bonus buy buytags group name quantity sell'
    'tool' = 'ability bonus buy flag group name replace sell'
    'market' = 'buy currency sell'
    'buy' = 'ability bonus cargo crew flag force initialCrew item name quantity shards ship tags tool'
    'sell' = 'cargo item price quantity shards'
    'sold' = 'item tags'
    'trade' = 'buy cargo initialCrew name quantity sell ship'
    'itemcache' = 'itemlimit max name text'
    'moneycache' = 'max multiples name text withdrawCharge'
    # -- combat --
    'fight' = 'abilityDamaged attackDice attacks combat defence flee group modifiers name playerDefence playerFirst preDamage stamina staminaLost useCache'
    'fightdamage' = 'type'
    'fightround' = 'pre'
    # -- Adventurers.xml (the six pre-made characters per book) --
    'adventurers' = ''; 'starting' = ''; 'abilities' = ''
    'adventurer' = 'gender name profession'
    'profession' = 'name'
    'rank' = 'amount'
    'stamina' = 'amount'
    'gold' = 'amount'
}

# Attributes whose value is a JaFL truth flag. The books write both letters and words.
$script:FL_BOOL_ATTRS = @('force', 'hidden', 'dead', 'not', 'using', 'sail', 'start', 'revisit',
                          'cumulative', 'permanent', 'supplemental', 'visit', 'playerFirst', 'fatal')
$script:FL_BOOL_VALUES = @('t', 'f', 'true', 'false')

# Closed value sets, mirroring the engine's own canonical lists (web/js/rules.js ABILITIES /
# SHIP_TYPES + aliases / CREW_LEVELS / CARGO_TYPES, and state.js's blessing names). A value
# may be a '|'-separated union, and '?'/'*' are JaFL's match-any wildcards.
$script:FL_ENUMS = @{
    'ability'        = 'charisma combat magic sanctity scouting thievery rank stamina defence'
    'abilityDamaged' = 'charisma combat magic sanctity scouting thievery rank stamina defence'
    # A blessing is an opaque named token to the engine, but the set is small and fixed: a
    # misspelling would silently never be granted, tested or spent. storms/storm and
    # poison/disease are the same blessing under two spellings (state.js BLESSING_ALIASES).
    'blessing'       = 'charisma combat magic sanctity scouting thievery defence disease poison injury luck storm storms travel wrath'
    'crew'           = 'poor average good excellent'   # or an integer delta - see below
    'gender'         = 'm f male female'
    'profession'     = 'mage priest rogue troubadour warrior wayfarer'
    'ship'           = 'barque brigantine galleon brig gall galley t'  # 't' = "any ship"
    'special'        = 'armourlock attack defence difficultyCurse difficultyRestore godless lock unlock weaponlock'
}
# The eight tradable commodities. Ports abbreviate them ("grai", "meta", "timb"), which
# canonCargo folds by prefix, so a prefix of exactly one commodity is legal here too.
$script:FL_CARGO = @('grain', 'furs', 'metals', 'minerals', 'spices', 'textiles', 'timber', 'slaves')
# `type` means something different on each tag that carries it.
$script:FL_TYPE_VALUES = @{
    'effect'      = 'ability aura use wielded'
    'fightdamage' = 'add replace'
    'header'      = 'armour cargo magic other ship ships shipsale weapon'
    'random'      = 'travel'
}

# ---- Element checks --------------------------------------------------------------------
# Parse a bundled fragment as strict XML so a malformed file is caught at build time rather
# than throwing at render time in the browser. Returns $null when valid, or an error string.
# `$expectRoot` (e.g. 'section') also checks the root element. NOTE: use .get_Name() -
# PowerShell's XML type adapter overrides plain .Name to return the `name` ATTRIBUTE.
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

# Parse and return the document, or $null (the caller has already reported the parse error).
function Get-XmlDoc([string]$xml) {
    if (-not $xml) { return $null }
    try {
        $doc = New-Object System.Xml.XmlDocument
        $doc.LoadXml($xml)
        return $doc
    } catch { return $null }
}

# One attribute value against its closed set. Returns $null when acceptable, else the reason.
function Test-AttrValue([string]$tag, [string]$attr, [string]$value) {
    if ($script:FL_BOOL_ATTRS -contains $attr) {
        if ($script:FL_BOOL_VALUES -notcontains $value.Trim().ToLowerInvariant()) {
            return "$attr=`"$value`" is not a truth flag (t/f)"
        }
        return $null
    }
    if ($attr -eq 'type' -and $script:FL_TYPE_VALUES.ContainsKey($tag)) {
        $allowed = $script:FL_TYPE_VALUES[$tag] -split ' '
        if ($allowed -notcontains $value.Trim().ToLowerInvariant()) {
            return "type=`"$value`" is not a <$tag> type ($($script:FL_TYPE_VALUES[$tag]))"
        }
        return $null
    }
    if ($attr -eq 'cargo' -or $script:FL_ENUMS.ContainsKey($attr)) {
        foreach ($part in ($value -split '\|')) {
            $p = $part.Trim().ToLowerInvariant()
            if ($p -eq '' -or $p -eq '?' -or $p -eq '*') { continue }   # JaFL match-any wildcards
            if ($attr -eq 'cargo') {
                # canonCargo folds an abbreviation to the one commodity it prefixes.
                if (@($script:FL_CARGO | Where-Object { $_.StartsWith($p) }).Count -ne 1) {
                    return "cargo=`"$part`" is not one of the eight commodities"
                }
                continue
            }
            if ($attr -eq 'crew' -and $p -match '^[+-]?\d+$') { continue }  # a crew-quality delta
            if (($script:FL_ENUMS[$attr] -split ' ') -notcontains $p) {
                return "$attr=`"$part`" is not a known $attr ($($script:FL_ENUMS[$attr]))"
            }
        }
    }
    return $null
}

# Walk an element tree against the vocabulary. Appends "<label> : ..." strings to $errors.
function Test-XmlVocabulary($el, [string]$label, [System.Collections.ArrayList]$errors) {
    if ($null -eq $el -or $el.NodeType -ne [System.Xml.XmlNodeType]::Element) { return }
    $tag = $el.get_Name()
    if (-not $script:FL_TAG_ATTRS.ContainsKey($tag)) {
        [void]$errors.Add("$label : unknown tag <$tag>")
        return   # its attributes and children are meaningless without a known tag
    }
    $allowed = $script:FL_TAG_ATTRS[$tag] -split ' '
    foreach ($a in $el.Attributes) {
        $name = $a.get_Name()
        if ($allowed -notcontains $name) {
            [void]$errors.Add("$label : unknown attribute $name= on <$tag>")
            continue
        }
        $bad = Test-AttrValue $tag $name $a.Value
        if ($bad) { [void]$errors.Add("$label : <$tag> $bad") }
    }
    foreach ($c in $el.ChildNodes) { Test-XmlVocabulary $c $label $errors }
}

# Every explicit jump target in a document, as "<book>:<section>" keys. `section=` names a
# section in `book=` when given, otherwise in the file's own book; <extrachoice> also arms a
# choice AT another section (atbook/atsection). Non-literal ids are skipped: they are either a
# computed target or a named entry point (Adventurers.xml's section="Andriel").
function Get-ExplicitTargets($el, [int]$ownBook, [System.Collections.ArrayList]$targets) {
    if ($null -eq $el -or $el.NodeType -ne [System.Xml.XmlNodeType]::Element) { return }
    foreach ($pair in @(@('book', 'section'), @('atbook', 'atsection'))) {
        $sec = $el.GetAttribute($pair[1])
        if ($sec -and $sec -match '^\d+[a-z]?$') {
            $bk = $el.GetAttribute($pair[0])
            if (-not $bk) { $bk = "$ownBook" }
            if ($bk -match '^\d+$') { [void]$targets.Add("$bk`:$sec") }
        }
    }
    foreach ($c in $el.ChildNodes) { Get-ExplicitTargets $c $ownBook $targets }
}

# ---- The whole source tree -------------------------------------------------------------
# Validates every file the build is about to bundle and returns @{ Errors; Checked }. Nothing
# is written and nothing is thrown: the caller decides what a failure means (the build aborts,
# the self-test asserts). $bookDirs is the BUNDLED set as number -> source directory, exactly
# as Get-BookRegistry resolved it from books.ini's Published= line (task 209): the build and
# this gate then iterate one set, and a published book whose folder is missing has already
# been reported there rather than skipped here. A link into any OTHER book (the unbundled
# 7-12) is intentional and never reported as dangling.
function Test-SourceTree([string]$rulesDir, [hashtable]$bookDirs) {
    $errors = [System.Collections.ArrayList]::new()
    $checked = 0
    $bookNumbers = @($bookDirs.Keys | Sort-Object)

    # 1. Index the section ids each bundled book really contains, so a link can be resolved.
    $known = @{}
    foreach ($b in $bookNumbers) {
        Get-ChildItem -Path $bookDirs[$b] -Filter '*.xml' |
            Where-Object { $_.BaseName -match '^\d+[a-z]?$' } |
            ForEach-Object { $known["$b`:$($_.BaseName)"] = $true }
    }

    # 2. Section files: well-formed, rooted at <section>, name matching the filename, a known
    #    vocabulary, and every explicit link resolving inside a bundled book.
    foreach ($b in $bookNumbers) {
        $dir = $bookDirs[$b]
        # Errors name the folder the author would open, which is the Path= leaf, not "book<N>".
        $dirName = Split-Path -Leaf $dir
        Get-ChildItem -Path $dir -Filter '*.xml' |
            Where-Object { $_.BaseName -match '^\d+[a-z]?$' } |
            ForEach-Object {
                $checked++
                $label = "{0}/{1}" -f $dirName, $_.Name
                $xml = Read-Xml $_.FullName
                # Accepted names: the full filename, and its numeric prefix for a lettered
                # continuation (609a -> "609" or "609a"). (task 78)
                $expectNames = @($_.BaseName, ($_.BaseName -replace '[a-z]+$', '')) | Select-Object -Unique
                $e = Test-XmlDoc $xml $label 'section' $expectNames
                if ($e) { [void]$errors.Add($e); return }
                $doc = Get-XmlDoc $xml
                Test-XmlVocabulary $doc.DocumentElement $label $errors
                $targets = [System.Collections.ArrayList]::new()
                Get-ExplicitTargets $doc.DocumentElement $b $targets
                foreach ($t in ($targets | Select-Object -Unique)) {
                    $tb = ($t -split ':', 2)[0]
                    if ($bookNumbers -notcontains [int]$tb) { continue }  # books 7-12 are deliberate
                    if (-not $known.ContainsKey($t)) {
                        [void]$errors.Add("$label : link to section $t, which book $tb does not contain")
                    }
                }
            }

        # 3. Adventurers.xml: rooted at <adventurers>, and each pregen's biography readable -
        #    inline prose, or the <FirstName>.xml the build folds its first <p> from. A
        #    malformed/missing bio used to leave the create-character card blank in silence.
        $advPath = Join-Path $dir 'Adventurers.xml'
        if (Test-Path $advPath) {
            $checked++
            $label = "{0}/Adventurers.xml" -f $dirName
            $advXml = Read-Xml $advPath
            $e = Test-XmlDoc $advXml $label 'adventurers'
            if ($e) { [void]$errors.Add($e) }
            else {
                $adoc = Get-XmlDoc $advXml
                Test-XmlVocabulary $adoc.DocumentElement $label $errors
                foreach ($a in $adoc.SelectNodes('//starting/adventurer')) {
                    $name = $a.GetAttribute('name')
                    if ("$($a.InnerText)".Trim()) { continue }   # inline prose (book 5)
                    $first = ($name -split '\s+')[0]
                    $bioPath = Join-Path $dir ($first + '.xml')
                    if (-not (Test-Path $bioPath)) {
                        [void]$errors.Add("$label : pregen `"$name`" has no inline bio and no $first.xml")
                        continue
                    }
                    $checked++
                    $bioLabel = "{0}/{1}.xml" -f $dirName, $first
                    $bioXml = Read-Xml $bioPath
                    $e = Test-XmlDoc $bioXml $bioLabel 'section'
                    if ($e) { [void]$errors.Add($e); continue }
                    $bdoc = Get-XmlDoc $bioXml
                    Test-XmlVocabulary $bdoc.DocumentElement $bioLabel $errors
                    if (-not "$($bdoc.SelectSingleNode('//section/p[1]').InnerText)".Trim()) {
                        [void]$errors.Add("$bioLabel : no biography prose for pregen `"$name`" (needs a first <p>)")
                    }
                }
            }
        }
    }

    # 4. The rules prose bundled into meta.json. Both files are <section> documents.
    foreach ($rf in @('Rules.xml', 'QuickRules.xml')) {
        $rp = Join-Path $rulesDir $rf
        if (-not (Test-Path $rp)) { continue }
        $checked++
        $label = "rules/$rf"
        $xml = Read-Xml $rp
        $e = Test-XmlDoc $xml $label 'section'
        if ($e) { [void]$errors.Add($e); continue }
        Test-XmlVocabulary (Get-XmlDoc $xml).DocumentElement $label $errors
    }

    return @{ Errors = @($errors); Checked = $checked }
}
