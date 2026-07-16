# Fabled Lands — Repository Review

Reviewed 2026-07-09. Scope: deployment/build pipeline, offline cache behaviour,
static rules rendering, player-facing flows, and the existing browser test setup.
The working tree was clean at the start of the review. No critical or high-severity
defects were found.

## New Findings

### Medium — asset-only releases remain stale in installed PWAs

`build/stamp-version.ps1:32`–`build/stamp-version.ps1:37` derives the cache
version from JavaScript, CSS, JSON, HTML, and the manifest, but excludes
`web/assets/`. Asset changes are valid build outputs: `build/build-data.ps1:208`,
`build/build-data.ps1:223`, and `build/build-data.ps1:242` copy maps and
illustrations there. The service worker precaches maps (`web/sw.js:42`) and uses
cache-first responses (`web/sw.js:89`), so an icon, map, or illustration changed
without a code/data change is never refreshed for existing installs.

Include deployable assets in the build stamp or publish them with revisioned
filenames. Do not hash the generated `sw.js` itself, as that would make the cache
version circular. Recorded as task 64.

### Low — the rules modal creates invalid table structure

`renderStatic` first renders all `h1`–`h6` elements as headings
(`web/js/app.js:775`), making its later identical condition that creates a
`<th>` unreachable (`web/js/app.js:781`). `rules/QuickRules.xml:3` places an
`<h3>` inside a `<tr>`, so the browser receives a heading element directly in a
table row rather than a header cell. This loses table semantics and can produce
inconsistent layout/accessibility.

Render headings inside table rows as `<th>` cells (with a suitable `colspan`)
and retain regular headings only outside tables. Add a focused DOM test. Recorded
as task 65.

## Confirmed Backlog

- **TTS skips bare story prose.** `web/js/tts.js:56` wraps only paragraphs, but
  sections such as `books/book4/16.xml:3` and `books/book2/745.xml:3` use bare
  text nodes. Narration has no chunks for those sections. Complete task 33.
- **Some game rules still live in the renderer/app layer.** This makes direct
  unit testing harder and breaks the project's stated DOM-free engine boundary.
  Complete task 34.
- **iOS installed icons are unreliable.** `web/index.html:11` references an SVG
  apple-touch icon; supply a PNG icon and precache it as task 35 specifies.
- **Locked caches can still be edited.** The buttons rendered in
  `web/js/render.js:2568` onward do not consult the state lock used by the
  gambling flow in `books/book1/91.xml:7`. Complete task 38.
- **The vampire can be fought armed.** In `books/book2/462.xml:4` equipment is
  confiscated, but the live `dead="f"` condition can return it before the fight
  resolves (`books/book2/462.xml:11`). Complete task 39.

## Recommendations

- Add a CI job that serves `web/` and requires the existing
  `web/_test.html` every-section smoke suite to pass. The suite is comprehensive,
  but the repository has no checked-in workflow to run it on changes.
- Align the illustration documentation with the shipped build. `README.md:226`
  says illustrations are absent, while the build deliberately ships the three
  referenced illustration assets through `build/build-data.ps1:242`.

## Validation

The local server successfully served `/_test.html` with HTTP 200. The full Chrome
headless smoke run could not be collected in this environment: the host returned
Windows `Access is denied` after Chrome launch, including when its output was
redirected to temporary files. No test result is claimed from this review.

---

## Audit log — passes archived from TASKS.md

*The running audit log's older passes, moved out of [`TASKS.md`](TASKS.md) to keep the backlog file focused — its "## Review log" keeps the most recent pass. Passes appear in the order they had in TASKS.md (newest of these first); task numbers refer to that file's checklist.*

Reviewed 2026-07-15 (third full pass): started clean at `37f2b2d`, moved the
completed 110–114 entries into **Done**, and audited app/state/engine/render/
combat/market/UI/data/build/test seams plus the live XML that exercises each new
finding. A strict independent corpus pass found **4,369 sections, 0 parse errors,
0 filename/name mismatches and 0 dangling Book 1–6 section targets**. Filed tasks
**115–121**: item-use detours bypass the task-110 return wrapper (115); save/load
restarts the already-mutated current visit and loses its execution/return state
(116); priced equipment/cargo selectors can grant their linked result without a
payment (117); generic/equipment losses can take `keep` items (118); restore the
rules/view boundary while splitting the 4,060-line renderer (119); split the
4,790-line, one-scope browser suite (120); and restore Windows PowerShell 5.1
compatibility for the documented build command (121). The module map remains a
good foundation and the headless cores remain UI-DOM-free; concentration in
`render.js` and `_test.html`, not the overall directory layout, is the structural
problem. The exact documented `powershell` build reproduced task 121's parse
failure; `pwsh` 7 validated all **4,377 XML files** and rebuilt successfully. The
fresh-profile Chrome suite is green: `RESULT ALL PASS pass=1076 fail=0`.

Reviewed 2026-07-14 (second full pass): started from a clean worktree with no
open backlog items, parsed and inventoried all **4,369** numeric section XML files
(zero parse errors), and re-audited the live tag/attribute surface against the
engine/render/state/app dispatch paths and the local JaFL tag reference. Filed
tasks **107–112**: visible transfers auto-run and omit their selector/chooser/
price contract (107); blessing-guarded storm outcomes expose the dangerous
redirect (108); §2.37 ignores which of its two abilities was rolled (109);
`<return>` re-enters as a fresh visit (110); `itemAt=` can remove `keep` items
(111); and the stored Skunk-juice `lift=` question has no Adventure Sheet action
(112). Harmless duplicated-description/stray-`dice` source attributes were
checked but not filed because they do not alter current gameplay. Baseline smoke
suite green at the reviewed tree: `RESULT ALL PASS pass=1009 fail=0`.

Filed 2026-07-14 from a playtest bug run (six reports): tasks **104–106**.
**104** (travel rolls don't gate the onward `<choices>`, and a "get lost"
`<outcome><goto></outcome>` doesn't suppress them — §1.278/§1.82, whole travel
corpus) and **105** (`<if ticks="N">` reads the live count, so a mid-visit
rerender flips the guard and re-shows the redirect — §1.496; §1.310 is only the
by-design box-on-entry display from task 70) are confirmed against current
source. **106** was first framed as the leather-chrome-in-both-themes design
question, then — after the reporter confirmed light mode is fine in Firefox but
wrong in Chrome and Edge — root-caused to Chromium "Auto Dark Theme" force-dark
(the `color-scheme: light` opt-out is a no-op; needs `only light`) and **fixed
the same day**. §1.416 ("can't cross to other books at Rank ≥ 4") was **not**
filed — already fixed by task 68 and works in current source (the reporter was
on a stale PWA cache).

Reviewed 2026-07-06: every previously open item (3–13) was re-verified against
the current code and is still accurate; items 15–36 were added from a full
review of the rules engine (`engine.js`/`combat.js`/`market.js`/`state.js`) and
the view/app/infra layer, with every finding verified against both the code and
the book XML corpus.

Reviewed 2026-07-07: the suite is green at HEAD (`RESULT ALL PASS pass=381
fail=0`) and every closed MEDIUM task's claims (24–31, 40, 41) were audited
against the shipped code — no discrepancies. A fresh review of the newest
subsystems (fight attributes, roll gates, currencies, item effects) plus the
cross-module seams filed tasks **45–62** (each verified against both the code
path and the triggering book XML); task **43** moved from LOW to MEDIUM to match
its own severity rating, and a `useCache` Defence divergence was appended to the
task-36 grab-bag. Checked clean in the same pass: `sanitizeData` round-trips all
newer fields (currencies, item effects, abilityFlags, cache locks, afflictions);
currency wallet routing; ship canonicalisation; tick caps; the roll-payment
arm/consume/re-arm cycle.

Reviewed 2026-07-09: the external review in `REVIEW.md` was verified against the
code — its two new findings were already filed as tasks **64**/**65** (both
premises re-confirmed: the stamp hashes js/css/json/html/manifest but not
`web/assets/`; `renderStatic`'s `<th>` branch at `app.js:781` is shadowed by the
identical heading test at `:775`), and its confirmed-backlog items all map to
the open tasks 33/34/35/38/39. Its two unrecorded recommendations are now filed
as tasks **66** (CI smoke-suite workflow — no `.github/` exists) and **67**
(README says section illustrations are absent, but the build ships the three
bespoke ones). The suite is green at HEAD: `RESULT ALL PASS pass=597 fail=0`
(the reviewer's environment couldn't launch Chrome, so no result was claimed
there).

Reviewed 2026-07-10: a fresh corpus-to-engine audit found seven gaps that the
render-every-section smoke scan cannot detect because every affected section
still builds valid DOM. Filed tasks **73–79**: ship-location metadata is not
maintained; standalone `force="f"` effects auto-apply; several live `<tick>`
forms are inert; blessings cannot be spent on their rule-defined rerolls/combat
benefits; selector-aware `<set>` expressions ignore their item/cache selectors;
five numeric source files have mismatched `<section name>` metadata; and the
preview/import persistence paths report success after a failed write. Each
finding was checked against the source XML and `JaFL-XML-Tags.html`. Baseline
suite at HEAD is green: `RESULT ALL PASS pass=649 fail=0`.

Worked 2026-07-08: all eight HIGH items (45–52) implemented, each with focused
headless tests and the full render-every-section scan green after every step
(suite grew 381 → 440 assertions, `RESULT ALL PASS fail=0`). Notable shared
plumbing added this pass: an aggregate multi-fight proxy + sequential locking
(45); an ability/stamina resolution mode threaded through `evalExpression` (46,
reused by the coming task 53); a shared `matchItemQuery`/`hasItemMatch` item
matcher (47); a settable group-fight proxy + per-foe targeting (48); a transient
per-fight attack/Defence bonus store (49); `ctx.wroteVars` roll/`<set>` write
tracking that gates var-keyed branches (50, also needed by tasks 61/43); a shared
`rollGateState` pay-to-roll gate on `<difficulty>`/`<rankcheck>` + resolved-roll
branch binding (51); and `removeCodeword` clearing the counter value (52, feeds
task 43). Left for their own tasks: `<fightround>` per-round rolls (32), the
hidden-price silent-arm phantom Pay button (56), and the repeatable price/flag
"choose one" cycle (43).

Reviewed 2026-07-12: a full repository review filed tasks **89–102** — the
current-vessel invariant left incomplete by tasks 73/81 (89), blessing
semantics (permanent Safety from Storms, the COMBAT reroll in combat, per-fight
Defence scoping — 90/91), the remaining live `<adjust>` variants (92), item
provenance / `quantity=` / `replace=` / hidden-group rewards (93–96), the
filtered `itemcache` (97), resurrection-arrangement semantics (98), and the
`<fightround>`/`<while>`/`<sectionview>`/`<price>` passthroughs (99–102). A
follow-up pass the same day merged those items into the contents checklist
under their priorities (they had been left in a separate mid-file block) and
re-verified a sample of premises at HEAD: `<choice sail="t">` still bypasses
the dock gate/`sailThenGo` (goto-only); `applyLose` still routes named blessing
losses through `removeBlessing()`, which strips the `permanentBlessings`
marker; the group-choice collector still gathers only
`lose, tick, gain, set, curse`; and §1.338's `<price>` remains an unhandled
element. Suite green at HEAD: `RESULT ALL PASS pass=785 fail=0`.
