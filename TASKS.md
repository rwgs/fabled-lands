# Fabled Lands — Web Edition · Engineering TODO

Backlog of recommended improvements. The checklist below is grouped by
priority — work the first open (`- [ ]`) item top-down. Task numbers are
stable IDs pointing at the detail sections below (sections are in the order
the tasks were filed, not work order).

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

**HIGH**
- [x] 45. Multi-fight sections: the fight gate & death-deferral track only the *last* `<fight>`
- [x] 46. `<set var … modifier="natural">` discards the value — book-2 rank ceremonies auto-succeed
- [x] 47. `<choice item="?" tags=…>` is never enabled — light-gated passages hard-locked
- [x] 48. Group fights: Surrender/flee throws a TypeError; no Flee button; no target choice
- [x] 49. `special="attack|defence"` grant permanent, save-persisted bonuses
- [x] 50. Var-keyed `<success>/<failure>` branches fire on entry (unset/stale vars)
- [x] 51. `<difficulty|rankcheck flag=…>` roll gates unimplemented; shared `<success>` binds only the last roll
- [x] 52. `removeCodeword` leaves the codeword's *value* behind — bonus counters never reset

**MEDIUM**
- [x] 5. Implement `<items group … limit="N">` "choose up to N" pickup
- [x] 6. Harden save import and migration
- [x] 7. Surface persistence failures to the player
- [x] 8. Make service-worker upgrades atomic
- [x] 24. Canonicalise ship types (`brig`, `gall`) and fix crew-upgrade steps
- [x] 25. Fix value/expression parsing: vars containing "d", unary minus, division
- [x] 26. Implement the remaining `<fight>` attributes
- [x] 27. Cap visit-box ticks and make `ticks=` guards robust
- [x] 28. Honour `dead="t"` on `<goto>`/`<choice>`
- [x] 29. Market & item polish: currency items, pipe names, headers *(parts 2 & 5 split → 40, 41)*
- [x] 30. Gate `<random flag=…>` rolls behind their payment
- [x] 31. `<rest>` with no `stamina=` should restore to full
- [x] 40. `<market currency="…">` alternate-currency markets
- [x] 41. Item `<effect>` system (use/aura/wielded/ability) and `<sold>` sell-hooks
- [x] 43. price/flag "choose one" purchases over-apply every linked reward *(moved from LOW 2026-07-07; scope grew — see detail)*
- [x] 53. `<difficulty modifier="noweapon">` still counts the weapon bonus
- [x] 54. Mid-fight escape brackets (tick…lose codeword) collapse — surrender/flee routes unreachable
- [x] 55. `<choice item=… pay="t">` doesn't consume the item
- [x] 56. `hidden="t"` payments render a phantom "Pay" button instead of arming silently
- [x] 57. Adventure Sheet: curses all display as "curse"; diseases/poisons invisible
- [x] 58. Market `<sold>` hooks match the shop row's tags, not the sold item's
- [x] 59. `<tick god=…>` drops `<effect>` children — Sig initiates never get +1 THIEVERY
- [x] 60. Affliction `<effect>` forms `divide`/`target`/`stamina` inert; item `<curse>` children never attach
- [x] 61. book6/628: the rerunnable `<set>` clobbers the roll's var — inn rest/dysentery never fires

**LOW**
- [x] 9. Centralise tag dispatch into a registry
- [x] 10. Dice RNG quality / reproducibility
- [x] 11. Harden the per-visit memoization assumption
- [x] 12. Add headless unit tests for the extracted rules
- [x] 13. Optional: build-time XML validation
- [x] 32. Implement or explicitly stub the remaining unhandled tags
- [ ] 33. Narrate sections without `<p>` wrappers (TTS)
- [ ] 34. Finish moving rules out of the view layer
- [ ] 35. iOS home-screen icons: provide PNG apple-touch-icon
- [x] 36. Minor rule divergences (grab-bag)
- [x] 37. Fix the `safeAddGodd` typo in the source XML
- [ ] 38. Gate cache widgets on `lock`/`unlock` under the single-pass render (book1/91 gamble)
- [ ] 39. Defer confiscate-and-return `<transfer … from=>` until a fight resolves (book2/462)
- [x] 42. Inner `<difficulty>`/`<random>`/`<rankcheck>` rolls inside a `<group>` are unrun
- [x] 44. Fold the ring of ultimate power's `Rank`/`Stamina` auras (book5/564)
- [x] 62. Render `<image file=…>` and use-effect images (map of Bazalek, book3/75)
- [x] 63. Heterogeneous "choose one" rewards (item / Shards / resurrection) over-apply (book1/597)

**Done**
- [x] 1. Gate combat progression / model fight outcomes
- [x] 2. Finish the logic/view split (combat/market/rest)
- [x] 3. Fix multi-attribute `<if>` conditions
- [x] 4. Prevent silent save-slot overwrite
- [x] 14. Fix save-card button overflow on mobile
- [x] 15. Fix `<gain>`/`<lose>`/`<tick>` ability effects (rank, stamina, "?", "*", fatal)
- [x] 16. Make wildcard/choice losses actually take things
- [x] 17. Recognise all spec'd `<if>` attributes; stop defaulting unknown conditions to true
- [x] 18. Preserve item `tags` and support tag-filtered item conditions
- [x] 19. Implement the curse / disease / poison system end-to-end
- [x] 20. Implement caches, banks, `<adjustmoney>` and `<transfer>`
- [x] 21. Fix `<flee>`/`<fightdamage>`: no render-time auto-apply, find them anywhere, honour `flee="t"`, `type="replace"`
- [x] 22. Render `<success>`/`<failure>`/`<outcome>` children of `<choices>`
- [x] 23. Make inline `<buy>`/`<sell>` functional (ships, tools, quantity, item sells)

---

## 1. Gate combat progression / model fight outcomes  — **done**

Fights no longer let the player skip past them, and win/loss now route correctly
(first spotted in `books/book1/570.xml`; fixed engine-wide). In `render.js` +
`combat.js`:
1. **`flee="N"` win threshold** — `makeFight` reads it as `winThreshold`;
   `fightRound` wins when enemy Stamina ≤ N (not only 0). Fixes 570's "reduce the
   Tree Guard to 5". (The 4 `flee="N"` sections; distinct from the 20 `<flee>`
   *child* Flee buttons, which already worked.)
2. **Gating** — `computeFightGate` finds the navigation that follows a `<fight>`;
   `applyFightGate` disables it (tooltip "Defeat the … first") while the fight is
   unresolved, then on a win enables everything **except** the lose-branch.
3. **Win vs lose branch** — the "if you lose…" goto is detected by conservative
   prose cues (WIN cues veto, so under-marking just falls back to death — never
   strands a win). On a loss it's the only branch enabled.
4. **Non-death loss** — reaching 0 Stamina in a fight that has a lose-branch sets
   `outcome='lose'` and **defers death**, so the player takes that branch (e.g.
   570 → 195, which restores Stamina) instead of dying. No lose-branch ⇒ death.

Verified: 18 targeted fight assertions (570 initial-gate / win / threshold, a
synthetic non-death loss with death-deferral, a no-lose-path death, flee child) +
the full render-every-section smoke test (all 165 fight sections render clean).

---

## 2. Finish the logic/view split (started with combat/market/rest)  — **done**

Every game rule now lives in a headless, DOM-free module; `render.js` builds the
widget and wires the button, then calls the rule and displays the result:
- **Training** → `engine.rollTraining()` (roll beats natural score ⇒ +1 ability).
- **Rank check** → `engine.rollRankCheck()` (success iff roll ≤ Rank; returns `margin`).
- **Difficulty** → `engine.rollDifficulty()` (already extracted; now also returns `margin`).
- **Resurrection** deal purchase → `engine.buyResurrectionDeal()`.
- (Combat → `combat.js`, economy → `market.js`, rest → `engine.applyRest` — earlier.)

`<random>` needs no extraction: it has no pass/fail rule at the roll site (it
sums `rollDice` + `childAdjustment`, both already in `engine.js`; outcome ranges
are matched later by `engine.matchRange`).

Remaining: add the unit tests these now enable — see item #12.

---

## 3. Fix multi-attribute `<if>` conditions  — **done**

`engine.evaluateCondition` used an `else if` chain, so a node such as
`<if codeword="Dove" title="Arena Champion">` checked only the first recognized
attribute and ignored the rest.

**Correction to the original task text:** the task said to combine the recognized
attributes as an *AND*. That is wrong — the canonical JaFL semantics is *OR*.
The original Java `IfNode.meetsConditions()` (`java-engine/flands/IfNode.java`)
returns `true` as soon as **any** present attribute is satisfied and applies
`not` to that final result; and every cited example's prose confirms OR:
book4/122 "codeword Dove **or** the title Arena Champion", book1/184 "codeword
Axe **or** … a black dragon shield", book3/222 "codeword Aid **or** … a ship
docked at Smogmaw", book6/160 "blessing … **or** a catastrophe certificate",
book1/460 light-source **or** Mage. Combining as AND would have broken all five.

Fix (`web/js/engine.js`): `evaluateCondition` now OR-combines every recognized
attribute (each is a disjunct; comma/pipe *within* a codeword or title list keep
their own AND/OR meaning), then negates with `not="t"`. A node with no recognized
attribute still defaults to true (task 17 tightens that to a warning + adds the
missing handlers — `weapon`/`armour`/`tool`/`disease`/`poison`/`cache`/`using`,
docked-at-location, natural-score, empty-god). Verified: 8 new engine assertions
in `web/_test.html` (codeword|title OR both ways + neither; item|profession OR;
`not` over the whole OR) + full render-every-section smoke test
(`RESULT ALL PASS pass=100 fail=0`).

---

## 4. Prevent silent save-slot overwrite  — **done**

`state.nextFreeSlot()` returned `0` when all 20 slots were occupied, so starting a
new game, opening a demo link, or importing a save could overwrite slot 0.

Fix:
- `nextFreeSlot()` (`state.js`) now returns **`null`** when all 20 slots are full.
- `importSave()` throws a clear "All 20 save slots are full…" error instead of
  landing on slot 0.
- New-game start (`app.js`) checks `nextFreeSlot()` first; if full it shows a
  `slotsFullModal()` ("Delete or export one to free a slot") and refuses to start
  rather than clobbering slot 0.
- **Demo / preview (`?demo=`) mode** no longer creates a persistent save: a new
  `GameState.ephemeral` flag makes `save()` a no-op, so a preview never occupies
  (or overwrites) a slot. The in-game menu offers **"Keep this adventure"** for an
  ephemeral game, which calls `GameState.keep()` — it grabs the first free slot,
  clears the flag and persists, or throws if full.

Verified: 5 new headless assertions (`nextFreeSlot()===null` when full; import
throws when full; ephemeral game writes nothing to storage; `keep()` assigns a
real slot, clears the flag and persists) plus a real-app boot check — title
screen and `?demo=1.1` game screen both render with no fatal error and no save
written. Full smoke test `RESULT ALL PASS pass=105 fail=0`.

---

## 5. Implement `<items group … limit="N">` "choose up to N" pickup  — **done**

Grouped award rows now enforce the "choose up to N" cap. In `render.js`:
- **Pre-scan** — `begin()` scans the section for every `<items group="X"
  limit="N"/>` controller and records `group → limit` in `ctx.groupLimits`, so the
  cap is known regardless of whether the controller sits before or after the award
  rows (both orders occur in the corpus).
- **Controller** — a new `case 'items'` → `renderItemsController` renders a small
  live status pill (`.items-pick-status`: "Choose up to N — M left" / "Chosen all
  N") so the player sees how many picks remain.
- **Award rows** — `renderItemAward` reads the row's `group=`; when the group has
  a limit it consults a per-visit `ctx.groupPicks` tally. Taking a row increments
  the tally; once the tally reaches the limit the remaining (untaken) rows disable
  with a "You may choose only N" tooltip. The 12-item carry cap still applies on
  top. A group with award rows but no controller (limit unknown) falls back to the
  prior per-row behaviour, so nothing regresses.

Affected sections: `book1/16`, `book4/113`, `book4/137`, `book4/218`,
`book5/671`, `book5/709`.

Verified: 9 new headless assertions (§218 limit=1 — six rows, all enabled, status
pill, one pick takes exactly one item and locks the other five with the cap
tooltip; §671 limit=2 — after one pick more remain, exactly two taken, then the
rest lock) + full render-every-section scan. `RESULT ALL PASS pass=220 fail=0`.

---

## 6. Harden save import and migration  — **done**

`importSave()` only checked for an object with `abilities` and `stamina`, and
`migrate()` did a shallow `{...base, ...data}` merge, so a malformed file could
still land wrong array/object shapes (a string `items`, junk affliction/ship
entries, non-numeric stats) that later broke rendering or the sheet.

Fix (`web/js/state.js`):
- **`sanitizeData(raw)`** (exported) deeply coerces every field of the known
  schema and **drops** bad entries rather than trusting them: strings→numbers
  with min/max/int clamps (Stamina clamped to its max, Rank/Shards floored,
  abilities `clampAbility`'d 1–12); `items`/`caches.items` filtered to well-formed
  possessions (nameless ones dropped); `titles`/`ships`/`curses`/`diseases`/
  `poisons`/`resurrections`/`effects` each element-validated; `codewords` kept
  only when truthy; `boxes` kept only when > 0; `vars`/`codewordValues` kept only
  when finite; `book`/`section`/`startBook`/`history`/`turns` coerced. Unknown
  top-level keys are discarded (the schema is fully known via `freshData()`).
- **`migrate()`** now simply delegates to `sanitizeData()`, so both **load** (from
  localStorage) and **import** are hardened by the same path.
- **`importSave()`** rejects non-save shapes up front with a clear error: not an
  object, an array, or `abilities` not being a (non-array) object, or missing
  Stamina.

Verified: 23 new headless assertions (field-by-field coercion/clamp/drop of a
deliberately hostile object; a junk save loaded into a live `GameState` renders
and computes derived stats without throwing; `importSave` rejects an array and a
non-object `abilities`) + the existing round-trip/exhaustion tests still pass +
full render-every-section scan. `RESULT ALL PASS pass=243 fail=0`.

---

## 7. Surface persistence failures to the player  — **done**

`GameState.save()` swallowed `localStorage` failures (logged only), so gameplay
continued as if progress was saved.

Fix:
- **`state.js`** — `save()` now **returns `true`/`false`** and sets a new
  `state.lastSaveError` to a player-facing message on failure (cleared on the next
  success). A `describeSaveError()` helper distinguishes a full store
  (`QuotaExceededError` / code 22 / Firefox 1014 → "Storage is full… export…
  delete an old save") from blocked storage ("…private-browsing mode… export to a
  file"). An ephemeral preview game reports success without writing.
- **`app.js`** — a `surfaceSaveError()` helper shows a modal ("Progress not
  saved") with a one-click **Export now** option; it is shown once per failure
  streak and re-arms once saving recovers. It is wired into the `onChange`
  listener (so any gameplay change that fails to persist warns), and the two
  "Save & quit to title" buttons + new-game start now check `save()`'s result and
  warn (with `force`) instead of silently proceeding as if saved.

Verified: 6 new headless assertions (normal save returns true / clears error;
simulated `QuotaExceededError` → false + "full" message; blocked-storage →
private-browsing message; recovery re-clears; ephemeral save reports success
without writing) + full render-every-section scan. `RESULT ALL PASS pass=249
fail=0`.

---

## 8. Make service-worker upgrades atomic  — **done**

`sw.js` used `cache.add(url).catch()` for every asset, so a missing **required**
file didn't abort the install; `activate` then deleted *all* old caches, so a
partial install could discard the last complete offline cache.

Fix (`web/sw.js`):
- **Split the precache list** into `REQUIRED` (app shell + all six books' data —
  the game can't run offline without these) and `OPTIONAL` (the large map/world
  images, fetched lazily on demand otherwise).
- **Install is all-or-nothing for REQUIRED** — `cache.addAll(REQUIRED)` rejects
  if any required asset fails, so the install fails and the previous complete
  cache lives on; we never activate an incomplete shell. `OPTIONAL` assets are
  added best-effort (`.catch`), so a map miss can't abort the upgrade.
- **Activate deletes old caches only after verifying completeness** — it
  re-checks that the new cache holds every `REQUIRED` asset (`cache.match`) before
  deleting any older cache; if incomplete, it keeps the old caches as an offline
  fallback. `skipWaiting`/`clients.claim` are preserved.

The `const VERSION = '…';` line kept its shape so `stamp-version.ps1`'s cache-key
rewrite still matches. Verified: `sw.js` compiles cleanly in headless Chrome
(`new Function(source)` syntax check) + full render-every-section scan unaffected.
`RESULT ALL PASS pass=249 fail=0`.

---

## 9. Centralise tag dispatch into a registry  — **done**

Tag handling was spread across two hand-rolled switches (`render.js`
`renderElement`, `engine.js` `applyEffect`). Both are now table-driven:

- **`engine.js`** — an `EFFECT_APPLIERS` map (`tag → (el, state, opts) => note`)
  replaces the `applyEffect` switch; `applyEffect` is now a one-line lookup
  (unknown tag → `''`, as before). This is the DOM-free "factory" half.
- **`render.js`** — a module-level `TAG_RENDERERS` map (`tag → Story method
  name`, all methods sharing the `(container, node, path)` signature) replaces the
  `renderElement` switch; the four cases that had inline bodies were extracted
  into methods (`renderParagraph`, `renderTextWrapper` for `<text>`/`<desc>`,
  `renderChoiceElement` for a bare `<choice>`, `renderReroll`) so every tag maps
  to a named handler. The `INLINE_STYLE` pre-check and the `PASSIVE_TAGS` / prose
  fallback in the default path are unchanged.

**Design note (deviation from the original single-table sketch):** the task text
suggested *one* unified table `{render, applyEffect, condition}`. Kept as **two
per-module tables** instead, deliberately — a single table holding both a DOM
renderer and a headless applier would couple the view to the rules and break the
architecture invariant (rules live in DOM-free modules). The task's own
parenthetical — "mirror the factory, *minus the UI coupling*" — asks for exactly
this split. `condition` isn't tag-dispatched at all (it's attribute-based OR
matching inside `evaluateCondition`, reached via the `if`/`elseif`/`else` render
entries), so it has no place in a tag table and is left as-is.

Adding a tag is now a one-line change per concern (a `TAG_RENDERERS` entry + its
method for the view; an `EFFECT_APPLIERS` entry for a passive effect). Pure
refactor — no behaviour change. Verified: full render-every-section scan (4369
sections, every tag exercised). `RESULT ALL PASS pass=570 fail=0`.

---

## 10. Dice RNG quality / reproducibility  — **done**

`engine.js` rolled with `Math.random()` — unbiased for 1–6 but **not seedable**.
Added a central, optionally-seedable RNG so runs can be made reproducible:

- **`engine.js`** — a module-level `_rng` now backs all *game* randomness. `rng()`
  returns its float in [0,1); `rollD6`, `rollDiceExpr` and the probabilistic
  `chance="x/y"` item loss all call it. Unseeded, `_rng` defers to the **live**
  `Math.random` (`() => Math.random()`, evaluated per call — so a test that stubs
  the global still steers the dice, and there's no bias). `seedRng(seed)` installs
  a deterministic **mulberry32** PRNG (a string seed is hashed to 32 bits via
  **xmur3**; a finite number is used directly), returning the numeric seed; pass
  `null`/`''` to revert to `Math.random`. Both helpers are exported.
- **`app.js`** — a `?seed=<value>` boot hook seeds the RNG for that page load and
  toasts the applied seed; unset ⇒ random as before. Documented in `README.md`
  beside `?demo=`.
- Deliberately **not** seeded: the dice-spin animation (`ui.js`) and DOM id
  suffixes (`state.js`) — cosmetic/structural, kept on `Math.random` so they can't
  perturb the outcome stream.

`crypto.getRandomValues` (higher entropy) was considered unnecessary — mulberry32
is ample for dice and, unlike crypto, is seedable, which is the point here.

Verified: 8 new headless assertions (same numeric seed reproduces the sequence;
seeded rolls in 1..6; different seeds diverge; string seed deterministic; string
vs numeric differ; `seedRng` returns the applied seed / null on revert;
`rollDiceExpr` reproduces with its modifier) + the full render-every-section scan
(the existing `Math.random`-stub roll tests still steer the dice, confirming the
live-deferral). `RESULT ALL PASS pass=578 fail=0`.

---

## 11. Harden the per-visit memoization assumption  — **done**

`render.js` memoises applied effects / rolls by a positional node path
(`basePath + '.' + idx`). This is safe today because the parsed section tree is
static per visit, so a node keeps the same sibling index across re-renders. The
assumption is now both **documented** and **guarded**:

- **Comment** — `appendChildren` (`render.js`) carries a block comment spelling
  out the invariant: every memo key (`fx@`/`roll@`/`grp@`/`pay@`/`chain@`) is
  derived from the positional path, so *conditionally reordering, inserting, or
  removing* siblings between renders would slide a node's path onto another node's
  memo slot — re-firing an applied effect or losing a resolved roll.
- **Tripwire** — a per-visit `ctx.pathNodes` map (`path → node`, reset each visit
  in `begin`) records the node first seen at each path; if a later re-render sees
  a *different* node at the same path, it `console.warn`s pointing at this task.
  It never fires under the static-tree model (a dev aid, ~1 map op/node, not a
  hot-path cost).

Verified: 3 new headless assertions (a real mixed section re-rendered twice trips
no warning; `pathNodes` populates on first render; the tripwire *does* fire when a
path is forced to map to a new node — proving it's live) + the full
render-every-section scan raising no reorder warning across all 4369 sections.
`RESULT ALL PASS pass=581 fail=0`.

---

## 12. Add headless unit tests for the extracted rules  — **done**

Audited the listed cases against the current suite first — most were already
covered, so this filled only the genuine gaps:
- **Already covered** (left as-is): over-Defence miss (a Def=COMBAT+12 wall never
  scratched, §task-49 block), `<fightdamage type="add">` + `type="replace">`
  (§105/hangman), cargo capacity (galleon 3-unit cap, 4th refused), and fixed /
  full / blank rest with cost charging (task-31 block).
- **New assertions** (6, at the end of `run()` in `web/_test.html`): a **decisive
  win** (a defenceless enemy falls, hero survives, `outcome==='win'`); a
  **decisive death** (an enemy that strikes first for lethal damage and can't be
  beaten kills the hero — `isDead()`, not a win); the **12-item carry cap on a
  buy** (`buyTrade` refused with the "carry only 12" note and *no* Shards spent,
  then succeeds and charges once a slot is freed); and a **dice rest** (`applyRest`
  with `"2d"`, `Math.random`-forced deterministic, heals the rolled total).

Note: the new block initially collided with an existing `let gw` in the same
`run()` scope — a duplicate declaration is a parse-time `SyntaxError`, which
silently aborts the whole module (page stuck at "running…", not a test failure).
Renamed to `gw12`. Verified: `RESULT ALL PASS pass=587 fail=0`.

---

## 13. Optional: build-time XML validation  — **done**

`build/build-data.ps1` bundled section XML unchecked, so a malformed file only
surfaced as a render throw in the browser (caught late, by the smoke test). Added
a **validation pre-pass** (`build/build-data.ps1`) that runs before anything is
written:

- A `Test-XmlDoc($xml, $label, $expectRoot)` helper parses a fragment with
  `System.Xml.XmlDocument.LoadXml` (strict XML — stricter than the runtime
  `DOMParser`) and, when `$expectRoot` is given, checks the root element. (Uses
  `.get_Name()` — PowerShell's XML type adapter overrides plain `.Name` to return
  the `name` *attribute*, a gotcha that made an early root check misreport.)
- The pre-pass validates **every section** (well-formed **and** rooted at
  `<section>`), plus each book's `Adventurers.xml` and the two rules files. Any
  failure prints the offending file(s) and **throws** (`$ErrorActionPreference =
  'Stop'`), aborting *before* JSON is written — so broken data never ships.
- Chosen over wiring the whole render-every-section smoke test into the build: it
  needs no browser/server, runs in-process, and pinpoints the bad file by name.

Confirmed the corpus is strict-XML clean first (4369 sections + 6
`Adventurers.xml` + 2 rules = **4377 files, 0 malformed**), so the gate never
fires spuriously; the failure path was unit-checked against an unclosed tag, a
stray `&`, and a wrong root. Full build runs clean (`XML OK: 4377 files
well-formed.`), the six book JSONs are byte-identical (no reformat), and the
headless suite is green (`RESULT ALL PASS pass=587 fail=0`). README's
"Regenerating the data" section documents the new gate.

---

## 14. Fix save-card button overflow on mobile  — **done**

On the saves screen each `.save-card` laid out the info and a `.save-btns` row of
three full-size buttons (Play / Export / Delete) side by side; `.save-btns` is
`flex-shrink: 0`, so on a narrow phone the buttons overflowed the card (Delete
clipped off-screen). Fixed in `css/style.css` inside the `@media (max-width:600px)`
block: the card stacks (`flex-direction: column`), and the button row goes
full-width with each `.btn` `flex: 1; min-width: 0` and reduced side padding, so
the three buttons share the row and all stay visible. CSS-only; verified visually
at a 360px viewport and with the full render-every-section smoke test
(`RESULT ALL PASS`).

---

## 15. Fix `<gain>`/`<lose>`/`<tick>` ability effects (rank, stamina, "?", "*", fatal)  — **done**

`firstAbility` accepted only the six core abilities, so `ability="rank"`,
`ability="stamina"`, `ability="?"` and `ability="*"` were dropped by `applyLose`/
`applyTick`, and in a `<gain>`/`<tick>` the dropped effect left `did` false so the
bare-tick fallback **ticked the visit box instead** (39 rank-ups did nothing and
corrupted tick state; book2/157 wheel of fortune, etc.).

Fix (`web/js/engine.js` + `web/js/state.js` + `web/js/render.js`):
- New `applyAbilityChange()` routes any ability spec: core abilities, `rank`,
  `stamina` (permanent max+current move via `state.adjustAbilityStamina`), `*`
  (all six), and `?`/`a|b` (via `opts.chooser`). `applyLose`/`applyTick` now enter
  the branch on `ability=` alone and set `did`, so a recognized ability effect
  never falls through to the box tick.
- `fatal="t"` honoured in `adjustAbility`/`adjustRank`/`adjustAbilityStamina`:
  reducing an ability/rank/current-Stamina to 0 drops Stamina to 0 (death);
  non-fatal Stamina floors current at 1 (book2/157, book5/356 hangman).
- `effect="+fixed|+cursed|-…"` stored as per-ability flags (`data.abilityFlags`);
  a new `state.abilityForCheck()` (used by `rollDifficulty` and the `ability=`
  `<if>` path) treats fixed as 1 and cursed as auto-fail, with JaFL's **mask
  exception** for CHARISMA. The displayed/derived score is left untouched
  (matches JaFL's PURPOSE_TESTING split) — book2/643, book6/78/332.
- **Choosers** (`render.js`): `renderAbilityChoice` defers `<lose|gain|tick
  ability="?"/"a|b">` to pick buttons instead of auto-applying; `renderTraining`
  offers a chooser for a bare/`?`/`a|b` `<training>` (fixes the phantom `''`/`'?'`
  key — book5/59, etc.); `renderDifficulty` offers a chooser for multi-ability
  rolls (`combat|magic`, 14×; book1/344).

Verified: 17 new assertions (rank gain w/o box-tick; bare `<tick/>` still ticks;
permanent stamina gain/loss; fatal stamina & fatal core-ability death; `*`; `?`
via chooser; fixed/cursed + mask; cursed auto-fails difficulty; §344 chooser→roll;
§59 six-ability chooser) + full render-every-section scan. `RESULT ALL PASS
pass=122 fail=0`.

Deferred (tracked elsewhere, not this task): `<lose>`'s `<adjust>` child
modifiers on ability/stamina damage → **task 25**; the flag-gated wheel spins in
book2/157 (`<random flag=…>`) still default the "?" choice to the first eligible
ability until **task 30** wires the payment gate; and book6/332's
`12-charisma modifier="natural"` raise depends on **task 25**'s `<set modifier>`
fix (the `-fixed`/`-cursed` clearing itself works).

---

## 16. Make wildcard/choice losses actually take things  — **done**

Robbery, imprisonment, disarming and death-cleanup sections left the player
untouched. Fixed in `web/js/engine.js` (`applyLose`/`applyShipLose`/new
`loseEquipment`) and `web/js/state.js` (`removeCurse`):
- `shards="*"` now empties the purse; `item="*"` removes every possession
  (honouring `chance="x/y"` probabilistic loss — book §…, and never taking a
  `keep`-tagged item) — book1/218, book1/157, book5/7.
- `blessing="*"` removes all blessings; `blessing="?"` removes one (via
  `opts.chooser`, else the first) — book2/157 outcome 5, book2/394.
- New `weapon=`/`armour=`/`tool=` loss handling: `"*"` = all of that kind,
  `"?"`/name = one (chooser/first), `using="t"` = the wielded weapon / worn
  armour; `bonus=`/`tags=` narrow the candidates (~15 confiscation nodes).
- `cargo="?"` removes one cargo unit (chooser or first) instead of the old
  `indexOf('?')` no-op (18×).
- `resurrection="t"` clears **all** arrangements (book2/394, book6/230);
  `removeCurse('*')` now lifts **every** matching curse (state.js).

Verified: 10 new headless assertions (lose-all Shards; lose-all possessions with
a surviving keep item; blessing "?"/"*"; weapon/armour `using="t"`; weapon "*";
resurrection clear-all; curse "*"; cargo "?") + full render-every-section scan
(`RESULT ALL PASS pass=132 fail=0`).

Deferred: an interactive weapon/armour/cargo chooser (the engine `opts.chooser`
hook is in place but unwired in the view, so a "?" confiscation defaults to the
wielded/first item — consistent with the §521 item-theft model). `curse="?"`
(3×) needs the named curses from **task 19**; `<lose item="?" cache=…>` is
**task 20**.

---

## 17. Recognise all spec'd `<if>` attributes; stop defaulting unknown conditions to true  — **done**

`evaluateCondition` (`web/js/engine.js`) had no handlers for `weapon=`, `armour=`,
`tool=`, `disease=`, `poison=`, `cache=`, `using=` or `bonus=`-filtered forms, so
those conditions silently passed/failed; and `docked=`, `modifier="natural"` and
empty-`god=` were mis-evaluated.

Fix (all OR-combined with the task 3 disjuncts):
- **weapon/armour/tool** conditions via a new `matchEquipment()`: `"?"`/`"*"`/empty
  = any of that kind; a name or `*glob*` (pipe-separated) matches by name;
  `bonus=` ("N"/"N+") and `tags=` narrow; `using="t"` restricts to the wielded
  weapon / worn armour (book2/90, book6/614, the book-6 weapon-type checks).
- **docked="<place>"** now needs a ship berthed at that place (`docked="t"` =
  anywhere), instead of matching any ship (book3/53/222/345).
- **modifier="natural"** compares the written ability score (`abilityForCheck(ab,
  true)`), not the item-boosted one (book2/554, book5/435).
- **god=""** = "worships no god" (`gods.length===0`) — book2/578.
- **cache=** redirects the shards/item/equipment lookups to a named stash
  (`state.cacheMoney`/`cacheItems`); **task 20** stocks those caches.
- **disease=/poison=** read `state.hasDisease`/`hasPoison`; **task 19** populates
  the affliction store.
- The source-XML typo `safeAddGodd` is accepted as an alias of `safeAddGod` (see
  new task 37).
- Genuinely unrecognized condition attributes now **`console.warn` once** and
  make the condition default to **false** (negated to true under `not="t"`)
  rather than silently passing; every attribute currently used on `<if>`/`<elseif>`
  in the corpus is whitelisted, so no existing section changes behaviour.

Verified: 17 new assertions (weapon "?"/glob/using; docked location; natural vs
boosted; empty-god; unknown-attr default; disease) + full smoke test
(`RESULT ALL PASS pass=149 fail=0`).

---

## 18. Preserve item `tags` and support tag-filtered item conditions  — **done**

`makeItem` accepts a `tags` parameter but no caller passed it, so all tagged
awards lost their tags and every `<if item="?" tags="light">` check was
permanently false (the Yellowport sewers questline was unenterable for
non-mages — book1/460 → §164).

Fix — tags now flow through all four call sites:
- **Awards** (`render.js` `renderItemAward`) read the node's `tags=`.
- **Market buys** (`market.js` `goodsFrom`→`buyTrade`) and **inline buys**
  (`applyInlineBuy`, wired from `renderInlineBuy`) read `buytags=` (falling back
  to `tags=` — the candle rows use `buytags`).
- **Starting items** (`data.js` `parseAdventurers` → `GameState.create`) carry
  their `tags=`.
- A shared `parseTags()` helper (state.js) does the comma/pipe split; the item
  **condition** now supports `item="?"` + `tags=` (any possession carrying every
  listed tag), mirroring the lose-path wildcard.

Verified: 6 new assertions (award preserves `light`; `if item="?" tags="light"`
true/false; the §460 non-mage-with-light gate; a market buy preserves
`light,useonce`) + full smoke test (`RESULT ALL PASS pass=155 fail=0`).

---

## 19. Implement the curse / disease / poison system end-to-end  — **done**

The affliction system now works end-to-end. Afflictions are stored uniformly as
`{name, type, effects:[{ability,bonus}], cumulative, lift}` (state.js
`addAffliction`/`removeAffliction`, backing `data.curses`/`diseases`/`poisons`):
- **Inflict** (`engine.js` `applyAffliction` + `readEffects`): the
  `<curse>`/`<disease>`/`<poison>` element's `name=` and `<effect ability=…
  bonus=…>` children are stored; `<disease>`/`<poison>` were added to the
  `applyEffect` switch and to `PASSIVE_TAGS` so they inflict on render (book4/31
  Curse of Tambu, book1/196 Ghoulbite, book1/532 Scorpion Poison).
- **Suffer**: `state.afflictionBonus(ability)` sums the effects and is folded into
  `ability()`, so the penalty hits derived stats (Defence) and checks until cured;
  clamps keep abilities ≥1.
- **Detect**: `hasCurse`/`hasDisease`/`hasPoison` match **by name**; the task-17
  `<if curse|disease|poison=…>` paths use them (book4/111/231, §532).
- **Cure**: `<lose curse|disease|poison="name"|"*"|"?">` removes the affliction
  (and its penalty), with `*` = all and `?` = the first (book4/12; the 11
  `<lose disease="*">`, 4 `<lose poison="*">`, 3 `<lose curse="?">`).
- **cumulative="t"** stacks; a non-cumulative re-infection has "no further effect".

Verified: 10 new assertions (curse inflict→detect→Defence penalty→cure; disease
non-cumulative + `<lose disease="*">`; poison by name; cumulative stacking) +
full smoke test (`RESULT ALL PASS pass=165 fail=0`).

Deferred: the curse-flavoured `special=` effects (armourlock/weaponlock,
difficultyCurse/difficultyRestore) remain **task 36**.

---

## 20. Implement caches, banks, `<adjustmoney>` and `<transfer>`  — **done**

The whole stash/bank economy now works. A cache is a named stash the books
address by key (`state.data.caches[name] = {money, items, locked}`): an
investment box, a bank account (`MerchantBank`), a gambling pot, or a villa
strongroom.

- **Cache store** (`state.js`): `_cache`/`cacheMoney`/`cacheItems`,
  `deposit/withdrawCacheMoney` (the latter with a `withdrawCharge` fee, rounded
  in the house's favour), `set/adjust/multiplyCacheMoney` (all floored, ≥0),
  `cacheAddItem`/`cacheRemoveItem`, and `lock/unlock/isCacheLocked`.
- **`<adjustmoney multiply="N">`** (`engine.js applyAdjustMoney`, added to
  `applyEffect` + `PASSIVE_TAGS`): scales a named cache (`name=`/`cache=`) or,
  with no name, the purse — book1/91 gamble (×5/×2/×0), book2/107/108,
  book5/116, and "lose half your money" (book6/139 et al.).
- **`<transfer>`** (`engine.js applyTransfer`): moves shards/weapon/armour/
  tool/item between the sheet and a cache — `to=` deposits, `from=` withdraws;
  `*`/`?`/name select; `limit=`/`x<kind>=` narrow. Confiscate-and-return
  (book2/462 vampire). A `force="f"` transfer is opt-in (a click in the view);
  a forced one applies on view.
- **lock/unlock** (`engine.js applySpecial`): `<tick special="lock|unlock"
  cache=…>` toggles a cache's `locked` flag.
- **`cache=` routing**: `<if cache=…>` already read the stash (task 17) and now
  it is populated; `<lose … cache=…>` and `<tick … cache=…>` (deposit / item
  enchant via `addtag`/`addbonus`) redirect to the cache. **The `cache=`-on-lose
  corruption is fixed first** — `<lose item="?" cache="4.468">` (book4/468) now
  takes from the villa stash, never the player's carried possessions.
- **Widgets** (`render.js`): `renderMoneyCache` (deposit/withdraw, honouring
  `max=`/`multiples=`/`withdrawCharge=`) and `renderItemCache` (store/take
  possessions, honouring `itemlimit=` and the 12-item carry cap), plus CSS.

Known limitation: because the section re-renders in a single memoized pass, the
lock/unlock bracket used by book1/91's gamble doesn't gate the widget's
interactivity (the primitive exists and is tested, but the widget stays live).
This affects only the "can't change your bet after rolling" nicety; deposits,
withdrawals, investments, banking and the villa stash all work. §91 renders
clean.

Verified: 18 new headless assertions (deposit/withdraw incl. bank fee; named-
cache multiply incl. ×0 wipe; purse-multiply floor; `if cache` threshold; the
§4.468 stash-not-inventory loss; `lose shards="*" cache`; lock/unlock; `tick
shards cache` deposit; transfer disarm/return round trip; `transfer shards="*"`;
§49 money-cache widget deposit; §468 item-cache widget renders) + full
render-every-section scan. `RESULT ALL PASS pass=187 fail=0`.

---

## 21. Fix `<flee>`/`<fightdamage>`: no render-time auto-apply, find them anywhere, honour `flee="t"`, `type="replace"`  — **done**

All four defects fixed:
1. **Render-time auto-apply (worst):** `renderElement` now has explicit
   `case 'flee'`/`case 'fightdamage'` → `renderInert`, which shows the prose but
   applies **no** effects and disables any controls it produces (using the same
   `this.inactive` suppression as an untaken branch). Entering book2/207 no
   longer costs the flee wound, and book1/105's ScorpionSting is no longer set on
   view (nor double-applied).
2. **Discovery:** `findSibling` (forward same-level only) is replaced by
   `findInSection(tag)` (`sectionEl.querySelector`), so a `<flee>`/`<fightdamage>`
   is found wherever it sits — inside a `<p>`, or before the `<fight>`
   (book2/152/207/297/313).
3. **Gate:** `computeFightGate` now skips `<choice flee="t">` (never added to
   `navNodes`), so book3/662's "flee at any time" stays live mid-fight. The
   flee="t" choice itself applies the `<flee>` consequence on click.
4. **Semantics:** the enemy-attack branch in `combat.js` honours
   `type="replace"` (no Stamina loss; apply the body instead — book5/356 hangman)
   vs the default `type="add"` (Stamina loss **plus** the body — book1/105), and
   a new headless `engine.applyEffectBody` walks the **whole** `<fightdamage>`/
   `<flee>` subtree per wound (all children, rolling any `<random>`/`<rankcheck>`/
   `<difficulty>` and honouring `<if>`/`<elseif>`/`<else>` chains), not just
   `firstElementChild`.

The Flee button and any `flee="t"` choice both call `applyEffectBody(fleeNode)`
on the flee event (a fatal parting wound routes to death), then navigate to the
flee's inner `<goto>`, else the `flee="t"` choice's section, else re-render so a
box-gated flee choice unlocks (book2/207 → §22).

Verified: 9 new assertions (§207 no auto-apply + Flee button applies wound +
codeword; §105 ScorpionSting unset on render; fightdamage type=add effect +
Stamina loss per wound; type=replace loses an ability not Stamina; §662 normal
post-fight choice gated while flee="t" stays live and applies its wound → §407) +
full render-every-section scan. `RESULT ALL PASS pass=196 fail=0`.

---

## 22. Render `<success>`/`<failure>`/`<outcome>` children of `<choices>`  — **done**

`renderChoices` kept only `<choice>` children, silently dropping the roll-branch
elements the books place inside choice tables (book1/123's swim SCOUTING roll led
nowhere). Fix (`render.js`): `renderChoices` now iterates *all* children in order
and routes `<success>`/`<failure>`/`<outcome>`/`<outcomes>` through `renderBranch`
(alongside the `<choice>` buttons), so the branch reveals its goto once the
prose's `<difficulty>`/`<random>` resolves. `renderBranch` gained a lone-
`<outcome>` case matching on `flag=` (no roll needed — the paid-offering idiom in
book4/456), `range=`/`var=` (vs the roll) or `codeword=`. Covers book1/123/554,
book2/53/61/122/138/190, book3/533, book4/456/457, book5/333, book6/735.

Verified: 4 new assertions on §123 (roll button + 4 plain choices render; branch
hidden until rolled; a swim outcome →53/→76 revealed after rolling) + full smoke
test (`RESULT ALL PASS pass=169 fail=0`).

---

## 23. Make inline `<buy>`/`<sell>` functional (ships, tools, quantity, item sells)  — **done**

**Buys:** `market.applyInlineBuy` now returns `{ok, note?}` and handles every
inline-buy kind — crew upgrade, **ship** (type canonicalised via a new
`rules.canonShipType`, with `name=`/`initialCrew=`), **tool** (with `ability=`/
`bonus=`), **item**, and **cargo** (routed through `buyTrade` so ship capacity is
enforced). `renderInlineBuy` reads `ship=`/`tool=` and honours `quantity=` as a
per-visit purchase cap, memoised in a new `ctx.buys` counter so a buy can no
longer repeat forever (book1/30 map, book1/359 "up to three lanterns"). The
plot-critical ships (book2/663, book3/393/406/710, book4/114/559/658, book5/192)
and priced tools (book1/299 mandolin, book5/548 wands, book6/421 talismans) are
granted; `buy ship="brig"/"gall"` canonicalise to brigantine/galleon.

**Sells:** `renderInlineSell` now handles `item=` + `shards=` sells (book 5's
rime-ice / selenium-ore income at book5/141/446/457/594; the book1/30 treasure-
map buy-back), repeatable while owned, via a new `market.sellInlineItem`. The
misleading "non-cargo sells unused" branch is gone.

**Rules-out-of-view (task 34 slice):** the inline cargo→Shards transaction moved
from `renderInlineSell`'s click handler into `market.sellCargo` (the view keeps
only the barter-reward wiring); the crew-upgrade grade check uses `CREW_LEVELS`
from `rules.js`.

Verified: 15 new assertions (buy ship grants a named ship; galleon holds 3 cargo
units, 4th refused; `brig`→brigantine + `none`→poor crew; buy tool grants a
bonus tool and charges; buy refused when short; sell-item round trip; §359
lantern quantity-3 cap with the light tag preserved; §30 treasure-map buy
memoised at quantity 1 + buy-back sell round trip) + full render-every-section
scan. `RESULT ALL PASS pass=211 fail=0`.

---

## 24. Canonicalise ship types (`brig`, `gall`) and fix crew-upgrade steps  — **done**

The books abbreviate ship types (`<trade ship="brig">` / `"gall"` — book4/141,
book5/145/225), so `type:'brig'/'gall'` fell through `shipCap` to the default 1
cargo unit (instead of brigantine 2 / galleon 3), and none of the 27
`<if ship="brigantine|galleon">` checks (nor `<elseif ship="brig">` on a
brigantine bought under its full name — book4/11/161) matched, since the raw
strings were compared. A crew *upgrade* (`<lose crew="-1">`, 4×, plus one
`crew="-2">`) on an excellent crew also indexed past the array end and silently
reset the crew to `'poor'`.

Fix:
- **`rules.js`** — a `SHIP_TYPE_ALIASES` map + `canonShipType()` fold
  `brig→brigantine`, `gall`/`galley`→`galleon` to the canonical `SHIP_TYPES`
  key.
- **`market.js`** — `shipCap`, `ownsGoods`, `buyTrade`, `sellTrade` and
  `applyInlineBuy` all canonicalise the ship type at purchase/sale and compare
  canonically; a new `canonCrew()` normalises `initialCrew=` (`none`→poor,
  blank/`oldcrew`→average).
- **`engine.js`** — a new `matchShipType()` canonicalises **both** the stored
  type and every listed alternative before comparing, wired into
  `evaluateCondition` (`<if ship=…>`) and `adjustApplies` (`<adjust ship=…>`);
  and `applyShipLose` now shifts the crew grade along `CREW_LEVELS` with a clamp
  on **both** ends (positive N demotes, negative N promotes; never wraps).
- **`ui.js`** — the Adventure Sheet ship line canonicalises the type so legacy
  saves holding an abbreviation still show the right label and capacity.

Verified: 12 new headless assertions (`<trade ship="brig">` stores a brigantine
with crew poor; a brigantine matches `<if ship="brig">`/`"brigantine">` and
rejects barque/galleon; a legacy `gall` ship matches `galleon`/`gall`; crew
upgrade past excellent stays excellent; `crew="-2"` from good clamps to
excellent; demotion below poor stays poor; average→good moves one step) + full
render-every-section scan. `RESULT ALL PASS pass=260 fail=0`.

Note: the prior session's test additions had shipped with a duplicate `const
gca` (colliding with the §... cargo test), a `SyntaxError` that had silently
broken the *entire* headless suite; renaming the new binding to `gcma` restored
it and confirmed all 260 assertions pass.

---

## 25. Fix value/expression parsing: vars containing "d", unary minus, division  — **done**

`resolveValue` tested `isDiceExpr` with `/d/i`, so any variable whose name merely
*contained* a "d" was misparsed — `<adjust amount="d">` rolled a die instead of
reading var `d` (book6/696/527/742), and `deduct`/`defence`/`shards` were all
treated as dice. `"-bonus"`/`"-s"`/`"-a"` looked up a var literally named
`-bonus` → 0 (book2/726/750/770/579). `evalExpression` tokenized only
`[A-Za-z_]+|\d+|[+\-*]` — no `/`, no parens, no unary minus — so
`"(shards+9)/10"`, `"shards/1000"`, `"(x+1)/2"`, `"(900-shards)/100"` and
`"-armour"`/`"-defence"` (book2/665, book4/679, book6/306/527/696/742) returned
garbage or 0. And `applyLose`/`applyAbilityChange` never applied
`childAdjustment`, so `<lose stamina="3d"><adjust .../></lose>` gave no damage
reduction (book4/556/679, book6/306/527/696/742; the spec lists `<gain>`/`<lose>`
as adjust-modifiable).

Fix (`web/js/engine.js`):
- **`isDiceExpr`** now matches a real dice pattern only —
  `/^\d+\s*d\s*\d*\s*([+-]\s*\d+)?$/i` (a leading digit is required), so `1d`/`2d`/
  `3d6`/`1d6+2` roll but `d`/`deduct`/`defence`/`shards` are variables. (Every
  `="d"` in the corpus is the variable `d`, never a bare die.)
- **`resolveValue`** is now *variable-first* (matching Java `Node.getAttributeValue`
  — int | `-var` | var, undefined → 0), with a fallback to `evalExpression` for
  any richer expression. An `<adjust amount="armour"/>` therefore reads the
  *variable* `armour` (sections set it to `-armourbonus`), not the sheet rating.
- **`evalExpression`** is a proper recursive-descent parser over the original Java
  `Expression` grammar: identifiers, integers, `+ - * /` (integer division,
  truncating toward zero) and parentheses, with a leading unary minus. Idents
  resolve *keyword-first* (armour/weapon/defence/stamina/shards/rank/crew + ability
  names, then stored vars) — the `<set value=>` contract.
- **`applyLose`** (stamina) and **`applyAbilityChange`** now add
  `childAdjustment(el, state)` to the amount; `adjustAmount` learned the `stamina`
  keyword (→ the natural/unwounded `staminaMax`) so book2/579's "reset your
  unwounded Stamina to the 2d roll" idiom works.

Verified: 29 new headless assertions (isDiceExpr on real dice vs "d"/"deduct"/
"defence"/"shards"; resolveValue reads `d`/`deduct` as vars and negates `-s`/
`-bonus`; integer-division/parens/unary-minus/keyword forms of evalExpression;
`<set var="d" value="-armour"/>` → armour-reduced stamina loss; book4/556 Three
Fortunes −1; a plain loss unchanged; book2/579 unwounded-Stamina reset) + full
render-every-section scan (4369 sections). `RESULT ALL PASS pass=289 fail=0`.

---

## 26. Implement the remaining `<fight>` attributes  — **done**

`makeFight` read only name/combat/defence/stamina/flee/playerFirst; every other
documented `<fight>` attribute in the corpus was silently ignored. All are now
implemented (`web/js/combat.js`, wired in `web/js/render.js`):

- **`attackDice="N"`** — the player rolls N dice to attack instead of 2 (Haniwa
  Warrior, book6/473).
- **`attacks="N"`** — the enemy strikes N times per round (Tripling, book5/345).
- **`modifiers="noarmour"`** — the player's armour bonus is dropped from their
  Defence for this fight (Water Drake, book6/718).
- **`playerDefence="V"`** — a value/variable replaces the player's Defence
  (Chimerical Beast `"s"`, Talanexor `"d"`), resolved each round via
  `resolveValue` (variable-first).
- **`abilityDamaged="S"`** — the enemy's hit reduces that ability instead of
  Stamina; `"stamina"` is a *permanent* max+current cut (`adjustAbilityStamina`,
  fatal) — the Big Boy / Giant fights (book6/460/563).
- **`preDamage="V"`** — damage inflicted on the enemy up front (from a codeword,
  else a like-named var), which may fell it before the first blow.
- **`staminaLost="S"`** — reset the codeword to 0 at fight start and accumulate
  the (overkill-capped) damage the player deals into it. The pair drives the
  Dawatsu Morituri fights (book6): the first stores `MorDamage`, the second reads
  it via `preDamage`.
- **`useCache="S"`** — the enemy fights with the best weapon/armour stashed in
  the named cache (their bonuses add to the enemy's Combat/Defence) — the Warrior
  Maid, book6/635.
- **`group="S"`** — a *simultaneous* multi-enemy fight: a combined widget
  (`renderGroupFight`/`drawGroupFight` + `combat.groupFightRound`) where the
  player strikes one foe and every still-standing foe strikes back
  (book6/192/273/291/618). A shared `sectionFight` proxy drives the existing
  fight-gate / death-defer machinery (win when all are down; lose→branch when the
  player is slain and the section has an "if you lose…" path).

`makeFight(node, state)` now runs the pre-fight setup (staminaLost reset,
useCache loadout, preDamage) once when state is supplied; `fightRound`/
`groupFightRound` default `attackDice`/`attacks` so a bare fight literal still
resolves.

Verified: 15 new headless assertions (attribute parsing; preDamage carry-over &
pre-kill; staminaLost reset + accumulation; attackDice=1 miss-cap; attacks=3
strike count; playerDefence override; noarmour armour-drop; abilityDamaged max
cut; useCache loadout; a group fight resolving; §6.192 drawing one combined
widget) + the three pre-existing fight tests still green + full
render-every-section scan (4369). `RESULT ALL PASS pass=303 fail=0`.

---

## 27. Cap visit-box ticks and make `ticks=` guards robust  — **done**

`state.addTick` had no cap at the section's `boxes=` count. In book1/16
(`boxes="1"`): visit 1 ticks the box; on visit 2 the `<if ticks="1">` guard
matches (goto 251) but the sibling bare `<tick/>` still fires → count 2; from
visit 3 on the guard (strict `==`) never matches again and the one-time
dragon-hoard loot is re-offered. The `ticks="N"` guard pattern appears in ~30
sections in book 1 alone.

Resolution: the guard stays strict equality — the Java engine's
`IfNode.meetsConditions()` also uses `getTickCount(section) == ticks`, so `>=`
would diverge. The real fix is the **cap**, mirroring JaFL's
`SectionNode.addTicks`, which only fills *unselected* boxes (never exceeding the
`boxes=` count) — its guarded `<goto>` also fires immediately and short-circuits
the sibling `<tick/>`, which the JS single-pass render can't. Changes:
- **`state.js`** — a transient `setSectionBoxes(n)` records the current section's
  `boxes=` count (not persisted), and `addTick` caps the current section's total
  at it (`Math.min`). A boxless section (cap 0) or a tick aimed at another section
  is left uncapped, so nothing else changes.
- **`render.js`** — `render()` calls `state.setSectionBoxes(nBoxes)` before the
  section body renders, so the bare `<tick/>` is capped as it fires.

Verified: 5 new headless assertions (three successive visits to §1.16 each leave
the count at 1, not 2; the `<if ticks="1">` guard still matches on a repeat
visit; a boxless section stays uncapped) + full render-every-section scan (4369).
`RESULT ALL PASS pass=308 fail=0`.

---

## 28. Honour `dead="t"` on `<goto>`/`<choice>`  — **done**

61 `<goto dead="t">` and 11 `<choice dead="t">` rendered as normal enabled
navigation for a living player, so a book4/16 trample *survivor* could click the
link "7" into the you-are-dead section (whose dead-end fallback then funnelled
them into real death). Only `dead="t"` occurs in the corpus (no `dead="f"`), but
both are handled.

Fix (`web/js/render.js`):
- A new **`deadGate(node, btn)`** disables a nav button whose `dead=` doesn't
  match the player's state — `dead="t"` is blocked while alive ("Only if you are
  dead."), `dead="f"` while dead. Wired into `renderGoto` (button disable) and
  `renderChoice` (a gating reason). A dead player can still take a `dead="t"`
  link, and a living player still takes the normal (`dead`-less) branch — book4/16
  survivor → §666, not §7.
- **`computeFightGate`** now marks any post-fight `dead="t"` goto/choice as a
  lose-branch node directly, preferring that precise "you are killed" marker over
  the prose heuristic; it's disabled on a win and is the branch offered on a loss
  (and makes `hasLosePath` true so death is deferred to it).

Death routing itself (the `handleDeath` resurrection/undo modal) is unchanged, so
resurrection deals still take priority — this task only stops the living from
using death-only links and sharpens the fight gate's lose-branch detection.

Verified: 5 new headless assertions (§4.16 dead="t" §7 disabled while alive but
enabled when dead; living §666 stays enabled; a dead="t" choice disabled while
alive; the fight gate marking a dead="t" goto as the lose-branch) + existing
fight/resurrection tests still green + full render-every-section scan (4369).
`RESULT ALL PASS pass=313 fail=0`.

---

## 29. Market & item polish: currency items, pipe names, headers  — **done** (parts 1/3/4; 2 & 5 split out)

This item bundled five loosely-related market/item divergences. The three
contained, high-confidence display/award fixes are done here; the two that are
really subsystems (alternate-currency markets, and the item `<effect>` /`<sold>`
system) were split into tasks **40** and **41** so each gets focused treatment.

Done (`web/js/state.js` helpers `currencyAward`/`splitItemName`, wired into
`render.js` + `market.js`):
1. **Currency items** — an award named `"N Shards"` (dragon hoard book1/16 and
   the 150–2000-Shard picks) now grants N Shards instead of burning a carry slot
   on a valueless possession; it still counts as one grouped "choose up to N" pick.
3. **Pipe-name rows** — a `name="fur cloak|wolf pelt"` good (book4/417,
   book5/101/416) is stored under its first name with the alternatives as tags, so
   the Sell button enables and `<if item="wolf pelt">` matches under either name
   (`matchItems` already matches a name against tags); the row displays the first
   name.
4. **`header1=` titles** — the market heading now prefers the explicit `header1=`
   column title (book4/111 "Potions"/"Artifacts"), falling back to the `type=`
   keyword label then a generic heading, instead of always "Goods for sale".

Verified: 6 new headless assertions (currencyAward parsing; §1.16 "500 Shards"
award adds money and no item; splitItemName; a pipe-name buy matched by either
name incl. `<if item="wolf pelt">`; header1= heading) + full render-every-section
scan (4369). `RESULT ALL PASS pass=319 fail=0`.

Split out (were parts 2 and 5): **task 40** `<market currency="Mithral">`
(book2/495) — needs a named-currency pool rather than deducting Shards; **task 41**
the ~54 item `<effect>` children (`type="use"` potions/Vade Mecum use-goto,
`aura`/`wielded` passives, `ability`) plus `<sold>` sell-hooks (book3/86/318),
which is a sheet-UI + effect subsystem.

---

## 30. Gate `<random flag=…>` rolls behind their payment  — **done**

`renderRandom` ignored `flag=`, so a pay-gated roll was free, and the paired
`<lose … price="k">` (routed through `renderOptionalPay`) applied **every**
`[flag="k"]` node on payment — in book2/157 that fired *all six* wheel outcomes
at once (lose an ability *and* gain one *and* lose Stamina *and* lose all
blessings…). The whole "pay to spin" idiom now works, faithful to the Java
engine (`RandomNode`/`LoseNode`/`GotoNode` flag listeners + `canUse`):

- **Roll gate** (`renderRandom`): a `<random flag="k">` paired with a
  `[price="k"]` cost (`isRollGate`) is disabled until the payment sets flag `k`;
  rolling **consumes** the flag (`setFlag(k,false)`), and a fresh payment
  re-arms it (armed-with-a-stale-result ⇒ drop the result, show the button
  again) — the per-visit "spin again" cycle.
- **Payment** (`renderRollPayment`, split from `renderOptionalPay`): paying a
  roll-gate cost deducts Shards/an item and sets flag `k` **only** — it no longer
  fires the outcome effects. Gated purely on the flag (no one-shot memo), so it
  re-enables once the roll clears the flag; repeatable per-day/-attempt
  (book3/314, book5/674, book6/628). Handles item costs (book6/50 dragon mask).
- **Outcome effects** (`renderPassive`): a roll-gated `flag="k"` reward (a
  `<lose>/<gain>` inside a `<random>`-fed `<outcome>` — book2/157, book5/674)
  is no longer suppressed as a "dependent reward"; it applies when its outcome is
  revealed by the roll (an `ability="?"` outcome offers its chooser).
- **`<goto>/<choice>` gate** (`flagGate`, JaFL `canUse`): a `<goto price="k">`
  exit is withheld while the payment is armed (paid, unrolled) and reopens once
  the roll clears the flag (book2/157 → 19, book6/628 → 8, book3/680 → 407); a
  `<goto flag="k">` is the mirror. Never strands — the roll button always keeps a
  way forward, and the dead-end guard counts disabled controls.
- **Stale-flag reset** (`begin`): a section's `price=`/`flag=` coordination flags
  are cleared on entry (only if set), so leaving mid-transaction can't pre-arm a
  roll or reveal a paid outcome for free on the next visit (also hardens the
  book4/456 paid-offering idiom). Flags are always section-local in the corpus.

Covers book2/157, book3/314, book5/674, book6/171/50/587/628 (every
`<random flag=>` in the corpus; all pair with a `[price=]`).

Known limitation (per-visit memo, task 11): a *repeated identical* outcome
within one visit (e.g. rolling dysentery twice in book3/314) doesn't re-apply its
memoized narrative effect — the roll re-arms and re-reveals, but `fx@<path>` is
still deduped. The primary bug (free rolls / pay firing every outcome) is fixed.

Verified: 19 new headless assertions (`isRollGate` true/false; `<goto price>`
open-while-clear / shut-while-set; §157 roll-disabled-until-paid, pay deducts 20
and fires **no** outcome, roll armed + exit withheld, spin reveals exactly one
outcome + reopens the exit, re-pay re-arms; §314 pay→roll→re-pay repeat cycle;
§674 flag-"c" gate + pay charges 25 with Stamina intact) + full
render-every-section scan (4369). `RESULT ALL PASS pass=338 fail=0`.

---

## 31. `<rest>` with no `stamina=` should restore to full  — **done**

`renderRest` defaulted a missing `stamina=` to `'1'`, so a "heal you of all lost
Stamina points" safe house / temple / healer (62 such tags in the corpus) only
restored **one** point per click. Fixed to match JaFL `RestNode`, which treats a
missing `stamina` attribute as `-1` ⇒ heal *all* Stamina ("restore all your
Stamina" in its own tooltip):
- **`engine.applyRest`** gained a restore-to-full mode: a `null`/blank `perUse`
  heals `staminaMax` (clamped ⇒ back to full); a numeric/dice `perUse` heals that
  amount as before. Any `shards=` cost is still charged first. Returns the amount
  actually healed.
- **`render.js renderRest`** now passes `null` (not a defaulted `'1'`) when the
  node has no `stamina=` attribute, and labels the button **"Rest (heal all
  Stamina)"** vs **"Rest (+N Stamina)"** for the fixed/dice form. The already-at-
  full disable and the affordability check are unchanged.

Verified: 7 new headless assertions (`applyRest(null)`/`applyRest("")` restore to
full; a fixed `applyRest("3")` heals 3 clamped to max; a full-restore rest still
charges its cost; the `<rest stamina="2">` label vs the bare-`<rest>` "heal all"
label; §1.114 safe house heals all lost Stamina on click) + full
render-every-section scan (4369). `RESULT ALL PASS pass=345 fail=0`.

---

## 32. Implement or explicitly stub the remaining unhandled tags  — **done**

Every previously-unhandled tag now has an explicit renderer (`TAG_RENDERERS` in
`render.js`), so the default recursion no longer silently swallows them. Two are
implemented per spec; three are explicit passthroughs whose *automation* is
deferred (their prose still renders, exactly as the default recursion did — no
behaviour change):

- **`<field name= label=>`** (book4/93, book5/401, book6/117/731) — **implemented.**
  `renderField` shows a live codeword-counter readout (`label: value`, 0 if unset),
  re-read each render so it tracks `<tick name=>` (the bribery/offering bonus, the
  Uttaku court status).
- **`<extrachoice>`** (book1/122/327, book5/535/625/722, book6/448/448a) —
  **implemented** end-to-end. A persisted, keyed choice store
  (`state.extraChoices` + `add/removeExtraChoice`/`extraChoicesFor`, sanitised and
  save-safe): a section registers a choice available either at a specific
  `atbook`/`atsection` or at any section with a matching `tag=` (only `"temple"` in
  the corpus), jumping to `book`/`section` when taken; a same `key=` replaces, and
  `remove="key"` lifts it. `renderExtraChoice` registers/removes once per visit
  (silent book-keeping) and shows the note's inline prose; `surfaceExtraChoices`
  renders the active ones at their target section as `.extra-choice` buttons that
  navigate like a `<goto>`. Fixes book1/122's "Enter the sewers" surfacing at §1.10
  and the temple-only Recall/curse-removal options.
- **`<while var=>`** (book5/218, book6/700), **`<fightround pre=>`** (book5/24/383/689),
  **`<sectionview>`** (book5/114) — **explicit passthrough** (`renderChildrenOnly`):
  the inner prose/rolls render as before, but the *automated* mechanic is deferred
  — a true repeat-until-var loop, per-combat-round rolls, and the random-section
  "trance" viewer, respectively. These render one pass and progression is
  unaffected (each section's onward `<goto>` is outside the deferred mechanic).
  Kept as passthrough rather than inert precisely to avoid regressing the rolls the
  default recursion already showed.

Verified: 10 new headless assertions (`<field>` value+label; `<extrachoice>`
register → surface at its target → navigate → key-replace → `remove`; the
`tag="temple"` mode surfacing only at temple sections; a sanitize round-trip) +
the full render-every-section scan (all 5 tags exercised, no throw).
`RESULT ALL PASS pass=597 fail=0`.

Deferred follow-ups (filed mentally against their tags, not new tasks unless they
bite): true `<while>` looping, `<fightround>` per-round automation, and the
`<sectionview>` random-paragraph viewer. (`<adjustmoney>`/caches → task 20,
`<poison>`/`<disease>` → task 19, `<sold>` → task 29 — all already done.)

---

## 33. Narrate sections without `<p>` wrappers (TTS)  — LOW

`tts.js` `prepare()` (tts.js:56) wraps sentences only inside `.flow` `<p>`
elements, but 1,544 of 4,389 sections render their prose as bare text nodes
directly in `.flow` — the 🔊 button and auto-narrate silently do nothing there
(e.g. book4/16, book2/745): `chunks` is empty and `play()` returns before
setting `playing`, with no user feedback. Collect/wrap top-level text nodes as
well (or normalise them into paragraphs at render time), and give the button a
disabled state when there is genuinely nothing to read.

---

## 34. Finish moving rules out of the view layer  — LOW (maintainability)

Known strays that violate the architecture invariant (rules live in DOM-free
modules):
- `renderInlineSell` performs the cargo transaction itself — mutates
  `ship.cargo` and money in the click handler (render.js:1313–1331; folded into
  task 23's rewrite).
- The "crew upgrades go one grade at a time" rule is inlined in
  `renderInlineBuy` (render.js:1260) — `CREW_LEVELS` already lives in rules.js.
- Choice costs are applied directly in `renderChoice`'s click handler
  (render.js:724 — `adjustMoney(-cost)` / `removeItemById`).
- `app.js:504` hard-codes the resurrection revive rule (half max Stamina) in
  the app layer — move to `engine.js` beside `buyResurrectionDeal`.

Move each into `market.js`/`engine.js` and cover with headless unit tests.

---

## 35. iOS home-screen icons: provide PNG apple-touch-icon  — LOW

`web/index.html:11` points `apple-touch-icon` at an SVG, and the manifest
offers only SVG icons — iOS Safari does not accept SVG touch icons, so
installed home-screen icons fall back to a page screenshot. Generate PNG sizes
(at minimum 180×180; ideally also 192/512 for the manifest), reference them in
`index.html` + `manifest.webmanifest`, and add them to the service-worker
shell precache.

---

## 37. Fix the `safeAddGodd` typo in the source XML  — **done**

The single `<if safeAddGodd="Elnir">` in `books/book2/67.xml` (Elnir initiation)
is corrected to `safeAddGod`; the data was rebuilt so `web/data/book2.json`
carries the fixed attribute. With the source true, the task-17 engine alias was
removed: `evaluateCondition` reads only `safeAddGod` and `safeAddGodd` is dropped
from `KNOWN_IF_ATTRS`, so a future stray `safeAddGodd` now correctly warns as an
unknown attribute instead of silently working. Verified: 3 new headless
assertions (safeAddGod true with no god / false when already an initiate; §2.67
still offers the Elnir initiation group) + full render-every-section scan.
`RESULT ALL PASS pass=529 fail=0`.

---

## 36. Minor rule divergences (grab-bag)  — **done**

Swept the confirmed `applySpecial`/`useCache` divergences in one pass:
- **`special="godless"`** (book6/118) now renounces every current god (via
  `removeGod`, so god-granted effects are stripped) before setting the godless
  flag — "cross the Gods Box off … you can never be an initiate of any deity".
- **`special="difficultyCurse"`** (book3/91) / **`difficultyRestore"`** (book2/102)
  are implemented via a persisted `data.oneDieRolls` flag: `rollDifficulty` rolls
  **one** die instead of two while cursed (and the roll-button label reflects it),
  lifted at the Three Fortunes' temple. Survives a save round-trip.
- **`useCache`** (combat.js) now adds a cached **weapon's** bonus to the enemy's
  Combat **and** Defence (JaFL `FightNode` adds `combatRaise` to both), plus a
  cached armour's bonus to Defence — §6.635 Warrior Maid with a +3 sword / +2 mail
  is Combat 11 / Defence 21, not 11/18. (The prior task-26 test asserting 11/18
  encoded the bug; updated.)
- **`special="weaponlock"`/`"armourlock"`** (book6/135, book2/290): JaFL locks the
  broken weapon / melted armour so it can't be swapped to dodge the loss; here the
  sibling `<lose weapon|armour using="t">` takes it and equipment auto-reconciles,
  so there is nothing extra to enforce — recognised as an explicit no-op.
- **`bonus="s"`** (book6/183) was already resolved: `applySpecial` reads the bonus
  through `resolveValue` (variable-aware), so this grab-bag point was stale.

Verified: 5 new headless assertions (godless renounces the god + sets the flag;
difficultyCurse → one-die roll + save round-trip; difficultyRestore → two dice;
useCache weapon→Combat+Defence) + the updated task-26 useCache assertion + full
render-every-section scan. `RESULT ALL PASS pass=555 fail=0`.

---

## 38. Gate cache widgets on `lock`/`unlock` under the single-pass render  — LOW

`<tick special="lock|unlock" cache=…>` now toggles a cache's `locked` flag
(task 20), and the flag is exposed via `isCacheLocked`, but the money/item cache
widgets do **not** disable their deposit/withdraw controls while locked. The
reason is the section re-renders in one memoized pass: in book1/91 the gamble
brackets the roll between a `lock` (inside a `force="t"` group, applied on click)
and an `unlock` (a passive applied once on entry), so reading the live lock state
at widget-render time is unreliable and would leave the widget stuck locked. The
practical loss is only the "you can't change your bet after rolling" nicety;
deposits, withdrawals, banking, investments and villa stashes all work, and §91
renders clean. To do it properly, pre-scan the section for its net lock state (or
make lock/unlock re-render-aware) and gate the widget on that. Add a §91 test.

**Was blocked on task 42; now unblocked (2026-07-08).** §91's `<random dice="2">`
sat inside the same `force="t"` group as the `<tick special="lock">`, so the roll
was swallowed. Task 42 fixed that — the gamble now rolls and its `<outcomes>`
resolve (a §91 test covers it). What remains for THIS task is only the widget
nicety: while the cache is locked, the money-cache widget's deposit/withdraw should
disable so the bet can't change after rolling. (With the hidden lock+unlock both
applying on entry the cache nets unlocked, so the bet is still editable — a cosmetic
gap, not a correctness one.)

---

## 39. Defer confiscate-and-return `<transfer … from=>` until a fight resolves  — LOW

`<transfer>` is implemented (task 20), but in book2/462 the return leg
(`<if dead="f"><transfer item="*" from="2.462"/></if>`) is active from entry —
the player is "not dead" throughout the fight, not only after winning — so the
weapons/armour stashed at the top are handed straight back and the vampire is
fought armed (the same net effect as the old do-nothing behaviour, so no
regression, but not the intended weaponless fight). Non-fight transfers (villa
stashing, banking) are correct. Fix: defer effects that appear after a `<fight>`
and are gated on `dead="f"` until the fight actually resolves (relates to the
fight-gate machinery and task 28's `dead="t"` handling). Add a §462 test.

---

## 40. `<market currency="…">` alternate-currency markets  — **done**

Split from task 29 (part 2). `<market currency="Mithral">` (book2/495, the Trau
trader) deducted **Shards**, and the paired `<choice shards="1" currency="Mithral">`
(book2/545, the parting toll) charged Shards too. Implemented option (a) — a
named-currency pool kept separate from the Shards purse:

- **`state.js`** — `freshData()`/`sanitizeData()` gain a `currencies` map
  (`name → amount`, sanitised like `boxes`); `currencyBalance(name)`,
  `adjustCurrency(name, delta)` and `multiplyCurrency(name, factor)` manage a
  named pool (floored at 0, integer). A new exported `isShardsCurrency(name)`
  treats `null`/blank/`"Shards"`/`"Shard"` (case-insensitive) as the default purse
  so only genuinely foreign coin lives in a pool.
- **`market.js`** — `buyTrade`/`sellTrade` take an optional `currency` argument;
  small `walletBalance`/`walletSpend`/`walletEarn` helpers route the
  payment/receipt to the Shards purse (default) or the named pool. Inline buys are
  always Shards in the corpus, so they pass none.
- **`render.js`** — `renderMarket` reads `currency=` and threads it to
  `renderShopRow`, which prices/labels the Buy/Sell buttons in that coin
  (`Buy 25 Mithral`), checks affordability against the pool, and passes it to
  `buyTrade`/`sellTrade`. `renderChoice` reads a `<choice currency=>`: the cost
  chip, the affordability gate and the click-time deduction all use the named
  pool. Because the player can hold no Mithral in the shipped corpus, every
  Mithral Buy is correctly disabled (Shards can no longer be spent there).
- **`engine.js`** — `applyAdjustMoney` honours `currency=` (grant/scale a foreign
  coin), so approach (a) is genuinely general — a future section can stock a
  Mithral pool via `<adjustmoney currency="Mithral" add="N"/>`. No corpus section
  uses this yet, so behaviour is unchanged for existing sections.

Covers book2/495 (Trau market) and book2/545 (Mithral toll choice) — the only two
`currency=` uses in the corpus.

Verified: 14 new headless assertions (buy refused with 0 Mithral + Shards
untouched; `currencyBalance` 0; `<adjustmoney currency>` grants a pool; buy
succeeds once held and debits **Mithral** not Shards; sell credits Mithral;
blank-currency buy still spends Shards; `multiplyCurrency` floors; §2.495 renders
Mithral-priced Buy buttons all disabled with 0 Mithral; §2.545 pay-Mithral choice
priced in Mithral and disabled with 0 Mithral) + full render-every-section scan.
`RESULT ALL PASS pass=359 fail=0`.

---

## 41. Item `<effect>` system (use/aura/wielded/ability) and `<sold>` sell-hooks  — **done**

Split from task 29 (part 5). Item `<effect>` children were discarded at award/buy
(`applyItemEffect` was a stub) and `<sold>` rows were unhandled. All are now
implemented, modelled on JaFL's `Effect`/`UseEffect`/`EffectSet` (reference read,
not copied):

- **Storage** — `makeItem` now carries an `effects[]` array; a new
  `engine.readItemEffects(node)` reads an item's `<effect>` children into
  serialisable records `{type, ability, bonus, uses, verb, text, body}` (the action
  children are serialised into `body` for later replay; a `<desc>` child is dropped).
  All four call sites pass them through: awards (`renderItemAward`), market buys
  (`goodsFrom`→`buyTrade`), inline buys (`renderInlineBuy`→`applyInlineBuy`), and
  the sanitiser (`sanitizeItem`+`sanitizeEffect`) so effects survive save/load.
- **`type="aura"`** (carried) / **`type="wielded"`** (only while it is the wielded
  weapon / worn armour) — a new `state.auraBonus(key)` sums matching effects and is
  folded into `ability()` and `defence()`, with `ability="*"` boosting every core
  ability. Covers the eight elemental swords, the sword of stone / ring of guarding
  (Defence), the ring of ultimate power (`*`+1), and the Jade Defender (wielded).
- **`type="use"`** — a **Use/Drink/Consult** button on the Adventure Sheet
  (`ui.js renderSheet` gained an `onUse` callback, wired from `app.js onUseItem`).
  `engine.useItemEffect` applies the effect: an action body (rest/cure/…) via
  `applyEffectBody` (which now also handles `<rest>`), else a bare potion's +N
  ability boost; it follows an inner `<goto>` use-target (the Vade Mecum consult,
  book5/549) and consumes a charge — `uses="N"` decrements and removes the item at
  0; an ability potion defaults to one use; a use effect with no `uses=` (Vade
  Mecum) is reusable. Covers book4/111 & book1/342 potions and the potion of
  restoration (`<rest/>`+cure poison/disease).
- **`type="ability"`** (2×) — these are the Red Ague disease's effects (book4/332),
  already applied by the affliction system (task 19); verified via a `<disease>`
  with `type="ability"` children still landing its penalty.
- **`<sold>`** (book3/86 item-level, book3/318 market-level `item="?"`/`tags=`) —
  `renderShopRow` runs the matching `<sold>` body (via `applyEffectBody`) after a
  successful sell (`runSoldHooks`/`soldMatches`), marking the codeword.

Potion bonuses are **section-scoped** — folded into `ability()` (so they flow into
difficulty rolls, combat and Defence) and cleared on entering a new section
(`Story.begin`→`clearPotionBonuses`). JaFL consumes the bonus after the exact
roll/fight; here it lasts the current section (which normally holds one relevant
roll/fight) — a small, bounded simplification (it can't carry across sections).
Known limitation: the ring of ultimate power's `Rank`+2 / `Stamina`+10 auras are
not folded in (only its `*`+1 abilities part is); `Rank`/`Stamina` aren't derived
through `ability()`, so wiring them would touch every rank/stamina read for one
legendary item — deferred.

Verified: 22 new headless assertions (aura Defence/COMBAT/`*` raises; wielded adds
while wielded and drops when not; use-potion parse + Drink → +1 COMBAT + consumed;
potion bonus clears on section change; potion of restoration heals to full + cures
poison + consumed; Vade Mecum parse + Consult → goto 5/550, reusable;
`type="ability"` disease penalty; market buy preserves effects; §3.86 item `<sold>`
and §3.318 market `<sold>` fire on sell; the sheet shows one Use button for a
potion and none for an aura sword and fires `onUse`) + full render-every-section
scan. `RESULT ALL PASS pass=381 fail=0`.

---

## 42. Inner `<difficulty>`/`<random>`/`<rankcheck>` rolls inside a `<group>` are unrun  — **done**

`renderGroup` collected only `lose, tick, gain, set, curse` (+ `rest`, task 61) as
a group's on-click effects, so when a group ALSO rendered as a button (label + an
effect), its `<difficulty>`/`<random>`/`<rankcheck>` child was swallowed into the
label and never rendered — the section's `<success>`/`<failure>`/`<outcomes>`
never resolved. This hit **25 built sections**: book1/91, 554; book2/53, 134, 138,
273, 438; book3/273, 389, 503, 629, 680; book6/24, 48, 94, 215, 239, 293, 320,
564, 567, 691, 707, 735, 741. (A group with a roll but no effect/goto already fell
through to the inline path and rendered its roll — untouched.)

Fix (`web/js/render.js`): `renderGroup` now detects a roll child up front and, if
present, delegates to a new **`renderGroupWithRoll`** which renders the group's
`<text>` label and the roll widget inline (binding the section's shared
success/failure/outcomes to that roll via `this.activeRoll`, which `appendChildren`
does for top-level rolls but a group-nested roll needs done explicitly). The
group's non-roll effects are applied **exactly once the roll resolves** (memoised
`grp@<path>`), mirroring JaFL's "the roll is the group's action" — so a bundled
cost/consequence (lose shards/item/god, a codeword marker, a rest that heals the
roll's own `var`) fires on the *attempt*, never on entry. **Hidden** bundled
effects (an armed price flag / cache lock — book3/680, book1/91, book2/138) still
apply on entry through `renderPassive`, since those are silent book-keeping.

This preserves effect timing so a marker can't clobber sibling gating: book2/53
sets codeword `2.53.1` on entry and the swim group clears it only when the SCOUTING
roll is attempted (the `box="2.53.1"` sibling choices show the right ☑/☐). And a
real cost (book6/215's 35-Shard blessing, book3/273's item loss, book6/691's god
renunciation) is never charged just by visiting.

Verified: 13 new headless assertions across 6 representative sections — §3.680
(roll renders as a widget not a button; the hidden price arms the "leave" option on
entry; a success ticks the box and reveals →644), §2.438 (the rest heals the
roll's own var, and nothing before the roll), §3.273 (a `force="t"` group loses the
rolled number of possessions on the roll, none on entry), §6.215 (the 35-Shard cost
is paid on the roll, not entry, and success grants the blessing), §1.91 (the gamble
renders a roll and its `<outcomes>` resolve against it), §2.53 (the codeword marker
clears on the attempt, not entry) — plus the full render-every-section scan.
`RESULT ALL PASS pass=570 fail=0`.

Follow-on: this unblocks task 38 (the §91 gamble now rolls; the lock/unlock widget
nicety is still separate).

---

## 43. price/flag "choose one" purchases over-apply every linked reward  — **done**

`renderOptionalPay` applied **every** `[flag="k"]` node on a single payment and
then permanently memoised `'pay@'+path`, so a "choose one" menu granted the whole
list and a repeatable bonus was capped at one purchase per visit. Both are fixed
by gating on the engine's existing flag cycle (a `price=` pay sets flag `k`;
applying a `flag=k` reward clears it — engine.js:404/405/532/533) and splitting
the reward shapes (`web/js/render.js`):

- **"Choose one"** — a `price="k"` cost with **two or more** linked *effect*
  rewards (`tick`/`lose`/`gain`). `isChooseOne(k)` routes the cost to
  `renderChooseOnePay` (paying only *arms* the choice — deducts the cost, sets
  flag `k`, no auto-reward) and each reward node to `renderChoosableReward` (an
  inline pick button, live only while armed; clicking applies **just that one**,
  which clears the flag). So one payment grants exactly one, and the cost
  re-enables for another round. A blessing already held, or a curse/disease/poison
  "lift" for an affliction you don't have, is disabled so a payment is never
  wasted. Fixes **book6/171** (`price="y"`, 60 Shards → one of six blessings),
  **book5/152** (`price="curse1"` 200 Shards *or* a +1 item → lift one of seven
  curses, repeatable), and **book6/690** (35/20 Shards → one of four blessings —
  was silently granting all four). Barter awards (`<item>`/`<weapon>` `flag=…`,
  book4/634) are excluded from choose-one so their existing handling is untouched.
- **Repeatable counter** — a single `<tick name="X" count|amount=…>` reward
  (`isCounterReward`) is the "add one per payment" idiom, so `renderOptionalPay`
  no longer memoises it: pay again to add again. Fixes **book4/93** crew bribe,
  **book6/117**, and **book6/731**'s `price="y"` donation bonus. (Relies on task
  52's `removeCodeword` clearing the counter value, so re-entering the section
  resets the bonus to 0.)
- **Everything else unchanged** — a single non-counter reward stays a one-shot
  purchase (permanent memo), preserving town-house buys, faith renunciations, and
  the single-blessing "only one at a time" gate (book2/202 storm, book3/390).
  Roll-gated payments (`isRollGate`) still route to `renderRollPayment` (tasks
  30/51), untouched.

Verified: 21 new headless assertions (§171 pays 60 → picks are dead until paid,
then grants exactly one blessing for no extra Shards; §152 arms on 200, only a
held curse is pickable, lifts exactly one and repeats for the second, a curse you
lack stays disabled; §690 one payment → one blessing; §4.93 two payments → bonus
2 and re-entry resets to 0) + full render-every-section scan (4369).
`RESULT ALL PASS pass=461 fail=0`.

---

## 44. Fold the ring of ultimate power's `Rank`/`Stamina` auras (book5/564)  — **done**

The item aura system (`state.auraBonus`) folded aura effects into
`ability()`/`defence()`, covering every aura in the corpus **except** the ring of
ultimate power (book5/564), whose three auras are `ability="*" bonus="1"` (all
abilities — already handled), `ability="Rank" bonus="2"` and `ability="Stamina"
bonus="10"`. Rank and Stamina aren't derived through `ability()`, so those two
auras did nothing.

Fix:
- **`state.js`** — new `rankValue()` = `data.rank + auraBonus('rank')`;
  `effectiveStaminaMax()` (task 60) now also folds in `auraBonus('stamina')`, so
  the ring's +10 rides the same accessor the sheet/fight display, healing and rest
  already use. `defence()` reads `rankValue()` (so the +2 Rank adds +2 Defence).
  `reconcileEquipment()` — run on every item add/remove — re-clamps current
  Stamina to the (possibly lower) effective max, so dropping the ring can't leave
  Stamina above the restored total.
- **`engine.js`** — `rollRankCheck` compares against `rankValue()`; `adjustAmount`
  and `evalExpression` resolve the `rank`/`stamina` keywords through
  `rankValue()`/`effectiveStaminaMax()`.
- **`ui.js` / `render.js`** — the Adventure-Sheet rank line and the rank-check
  result readout show `rankValue()`.

Verified: 9 new headless assertions (§564 grants the ring; Rank +2; Stamina total
+10; all abilities +1; Defence +3; a rank check uses the boosted Rank; healing
fills the boosted total; dropping the ring restores Rank and the Stamina total and
re-clamps current Stamina) + full render-every-section scan. `RESULT ALL PASS
pass=550 fail=0`.

---

## 45. Multi-fight sections: the fight gate & death-deferral track only the *last* `<fight>`  — **done**

`renderFight` did `this.sectionFight = fight` for **every** fight in document
order, so in a sequential multi-fight section the last one won; `applyFightGate`
and the death-deferral check read only that single `sectionFight`. In the ~18
sequential (non-`group`) multi-fight sections — book1/96, 121, 210, 297, 371,
479, 569; book2/128, 582, 726, 770; book3/73, 587, 675, 685; book5/80; book6/116,
186 — all fight widgets were live at once, and winning **only the last** unlocked
the exit (the earlier fights could be skipped). Worse, dying to a non-last fight
set `outcome='lose'` on *that* fight object while the death-deferral read the last
fight (outcome still null), so real death fired even when the section had an
"if you lose…" branch.

Fix (`web/js/render.js`):
- **Track every fight.** A new `this.sectionFights[]` collects each sequential
  (non-`group`) fight drawn this pass, in document order (skipping fights inside
  an untaken `this.inactive` branch, which are display-only). A new
  `aggregateFightOutcome()` returns the section's outcome: **lose** if any fight
  is lost, **fled** if any fled, **win** only once **every** fight is won, else
  unresolved (`null`). `this.sectionFight` is now a small settable proxy over that
  aggregate (its `name` getter names the first not-yet-won foe for the gate
  tooltip; a settable `outcome` lets a `flee="t"` choice mark it fled without
  throwing on a getter). `applyFightGate` and the death-deferral guard read the
  proxy unchanged, so the exit opens only after **all** fights are won and a loss
  on any fight now defers death to the "if you lose…" branch.
- **Sequential locking.** `renderFight` computes `locked = ` any earlier fight not
  yet won and passes it to `drawFight`, which renders a locked foe's stats with
  "Defeat the previous foe first." and **no** controls — so only the current foe
  can be engaged. `drawFight` also gained an explicit `lose` display case ("You are
  defeated by the …") instead of falling through to a stray Attack button.

The group-fight path (task 26) is untouched — it already uses its own aggregate
proxy and does not populate `sectionFights`.

Verified: 10 new headless assertions (§1.121 — three widgets, exit gated on entry,
only the first foe active, exit **stays** gated when only the first is won, the
second unlocks after the first, exit opens once all three are won; §5.80 —
hasLosePath, a loss on fight 1 defers death instead of firing `onDeath`, the
`dead="t"` §7 lose-branch is the enabled route and the §123 win exit is disabled)
+ full render-every-section scan (4369). `RESULT ALL PASS pass=391 fail=0`.

---

## 46. `<set var … modifier="natural">` discards the value — book-2 rank ceremonies auto-succeed  — **done**

`applySet` treated `modifier=` as an *additive amount*:
`val = state.getVar(name) + resolveValue(state, get('modifier'))` — overwriting
the already-computed `value=` expression. `resolveValue(state,'natural')` was a
var lookup → 0, so the var was set to 0. In JaFL (`SetVarNode.resolveIdentifier`,
`Adventurer.getAbilityValue`) `modifier="natural"/"affected"` selects **how
ability/stamina identifiers inside `value=` resolve** (written score vs
item-boosted), never an addend. 30 occurrences in 29 sections: book2/270, 345,
362, 529, 536, 563, 584, 614, 637, 683, 752 (`<set var="r" value="rank"
modifier="natural"/>` then "roll 2d > r to gain a Rank" — with r=0 **every book-2
rank-up ceremony auto-succeeded**); book3/104, 179, 267, 379, 412, 455, 492, 559,
583, 696; book6/17, 50, 118, 332, 344, 402, 479, 738 (book6/332's
`value="12-charisma"` raise was a no-op).

Fix (`web/js/engine.js`):
- **`evalExpression(expr, state, mode)`** gained a `mode` param. A `<set
  modifier="natural">` resolves ability identifiers via `abilityForCheck(ab,
  true)` (the written score) and `stamina` as the **unwounded max**;
  `modifier="affected"` uses `abilityForCheck(ab, false)` (item-boosted) and the
  affected max; with no modifier the historical behaviour holds (abilities read
  the boosted score, a bare `stamina` reads *current* Stamina — the JaFL
  `stamina && modifier==null` special case). Verified against the Java
  `getAbilityValue(ability, modifier)`: NATURAL→`stat.natural`,
  AFFECTED→`stat.affected`, and the stamina current/max split.
- **`applySet`** drops the additive `modifier` branch entirely and threads the
  mode (`setValueMode()` maps `natural`/`affected`, ignores anything else — the
  corpus never uses a numeric `<set modifier>`) into `evalExpression`.

This also makes book3/104's wound check work: `curr = stamina` (current) vs
`max = stamina modifier="affected"` (unwounded max) now differ when wounded.

Verified: 9 new headless assertions (§2.752 r = the real Rank not 0, and the 2d>r
check is a genuine test; §6.332 c = 12 − natural CHARISMA; a `modifier="natural"`
read ignores a +tool ability bonus while `modifier="affected"` includes it;
§3.104 bare `stamina` = current and affected `stamina` = unwounded max, wound
detected; `evalExpression('rank', state, 'natural')` reads the Rank) + the
existing task-25 `12-charisma` (no-modifier) test still green + full
render-every-section scan (4369). `RESULT ALL PASS pass=400 fail=0`.

---

## 47. `<choice item="?" tags=…>` is never enabled — light-gated passages hard-locked  — **done**

`renderChoice` gated on `this.state.hasItem(itemReq)`, but `matchItems`
(state.js) has **no** `"?"` wildcard handling (that special case lived only in
`evaluateCondition`'s item path), and `tags=` on a `<choice>` was never consulted
— so the button was permanently disabled with tooltip "needs ?". Nine sections
hard-locked: book2/291 (`<choice section="440" item="?" tags="light">Enter the
castle`), book2/720, book3/11, book3/414, book3/471, book4/6, book4/35, book4/405,
book6/530 — all `item="?" tags="light"` (a lantern/candle gate).

Fix: extracted the `"?"`-plus-tags matcher into a shared **`matchItemQuery(items,
pattern, tags)`** (state.js) — `"?"`/blank = any possession, narrowed to those
carrying every listed tag; a concrete name/glob defers to `matchItems`. Both the
`<if item=…>` path (`evaluateCondition`, engine.js) and the `<choice>` item gate
now go through it: `evaluateCondition` calls `matchItemQuery` directly, and a new
`GameState.hasItemMatch(pattern, tags)` backs `renderChoice`'s gate (the choice
also reads its own `tags=`, and the disabled tooltip now reads "needs light"). The
two matchers can no longer diverge.

Verified: 4 new headless assertions (§2.291 "Enter the castle" locked without a
light source, unlocks once a `light`-tagged lantern is carried; `hasItemMatch("?",
"light")` true with a lantern / false without) + full render-every-section scan
(4369). `RESULT ALL PASS pass=404 fail=0`.

---

## 48. Group fights: Surrender/flee throws a TypeError; no Flee button; no target choice  — **done**

Three gaps in the task-26 group-fight widget, all fixed:
1. **Surrender throws.** The group `sectionFight` proxy defined `outcome` as a
   getter only, but a `flee="t"` choice's click handler assigns
   `this.sectionFight.outcome = 'fled'` — ES modules are strict mode, so the
   assignment threw a `TypeError` and aborted before `navigate()`. book6/618
   (three `group="a"` fights + `<choice flee="t" section="452">Surrender`): the
   player could not surrender. **Fix:** the proxy's `outcome` is now a
   getter/setter over an `_override` (mirrors the task-45 sequential proxy), so a
   `'fled'` assignment is honoured and never throws.
2. **No Flee button.** `drawGroupFight` rendered only Attack; only `drawFight`
   wired a `<flee>` node. **Fix:** `renderGroupFight` now finds the section's
   `<flee>` and passes it in; `drawGroupFight` renders a Flee button that applies
   the flee body, marks the group fled, and follows the flee's `<goto>` (else a
   `flee="t"` choice's section) — book6/291's "flee back to your ship" → §745.
3. **No target choice.** `groupFightRound` always struck the first undefeated
   member. **Fix:** `groupFightRound(state, fights, dmgNode, target)` takes the
   chosen foe (falling back to the first undefeated), and `drawGroupFight` renders
   one **Attack ‹name›** button per still-standing foe, so the player picks their
   target each round (book6/192's Combat-12 Third Spider can be saved for last;
   book6/618 Jiro no longer soaks free rounds).

Verified: 6 new headless assertions (§6.192 one Attack button per foe; a group
round strikes the chosen member 3 while sparing 1 & 2; §6.618 Surrender is live
and navigates to §452 with no TypeError; §6.291 shows a Flee button that
navigates to §745) + the existing group-fight tests still green + full
render-every-section scan (4369). `RESULT ALL PASS pass=410 fail=0`.

---

## 49. `special="attack|defence"` grant permanent, save-persisted bonuses  — **done**

`applySpecial` pushed `{ability:'combat', bonus, type:'blessing', uses:1}` into
`data.effects` for both kinds — but **nothing ever consumed or expired those
entries** (`effectBonus` just summed them forever, and `sanitizeData` persisted
them), and because `defence()` includes `ability('combat')` an attack bonus also
raised Defence and vice versa. The books are explicit that every case is a
**per-fight** modifier: "add 3 to your dice rolls *for this fight*" (rat poison,
book1/42/145/247/428), "subtract 2 *for this fight*" (book1/238, book6/624
"−2 to COMBAT"), book6/490 (−1 for a weaponless fight), and `special="defence"`
"add 4 to your Defence *for the duration of that combat only*" (book4/434 ring)
/ book6/183 (Thunder Beast).

Fix:
- **`GameState`** gains a **transient** `_fightBonus = {attack, defence}` (state.js)
  — deliberately kept OFF `data`, so it is never serialised and cannot survive a
  save. `fightAttackBonus()`/`fightDefenceBonus()`, `addFightBonus(kind, n)` and
  `clearFightBonuses()` manage it. It is section-scoped: `Story.begin` clears it
  on entering a section (beside `clearPotionBonuses`), matching the "for this
  fight" wording (a section holds one fight).
- **`applySpecial`** (engine.js) now routes `attack`→`addFightBonus('attack',…)`
  and `defence`→`addFightBonus('defence',…)` instead of a permanent `data.effects`
  blessing, and **resolves a variable bonus** (`bonus="s"` → `resolveValue`, was
  NaN→0 — the book6/183 gap noted under task 36).
- **`combat.js`** applies each to the right stat only: `playerStrike` adds
  `fightAttackBonus()` to the attack roll's COMBAT (never via `ability('combat')`,
  so it can't leak into Defence); `playerDefenceFor` adds `fightDefenceBonus()` to
  the player's Defence (over a `playerDefence=` override too).

Verified: 15 new headless assertions (attack bonus set / no Defence leak / not in
persisted data / dropped on a save round-trip; defence bonus set / no COMBAT leak;
`clearFightBonuses` resets; §6.183 `bonus="s"` variable resolves; a would-always-
miss wall is scratched only once a +10 attack bonus is added; §1.42 rat poison
grants +3 for the fight, consumes the poison, leaves Defence untouched, and the
bonus clears on entering §423) + full render-every-section scan (4369).
`RESULT ALL PASS pass=425 fail=0`.

---

## 50. Var-keyed `<success>/<failure>` branches fire on entry (unset/stale vars)  — **done**

`renderBranch` skipped the "wait until the roll is made" guard whenever the
branch carried `var=`, and `branchSuccess` read `state.getVar(...) > 0`
immediately. Vars are global and persist in the save, so on **first entry** (var
unset → 0) every `<failure var=…>` revealed and **applied its effects** (memoised
under `fx@`, never undone) — book3/437's failure tick fired before either
Difficulty-17 roll; same in book2/419, book3/476, book6/442, book6/691 — and a
**stale** `s>0` from an earlier section made book6/691's `<success var="s">`
apply for free. book5/24's `<failure var="hang"><lose stamina="-hang"/>` drained
0 on entry and memoised it forever.

Fix (`web/js/render.js`): a var-keyed branch now waits until that var has actually
been **written this visit**, tracked in a new `ctx.wroteVars` set:
- Both **roll** handlers (`renderDifficulty`/`renderRandom`/`renderRankcheck`) and
  an active **`<set var>`** application add the var to `ctx.wroteVars`.
- A new `branchResolved(node, roll)` gates `<success>`/`<failure>`/`<outcome>` and
  the `<outcomes>` loop: a var-keyed branch is ready only when `wroteVars` holds
  its var; a plain (roll-fed) branch still waits for its roll. `branchSuccess`
  (var sign) is only consulted once resolved.
- This preserves the **set-sentinel** idiom (book2/138 key-of-stars, book3/43
  Chill → a `<set var="X" value="1"/>` resolves the branch with no roll) while a
  stale/unset var keeps the branch pending — so a `<success>/<failure>` never
  fires or applies effects on entry.
- Also hardened `pendingRollVar` to strip a leading sign (`"-hang"` → the `hang`
  roll var) so a signed-var quantity above its roll defers correctly.

Full `<fightround>` per-round rolls (book5/24's drain magnitude) remain task 32;
this task stops the spurious entry-fire.

Verified: 7 new headless assertions (§3.437 no codeword ticked before the rolls,
the inner SANCTITY branch stays pending after only the MAGIC roll, exactly one
outcome codeword after both rolls; §2.138 the key set-sentinel resolves "Open the
door"→69 with no roll, and without the key neither outcome shows on entry; §5.24
the per-round Hangman drain does not fire on entry) + full render-every-section
scan (4369). `RESULT ALL PASS pass=432 fail=0`.

---

## 51. `<difficulty|rankcheck flag=…>` roll gates unimplemented; shared `<success>` binds only the last roll  — **done**

Task 30 built the pay-to-roll gate **only into `renderRandom`**. `isRollGate`
matches `difficulty[flag]`/`rankcheck[flag]`, so the paired cost rendered as a
roll-payment — but `renderDifficulty`/`renderRankcheck` ignored `flag=`: the
payment was decoration and the roll was free (book6/731 CHARISMA boon). And when
two rolls shared one flag+`<success>` ("make a MAGIC roll…or a SCOUTING roll",
book2/122/book6/630), the shared `<success>` bound to `this.activeRoll` — the
document-order **last** roll — so a successful *first-listed* roll was silently
ignored (a MAGIC-built character couldn't reach §2.376 via MAGIC).

Fix (`web/js/render.js`):
- **Flag gate in `renderDifficulty`/`renderRankcheck`** via a shared
  `rollGateState(node, key)`: a `flag=` roll paired with a `[price=]` cost is
  disabled ("Pay first…") until the payment sets the flag; rolling **consumes**
  the flag (`setFlag(k,false)`), and a fresh payment re-arms it (dropping a stale
  result) — one paid attempt per payment, matching the `<random>` gate.
- **Shared-branch binding**: `appendChildren` now binds `this.activeRoll` to
  whichever roll has actually **resolved** (has a stored result), only falling
  back to the last-listed roll when none has resolved yet. So a shared
  `<success>`/`<failure>` fed by two rolls reads the one the player rolled. (Var-
  keyed branches are unaffected — they bind by var via task 50.)

The hidden `<tick price>` that arms book2/122/630's rolls still renders a phantom
Pay button until **task 56** makes it arm silently; task 51 makes the gate and
binding correct once armed.

Verified: 6 new headless assertions (§6.731 the CHARISMA roll is disabled until
the 100-Shard donation is paid; a synthetic two-roll section — both rolls
disabled before payment, a pay button arms them, payment deducts the cost and
enables them, a first-listed MAGIC success reveals the shared `<success>`→376,
and the second roll is disarmed after the one paid attempt) + full
render-every-section scan (4369). `RESULT ALL PASS pass=438 fail=0`.

---

## 52. `removeCodeword` leaves the codeword's *value* behind — bonus counters never reset  — **done**

`removeCodeword` deleted `data.codewords[cw]` but not `data.codewordValues[cw]`.
In JaFL a codeword and its value are one entry, so `<lose codeword="X">` zeroes
the counter — the books rely on that as a counter-reset idiom: book6/117 and
book6/731 open with a hidden `<lose codeword="CharismaBonus"/>` (and reset inside
every outcome) so each visit's donation bonus starts at 0; book4/93's crew-bribe
counter likewise; book6/47 resets SpiderDamage. Before the fix, `<adjust
name="…">` (which reads `codewordValue`) still saw the old total, so **every
bonus ever bought was a permanent, save-persisted roll modifier** — and
`CharismaBonus` even leaked between books 4 and 6 (shared name).

Fix (`web/js/state.js`): `removeCodeword(cw)` now also deletes
`codewordValues[cw]`. The sole caller is `<lose codeword>` (`applyLose`) — the
JaFL "zero the counter" path — so nothing relies on the value surviving. Feeds
task 43's repeatable-cycle semantics.

Verified: 2 new headless assertions (a codeword's counter value accumulates via
`adjustCodewordValue`, then `<lose codeword>` clears both the codeword and its
value to 0) + full render-every-section scan (4369). `RESULT ALL PASS pass=440
fail=0`.

---

## 53. `<difficulty modifier="noweapon">` still counts the weapon bonus  — **done**

`renderDifficulty` resolved `modifier=` numerically (`resolveValue(state,'noweapon')`
→ unknown var → 0) and the roll then used `abilityForCheck('combat')`, which
**includes** the wielded weapon's bonus — so the four unarmed-combat rolls
(book3/235/271/290, book5/516) let a wielded weapon help a bare-knuckle fight.

Fix — route the modifier keyword into the ability lookup instead of treating it
as an addend (shared plumbing with task 46):
- **`state.js`** — new `abilityForMode(ability, mode)` centralises the check-value
  logic (cursed/fixed flags + CHARISMA mask first), then dispatches on the JaFL
  modifier: `natural`→written score, `noweapon`/`notool`→affected score **minus**
  the weapon/tool bonus (new `abilityNoWeapon`, computed **pre-clamp** so a 1..12
  ceiling hit doesn't distort it), `affected`/none→full affected score.
  `abilityForCheck(ability, natural)` now just delegates (`natural?'natural':null`),
  so every existing caller (the `<if>` path, `evalExpression`, `rollDifficulty`) is
  unchanged.
- **`engine.js`** — `rollDifficulty(state, ability, level, modifier, mode)` takes a
  `mode` and resolves the ability via `abilityForMode`.
- **`render.js`** — `renderDifficulty` recognises the keywords
  (`natural`/`noweapon`/`notool`/`affected`) and passes them as `mode`; any
  non-keyword `modifier=` keeps the historical numeric/var addend behaviour (none
  occur in the corpus today, but the path is preserved). `<rankcheck>` rolls
  against Rank with no ability score, so a modifier keyword is inapplicable there
  (and none appears in the corpus) — left as-is.

Verified: 5 new headless assertions (a +3 weapon lifts affected COMBAT but not the
noweapon score; `rollDifficulty(..,'noweapon')` uses the bare COMBAT while the
default counts the weapon; the pre-clamp edge — COMBAT 11 + a +2 weapon reads 12
affected, 11 bare; the §3.235 rendered+rolled COMBAT excludes the weapon bonus) +
full render-every-section scan (4369). `RESULT ALL PASS pass=466 fail=0`.

---

## 54. Mid-fight escape brackets (tick…lose codeword) collapse — surrender/flee routes unreachable  — **done**

The JaFL idiom brackets a fight between `<tick codeword="X"/>` (top) and
`<lose codeword="X"/>` (after the fight); a `box="X"`-gated choice is the
mid-fight escape, valid only *while the fight is unresolved*. The single-pass
render applied both passives in the same pass, so the box was already un-ticked
by the time choices rendered — and `applyFightGate` disabled post-fight nav
anyway. All three fixes landed in `web/js/render.js`:

- **Escape-codeword detection** — a new `computeEscapeCodewords(sectionEl)` (run
  before the fight gate, stored on `this.escapeCodewords`) finds codewords that are
  BOTH `<tick codeword="X">`'d in the section AND used as a `box="X"` on a choice —
  the surrender/flee signature (book2/582, book3/211 tick at the top; book2/442,
  book2/207 tick inside a flee `<group>`/`<flee>`). Empty unless the section has a
  fight.
- **Defer the closing `<lose codeword>`** — `isDeferredEscapeClear(node)` +
  `renderPassive` skip a `<lose codeword="X">` that sits **after** a fight (so
  `sectionFights` is non-empty) and clears an escape codeword, until the fight is
  **won**. So the box stays ticked while the fight is unresolved or the player is
  fleeing; on a win the clear applies and the escape closes. An entry-clear
  `<lose codeword>` before the fight (book2/207/442) is untouched.
- **Escape choices bypass the fight gate** — `computeFightGate` no longer adds a
  `<choice box="X">` (X an escape codeword) to `navNodes` (like a `flee="t"`
  choice), so `applyFightGate` never disables it; its own `box=` check governs it,
  making it live exactly while the codeword is ticked (book2/442 becomes reachable
  once the `<group>` ticks 2.442.1).
- **`fled` disables the win exit** — `applyFightGate` now disables **all** nav on
  `outcome==='fled'` (not just lose-role), and the never-strand-a-win safety is
  scoped to `outcome==='win'`. So begging for mercy in book2/582 (a bare `<flee>`
  Flee button with no goto → `fled` + re-render) no longer enables "Defeat them
  all" (§654); only the ungated Surrender remains.

Verified: 16 new headless assertions (§2.582 Surrender live mid-fight while §654 is
gated, fleeing keeps §654 gated and Surrender live, winning clears the codeword →
Surrender off / §654 on; §3.211 "Run back" live vs "Kill the creature" gated, win
closes the escape; §2.442 "If you flee" gated until the group is taken, the group
ticks the codeword + forfeits the Paladin title, the escape then navigates to 118)
+ the §207/§662 flee tests still green + full render-every-section scan (4369).
`RESULT ALL PASS pass=482 fail=0`.

---

## 55. `<choice item=… pay="t">` doesn't consume the item  — **done**

`renderChoice` computed `pay` only when `shards=` was present, so `pay="t"` on an
item-only choice was ignored and the removal branch never ran — the player kept
the given-away item (and it still satisfied later `<if item=…>` checks).

Fix (`web/js/render.js`): `pay` is now `payExplicit === true || (payExplicit ==
null && shards != null)` — an explicit `pay="t"` consumes the choice's
requirement (both a `shards=` cost and an `item=` requirement) regardless of
whether Shards are involved, while the historical defaults are unchanged: a
`shards=` cost with no `pay=` still deducts, `pay="f"` never deducts, and a bare
`item=` gate is still just a requirement (kept, not consumed). The existing
`if (pay && itemReq)` removal branch now fires for book2/400 (green gem) and
book6/740 (rope). Corpus audit: the only `pay="t"` choices are those two
item-only cases; every other `pay=` is `shards= pay="f"` (a "can you afford it"
travel gate whose cost is paid at the destination), all preserved.

Verified: 8 new headless assertions (§400 gem choice enabled while held, giving
consumes it + navigates to 288, gated without the gem; §740 rope choice consumes
+ navigates to 513; a `pay="f"` shards choice still doesn't deduct) + full
render-every-section scan (4369). `RESULT ALL PASS pass=490 fail=0`.

---

## 56. `hidden="t"` payments render a phantom "Pay" button instead of arming silently  — **done**

The price routing in `renderPassive` never checked `hidden=`, so a
`<tick price="k" hidden="t"/>` rendered a bare "Pay"/"Confirm" button the player
had to discover — and, gated purely on the flag, it could be re-clicked to re-arm.

Fix (`web/js/render.js`): a new guard at the top of the price/flag handling — when
`price != null && hidden` — fires the node once per visit (memoised on
`'pay@'+path`) and renders **nothing**. It calls `applyEffect(node)` to set the
flag (and apply any real cost), and if the price has **exactly one** linked
reward that isn't a roll gate, applies that reward too. This covers every shape:
- **roll gates** (book6/630 SCOUTING|SANCTITY, book2/122 MAGIC|SCOUTING) — arm the
  either-or `<difficulty flag=…>` rolls on entry (task 51); no button, both rolls
  live at once, and re-arming is capped at once per visit.
- **choose-one menus** (book4/127 bet on a contestant, book5/365 pick a blessing) —
  arm the flag so the task-43 pick buttons go live; the picks do the granting.
- **a lone linked reward** (book3/472 — a SCOUTING success sets the hidden flag →
  gain the codeword Chance) — granted directly.

Left as-is: book3/680's hidden `<gain price="x">` lives inside a `<group>` (applied
on click, never a standalone widget → no phantom button; the roll-in-a-group is
task 42). book1/597's reward is a *heterogeneous* choose-one (tool / 500 Shards /
resurrection) that `isChooseOne` can't model — the phantom button is gone and the
flag arms, but proper mutual exclusivity is filed as new task **63**.

Verified: 7 new headless assertions (§630 no Pay button, flag armed on entry, both
rolls enabled; a synthetic single-reward hidden price grants its reward with no
button; §127 no button + both bet picks live + no bet auto-placed) + full
render-every-section scan (4369). `RESULT ALL PASS pass=497 fail=0`.

---

## 57. Adventure Sheet: curses all display as "curse"; diseases/poisons invisible  — **done**

`renderSheet` chipped curses by `c.type` (the literal word "curse" for every
entry) and rendered nothing for `d.diseases`/`d.poisons`, so a player afflicted
with Ghoulbite (book1/196) or Scorpion Poison (book1/532) saw nothing while the
penalty silently depressed their abilities, and multiple curses were
indistinguishable.

Fix (`web/js/ui.js`): a shared `afflictionNames(list)` maps each entry to
`a.name || a.type`; Curses now chip by name, and new **Diseases** and **Poisons**
sections render the same way beside Curses.

Verified: 3 new headless assertions (a curse chips by its name not "curse"; a
Diseases section lists Ghoulbite; a Poisons section lists Scorpion Poison) + full
render-every-section scan (4369). `RESULT ALL PASS pass=500 fail=0`.

---

## 58. Market `<sold>` hooks match the shop row's tags, not the sold item's  — **done**

`soldMatches` tested the *row descriptor's* tags (built from `buytags=`), not the
tags on the possession actually sold. In book3/318 the free-goods rows carry
`buytags="318.free"` and the hook is `<sold item="?" tags="318.free">
<tick codeword="3.318.sold"/></sold>`, so selling *any* bonus-1 armour or bonus-0
weapon through those generic rows (e.g. a starting leather jerkin) fired the hook
— and book3/20 → book3/372 punished the "sale" (cobblestones, `<lose stamina="1d">`,
loss of the Saviour title).

Fix — match the sold **possession's** own tags/name:
- **`market.js`** — `sellTrade` now returns `{ ok, item }`, where `item` is the
  possession actually removed (for a carried good; ship/cargo sales carry none).
- **`render.js`** — the sell handler passes `res.item` to `runSoldHooks`, and
  `soldMatches(soldNode, soldItem)` tests `soldItem.tags`/`soldItem.name` (a null
  item — a ship/cargo sale — never matches). The row's own `<sold>` child still
  fires unconditionally (book3/86 pirate captain's head — that *is* the row's sale).

Verified: 3 new headless assertions (§3.318 selling a starting leather jerkin does
NOT tick 3.318.sold; selling an armour carrying the 318.free tag does; the
existing §3.86 row-hook and §3.318 candle-hook tests still pass) + full
render-every-section scan (4369). `RESULT ALL PASS pass=503 fail=0`.

---

## 59. `<tick god=…>` drops `<effect>` children — Sig initiates never get +1 THIEVERY  — **done**

`applyTick`'s `god=` path never read the `<effect>` children, so becoming an
initiate of Sig (book1/437, book2/334 — `<tick god="Sig"><effect ability="thievery"
bonus="1"/></tick>`, "add 1 to your THIEVERY score") granted no bonus. The
previously-unused top-level `data.effects` store is now the home for god-linked
effects:

- **`state.js`** — `setGod(g, effects)` folds any granted effects into
  `data.effects` tagged `source: "god:<g>"`, guarded against double-adding (the "no
  double THIEVERY bonus" rule); `removeGod(g)` strips every `source: "god:<g>"`
  effect on renunciation. `sanitizeData` now preserves the effect's `source` so the
  bonus survives a save round-trip. `effectBonus` already folds `data.effects` into
  `ability()`, so the +1 flows into the score and every check.
- **`engine.js`** — the `<tick|gain god=…>` path passes `readEffects(el)` to
  `setGod`. This flows through the `<group>` initiation button too (it applies the
  `<tick god>` element via `applyEffect`).

Verified: 6 new headless assertions (initiation grants +1 THIEVERY; re-initiating
doesn't stack; renouncing restores it; the effect survives a save round-trip; the
§1.437 group initiation grants Sig +1 THIEVERY and costs 50) + full
render-every-section scan (4369). `RESULT ALL PASS pass=509 fail=0`.

---

## 60. Affliction `<effect>` forms `divide`/`target`/`stamina` inert; item `<curse>` children never attach  — **done**

`readEffects` read only `ability` + `bonus`, and `firstAbility` rejected
`stamina`, so four book-5 afflictions did nothing. All four now work:
- **book5/198** `<effect ability="combat" divide="2"/>` (Champion's Curse) —
  "fight at half your COMBAT (round up)".
- **book5/705** `<effect ability="charisma" target="1"/>` — "CHARISMA falls to 1
  until the curse is lifted".
- **book5/306** `<poison><effect ability="stamina" bonus="-6"/></poison>` —
  "lose 6 Stamina permanently … until you find a cure".
- **book5/238** the stone-bracelet trap carries its curse as an `<item><curse…>`
  child; taking the bracelet now attaches the curse.

Fix:
- **`engine.js`** — a new `afflictionAbility()` accepts the six core abilities
  **plus `stamina`**; `readEffects` now emits exactly one of `{bonus | divide |
  target}` per `<effect>` (mirroring JaFL `AbilityEffect`'s ADJUST/DIVIDE/TARGET
  modify-types), still falling back to a penalty carried on the element itself.
- **`state.js`** — `afflictionMod(ability, value)` applies the non-additive
  transforms after the additive `afflictionBonus`: a `divide` halves the summed
  score rounding up (`Math.ceil`, = JaFL `(v+mod-1)/mod`), a `target` pins it.
  Wired into `ability()` and `abilityNoWeapon()` (so it flows into `defence()`
  and every check) but **not** `abilityNatural()` — a curse is an aura, disabled
  under `modifier="natural"`. A new `afflictionStaminaMod()`/`effectiveStaminaMax()`
  fold `ability="stamina"` affliction penalties into the Stamina total (reversible
  on cure); `addAffliction` caps current Stamina to the reduced max and
  `healStamina` clamps to it. `sanitizeAffliction` round-trips the new
  `divide`/`target` effect fields.
- **`ui.js` / `render.js`** — the Adventure-Sheet Stamina bar, both fight-widget
  Stamina headers and the `<rest>` "already full" check all read
  `effectiveStaminaMax()` so a Stamina-cutting affliction shows and gates
  correctly. `renderItemAward`'s Take handler applies any `<curse>`/`<disease>`/
  `<poison>` child of the item node once the item is taken (a trapped treasure).

Verified: 10 new headless assertions (§198 COMBAT halved round-up + restore on
lift; §705 CHARISMA pinned to 1 + restore; §306 poison −6 Stamina total + current
cap + save round-trip + cure restore; §238 the bracelet's Take button attaches
the curse and halves MAGIC) + full render-every-section scan. `RESULT ALL PASS
pass=519 fail=0`.

---

## 61. book6/628: the rerunnable `<set>` clobbers the roll's var — inn rest/dysentery never fires  — **done**

Task 25 made an absolute `<set value=…>` re-evaluate on every render so
roll-derived vars stay correct — but book6/628 uses `<set var="y" value="7"/>` as
a *sentinel* ("not yet rolled"; JaFL sets it once on entry) before a pay-gated
`<random dice="1" flag="x" var="y">`, then branches `<if var="y" lessthan="6">`
(rest +1 Stamina) / `equals="6"` (dysentery). After paying and rolling, the
rerender re-applied `y=7` **before** the if-chain evaluated, so neither branch
ever activated: the player paid 1 Shard a day and rolled, but never healed (nor
risked dysentery). This is the only corpus collision — every other `<set>`
sharing a var with a roll sits in a mutually exclusive branch (book2/138,
book3/43/102/149/304/642/653, book6/480).

Fix (`web/js/render.js`):
- A new per-visit **`ctx.rolledVars`** set records which vars a *roll* has written
  this visit (populated at all three roll sites — difficulty/random/rankcheck —
  alongside the existing `ctx.wroteVars`). The rerunnable-`<set>` branch in
  `renderPassive` now treats a var a roll owns as **frozen**: `rollOwned` short-
  circuits the re-apply entirely (not merely flipping `rerunnable`, which the
  first-render "not memoised" path would otherwise still re-run), so the die
  result stands. A `<set>` whose var *no* roll has touched still re-evaluates
  every render (task 25), and a `<set>` sentinel that feeds a `<success>`/branch
  still records into `wroteVars` (task 50). `rolledVars` is kept distinct from
  `wroteVars` precisely because the `<set>` itself writes `wroteVars`.
- Making §628 actually heal also required `renderGroup` to apply a `<rest>` child
  on the group click (via `engine.applyRest`) — it previously collected only
  `lose/tick/gain/set/curse`, so the "regain 1 Stamina" `<group force="t">`
  cleared its flag but never healed. This is the `<rest>`-in-`<group>` half of
  task 42 (the inner-*roll*-in-group half — book3/680's MAGIC-roll group — is
  still open there).

Verified: 7 new headless assertions on §6.628 (sentinel y=7 on entry; no active
rest/dysentery action before the roll; the "1 Shard a day" pay button arms the
gated roll; a forced die of 3 writes y=3 and the sentinel does **not** re-clobber
it; a 3 activates exactly the rest action, not dysentery; taking it heals 1) +
full render-every-section scan. `RESULT ALL PASS pass=526 fail=0`.

---

## 62. Render `<image file=…>` and use-effect images (map of Bazalek, book3/75)  — **done**

The `<image>` handler read `src|name`, but the corpus uses `file=` (+ `title=`/
`book=`), so inline images never rendered; and `useItemEffect` had no `<image>`
handling, so the map of Bazalek's `<effect type="use" verb="Read">…<image/></effect>`
Read button was a no-op. All four image sites now work (book1/200, book3/75,
book5/410, and the section `image=` attribute).

Fix:
- **`build/build-data.ps1`** — now copies each book folder's section
  illustrations (any image file that is neither the `<Region>-Map` regional map
  nor a `-cover` cover) into `web/assets/illus/`, so `render.js` can resolve them
  there. The three referenced illustrations (Forest of the Forsaken, Map of
  Bazalek Isle, TheBlackDiptych) land there.
- **`render.js`** — a new `renderImage` reads `file=` (falling back to `src`/
  `name`): an inline `<image>text</image>` keeps its prose as a clickable
  `.image-link` that opens the illustration in a modal (`showImageModal`), while a
  self-closing `<image/>` drops in the figure. `makeIllustration` now
  URL-encodes the (space-bearing) filename, sizes the image and adds an optional
  `<figcaption>`.
- **`engine.js` / `app.js`** — `useItemEffect` returns an `image` descriptor when
  the use-body carries an `<image>`; `onUseItem` opens it in a modal
  (`showIllustration`), leaving a reusable map unconsumed.
- **book5/410** — the source referenced `The Black Diptych.jpg` but the asset is
  `TheBlackDiptych.jpg`; corrected the `file=`/`image=` to match so the Diptych
  actually loads.

Verified: 6 new headless assertions (§75 inline image link keeps its prose; the
taken map carries a Read use-effect whose body holds the `<image>`; Reading
surfaces the Bazalek illustration and does not consume the reusable map; §200
inline treasure-map link) + an HTTP probe confirming all three
`assets/illus/*.jpg` serve 200 + full render-every-section scan. `RESULT ALL PASS
pass=535 fail=0`.

---

## 63. Heterogeneous "choose one" rewards (item / Shards / resurrection) over-apply (book1/597)  — **done**

The task-43 "choose one" machinery only handled *effect*-node rewards
(`tick`/`lose`/`gain`) sharing one flag; a menu that mixes an item award, a Shards
tick and a resurrection deal was not modelled. In **book1/597** the reward for the
ghoul's head is "choose only one of these three": an `<tool name="amber wand" …
flag="x"/>`, `<tick shards="500" flag="x"/>`, and a `<resurrection … flag="x">`.
`renderItemAward`/`renderResurrection` ignored `flag=`, so the wand's Take button
and the resurrection widget were always live while the 500-Shards reward showed
nothing, and nothing enforced the "only one" cap.

Fix (`web/js/render.js`):
- `isChooseOne(key)` now accepts item-family (`item/weapon/armour/tool`) and
  `resurrection` reward nodes in addition to effect nodes, **but** requires the
  set to be *heterogeneous* (at least one non-item-family node). A pure
  item/weapon set stays a barter (book4/634 "give one, take one" is untouched);
  the pure-effect task-43 menus still qualify.
- `renderItemAward` and `renderResurrection` route a `flag=`-linked node to
  `renderChoosableReward` when it belongs to a choose-one. A new
  `grantChoosableReward` grants the picked reward — an item via
  `addItem`/`makeItem` (currency awards credit Shards), a resurrection via
  `buyResurrectionDeal` — and clears the flag; effect rewards still clear their
  own flag through `applyEffect`. `rewardLabel`/`rewardWasteReason` gained
  item-family + resurrection cases (a Take label with the bonus tail; disabled
  when the carry cap is full or a resurrection deal is already held), and an
  unarmed pick under a *hidden* price now reads "You may choose only one" rather
  than "Pay first".

Verified: 6 new headless assertions (§597 three armed picks, nothing auto-applied;
taking the wand grants it and blocks the Shards + resurrection; taking
resurrection blocks the wand + Shards; §634 barter still renders Take buttons,
not reward picks) + full render-every-section scan. `RESULT ALL PASS pass=541
fail=0`.
