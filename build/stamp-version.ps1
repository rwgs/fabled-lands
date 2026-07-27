#Requires -Version 7.0
# Requires PowerShell 7 (pwsh), like build-data.ps1 which calls this. The digest itself is now
# culture-independent (paths are sorted with an ordinal comparer -- task 196; it used to rely on
# Sort-Object, which orders the hyphenated asset names differently under .NET Framework 5.1 vs
# .NET Core 7 and so emitted a different stamp from identical content). The guard stays: one
# pwsh-7 rule for both build scripts, enforced in CI. (task 121)
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

      pwsh -ExecutionPolicy Bypass -File build/stamp-version.ps1

  The stamp identifies CONTENT, so identical content must always produce an
  identical stamp (task 196). Three things guarantee that:
    * paths are repo-relative, forward-slashed and sorted ORDINALLY, so no
      machine's locale (or checkout directory) can reorder the digest inputs,
      and a renamed file moves the digest;
    * text is LF-normalised before hashing, so a core.autocrlf=true checkout
      (CRLF in the working tree) digests the same as an LF one;
    * the date component is REUSED whenever the digest is unchanged, so a
      rebuild on a later day with no source change is a byte-for-byte no-op
      and leaves the tree clean. A new date is only chosen for real changes.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web  = Join-Path $root 'web'
$verFile = Join-Path $web 'js/version.js'
$swFile  = Join-Path $web 'sw.js'

# Extensions whose bytes are line-ending sensitive. Git's autocrlf only rewrites text, so
# everything else (icons, maps, illustrations) is hashed raw -- normalising binary would be
# both wrong and pointless.
$TEXT_EXT = @('.js', '.mjs', '.css', '.html', '.json', '.webmanifest', '.svg', '.txt', '.md')

# The one generated line in sw.js, blanked to a fixed placeholder so the file's CODE can be
# hashed without the circularity of hashing the cache key this script is about to write.
$SW_VERSION_RE = "const VERSION = '[^']*';"
$SW_PLACEHOLDER = "const VERSION = '__STAMP__';"

# SHA1 via the Get-FileHash cmdlet rather than the raw crypto API: same digest, and it keeps
# the script the kind of plain, readable automation the Windows AV heuristics do not block.
function Get-Digest {
    param([byte[]]$Bytes)
    $stream = [System.IO.MemoryStream]::new($Bytes)
    try { return (Get-FileHash -Algorithm SHA1 -InputStream $stream).Hash.ToLowerInvariant() }
    finally { $stream.Dispose() }
}

# A file's canonical bytes: LF-normalised for text, raw for everything else.
function Get-CanonicalBytes {
    param([string]$Path)
    if ($TEXT_EXT -notcontains ([System.IO.Path]::GetExtension($Path)).ToLowerInvariant()) {
        return [System.IO.File]::ReadAllBytes($Path)
    }
    $text = [System.IO.File]::ReadAllText($Path)
    if ($Path -eq $swFile) { $text = [regex]::Replace($text, $SW_VERSION_RE, $SW_PLACEHOLDER) }
    return [System.Text.Encoding]::UTF8.GetBytes($text.Replace("`r`n", "`n"))
}

# ---- Content hash of the shipped app ---------------------------------------
# Every source file that makes up the deployed app. version.js is excluded because it is
# nothing but this script's output; _test.html and web/tests/ are a dev-only harness and are
# left out because nothing here sweeps them. web/js and web/assets are BOTH recursed: replacing
# only an icon, map or illustration must still move the stamp -- and therefore the service-worker
# cache key -- instead of leaving installed players on a stale asset (task 64), and a module
# added in a new web/js subdirectory must do the same rather than shipping under the previous
# version identity (task 206; web/js is flat today, so recursing it changes no current digest).
# sw.js IS included (task 196): a service-worker-only release is a real release and must not
# keep the previous version identity.
$files = @()
$files += Get-ChildItem -Path (Join-Path $web 'js')   -Filter '*.js'   -File -Recurse | Where-Object { $_.Name -ne 'version.js' }
$files += Get-ChildItem -Path (Join-Path $web 'css')  -Filter '*.css'  -File
$files += Get-ChildItem -Path (Join-Path $web 'data') -Filter '*.json' -File
foreach ($f in 'index.html', 'manifest.webmanifest', 'sw.js') {
    $p = Join-Path $web $f
    if (Test-Path $p) { $files += Get-Item $p }
}
$assetsDir = Join-Path $web 'assets'
if (Test-Path $assetsDir) { $files += Get-ChildItem -Path $assetsDir -File -Recurse }

# path -> digest, keyed by the REPO-relative path so the digest is independent of where the
# checkout lives and so a rename is a content change.
$digests = @{}
foreach ($f in $files) {
    $rel = [System.IO.Path]::GetRelativePath($root, $f.FullName).Replace('\', '/')
    $digests[$rel] = Get-Digest (Get-CanonicalBytes $f.FullName)
}

$paths = [string[]]$digests.Keys
[Array]::Sort($paths, [System.StringComparer]::Ordinal)
$manifest = (($paths | ForEach-Object { "$_ $($digests[$_])" }) -join "`n") + "`n"
$hash = (Get-Digest ([System.Text.Encoding]::UTF8.GetBytes($manifest))).Substring(0, 7)

# ---- Date: reuse it while the content is unchanged --------------------------
# Otherwise a rebuild on any later day rewrites version.js and sw.js with a new stamp for
# content nobody touched, dirtying the tree and handing every installed player a pointless
# cache eviction. (Task 144 removed the same no-op date churn from meta.json.)
$stamp = "$((Get-Date).ToString('yy.MM.dd')).$hash"
if (Test-Path $verFile) {
    $prev = [regex]::Match([System.IO.File]::ReadAllText($verFile), "VERSION = '(\d{2}\.\d{2}\.\d{2})\.([0-9a-f]{7})'")
    if ($prev.Success -and $prev.Groups[2].Value -eq $hash) { $stamp = "$($prev.Groups[1].Value).$hash" }
}

# ---- Write, but only where something actually changed -----------------------
# Both comparisons are LF-normalised: on a CRLF checkout the file on disk never equals the LF
# text we would write, so a naive compare would rewrite (and re-timestamp) both files forever.
function Set-IfChanged {
    param([string]$Path, [string]$Content, [string]$Message)
    $old = (Test-Path $Path) ? [System.IO.File]::ReadAllText($Path).Replace("`r`n", "`n") : $null
    if ($old -eq $Content) { return $false }
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host $Message
    return $true
}

# 1) in-game version stamp
$content = "// Auto-generated build stamp -- run build/stamp-version.ps1 to refresh.`nexport const VERSION = '$stamp';`n"
if (-not (Set-IfChanged $verFile $content "Stamped version $stamp")) { Write-Host "Version already at $stamp" }

# 2) service-worker cache key
if (Test-Path $swFile) {
    $swVersion = "fl-$stamp"
    $sw = [System.IO.File]::ReadAllText($swFile).Replace("`r`n", "`n")
    $new = [regex]::Replace($sw, $SW_VERSION_RE, "const VERSION = '$swVersion';")
    if (-not (Set-IfChanged $swFile $new "Bumped service-worker cache -> $swVersion")) {
        Write-Host "Service-worker cache already at $swVersion"
    }
}
