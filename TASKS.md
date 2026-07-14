# Fabled Lands — Web Edition · Engineering TODO

Backlog of recommended improvements. The checklist below is grouped by
priority — work the first open (`- [ ]`) item top-down. Task numbers are
stable IDs pointing at the detail sections below (sections are in the order
the tasks were filed, not work order).

**HIGH**

*(none open — completed tasks are listed under **Done**.)*

**MEDIUM**

*(none open — completed tasks are listed under **Done**.)*

**LOW**

*(none open — completed tasks are listed under **Done**.)*

**Done**

*All backlog items are complete. Listed by task number (the stable ID pointing at
the detail section below); detail sections remain in filed order, not this order.*

- [x] 1. Gate combat progression / model fight outcomes
- [x] 2. Finish the logic/view split (combat/market/rest)
- [x] 3. Fix multi-attribute `<if>` conditions
- [x] 4. Prevent silent save-slot overwrite
- [x] 5. Implement `<items group … limit="N">` "choose up to N" pickup
- [x] 6. Harden save import and migration
- [x] 7. Surface persistence failures to the player
- [x] 8. Make service-worker upgrades atomic
- [x] 9. Centralise tag dispatch into a registry
- [x] 10. Dice RNG quality / reproducibility
- [x] 11. Harden the per-visit memoization assumption
- [x] 12. Add headless unit tests for the extracted rules
- [x] 13. Optional: build-time XML validation
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
- [x] 24. Canonicalise ship types (`brig`, `gall`) and fix crew-upgrade steps
- [x] 25. Fix value/expression parsing: vars containing "d", unary minus, division
- [x] 26. Implement the remaining `<fight>` attributes
- [x] 27. Cap visit-box ticks and make `ticks=` guards robust
- [x] 28. Honour `dead="t"` on `<goto>`/`<choice>`
- [x] 29. Market & item polish: currency items, pipe names, headers *(parts 2 & 5 split → 40, 41)*
- [x] 30. Gate `<random flag=…>` rolls behind their payment
- [x] 31. `<rest>` with no `stamina=` should restore to full
- [x] 32. Implement or explicitly stub the remaining unhandled tags
- [x] 33. Narrate sections without `<p>` wrappers (TTS)
- [x] 34. Finish moving rules out of the view layer
- [x] 35. iOS home-screen icons: provide PNG apple-touch-icon
- [x] 36. Minor rule divergences (grab-bag)
- [x] 37. Fix the `safeAddGodd` typo in the source XML
- [x] 38. Gate cache widgets on `lock`/`unlock` under the single-pass render (book1/91 gamble)
- [x] 39. Defer confiscate-and-return `<transfer … from=>` until a fight resolves (book2/462)
- [x] 40. `<market currency="…">` alternate-currency markets
- [x] 41. Item `<effect>` system (use/aura/wielded/ability) and `<sold>` sell-hooks
- [x] 42. Inner `<difficulty>`/`<random>`/`<rankcheck>` rolls inside a `<group>` are unrun
- [x] 43. price/flag "choose one" purchases over-apply every linked reward *(moved from LOW 2026-07-07; scope grew — see detail)*
- [x] 44. Fold the ring of ultimate power's `Rank`/`Stamina` auras (book5/564)
- [x] 45. Multi-fight sections: the fight gate & death-deferral track only the *last* `<fight>`
- [x] 46. `<set var … modifier="natural">` discards the value — book-2 rank ceremonies auto-succeed
- [x] 47. `<choice item="?" tags=…>` is never enabled — light-gated passages hard-locked
- [x] 48. Group fights: Surrender/flee throws a TypeError; no Flee button; no target choice
- [x] 49. `special="attack|defence"` grant permanent, save-persisted bonuses
- [x] 50. Var-keyed `<success>/<failure>` branches fire on entry (unset/stale vars)
- [x] 51. `<difficulty|rankcheck flag=…>` roll gates unimplemented; shared `<success>` binds only the last roll
- [x] 52. `removeCodeword` leaves the codeword's *value* behind — bonus counters never reset
- [x] 53. `<difficulty modifier="noweapon">` still counts the weapon bonus
- [x] 54. Mid-fight escape brackets (tick…lose codeword) collapse — surrender/flee routes unreachable
- [x] 55. `<choice item=… pay="t">` doesn't consume the item
- [x] 56. `hidden="t"` payments render a phantom "Pay" button instead of arming silently
- [x] 57. Adventure Sheet: curses all display as "curse"; diseases/poisons invisible
- [x] 58. Market `<sold>` hooks match the shop row's tags, not the sold item's
- [x] 59. `<tick god=…>` drops `<effect>` children — Sig initiates never get +1 THIEVERY
- [x] 60. Affliction `<effect>` forms `divide`/`target`/`stamina` inert; item `<curse>` children never attach
- [x] 61. book6/628: the rerunnable `<set>` clobbers the roll's var — inn rest/dysentery never fires
- [x] 62. Render `<image file=…>` and use-effect images (map of Bazalek, book3/75)
- [x] 63. Heterogeneous "choose one" rewards (item / Shards / resurrection) over-apply (book1/597)
- [x] 64. Asset-only releases do not invalidate the PWA cache
- [x] 65. Rules modal emits invalid table heading markup
- [x] 66. Add a CI workflow that runs the headless smoke suite
- [x] 67. README: align the illustration docs with the shipped build
- [x] 68. `<if ability="rank|stamina">` always reads 0 — Rank gates never open (§416 + 11 more)
- [x] 69. Bare post-fight `<lose>/<gain>` apply on entry, not on the fight outcome (§570 + 7 more)
- [x] 70. Visit box renders unticked on the visit it ticks; bare `<tick/>` prints "If not, , and read on" (§496 + widespread)
- [x] 71. `<lose staminato="N">` never applies — the handler is gated on a `stamina=` attr it lacks (16 sections)
- [x] 72. "codeword gained" notification fires even when the codeword was already held
- [x] 73. Ship dock/current-vessel state is not maintained — any owned ship can sail or trade from anywhere *(core done; todock= + sailing-ship pointer split → task 81)*
- [x] 74. Standalone `force="f"` effects auto-apply — missions/initiations cannot be declined; choose-one losses over-apply
- [x] 75. Live `<tick>` forms for equipment, profession changes and patterned titles are incomplete/inert
- [x] 76. Blessings are stored as inert labels — ability/Luck/travel benefits cannot be used *(core rerolls done; combat Defence/Wrath split → task 80)*
- [x] 77. Selector-aware `<set item|cache …>` expressions read the sheet instead of the selected item/cache (21 nodes)
- [x] 78. Validate numeric `<section name>` against its filename; fix five mismatched source files
- [x] 79. Keeping a preview or importing a save reports success when persistence fails
- [x] 80. Combat blessings: expose Defence through Faith (+3, one fight) and Divine Wrath (1d pre-damage) as fight-widget buttons *(split from task 76)*
- [x] 81. Ships: honour `todock=` and track which at-large ship is being sailed *(split from task 73)*
- [x] 82. Test harness: a duplicate top-level `const` in `run()` silently aborts the whole suite (reads as a hang, not a failure)
- [x] 83. Combat blessings (Wrath/Defence) buttons appear only on the single-fight widget, not group fights *(split from task 80)*
- [x] 84. De-flake the "fight attack produces a log line" test (timing-dependent on the 900 ms dice animation)
- [x] 85. book6/135 source: `tag="keep"` is a stray/misnamed attribute (likely meant `tags=`); harmless but should be cleaned
- [x] 86. Add a full-section render integration test for book5/386 (currently covered only by synthetic ticks) *(added; surfaced the §386 enchant-cycle bug → task 88)*
- [x] 87. Fight widget "Your Combat" omits the per-fight attack bonus (`special="attack"`), unlike the Defence line
- [x] 88. book5/386: the hidden `removetag="Tz"` cleanup fires on entry, so Targdaz's weapon-enchant roll/outcomes never land (weapon never changes)
- [x] 89. Ship actions still use remote vessels, and `<choice sail>` does not sail one
- [x] 90. Permanent Safety from Storms is deleted by storm-avoidance `<lose blessing>` nodes
- [x] 91. COMBAT blessing cannot reroll an attack, and Defence blessing leaks between fights
- [x] 92. Eight live `<adjust>` variants are ignored or applied unconditionally
- [x] 93. Item group provenance and rolled `itemAt=` losses are not represented
- [x] 94. `quantity=` is ignored on rewards, cargo ticks and market stock
- [x] 95. Item `replace=` rewards add a duplicate instead of transforming the possession
- [x] 96. Hidden item rewards inside `<group>` choices are never granted
- [x] 97. Molhern's `itemcache` ignores its `<include>` / `<exclude>` filters
- [x] 98. Resurrection arrangements ignore replacement, supplemental and hidden semantics
- [x] 99. `<fightround>` effects are detached manual widgets instead of combat-round rules
- [x] 100. The two live `<while>` loops execute only one rendered pass
- [x] 101. §5.114's `<sectionview>` oracle cannot display its referenced section
- [x] 102. §1.338's standalone `<price>` does not charge for or complete the poison cure
- [x] 103. §4.658: `initialCrew="oldcrew"` ignores the `oldcrew` variable — the salvaged barque's crew resets to average
- [x] 104. Travel rolls don't gate the section's onward choices; a "get lost" outcome doesn't suppress them (§1.278/§1.82 + every travel section)
- [x] 105. `<if ticks="N">` reads the live count — this visit's own `<tick/>` flips the guard on a mid-visit rerender, re-showing the "already ticked → goto" redirect (§1.496)
- [x] 106. Light mode is force-darkened on Chrome/Edge — Chromium "Auto Dark Theme"; `color-scheme: light` doesn't opt out, needs `only light` *(fixed; leather-chrome-in-both-themes remains an intentional design note)*

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

## 33. Narrate sections without `<p>` wrappers (TTS)  — **done**

`tts.js` `prepare()` wrapped sentences only inside `.flow` `<p>` elements, but
~1,544 of 4,389 sections render their prose as bare text nodes directly in
`.flow` — the 🔊 button and auto-narrate silently did nothing there (e.g.
book4/16, book2/745): `chunks` was empty and `play()` returned before setting
`playing`, with no user feedback.

Fix:
- **`tts.js`** — after the `<p>` pass, `prepare()` now also calls a new
  `wrapFlowRuns(flowEl)` that wraps runs of bare inline prose (text nodes +
  inline elements) sitting directly in `.flow` into the same `.tts-s` sentence
  spans (via the existing `wrapSentences`, so listeners on any moved controls are
  preserved). Block widgets — `<p>`, the choices/fight/market/roll `<div>`s,
  tables, etc. (a `FLOW_BLOCK` tag set) — end the current run and are left in
  place, so they are never swept into a sentence span. Chosen over "normalise
  into paragraphs at render time" to keep the change entirely inside the optional
  TTS module (no view-layer churn across 1,544 sections).
- **Disabled state** — a non-mutating `Narrator.canNarrate(flowEl)` reports
  whether a section has any prose worth reading (clones the flow, strips the same
  non-prose regions `prepare` excludes — `CONTROL_SEL` + `.choices` + `table` —
  and tests for alphanumerics). `app.js`'s new `syncNarrateBtn()` runs on every
  (re)render (wired into the Story `onRender` hook, beside `handleRerender`) and
  disables the 🔊 button (title "Nothing to read aloud here") when there is
  genuinely nothing. `.icon-btn:disabled` gets a dimmed style; the hover rule is
  now `:not(:disabled)`. Wrapping stays lazy (only on play) — `canNarrate` leaves
  the DOM pristine, confirmed in a real-app boot.

Verified: 7 new headless assertions (book4/16 bare-text → chunks > 0 and the
prose captured; book2/745 active-`<else>` prose narrates; a choices-only section
→ 0 chunks; `canNarrate` true/false agreeing with `prepare`; a `<p>` section
still narrates and `prepare` is idempotent) + a real-app boot at `?demo=4.16`
(story renders, no fatal, the narrate button is enabled with no eager `.tts-s`
wrapping) + full render-every-section scan. `RESULT ALL PASS pass=607 fail=0`.

---

## 34. Finish moving rules out of the view layer  — **done**

Known strays that violated the architecture invariant (rules live in DOM-free
modules), each now moved into `market.js`/`engine.js` with the view reduced to
reading attributes + wiring the click:

- **Cargo transaction** — already resolved by task 23: `renderInlineSell`'s
  cargo→Shards move lives in `market.sellCargo` (the view only keeps the
  view-linked barter-reward wiring, `applyLinkedCargoBuys`). Re-verified, no
  change needed.
- **Crew "one grade at a time" rule** — extracted to a new
  `market.canUpgradeCrew(state, crew)` (`{ok, reason}`), which `applyInlineBuy`
  now *enforces* (a two-grade jump is refused and spends nothing) rather than the
  rule being computed only in the view's disabled-button gate. `renderInlineBuy`
  just consumes the verdict for its disable/tooltip; `CREW_LEVELS` no longer
  needs importing into `render.js`.
- **Choice cost** — the paid-`<choice>` transaction (deduct Shards / foreign
  currency, consume the required item) moved from `renderChoice`'s click handler
  into `market.payChoiceCost(state, {pay, cost, currency, foreignCoin, item})`.
- **Resurrection revive** — the "revive at half max Stamina" rule moved from
  `app.js`'s `handleDeath` into `engine.reviveWithResurrection(state)`, which
  consumes the earliest deal, heals to `max(1, floor(staminaMax/2))`, and returns
  its `{book, section}` for the app to navigate to (or `null` if none).

Verified: 12 new headless assertions (crew: one-grade allowed, two-grade jump
refused by both `canUpgradeCrew` and `applyInlineBuy` with no Shards spent,
one-grade applies + charges, no-ship refusal; `payChoiceCost` pay=false no-op,
Shards deduct, item consume, foreign-currency debit; `reviveWithResurrection`
half-heal + target + consume, and null when none) + the existing §400/§740/pay="f"
choice-cost and crew tests still green + a real-app boot (`?demo=1.1`, no fatal,
no module-load error) + full render-every-section scan. `RESULT ALL PASS pass=619
fail=0`.

---

## 35. iOS home-screen icons: provide PNG apple-touch-icon  — **done**

`web/index.html` pointed `apple-touch-icon` at an SVG, and the manifest offered
only SVG icons — iOS Safari does not accept SVG touch icons, so installed
home-screen icons fell back to a page screenshot.

Fix:
- **Generated three PNGs** from `assets/icon.svg` and committed them under
  `web/assets/`: `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png`.
  Rasterised with headless Chrome (`--screenshot` at the icon's native 512 on the
  `#2b1a0f` theme background, so the icon is a full opaque square — ideal for
  iOS's own masking), then downscaled 512→192/180 with high-quality bicubic
  (`System.Drawing`). No build toolchain or dependency was introduced. (Chrome's
  headless-new minimum window size crops direct screenshots below ~500px, hence
  the render-at-512-then-downscale approach.)
- **`index.html`** — `apple-touch-icon` now references `assets/apple-touch-icon.png`
  with `sizes="180x180"`.
- **`manifest.webmanifest`** — added PNG icon entries at 192×192 and 512×512
  (`purpose:"any"`) alongside the existing scalable SVGs.
- **`sw.js`** — the three PNGs join the `REQUIRED` precache next to the icon
  SVGs, so they are available offline. (Task 64 already makes `web/assets/**` part
  of the build stamp, so replacing an icon now busts the cache.)

Verified: 4 new headless assertions (apple-touch-icon href is a `.png`; manifest
lists PNG icons at 192 and 512; the touch-icon PNG is fetchable and decodes at
exactly 180×180) + task 64's precache-fetchability test now also covers the three
PNGs + a visual check of the rendered 512 and 180 icons + full render-every-section
scan. `RESULT ALL PASS pass=623 fail=0`.

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
resolve (a §91 test covers it). What remained for THIS task is only the widget
nicety: while the cache is locked, the money-cache widget's deposit/withdraw should
disable so the bet can't change after rolling.

**Done (2026-07-09).** The tricky part was distinguishing the two lock/unlock
patterns in the corpus so the fix couldn't regress the stash sections:
- *Gamble* (book1/91, book2/134): the `<tick special="lock" cache=X>` sits **inside
  the roll `<group>`** — "freeze the bet on the roll." Its widget should lock.
- *Stash* (book1/177, book2/211, the townhouse/apartment sections): a **top-level**
  lock/unlock brackets a freely-editable `<itemcache>`; disabling that widget would
  be a real regression.

Fix (`render.js` + a CSS cue):
1. **Pre-scan** in `begin()` records every cache whose lock is bundled in a roll
   group into `ctx.rollLockCaches`, and resets those (and only those) to unlocked
   on entry, so a fresh visit re-opens the bet. Stash caches are never in the set.
2. **`renderGroupWithRoll`** now *defers* a hidden `special="lock"`/`"unlock"` tick
   to fire on the roll (not on entry) — §91's lock was the lone hidden-lock-in-a-
   roll-group. Hidden price-flag arming (book3/680, book2/138) still fires on entry
   as before (only `special="lock|unlock"` is redirected).
3. **`renderMoneyCache`** disables its input/deposit/withdraw (and adds a
   `.cache.locked` dim) only when the cache is in `ctx.rollLockCaches` **and**
   `isCacheLocked` — so exactly the gamble bet locks after the dice; stash widgets
   are untouched. (`<itemcache>` is deliberately not gated: no gambling cache uses
   one, so adding it would be untested dead code.)

Verified: 3 new headless assertions (§91 bet editable before the roll; the bet's
deposit/withdraw disable + `.money-cache.locked` after rolling; a synthetic
top-level stash lock leaves its money-cache editable) + the existing §91
roll-resolves-outcome test + full render-every-section scan (all 26 lock/unlock
sections render clean). `RESULT ALL PASS pass=626 fail=0`.

---

## 39. Defer confiscate-and-return `<transfer … from=>` until a fight resolves  — LOW

`<transfer>` is implemented (task 20), but in book2/462 the return leg
(`<if dead="f"><transfer item="*" from="2.462"/></if>`) was active from entry —
the player is "not dead" throughout the fight, not only after winning — so the
weapons/armour stashed at the top were handed straight back and the vampire was
fought armed.

**Done (2026-07-09).** This turned out to be a broader bug: *every* post-fight
`<if dead="f">` in the corpus is an "if you win…" outcome (11 sections —
book1/21/297/634, book2/413/462/469/514, book3/7, book6/55/186/348/718), and
because the player is "alive" all through the fight, each one fired its rewards on
**entry** — book6/348 handed over 12,000 Shards, book2/413/55/718 ticked their
win codewords, book1/634/3.7 gave Shards, all before a blow was struck.

Fix (`render.js`): the `if/elseif/else` chain walker now recognises a *fight-outcome
chain* — an `<if>` carrying a `dead=` attribute positioned after a fight — via a new
`isDeferredDeadChain(node)`, and holds the **whole** chain inactive (so the `<else>`
lose-branch can't slip active either) until `aggregateFightOutcome` reports `win`
or `lose`. Once resolved the ordinary `dead=` test is correct: a win → alive →
the "if you win" branch applies its rewards / the §462 confiscate-return; a loss →
dead → the `<else>` (or plain death). Nothing before a fight, and no non-`dead=`
conditional, is affected. The suppression reuses the existing grayed-branch
`this.inactive` path, so `<transfer>`/`<gain>`/`<tick>` apply nothing and reward
`item`/`weapon` awards render as disabled Take buttons until the win.

Verified: 4 new headless assertions (§462 confiscates gear to the cache on entry;
the return branch stays grayed mid-fight; no weapon/armour returns to the sheet
while fighting; winning returns the stashed gear and empties the cache) + the full
fight/branch suite and render-every-section scan unchanged. `RESULT ALL PASS
pass=630 fail=0`.

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

---

## 64. Asset-only releases do not invalidate the PWA cache  — **done**

`build/stamp-version.ps1` hashed JavaScript, CSS, generated JSON, `index.html`,
and the manifest, but not any files beneath `web/assets/`. Because the
service-worker cache name is `fl-<stamp>`, replacing only an icon, map, or
illustration left the stamp — and therefore the cache name — unchanged, so
existing installs kept serving the old asset indefinitely. Separately, the three
`web/assets/illus/` files were in *no* precache list, so an installed player who
went offline before viewing them (e.g. book3/75's map of Bazalek) never got them.

Fix:
- **`build/stamp-version.ps1`** now folds `web/assets/**` (recursive, `-File`)
  into the content-hash input alongside js/css/json/html/manifest. Any change to
  an icon, map, or illustration moves the stamp (and thus the SW cache key), so
  the change reaches installed players instead of stranding them on the stale
  cached asset. `sw.js` stays excluded — it lives in `web/`, not `web/assets/`,
  and hashing the file whose cache key we rewrite would be circular (the note's
  explicit warning). Verified with a reversible probe: adding one file under
  `web/assets/` moved the stamp (`a6d86f8`→`2b5542c`) and removing it restored it.
- **`web/sw.js`** adds the three section illustrations to the `OPTIONAL` precache
  list (best-effort, so an offline miss can't abort the upgrade). They are stored
  **URL-encoded** (`Forest%20of%20the%20Forsaken.JPG`, …) to match render.js's
  runtime request (`'assets/illus/' + encodeURIComponent(name)`) so the precached
  response actually matches the fetch cache key.

Chose stamp-input hashing over emitting revisioned asset URLs (the alternative
the task floated): it needs no rewriting of `<img src>`/`manifest` references and
keeps the single-stamp cache-busting model already in place.

Verified: 3 new headless assertions (sw.js declares a `fl-yy.MM.dd.<hash>` cache
key; the precache lists all three illustrations built with the *same*
`encodeURIComponent` render.js uses; every precached `./` asset/data/css/js/html
URL is HEAD-fetchable — catching a misnamed or mis-encoded entry) + the reversible
stamp probe above + full render-every-section scan. `RESULT ALL PASS pass=600
fail=0`.

---

## 65. Rules modal emits invalid table heading markup  — **done**

`renderStatic()` (`app.js`) handled every `h1`–`h6` element before its later,
identical condition that created a `<th>`, so the `<th>` branch was unreachable.
In `rules/QuickRules.xml`, `<h3>Quick Rules</h3>` is a direct child of `<tr>`, so
the modal produced an `<h3>` nested illegally inside a table row.

Fix (`app.js`): the heading case is now context-aware — a heading whose DOM parent
is a `<tr>` renders as a `<th>` that spans the table's widest row (colspan computed
from the source table's row cell counts, ≥1); a heading anywhere else stays a real
`<hN>`. The dead duplicate branch was removed. To make it testable, `renderStatic`
is now `export`ed and the module's auto-`boot()` is guarded on the presence of
`#app` (index.html has it; the headless harness does not), so importing `app.js`
from `_test.html` has no side effects.

Verified: 4 new headless assertions (QuickRules renders a `<tr>`; its heading is a
`<th>` with no nested `<hN>`; the header cell keeps the "Quick Rules" text; a
heading outside a table stays an `<hN>`) + a real-app boot (`?demo=1.1`, still
auto-boots, no fatal) + full render-every-section scan. `RESULT ALL PASS pass=634
fail=0`.

---

## 66. Add a CI workflow that runs the headless smoke suite  — LOW (infra)

*(From the 2026-07-09 external review's recommendations.)* The repository has no
`.github/workflows/` at all, so the comprehensive `web/_test.html` suite (597
assertions + render-every-section over all 4,369 sections) only runs when someone
remembers to run it locally. A regression pushed without the local loop would
ship silently.

Add a GitHub Actions workflow that, on push/PR:
1. Serves the repo root (`python -m http.server 8848 &`).
2. Runs headless Chrome against `http://localhost:8848/web/_test.html` with
   `--headless=new --dump-dom --virtual-time-budget=90000` and a fresh
   `--user-data-dir` (Chrome is preinstalled on `ubuntu-latest` runners).
3. Fails unless the dumped `#results` starts with `RESULT ALL PASS`.

**Done (2026-07-09).** Added `.github/workflows/smoke.yml` — one small workflow,
one job (`ubuntu-latest`), no build toolchain: checkout → serve the repo root with
`python3 -m http.server` → wait for it → drive `google-chrome --headless=new
--dump-dom --virtual-time-budget=90000` with a fresh `--user-data-dir` (so no stale
service-worker cache reports a false pass) → the step exits non-zero unless the
dumped DOM contains `RESULT ALL PASS`, echoing the first `FAIL` lines otherwise.
The script uses `set -euo pipefail` with an `if`-guarded wait loop and `|| true`
on Chrome so only a genuine suite failure reds the job.

Deliberately **omitted** the optional regenerate-and-diff of `web/data/*.json`:
[[build-needs-pwsh7]] shows JSON formatting is sensitive to the PowerShell build
that produced it, so a cross-platform (Linux `pwsh`) regenerate could diff
spuriously and red the job for no real defect. The smoke suite already loads the
committed JSON and renders every section, so a malformed/hand-broken bundle fails
the suite anyway. (Cannot be executed from this environment — validated for
structure: no tabs, well-formed `on:`/`jobs:`, `set -e`-safe shell.)

---

## 67. README: align the illustration docs with the shipped build  — LOW (docs)

`README.md` ("What's included & known limits") says *"Section illustrations are
not part of this repository, so inline art is skipped gracefully."* That is now
half-wrong: since task 62, three bespoke illustration files live in `books/`
(book1 "Forest of the Forsaken", book3 "Map of Bazalek Isle", book5
"TheBlackDiptych") and `build/build-data.ps1` copies every non-map, non-cover
book-folder image into `web/assets/illus/`, where `render.js` displays them.
The general per-section art (e.g. `142.jpg`) is indeed still absent.

Fix: reword the bullet to say the three `<image>`-referenced illustrations are
included and shipped by the build, while the remaining per-section art is not
(the drop-in instructions for `web/assets/illus/` stay). Doc-only change — but
still run `stamp-version.ps1`? **No:** README is not hashed by the stamp and not
served by the app, so no stamp/test loop is needed beyond a sanity read.

**Done (2026-07-09).** Reworded the "What's included & known limits" bullet: the
three `<image>` illustrations — book 1 *Forest of the Forsaken*, book 3 *Map of
Bazalek Isle*, book 5 *The Black Diptych* (confirmed to live in `books/book1|3|5/`)
— ship via the build into `web/assets/illus/` and are shown by `render.js`, while
the general per-section art (`142.jpg`, …) is still absent and skipped gracefully;
the drop-in instructions stay. Also tightened the repo-tree comment on `images/`
from "Section illustrations are NOT included" to "General per-section art is NOT
included," since that folder never held the bespoke illustrations (they come from
the book folders). Doc-only; no stamp/test loop run, as noted above.

---

## 68. `<if ability="rank|stamina">` conditions always read 0 — Rank gates never open  — HIGH (engine)

*(Filed 2026-07-10 from playtesting §416.)* `evaluateCondition`'s `ability=`
handler (`engine.js`) resolves the ability through `firstAbility()`, which only
recognizes the **six core abilities** and returns `null` for `rank`/`stamina`.
The value therefore falls to `0`, so every `<if ability="rank" …>` comparison is
against 0 regardless of the character's real Rank. `resolveValue`/`evalExpression`
and `adjustAmount` already special-case `rank`→`state.rankValue()` and
`stamina`→ the (effective-max) score; the condition path just never got the same
routing.

Effect: `greaterthan`/`equals` Rank gates never fire (the branch stays greyed and
its links disabled — e.g. §416's south-west/south-east ship routes are dead even
at Rank 10), and `lessthan` Rank gates fire *always* (§b4/255's "Rank less than 4"
branch shows for everyone). Affects **12 sections**: book1/13, 249, 312, 364, 366,
416, 502; book2/95, 480; book4/255, 294, 465.

Fix: in the `add(get('ability'), …)` branch, route `rank`→`state.rankValue()` and
`stamina`→ the effective/written score (per the `modifier`) before falling back to
`firstAbility`, mirroring `evalExpression`. Add a focused headless assertion (a
Rank-N character passing/failing a `greaterthan`/`lessthan` Rank gate) and re-run
the every-section scan.

**Done (2026-07-10).** Routed `rank`→`state.rankValue()` and `stamina`→
`effectiveStaminaMax()` (with a `modifier`) / current Stamina (without) in the
`ability=` condition handler, before the `firstAbility` fallback — parity with
`evalExpression`/`adjustAmount`. Added seven `_test.html` assertions (Rank-10 vs
Rank-2 characters across `greaterthan`/`lessthan`/`equals`, plus a `stamina`
read). Suite green: `RESULT ALL PASS pass=641 fail=0`.

---

## 69. Bare post-fight `<lose>/<gain>` apply on entry, not on the fight outcome  — HIGH (render)

*(Filed 2026-07-10 from playtesting §570.)* When a fight's win/lose consequence is
written as **bare prose** after the `<fight>` (not wrapped in `<if dead=…>` /
`<success>` / `<failure>`), the inline `<lose>`/`<gain>` effects auto-apply on
render (`renderPassive`), before the fight is fought. The fight gate only disables
*navigation* buttons, not effects. §570 sets you to 1 Stamina **and strips all
your Shards the instant you enter**, then makes you fight the Tree Guard.

An XML-aware scan (see scratchpad) finds **8 player-facing cases** (bare,
non-`hidden` `<lose>/<gain>` after a `<fight>`, outside any gating wrapper):
book1/199 (`gain shards="200"` win reward), book1/570 (`lose staminato/shards`
lose penalty), book2/476 (`lose codeword="Brisket"` on win), book2/601
(`gain shards="25"` on win), book3/500 (`lose item` on win), book5/162
(`gain shards="15"` on win), book5/198 (`lose curse="Champion's Curse"`),
book6/490 (`gain shards="15"` unconditional post-fight). The other matches are
`hidden="t"` bookkeeping codewords already deferred by task 54's escape-clear
machinery. **§198 is also silently broken today**: its `<lose curse>` runs as a
no-op on entry (curse not yet applied), memoizes, and never lifts the Champion's
Curse the player picks up mid-fight — COMBAT stays halved.

Approach (chosen after scope check — 8 cases over 5 books favours a general engine
fix over 8 XML edits): defer a bare, **non-`hidden`** `<lose>/<gain>` that sits
after a `<fight>` (outside any conditional wrapper) until the fight resolves,
classifying it win/lose/unconditional by the surrounding prose (reuse
`computeFightGate`'s LOSE/WIN heuristic + `aggregateFightOutcome`), and applying it
only on the matching branch (win/uncond → on win; lose → on loss). Excluding
`hidden="t"` keeps task 54 untouched. Add a headless test (enter §570, assert
Shards/Stamina unchanged pre-fight; lose → 1 Stamina + 0 Shards; §199 win → +200)
and re-run the every-section scan.

**Done (2026-07-10).** `computeFightGate` now also builds an `effectNodes` map:
each bare, non-`hidden` `<lose>/<gain>` seen after a `<fight>` and outside any
`WRAP` wrapper (`if`/`elseif`/`else`/`success`/`failure`/`outcomes`/`group`/
`choice`) is classified `win`/`lose`/`uncond` by the same LOSE/WIN prose heuristic
that marks nav nodes. `renderPassive` checks that map before applying: while the
fight is unresolved (or fled) it holds the effect (shows the words, applies
nothing, does not memoise); once resolved it applies only on the branch taken
(`win`/`uncond` → win, `lose` → loss). Four `_test.html` assertions cover §570
(entry keeps 45 Shards / 20 Stamina; lose → 1 Stamina + 0 Shards) and §199 (entry
pays nothing; win → +200). Surfaced task **71** en route (§570's `staminato` had
never fired). Suite green: `RESULT ALL PASS pass=649 fail=0`.

---

## 71. `<lose staminato="N">` never applies — handler gated on a missing `stamina=` attr  — HIGH (engine)

*(Surfaced 2026-07-10 while fixing task 69's §570.)* `applyEffectBody`'s Stamina
branch is `if (get('stamina') != null) { … if (get('staminato') != null) … }` — the
`staminato` case lives *inside* a guard that requires a `stamina=` attribute. But
`<lose staminato="N">` ("you are beaten down to N Stamina", e.g. §570 "wake up on 1
Stamina") never carries `stamina=`, so the block is skipped and the reduction never
happens. A corpus scan shows **16 sections** use `staminato` and **none** pair it
with `stamina=`, so the effect is dead everywhere: book1/21, 157, 297, 308, 488,
498, 551, 570; book4/169, 338, 420; book5/66, 398, 521, 540, 669 (two use
`staminato="prestamina"` — "back to your pre-fight Stamina").

Fix: widen the guard to `get('stamina') != null || get('staminato') != null`; the
`staminato` arm already computes the damage as `current − target`. Add a direct
`applyEffect` assertion (15 → 1 on `staminato="1"`).

**Done (2026-07-10).** One-line guard widened; existing `staminato` arm unchanged.
Added a unit assertion (Stamina 15 → 1) plus the §570 integration coverage from
task 69. Suite green: `RESULT ALL PASS pass=649 fail=0`.

---

## 70. Visit box renders unticked on the visit it ticks; bare `<tick/>` prints a dangling comma  — MEDIUM (render)

*(Filed 2026-07-10 from playtesting §496.)* Two defects in the standard box idiom
`<if ticks="1">…goto…</if> If not, <tick/>, and read on.` (book1/160, 496, 199, …;
the `<tick/>, and read on` phrasing appears in **45 sections**):

1. **Box shows empty on the ticking visit.** The section box row is drawn
   (`render.js` ~L168) from `tickCount()` *before* `appendChildren` (L207) runs the
   `<tick/>`, so on the first visit the box still renders ☐ even though the tick is
   applied to state; it only shows ☑ on a later visit. Reads as "the box isn't
   being ticked." Fix: build/populate the box row *after* `appendChildren` (re-read
   `tickCount()`), keeping it in the same visual slot (insert before `.flow`).
2. **Wording.** A bare `<tick/>` renders no text, so `If not, <tick/>, and read on.`
   comes out as **"If not, , and read on."** (dangling comma). Fix: render a bare
   section-box `<tick/>` (no codeword / meaningful attrs) as its printed words —
   "tick the box" — so the sentence reads naturally, matching the gamebooks.

Add a headless assertion (first visit to a `boxes="1"` section shows ☑ after
render and the prose contains "tick the box", no ", ,") and re-run the scan.

**Done (2026-07-10).** (1) `render()` now runs `setSectionBoxes` before the walk
(keeps the tick cap) but *draws* the box row after `appendChildren`, inserted above
`.flow`, so a `<tick/>` applied this visit reads ☑ immediately. (2) A new
`isBareBoxTick()` guard (a `<tick>` with no words and no attribute beyond `count=`)
makes `renderPassive` print "tick the box" for the otherwise word-less box tick, so
"If not, <tick/>, and read on" renders as "If not, tick the box, and read on".
Added three `_test.html` assertions rendering §1.496 (state ticked, box shows ☑,
prose reads naturally with no ", ,"). Suite green: `RESULT ALL PASS pass=644
fail=0`.

---

## 72. "codeword gained" notification fires even when the codeword was already held  — LOW (engine)

*(Filed 2026-07-10 from a bug report.)* `applyTick`'s codeword branch
(`engine.js` ~L574) unconditionally pushed `'codeword gained'` onto the note list
and returned it, so `<tick codeword="X"/>` popped the "codeword gained" toast even
when the player already held X. Codewords are a set (`state.data.codewords[cw] =
true`), so re-granting one is a no-op on state — but the user still saw a reward
message for nothing gained. Common because books re-assert a codeword on a section
the player may revisit.

Fix: check `state.hasCodeword(cw)` before adding and only push the note when at
least one listed codeword was actually new; `did` stays `true` regardless so a
pipe-listed re-grant still never falls through to the bare visit-box tick.

**Done (2026-07-10).** Guarded the note with a `gained` flag over the split list;
state write and `did` unchanged. Suite green over three runs: `RESULT ALL PASS
pass=649 fail=0` (the one intermittent "fight attack produces a log line" failure
is the pre-existing 900 ms animation-timing flake, confirmed present on the
stashed pristine build too).

---

## 73. Ship dock/current-vessel state is not maintained — any owned ship can sail or trade from anywhere  — HIGH (state/market/navigation)

*(Filed 2026-07-10 from the repository review.)* The corpus has **94** numeric
sections with `dock=`, **15** sailing gotos and **2** `todock=` sections, but
`Story.begin` ignores both section attributes. A bought ship is created with
`docked: null`; `renderGoto` enables `sail="t"` when `state.ships.length > 0`
without checking the section's dock; clicking it neither chooses a ship nor
marks one as the current vessel/"at large". Cargo grants/losses, crew changes,
ship losses, cargo markets and `<if cargo|crew|ship>` likewise use the first or
any owned ship rather than a vessel present at the current location. A ship left
at Smogmaw can therefore sail from Kunrir, and a newly purchased vessel never
acquires its purchase port for the three working `docked="Smogmaw"` conditions.
This contradicts the checked-in tag specification: section `dock=` enables only
ships at that dock, `sail="t"` selects one and puts it at large, and `todock=`
moves other at-large ships when leaving.

Implement explicit current-vessel/location rules in a DOM-free module/state API:

1. Give ships stable identities and track which one is currently being sailed.
   Buying/receiving a ship at a `dock=` section must berth it there.
2. A sail action must offer only ships at the current dock (or the current ship
   while already at sea); choose one when several qualify, then mark it at large.
   Reaching a dock with the current ship berths that ship there. Honour `todock=`
   for other at-large vessels.
3. Route cargo/crew/ship transactions and location-sensitive conditions through
   the current/local ship instead of `ships[0]`/`ships.some(...)`. Preserve rules
   that genuinely mean any owned ship.
4. Thread only location/selection data through `render.js`; keep the mutations
   and eligibility checks headless in `state.js`/`market.js`/`engine.js`.

Add focused tests: two ships at different docks cannot sail/trade from the wrong
port; buying at a dock records that dock; sailing one of two ships changes only
the chosen ship; arrival re-docks it; `todock=` moves the other at-large ship;
book3/53's Smogmaw condition follows the actual berth. Re-run all sections.

**Done — core (2026-07-11).** Implemented the location model headlessly. A ship's
`docked` field is now maintained (a dock name, or `null` = "at large"), and a new
`data.location` tracks where the *player* is:
- **state.js** — ships gain a stable `id`; `arriveAtDock(x)` records the location and
  berths any at-large ship here (sailed in — JaFL `ShipList.setAtDock`); `shipsHere()`
  (`docked === location`), `currentShip()` (a ship here, else the first owned),
  `shipDockedAt(x)`, `sailShip(id)` (set at large). A `sameDock` helper matches
  null==null (at large) or case-insensitive dock names. `sanitizeData` migrates
  `location` and back-fills ship `id`s.
- **render.js** — `Story.begin` calls `arriveAtDock(section dock=)`, so entering a
  dock berths the arriving ship and a `dock`-less section clears the location. A
  `sail="t"` goto is enabled only when `shipsHere()` is non-empty (a ship left at
  Smogmaw can no longer sail from Kunrir); clicking it sets the ship at large then
  navigates, **prompting a choice** (`sailThenGo` → `.ship-choice`) when several ships
  share the dock; `force` now defaults optional for a sail goto.
- **engine.js** — `applyShipLose`, the `<tick crew|cargo>` grants, the adjust-crew
  path, `<set dock="X">` and the `crew` expression identifier route through
  `currentShip()`; `<if docked="X">` uses `shipDockedAt`.
- **market.js** — a ship bought inline or in a market berths at the current port;
  cargo loads onto / sells from a ship *here* first; `canUpgradeCrew` uses the local
  ship.
- **ui.js** — the sheet shows each ship's berth ("docked at X" / "at large").

`<if ship="type">` (65 uses) is left as **any-owned** (ownership, not location), as
the task requires. Deferred to **task 81**: `todock=` (book1/176, book4/114) and a
persistent "which at-large ship am I sailing" pointer across sea sections (needed so
`todock` and multi-at-large arrivals berth correctly). Added 22 assertions
(berth-on-arrival, here/current routing, cargo-to-local-ship, buy-berths-at-dock,
sail-gated-and-at-large, multi-ship sail chooser, §3.53 branch by real berth, save
migration). Web-only — stamped `26.07.11.a06e630`. Suite green:
`RESULT ALL PASS pass=723 fail=0`.

---

## 74. Standalone `force="f"` effects auto-apply — optional missions/initiations cannot be declined  — HIGH (render)

*(Filed 2026-07-10 from the repository review.)* `renderPassive` auto-applies
every standalone `lose`/`tick`/`gain`/`set`/`adjustmoney` unless it happens to
match a price gate, chooser, fight deferral or economic-decline heuristic. It
never reads `force=`. The XML corpus has **35** non-transfer standalone effects
with `force="f"` (the three optional transfers already have a proper button in
`renderTransfer`). Concrete failures:

- book1/25, 75, 191, 256, 290, 331, 411, 471, 472 and others grant mission
  codewords on entry even when the player declines;
- book1/636, book2/135 and book5/435 automatically initiate every qualifying
  visitor into Tyrnai;
- book6/160 removes both Safety from Storms and the catastrophe certificate when
  the player owns both, although its prose says to choose one;
- book3/405 executes all twelve optional `<set dock=…>` actions in sequence, so
  the successful ship always ends at Yellowport; and
- book6/163 automatically surrenders the ivory-handled katana.

Render a standalone `force="f"` action as an explicit, once-per-visit action
instead of applying it on entry. Preserve conditional/roll gating and the
existing specialised transfer/payment controls. For sibling actions that form a
single choice (book6/160 and book3/405), enforce one selection; either add a
small generic choice controller or make the choice explicit in the source XML.
Forced/default narrative effects should keep the current automatic behaviour.

Add DOM/state tests for declining/accepting a mission, optional Tyrnai
initiation, choosing exactly one book6/160 protection, and selecting a non-final
dock in book3/405. Re-run all sections.

**Done (2026-07-10).** `renderPassive` now checks `force=` before the auto-apply
path: a visible `force="f"` passive node (`tick`/`gain`/`lose`/`set`/`adjustmoney`)
routes to a new `renderForcedOptional`, which renders it as a **once-per-visit opt-in
button** (`applyEffect` fires only on click, memoised by a `force@path` key) instead
of applying on entry. The check sits **after** the price/flag/hidden/payment gates so
the specialised controls still win; a survey confirmed no `force="f"` passive node
carries `hidden`/`price`/`flag`/`ability="?"`, so none are mis-routed. This fixes the
19 single opt-ins (mission codewords, the three Tyrnai initiations, the katana
surrender, book4/263's win/loss payouts) — they are no longer applied when declined.

Choose-one enforcement (`forcedChoiceGroup` + a per-visit `ctx.forcedChosen` map):
`<set dock=…>` `force="f"` siblings share one `'dock'` token (a ship docks at ONE
place — book3/405), and two-or-more `force="f"` `<lose>` under a shared parent form a
group keyed by that parent (book6/160's "cross off one"). Taking any member records
the choice and disables the untaken members ("You may choose only one"), so exactly
one option applies — book3/405 no longer runs all twelve docks to Yellowport, and
book6/160 no longer strips both protections. Forced/default effects (no `force=`, or
`force="t"`) keep auto-applying.

Pure render-layer change (no engine/state edits). Added 17 DOM assertions
(§1.25 accept/record + not-on-entry, §1.636 optional Tyrnai, §6.163 katana,
§6.160 choose-one + lock, §3.405 no auto-dock + pick-one + lock). Web-only — stamped
`26.07.10.1ab77d7`. Suite green: `RESULT ALL PASS pass=701 fail=0`.

---

## 75. Live `<tick>` forms for equipment, profession changes and patterned titles are incomplete/inert  — MEDIUM (engine/render/state)

*(Filed 2026-07-10 from the repository review.)* `applyTick` only modifies
equipment when `item=` is present with `addbonus`/`addtag`. It does not recognise
`weapon=`/`armour=`/`tool=`, `removetag`, `profession`, `titlePattern` or
`titleAdjust`; a recognized-looking tick with none of its handled attributes
falls through to the bare visit-box tick. Live effects broken by this include:

- six equipment ticks: book5/386 cannot select/tag/upgrade/clean up Targdaz's
  weapon, book6/731's +1 weapon boon is inert, and book6/135 cannot remove a
  `keep` tag from the weapon it breaks;
- book6/118 cannot make a former Priest choose a new profession and book6/731's
  Priest reward does nothing; and
- the three bokh mastery grants (book5/119, 172, 235) increment an internal
  `bokh` value only by coincidence (`titleValue=1`) and display `bokh (N)` rather
  than `titlePattern="Circle {0} Master of bokh"`. Book5/235 also misspells
  `titleAdjust` as `titalAdjust` in the source.

Extend the headless effect API to select the correct equipment kind using
`?`/name/tags/`using`, apply `addbonus`/`addtag`/`removetag`, and return a chooser
request when several possessions qualify. Support a single profession and a
pipe-list profession picker. Persist enough title pattern/value metadata to
render the current formatted title and honour `titleAdjust`; fix the XML typo.
Do not put these mutations in `render.js`.

Add focused tests for book5/386's full tag→bonus→cleanup cycle, book6/731's
weapon/profession outcomes, the five-way former-Priest choice in book6/118, and
two successive bokh grants displaying Circle 2. Rebuild data and run all sections.

**Done (2026-07-11).** Three parts, rules kept headless:
- **Equipment** — a shared `selectEquipment(el, state, eqAttr, cacheN, opts)` (engine.js)
  replaces the old item-only enchant. It selects by `item`/`weapon`/`armour`/`tool`
  (kind-filtered), narrowed by `tags=` and `using=` (wielded/worn), from the sheet or a
  `cache`; `*` = all, a name = those named, `?`/blank = one (the `opts.chooser` pick when
  several qualify, else the first). `applyTick` now applies `addbonus`/`addtag`/**`removetag`**
  to the selection — so book5/386 can tag → up/down-bonus → clean up Targdaz's weapon,
  book6/731's +1 boon works, and book6/135's `using="t" removetag="keep"` frees the broken
  weapon. `render.js` adds `needsEquipmentChoice`/`renderEquipmentChoice`: a bare
  `weapon="?"`/`item="?"` (no tags/using/cache) with >1 candidate shows an inline picker
  instead of defaulting.
- **Profession** — `state.setProfession` + an `applyTick` branch for a single
  `<tick profession="priest">` (book6/731); a pipe-list (`mage|rogue|…`) routes to a new
  `needsProfessionChoice`/`renderProfessionChoice` picker (book6/118 former Priest).
- **Patterned titles** — `state.adjustPatternedTitle(name, pattern, init, adjust)` +
  an `applyTick` `titlePattern` branch: a NEW title starts at `titleValue` (default 1),
  an existing one advances by `titleAdjust` (default 1), and the title record carries the
  `pattern` ({0}=value). `ui.js` renders it ("Circle 2 Master of bokh", not "bokh (2)");
  `sanitizeData` round-trips `pattern`. Fixed the `titalAdjust`→`titleAdjust` typo in
  `book5/235.xml` and rebuilt (only `book5.json` changed — 1 line; `meta.json` restamped).

Added 15 assertions (bokh Circle 1→2 + sheet render + titleValue≠titleAdjust + migration;
the §386 tag/bonus/removetag cycle; §135 `using` removetag; §731 profession=priest; DOM
two-weapon enchant picker; DOM five-way profession picker). Rebuilt data (pwsh 7) —
stamped `26.07.11.b048106`. Suite green: `RESULT ALL PASS pass=761 fail=0`.

---

## 76. Blessings are stored as inert labels — their reroll/combat benefits cannot be used  — HIGH (engine/combat/render/state)

*(Filed 2026-07-10 from the repository review.)* The corpus grants **95**
blessings and repeatedly defines their use, but the state stores only strings
and the sheet renders non-interactive chips. Roll/combat widgets never consult
them. As a result:

- CHARISMA/COMBAT/MAGIC/SANCTITY/SCOUTING/THIEVERY blessings cannot reroll a
  failed roll (e.g. book1/107, book2/13, book6/171/587/690);
- Luck cannot reroll any dice result, and Safe Travel cannot reroll a
  `random type="travel"` encounter (explicitly required by
  `JaFL-XML-Tags.html`);
- Defence through Faith cannot add +3 Defence for one chosen combat, and Divine
  Wrath cannot inflict its 1d pre-fight damage (book5/248/692/89, book6/94);
- ordinary blessings are never consumed by those uses; and
- book6/159's `permanent="true"` Safety from Storms is indistinguishable from an
  ordinary one, so permanence cannot be honoured when the blessing is used.

Model blessing metadata/consumption headlessly and migrate existing string-only
saves. After a failed relevant roll, offer a one-click blessing reroll that
replaces the result and consumes the blessing unless permanent; Luck applies to
all player dice and Safe Travel to travel rolls. Before/during combat, expose
the Defence and Wrath choices and consume them exactly once. Keep the existing
XML-driven storm/disease avoidance paths working and distinguish using a
permanent blessing from punitive "lose all blessings" effects. The view should
only render choices and dice, with eligibility/consumption in engine/combat/state.

Add unit/DOM tests for an ability reroll success/failure replacement, Luck on a
random roll, Safe Travel, +3 Defence for one fight, Wrath pre-damage, ordinary
consumption, permanent storm retention, save migration and duplicate prevention.
Re-run all sections.

**Done — core rerolls (2026-07-10).** Landed the metadata/consumption model and the
ability/Luck/Safe-Travel rerolls; the combat Defence-through-Faith / Divine-Wrath
choices were split into their own follow-up (**task 80**, fight-widget buttons)
per the agreed scope.

- **state.js** — blessings keep their string shape in `data.blessings`, with a new
  parallel `data.permanentBlessings` (canonical names). `addBlessing(b, permanent)`
  records/upgrades permanence and de-dupes; `removeBlessing` drops the marker too;
  `removeAllBlessings()` clears both (a punitive `<lose blessing="*">` removes even
  permanent ones); `isBlessingPermanent`; `useBlessing(b)` consumes unless permanent;
  `rerollBlessings({ability,success,kind,travel})` returns the spendable blessings —
  an ability blessing on a FAILED check of that ability, Luck on any roll, Safe
  Travel on a `random type="travel"`. `sanitizeData` migrates string-only saves
  (⇒ `permanentBlessings: []`) and keeps only canonicalised markers for held
  blessings (orphans dropped).
- **engine.js** — the grant path reads `permanent=` (`addBlessing(name, boolAttr(permanent))`
  — book6/159); the `<lose blessing="*">` path routes through `removeAllBlessings()`.
- **render.js** — a shared `appendBlessingReroll(widget, opts, reroll)` shows a
  one-click "Use your blessing of X to reroll" beneath a resolved roll; clicking
  consumes the blessing (unless permanent) and re-runs the SAME roll, overwriting the
  memoised result (so a pay-to-roll gate's flag is not re-consumed). Wired into
  `renderDifficulty` (ability + Luck on failure), `renderRankcheck` (Luck on failure),
  `renderTraining` (Luck on failure), and `renderRandom` (Luck always; Safe Travel on
  `type="travel"`). Only appears when the blessing is actually held, so the
  render-every-section scan (a blessing-less character) is unaffected.
- **ui.js** — a permanent blessing chips as "X (permanent)" so it reads distinctly.

Storm/disease/poison/injury immunity paths are untouched (still `<if blessing=…>` +
XML-driven `<lose>`). Added 22 assertions (metadata/permanence/consumption, alias
upgrade, lose-all, engine grant + lose-all, save migration + orphan drop,
`rerollBlessings` eligibility across ability/Luck/Safe-Travel, and a synthetic §T76
DOM reroll: a failed THIEVERY roll offers THIEVERY+Luck buttons, using THIEVERY
consumes it and re-rolls to success). Web-only — stamped `26.07.10.264f3fa`. Suite
green: `RESULT ALL PASS pass=684 fail=0`.

---

## 77. Selector-aware `<set item|cache …>` expressions ignore their selected item/cache  — HIGH (engine)

*(Filed 2026-07-10 from the repository review.)* `applySet` reads only `dock`,
`var`, `modifier`, `value` and `codeword`, then evaluates `value=` against the
player's global sheet. It ignores `item`/`weapon`/`armour`/`tool`, `tags` and
`cache` selectors. All **21** selector-aware set nodes therefore compute the
wrong value:

- sixteen light-source counters use `<set item="?" tags="…"
  value="matches">` across eight sewer/cave sections. `matches` resolves as an
  unset variable (0), so both counters compare equal and a candle is consumed
  even when a reusable light is available;
- book2/322's treasure risk reads purse Shards instead of cache `2.322.t`, so
  the vampire-bat roll does not reflect how much treasure was taken;
- book2/665's smithy payment and cached weapon/armour bonuses read the purse and
  currently equipped gear, producing the wrong roll modifier/upgrade cap; and
- book5/386 reads the wielded weapon bonus rather than the weapon tagged `Tz`.

Implement the checked-in SetNode selector semantics in `engine.js`: `matches`
counts matching items in the selected inventory/cache, `weapon`/`armour`/`tool`
resolve the selected possession's bonus, and sheet identifiers such as `shards`
resolve against `cache=` when supplied. Reuse `matchItemQuery`/the shared item
matcher and define deterministic/chooser behaviour for `?`; keep expression
parsing itself unchanged.

Add direct tests for item/tag match counts and cached Shards/equipment, plus
integration tests for book1/164 (lantern + candle does not burn the candle),
book2/322's risk modifier, book2/665's upgrade cap and book5/386's selected
weapon. Re-run all sections.

**Done (2026-07-10).** Implemented the checked-in SetNode selector semantics in
`engine.js`. `applySet` now builds a selector context (`setSelector`) from the
node's `item`/`weapon`/`armour`/`tool` + `tags`/`bonus` + `cache` and threads it
into `evalExpression(value, state, mode, sel)`. A new `sel` branch in the
identifier resolver mirrors JaFL `SetVarNode.resolveIdentifier`:
- `matches` → count of items matching the selector in the selected pool
  (`setSelectorMatches`, drawn from the named cache or the sheet, narrowed by
  kind/name/tag/bonus and reusing the shared `matchItemQuery`);
- `weapon`/`armour`/`tool` → the single selected possession's bonus
  (`setSelectorBonus`); when the selection is missing, ambiguous or the wrong
  kind it falls back to the wielded weapon / worn armour, **but only for a sheet
  lookup** — a cache lookup that misses reads 0 (no equipment fallback);
- `shards` → the named cache's money when `cache=` is set, else the purse.

When the node carries neither an item selector nor a cache, `setSelector`
returns `null` and resolution is unchanged (existing `<set>` behaviour and the
`resolveValue → evalExpression(str, state)` 2-arg callers are untouched).

The sixteen light counters now compare correctly (a reusable lantern gives
`lights > candles`, so §1.164's candle is not burned); §2.322's risk reads the
cache treasure taken; §2.665's `MoneyBonus`/`weaponbonus`/`armourbonus` read the
cache and the deposited item, capping the upgrade at `6 − bonus`; and §5.386
reads the `Tz`-tagged weapon rather than the wielded one. Added 14 `_test.html`
assertions (match counts; §5.386 selected-vs-wielded weapon; §2.665 cached
money/weapon/armour + upgrade cap + armour mirror; §2.322 risk modifier; §1.164
render — the "cross it off" block active only when candles == lights; a
no-cache-shards regression) covering the direct and integration cases the filing
asked for. Web-only change — stamped `26.07.10.fdc8a51`. Suite green:
`RESULT ALL PASS pass=663 fail=0`.

---

## 78. Validate numeric `<section name>` against its filename; fix five mismatched source files  — LOW (data/build)

*(Filed 2026-07-10 from the repository review.)* `build-data.ps1` validates that
each numeric source is well-formed and rooted at `<section>`, but does not check
the root's `name=` against the filename used as the JSON/navigation key. Five
ordinary numeric files currently disagree:

- `book4/461.xml` says `name="451"`;
- `book5/119.xml` says `name="172"`;
- `book5/270.xml` says `name="406"`;
- `book5/276.xml` says `name="137"`; and
- `book6/288.xml` says `name="287"`.

The contents are distinct from each namesake file, so these are metadata copy
errors, not intentional duplicates. The app currently labels sections from the
JSON key, masking the problem. Correct the five source attributes and extend the
build validator so a purely numeric filename must match `section@name`. Allow a
lettered continuation to use its printed parent number (`book5/609a.xml` has
`name="609"`) or document/validate that convention explicitly. Add a build-time
assertion, rebuild data and run all sections.

**Done (2026-07-11).** Corrected the five source `<section name>` attributes to match
their filenames (`book4/461` 451→461, `book5/119` 172→119, `book5/270` 406→270,
`book5/276` 137→276, `book6/288` 287→288). Extended the `build-data.ps1` validation
pre-pass: `Test-XmlDoc` now takes `$expectNames` and, for every bundled section file,
asserts `<section name>` matches its filename key. A purely numeric file must match
exactly; a lettered continuation may use **either** its full name or its numeric
prefix — the corpus is inconsistent (`book5/609a` uses `name="609"`, `book6/448a`
uses `name="448a"`), so both are accepted rather than rewriting those intentional
continuations. The gate caught `448a` on the first run, which is how the two-convention
split was found. Rebuild under **pwsh 7** left book1–3 JSON byte-identical (only
book4/5/6 changed, in the five sections + task 85's tag). `XML OK: 4377 files`;
suite green: `RESULT ALL PASS pass=778 fail=0`. README's "Regenerating the data" gate
note updated.

---

## 79. Keeping a preview or importing a save reports success when persistence fails  — MEDIUM (state/app)

*(Filed 2026-07-10 from the repository review.)* Task 7 made `save()` return
`false` and set `lastSaveError`, and new-game/save-and-quit callers surface it.
Two later entry points ignore that contract:

- `GameState.keep()` clears `ephemeral`, assigns a slot, calls `save()` and
  returns the slot even when the write failed. `keepDemo()` then toasts
  "Adventure saved."; because no `changed()` event fires, the existing save-error
  modal is not shown. The preview is also no longer ephemeral, so retrying is
  awkward.
- `importSave()` calls `gs.save()` without checking the result and returns
  `{slot, meta: loadSlotMeta()[slot]}`. The UI toasts `Imported “undefined”.`
  even though no save exists.

Make both operations transactional with respect to persistence: on failure,
preserve/revert the preview's ephemeral state and slot, and throw or return a
failure that the existing modal can display; an import must not claim a slot or
success without both save data and metadata. Reuse `lastSaveError`'s player-facing
message. Add tests with a throwing `localStorage.setItem` for keep/import, plus
recovery/retry tests. No app stamp is needed for the TASKS-only filing; when the
fix is implemented, stamp and run the full suite.

**Done (2026-07-11).** Both entry points are now transactional with respect to
persistence, reusing `save()`'s `lastSaveError` contract (task 7):
- **`GameState.keep()`** (`state.js`) captures the previous slot, promotes the
  game, then checks `save()`'s result. On failure it **reverts** (`slot` back to
  the old value, `ephemeral` back to `true` so the preview can be retried or
  exported) and **throws** `lastSaveError`. It only returns the new slot on a
  confirmed write.
- **`importSave()`** (`state.js`) now checks `gs.save()`; on failure it rolls back
  any partial write (`deleteSlot`, guarded) so no slot is half-claimed and
  **throws** `lastSaveError`, instead of returning `{slot, meta: undefined}` and
  letting the UI toast `Imported "undefined"`. It reads `meta` only after a
  successful save.
- **`app.js`** — `keepDemo()`'s existing catch now shows the storage message with
  a one-click **Export now** (the reverted game is still in memory, so export
  works); `importSaveFile()` already routed the throw to its "Import failed"
  modal.

Added 9 headless assertions (`_test.html`): with a throwing `localStorage.setItem`,
`keep()` throws, reverts to an ephemeral preview on its old slot, raises the "full"
message and writes nothing, then recovers once storage works; `importSave()` throws,
raises the message, claims no slot / writes nothing, then recovers with a real slot
and named meta. Web-only — stamped `26.07.11.27bfd95`. Suite green:
`RESULT ALL PASS pass=770 fail=0`.

---

## 80. Combat blessings: expose Defence through Faith and Divine Wrath on the fight widget  — MEDIUM (combat/render/state)

*(Split from task 76 on 2026-07-10.)* Task 76 landed the blessing
metadata/consumption model (`useBlessing`, `permanentBlessings`, migration) and the
ability/Luck/Safe-Travel rerolls, but deferred the two **combat** blessing benefits,
which the books define but the engine cannot yet apply:

- **Defence through Faith** (`blessing="defence"`, optional `bonus=` defaulting to 3)
  — add its bonus to the player's Defence for **one chosen combat**, then consume it
  (book5/248/692, book6/…); and
- **Divine Wrath** (`blessing="wrath"`) — inflict **1d** pre-fight damage on the enemy,
  then consume it (book5/89, book6/94).

The plumbing already exists to build on: `combat.js` reads a transient
per-fight Defence/attack bonus (`state.fightDefenceBonus()`/`fightAttackBonus()`,
task 49, cleared each section in `begin`), and enemy up-front damage has a
`preDamage` path (task 26). The agreed UX (from the task-76 scoping) is **buttons on
the fight widget**: when the player holds `defence`/`wrath` and a fight is unresolved,
show "Use Divine Wrath (1d damage)" / "Use Defence through Faith (+N Defence)"; a
click applies the effect (Wrath → reduce enemy Stamina by a 1d roll once; Defence →
set the per-fight Defence bonus for this fight) and consumes the blessing via
`state.useBlessing(...)` unless permanent. Keep the rules headless (a
`combat.js`/`state.js` helper decides eligibility and applies the effect; the view
only renders the buttons and the dice), and guard against using each benefit more
than once per fight.

Add DOM/headless tests: Wrath cuts enemy Stamina by the rolled 1d exactly once and
is then consumed; Defence raises the player's fight Defence by +3 (or `bonus=`) for
that fight only and clears on leaving the section; the buttons appear only while a
fight is unresolved and only when the blessing is held; a permanent such blessing is
not consumed. Stamp and re-run all sections.

**Done (2026-07-11).** Added two headless helpers to `combat.js`:
`useWrathBlessing(state, fight)` rolls 1d, cuts the enemy's Stamina (and any
`staminaLost` tally), fells it if that reaches the win threshold, marks `fight.wrathUsed`
and consumes the blessing (via `useBlessing`, so a permanent one survives — task 76);
`useDefenceBlessing(state, fight, bonus=3)` adds a per-fight Defence bonus through the
existing `addFightBonus('defence', …)` store (task 49, cleared on leaving the section —
so it lasts exactly one combat), marks `fight.defenceUsed` and consumes the blessing.
Both are once-per-fight (guarded by the fight-object flags) and no-ops without the
blessing. `render.js` `drawFight` renders "Use Divine Wrath (1d damage)" / "Use Defence
through Faith (+3 Defence)" buttons on an unresolved single-fight widget only when the
player holds the blessing — so a blessing-less character (the every-section scan) never
sees them; the "Your Defence" line now includes the per-fight bonus so the boost is
visible. Rules stay in `combat.js`/`state.js`; the view only renders the button and the
result. Added 13 assertions (Wrath 1d damage + fell + once + consume; Defence +3 + once
+ consume; inert without the blessing; DOM buttons shown-only-when-held, click applies +
consumes + removes the button, and the boosted Defence displays). Web-only — stamped
`26.07.11.54c1322`. Suite green: `RESULT ALL PASS pass=746 fail=0`.

Deferred (not needed by the corpus uses, which are single fights): the buttons are on
the single-fight widget only, not group fights — a group-fight Wrath would need a target
choice among foes. File a follow-up only if a group section is found to need them.

---

## 81. Ships: honour `todock=` and track which at-large ship is being sailed  — MEDIUM (state/render)

*(Split from task 73 on 2026-07-11.)* Task 73 landed the core dock/location model
(`data.location`, ship `docked`/`id`, `arriveAtDock`/`shipsHere`/`currentShip`/
`sailShip`, sail gating + chooser, buy-berths-at-dock, cargo/crew/dock routing). Two
pieces were deferred because they need a persistent "current vessel" pointer:

1. **`todock="X"`** (book1/176, book4/114) — "when the character leaves this section,
   any ships at sea the character isn't in move to dock X." This is only meaningful
   once we track *which* at-large ship the player is currently sailing (the others get
   sent to X). `Story.begin` reads the attribute but does nothing with it yet.
2. **Sailing-ship identity across sea sections** — `arriveAtDock` currently berths
   *every* at-large ship at the arrival dock (JaFL's own default). If the player gains
   a second ship while at sea (so two are at large), arriving berths both together
   instead of leaving the non-sailed one to be moved by `todock`. A
   `data.sailingShipId`, set by the sail action and cleared on docking, would let
   `arriveAtDock` berth only the sailed ship and let `todock` relocate the rest.

Implement a `sailingShipId` on state (set in `sailShip`, cleared when that ship
docks), make `arriveAtDock` berth only the sailed vessel (or all, if none is marked —
the single-ship common case is unchanged), and apply a section's `todock=` on leaving
to move other at-large ships. Keep it headless in `state.js`; thread only the
`todock` value through `render.js` (apply it in the navigate-away path). Add tests:
gain a ship at sea, sail one, arrive at a dock — only the sailed ship berths there and
`todock=` sends the other to the named port; a single-ship voyage is unaffected. Stamp
and re-run all sections.

**Done (2026-07-11).** Added `data.sailingShipId` (set by `sailShip`, cleared when the
ship reaches a dock). `arriveAtDock` now berths **only** the sailed ship while a voyage
is active (else every at-large ship — the single-ship case + loaded saves), and ends
the voyage on landfall. `applyTodock(dock, exemptId)` moves at-large ships to the dock
except the exempted one; `sanitizeData` keeps `sailingShipId` only when it names an
at-large ship.

The exit type drives the exemption, which the two `todock` sections need to differ on:
`Story.begin` records `sectionTodock`, and navigation is wrapped once in the
constructor — a **sail exit** (`sailThenGo`) sets `_sailExempt` to the ship taken, so
`todock` relocates only the OTHERS and the voyage continues (book4/114: pick one of two
ships, the other sails to Yarimura); a **non-sail exit** (gone ashore) exempts nothing,
so every at-large ship docks and the voyage ends (book1/176: go ashore → your ship is
noted at Yellowport; or sail on → it stays at large). Added 10 assertions (applyTodock
exemption, sail-marks/arrive-clears, save migration, and DOM §4.114 two-ship split +
§1.176 ashore-vs-sail). Web-only — stamped `26.07.11.05cddc7`. Suite green:
`RESULT ALL PASS pass=733 fail=0`.

---

## 82. Test harness: a duplicate top-level `const` in `run()` silently aborts the whole suite  — LOW (test infra)

*(Filed 2026-07-11 from experience adding tasks 73/81/75.)* Every assertion in
`web/_test.html` lives in one `async function run()` scope. Adding a test block that
reuses a `const`/`let` name already declared **anywhere** in `run()` is a *parse-time*
`SyntaxError` (e.g. "Identifier 'g53' has already been declared"), which aborts the
**entire** module before `run()` is ever called. The symptom is misleading: the page
stays at `#results = "running…"` with title `FL tests` (not `TESTS_OK`/`TESTS_FAIL`), so
the headless smoke check reports "no RESULT line" and it reads as a hang, not a failing
assertion. Diagnosing it requires re-running Chrome with `--enable-logging=stderr --v=1`
and grepping the console for the `SyntaxError`. This bit three times in one session
(g53/c53, g114/c114, and a near-miss), each costing a diagnostic round-trip.

Make the harness fail loudly and locally instead:
- Wrap each task's test block in its own block scope `{ … }` (or an IIFE) so its
  `const`s are local and a collision is impossible across blocks — the cheapest fix and
  it also documents block boundaries; **or**
- keep one scope but add a lightweight guard/step that surfaces a top-level parse error
  as a visible `FATAL` (e.g. load the module via a small bootstrap that catches the
  `error` event and writes it into `#results`), so the smoke check sees a failure rather
  than a hang; **and/or**
- add a build/CI check that the test module parses (a Node `--check`-style pass, or run
  it headless and assert the title becomes `TESTS_OK`/`TESTS_FAIL`).

No engine/data change. Add a note in `AGENTS.md`'s build+test section about the
symptom so the next contributor recognises "stuck at running…" as a duplicate
declaration. Re-run the suite to confirm the guard reports a synthetic collision as a
visible failure.

**Done (2026-07-12).** Added a small **classic** `<script>` in `web/_test.html`, placed
*before* the `type="module"` block (so it is registered even when the module fails to
compile), that listens for the window `error` event (bubble phase → catches script/parse
errors, not resource 404s). On a top-level abort it writes a visible
`RESULT FATAL pass=0 fail=1 / FATAL the test module did not load: <message> (file:line)`
into `#results` and sets the title to `TESTS_FAIL`, with a guard so it never clobbers a
suite that already reported. Verified by temporarily inserting a duplicate
`const SYNTHETIC_DUP_82` — the run reported
`RESULT FATAL … Identifier 'SYNTHETIC_DUP_82' has already been declared (_test.html:36)`
with title `TESTS_FAIL` (previously a hang at `running…`); reverted, and the healthy run
is unchanged (`RESULT ALL PASS pass=785 fail=0`, `TESTS_OK`). Also documented the symptom
in `AGENTS.md`'s build+test notes. Chose the bootstrap over wrapping every block in `{}`
(the cheapest generic safety net; many blocks are already block-scoped). Test-only, no
stamp.

---

## 83. Combat blessings (Wrath/Defence) buttons appear only on the single-fight widget  — LOW (render)

*(Split from task 80 on 2026-07-11.)* Task 80 added the "Use Divine Wrath (1d damage)"
and "Use Defence through Faith (+3 Defence)" buttons in `drawFight` (the single-fight
widget), where every corpus grant's *intended* use lives. But the blessings are
player-held and mechanically usable in **any** fight, so a player who holds one and
enters a simultaneous **group fight** (`drawGroupFight` — §6.192/273/291/618) cannot
use it: the buttons aren't rendered there. Divine Wrath is granted in book6 (§94) and
the group fights are all in book6, so the scenario is reachable, if uncommon.

Add the buttons to `drawGroupFight` too. Defence through Faith is target-agnostic —
reuse `useDefenceBlessing` unchanged. Divine Wrath needs a target among the living
foes: either extend `useWrathBlessing` to accept a specific `fight` (render one Wrath
button per still-standing foe, mirroring the per-foe Attack buttons) or let the player
pick. Keep the once-per-combat guard across the whole group (a single `wrathUsed`/
`defenceUsed` marker on the group, not per-foe). Add a DOM test: a group fight with a
Wrath holder shows the option, using it damages the chosen foe once and consumes the
blessing. Stamp and re-run all sections.

**Done (2026-07-12).** `drawGroupFight` (`render.js`) now renders the combat-blessing
controls, mirroring `drawFight`: one "Divine Wrath on <foe> (1d)" button per still-living
foe (target chosen like the per-foe Attack buttons), and one target-agnostic "Use
Defence through Faith (+3 Defence)". The once-per-combat guard lives on the group proxy
(`this.sectionFight.wrathUsed`/`defenceUsed`), not per-foe — `useWrathBlessing(state,
target)` damages the chosen foe while the click sets `sectionFight.wrathUsed`, and
`useDefenceBlessing(state, this.sectionFight)` marks the proxy; both consume the blessing
(so a non-permanent one also hides the buttons). Also folded in the task-87 counterpart
for the group `.you` line: it now shows `defence() + fightDefenceBonus()` (both single
and group resolution fold the bonus in via `playerDefenceFor`). Added 7 headless DOM
assertions (Wrath button per living foe; damages the chosen foe by 1d; consumed +
once-per-combat; Defence +3 + consumed + boosted display; blessing-less character sees
no buttons). Web-only — stamped `26.07.12.896c1f5`. Suite green on the first run:
`RESULT ALL PASS pass=785 fail=0`.

---

## 84. De-flake the "fight attack produces a log line" test  — LOW (test infra)

*(Filed 2026-07-11 from repeated flakes this session.)* The `web/_test.html`
assertion **`fight attack produces a log line`** (§105: click the fight `.btn-roll`,
`await` 900 ms, assert a `.fight-log div` exists) fails intermittently under headless
Chrome `--virtual-time-budget`: `rollButton`'s click handler `await animateDice(box)`
before `fightRound` runs, and the fixed 900 ms wait occasionally elapses (in virtual
time) before the log line is written. It failed on ~half the smoke runs this session
with no code change, so a genuine regression here could be dismissed as "the flake",
eroding suite trust (see the [[flaky-fight-log-test]] memory for the operational
"just re-run" guidance).

Make it deterministic: either stub/short-circuit `animateDice` in the test environment
(a hook or a near-zero duration), or drop the wall-clock `await` and assert on the
resolved state instead — e.g. after the click settles, check `fight.log.length` /
`state` directly rather than polling the DOM after a timeout. Confirm the assertion
passes on repeated headless runs. No engine change; test-only.

**Done (2026-07-11).** Investigating turned up **two** causes, not the one filed. (1)
`animateDice` is a `setInterval(70ms)×8`, which `--virtual-time-budget` occasionally
starves so the promise never resolves — fixed by using the existing
`window.__FL_INSTANT_DICE__` hook (animateDice returns `Promise.resolve()` with no
timer). (2) The deeper cause: the test reused the shared `gs`, whose Stamina had been
drained by earlier tests, so an unlucky `fightRound` roll sometimes **killed the player**
in one round; the handler then `rerender()`s the section and the running `.fight-log`
is gone (`log=0`). `drawFight` always renders `.fight-log` — including for a *won* fight
— so only the death path clears it. Fixed by giving the test a **fresh, 99-Stamina
state** that cannot die in one round (and dropping the 900 ms wall-clock wait for a
short poll). Verified deterministic: **5/5** clean runs at the default
`--virtual-time-budget=90000` (previously ~50% failure). Test-only, no stamp;
`RESULT ALL PASS pass=778 fail=0` each run. The [[flaky-fight-log-test]] "just re-run"
guidance is now obsolete — a failure here is a real regression.

---

## 85. book6/135 source: `tag="keep"` is a stray/misnamed attribute  — LOW (data)

*(Filed 2026-07-11 from task 75.)* `book6/135.xml` has
`<tick weapon="?" using="t" tag="keep" removetag="keep"/>`. `tag=` is not a recognised
tick attribute (the item-tag filter is `tags=`), so the engine ignores it. The effect
is nonetheless correct — `using="t"` already selects the wielded weapon and
`removetag="keep"` strips its `keep` tag — so this is cosmetic, not a bug. Clean it up
for clarity: drop `tag="keep"` (redundant with `using="t"`) or, if a filter was
intended, change it to `tags="keep"` (which would narrow to a keep-tagged wielded
weapon — verify that matches the section's intent before changing semantics). Since it
edits source XML, fold it into task 78's rebuild pass rather than a standalone build.
Confirm §6.135 still renders and removes the tag after the change.

**Done (2026-07-11, folded into task 78's rebuild).** Dropped the stray `tag="keep"`
from `book6/135.xml`, leaving `<tick weapon="?" using="t" removetag="keep"/>`. The
section comment ("modified so that even 'kept' weapons can be broken") confirms the
intent is to strip `keep` from the *wielded* weapon so the sibling
`<lose weapon="?" using="t"/>` can take it — which `using="t"` + `removetag="keep"`
already do; `tag=` was never a recognised attribute, so this is purely cosmetic. The
existing `§6.135 <tick weapon="?" using="t" removetag="keep">` assertion still passes.
Rebuilt with task 78; suite green (`RESULT ALL PASS pass=778 fail=0`).

---

## 86. Add a full-section render integration test for book5/386  — LOW (test coverage) — **done**

*(Filed 2026-07-11 from task 75.)* Task 75's equipment-tick tests exercise the
tag→+bonus→−bonus→removetag cycle with **synthetic** `<tick weapon="?" …>` nodes, which
covers the engine mechanics §386 depends on. It does not render the actual §386 section
end-to-end (tag one weapon → roll 2d vs the tagged weapon's bonus → the outcome table's
addbonus/removetag/destroy branches → the final `removetag="Tz"` cleanup). Add a DOM
integration test that begins §5.386 with a known weapon and drives the roll (stubbed
RNG) through a representative outcome, asserting the weapon's bonus/tags and the Shard
refund at bonus ≥ 6. This guards the wiring (visible vs hidden ticks, the `tags="Tz"`
selection after the first tag) that the synthetic tests don't. Test-only; re-run all
sections.

**Done (2026-07-11).** Added a DOM integration test for §5.386 (`_test.html`, five
assertions) that begins the real section and drives the roll. It pins two things:
(correct) the hidden `<tick shards="150">` refund fires **only** at bonus ≥ 6 (a +6
weapon → +150 Shards, and is not enchanted past its cap; a +2 weapon → no refund),
and the section renders its visible "one weapon" tick, two roll buttons and the goto
to 245. Driving the roll (stubbed 2d = 12) does **not** throw. It also documented a
real defect the end-to-end render surfaced that the synthetic ticks could not: the
weapon-enchant cycle never lands — see **task 88**. The test asserts the current
(unchanged-weapon) behaviour with a comment to update part (c) once 88 is fixed.
Test-only (no new stamp). Suite green: `RESULT ALL PASS pass=778 fail=0`.

---

## 87. Fight widget "Your Combat" omits the per-fight attack bonus  — LOW (render)

*(Filed 2026-07-11 from task 80.)* `drawFight`'s "you" line shows
`Your Combat ${state.ability('combat')}` but combat resolution adds
`state.fightAttackBonus()` (the `special="attack"` per-fight bonus — task 49; e.g.
book1/42's rat poison +3). Task 80 made the sibling Defence display accurate
(`state.defence() + state.fightDefenceBonus()`) but left Combat showing only the base,
so a player with an attack bonus sees a "Your Combat" value lower than what their rolls
actually use. Cosmetic — the resolution already uses the bonus (`playerCombat` in
`combat.js`). For parity, show `Your Combat ${state.ability('combat') + state.fightAttackBonus()}`
in both `drawFight` and `drawGroupFight`. Add/extend a DOM assertion that the displayed
Combat reflects a `special="attack"` bonus. Web-only; stamp and re-run all sections.

**Done (2026-07-11).** Both `drawFight` and `drawGroupFight` (`render.js`) now show
`Your Combat ${state.ability('combat') + state.fightAttackBonus()}` (single-fight
via a `shownCombat` local mirroring the existing `shownDef`), so the displayed
Combat matches `playerCombat` in `combat.js`. Added 3 headless assertions
(`_test.html`): a `<tick special="attack" bonus="3">` before a single `<fight>`
sets the bonus on entry and the widget's `.you` line shows base + 3; the group-fight
widget likewise shows base + 2. Web-only — stamped `26.07.11.4781047`. Suite green:
`RESULT ALL PASS pass=773 fail=0`.

---

## 88. book5/386: the hidden `removetag="Tz"` cleanup fires on entry, defeating the enchant roll  — LOW (render/engine)

*(Filed 2026-07-11 from task 86's end-to-end render.)* §5.386 (Targdaz the
weaponsmith) is meant to: tag one weapon (`<tick weapon="?" addtag="Tz">`), roll 2d
against its current bonus, and on the roll's success/`<outcomes>` branches raise,
lower or destroy **that tagged weapon** — then a final hidden
`<tick weapon="?" tags="Tz" removetag="Tz" hidden="t"/>` cleans up the tag. In the
single-pass render every passive/hidden effect applies **on entry**, so the cleanup
`removetag="Tz"` runs immediately after the `addtag`, stripping the tag *before* the
interactive roll resolves. When the roll's `addbonus="1"` (success) and the
`<outcomes>` `addbonus="-1"` / `<lose weapon>` (destroy) ticks later fire, their
`weapon="?" tags="Tz"` selector matches **no** weapon, so nothing happens — the
weapon never changes no matter what is rolled (verified end-to-end: a +2 weapon stays
+2 on a roll of 12 *and* on a roll of 2, and is never destroyed). The `<set var="bonus">`
and the bonus ≥ 6 Shard refund still work (they run before the strip / don't depend on
the tag). A secondary quirk seen in the same render: the roll buttons still show for a
bonus-6 weapon even though `<if var="bonus" lessthan="6">` should hide them (the roll
does nothing regardless). Fix: defer the hidden cleanup `removetag` until the section
is actually left (or until after the roll/outcomes resolve) so the tagged weapon
survives long enough for its own outcome ticks — likely a shared mechanism for
"end-of-section cleanup" hidden ticks. Related single-pass ordering limitations:
task 20 (lock/unlock bracket), task 61 (rerunnable `<set>` clobbers a roll var).
Then update `_test.html`'s §5.386 part (c) to expect the enchant/outcome to land.

**Done 2026-07-13.** A hidden `<tick removetag="X">` is now recognised as an
end-of-section tag cleanup (`isDeferredTagCleanup` in render.js) and **deferred to
the section exit** rather than applied on entry: `renderPassive` records it in
`this.deferredCleanups` (reset per visit), and the `navigate` wrapper (the single
"leaving" hook, alongside `todock=`) applies each recorded cleanup once on the way
out. So Tz stays on the chosen weapon for the whole visit — the `<if var="x"
greaterthan="bonus">` +1, the `<outcomes>` −1/`<lose weapon>` destroy all now match
it — and the tag is stripped exactly once when the player leaves, never leaking onto
the weapon for a later re-visit. §5.386 test rewritten: (c) a low roll (2-6) now
destroys the tagged weapon; (d) a high roll raises then the 7-12 outcome lowers
(net unchanged), the Tz tag survives mid-visit, and leaving via →245 strips it. The
secondary quirk (roll widgets shown grayed/disabled for a bonus-6 weapon under the
inactive `<if var="bonus" lessthan="6">`) is left as-is — it is the app's standard
inactive-branch rendering and does nothing. Suite green: `RESULT ALL PASS pass=966
fail=0`.

---

## 89. Ship actions still use remote vessels, and `<choice sail>` does not sail one  — HIGH (state/engine/market/render)

*(Filed 2026-07-12 from a full repository review.)* Tasks 73 and 81 added dock
state and made `<goto sail="t">` choose a local vessel, but the same invariant is
not applied consistently. All 29 live `<choice sail="t">` links go through
`renderChoice`, which neither requires a ship at the current dock nor calls
`sailThenGo`; a player can therefore leave port without a ship and a real ship is
not marked as the voyage's `sailingShipId`. `GameState.currentShip()` also falls
back to `ships[0]`, while `shipsHere()` treats `location === null` as matching every
at-large ship. As a result, inland/sea sections can act on an unrelated vessel.
The same leak appears in `market.js` (cargo buy/sell falls back from a local ship
to any ship; ship sales and inline cargo sales search all ships) and in
`evaluateCondition` (`ship`, `crew` and `cargo` search all owned ships, and the
`cargo` test ignores the requested cargo name). This changes rules, not just UI:
e.g. §1.586's storm dice can follow the type of a ship left elsewhere instead of
the one being sailed.

Define one current-vessel rule: at a dock use a vessel berthed there; during a
voyage use `sailingShipId`; inland with no explicit dock/current voyage has no
current vessel. Route ship/crew/cargo conditions, adjustments, inline actions and
market transactions through it, while preserving explicit `docked=` checks for
other ports. Make `<choice sail>` use the same gate/chooser/action as `<goto
sail>`. Add headless coverage with two ships at different docks and at sea:
remote cargo cannot be bought/sold, remote crew/cargo/type cannot satisfy a local
condition, the named cargo must match, the sailed ship drives §1.586, and both
choice/goto sailing set and later berth only that ship. Stamp and run all sections.

**Done (2026-07-12).** One rule, in `state.currentShip()`: at a dock → the first
vessel *berthed there* or **null** (the `ships[0]` fallback is gone); away from a
dock → the sailed ship (`sailingShipId`), else the first at-large ship (JaFL's
at-sea default — covers §4.658's replacement bought after a wreck and pre-pointer
saves), else null. `shipsHere()` keeps its JaFL shape (at a dock = berthed here;
at sea = the at-large flotilla, which §4.114's chooser needs) — the leak was the
*fallbacks*, not the flotilla. `arriveAtDock` now tolerates a stale voyage pointer
(sailed ship wrecked mid-voyage) by berthing all at-large ships. Routed through
the rule: `<if ship|crew|cargo>` (with `cargo` now matching the **named**
commodity, JaFL `Ship.hasCargo`; also added `cargo` to `KNOWN_IF_ATTRS` — it
warned as unrecognized), `<adjust ship|crew>`, `<tick crew|cargo>` (a recognized
attr with no vessel is inert, no box-tick fallthrough), and in `market.js` the
cargo buy/sell, ship sale, `ownsGoods` and inline `sellCargo` all scope to
`shipsHere()` — no any-owned-ship fallback. `<choice sail="t">` (29 live) now
gates on a ship here ("you need a ship here") and routes through the same
`sailThenGo` chooser/action as `<goto sail>`, so a real vessel is set at large,
`todock=` exemption applies, and landfall berths only it. Explicit `<if docked=>`
checks other ports as before.

Found while testing: **prose between branches broke the if/elseif/else chain** —
`appendChildren` reset the chain on any non-whitespace text, so §1.586's
"`</if>, <elseif>…, or <else>`" idiom re-armed the `<else>` after a *matched*
`<if>`, offering the barque's 1-die storm roll AND the galleon's 3-dice roll at
once (day-one bug, invisible to the shipless smoke scan). JaFL binds each
elseif/else to the nearest preceding if regardless of interleaved text; the
reset is removed (elements still break the chain). Also filed **task 103**
(§4.658 `initialCrew="oldcrew"` resets the salvaged crew to average).

Tests: +27 assertions (block-scoped) — two-dock isolation (conditions, market
buy/sell, ship sale, inline sellCargo), local-hold-full refusal, inland
no-vessel, named-cargo match, voyage-vs-prize pointer, §4.658 wreck→replacement→
landfall, DOM §1.586 both directions (sailed galleon rolls 3 dice; sailed poor
barque rolls 1 die and the remote excellent crew adds no bonus), DOM §2.33
choice-sail gate/sail/berth-only-that-ship, and a two-ship choice-sail chooser.
§3.405's setup modernised (the ship is mid-voyage there, not berthed at a third
port). Web-only — stamped `26.07.12.d70c943`. Suite green:
`RESULT ALL PASS pass=812 fail=0`.

---

## 90. Permanent Safety from Storms is deleted by storm-avoidance `<lose blessing>` nodes  — MEDIUM (engine/state)

*(Filed 2026-07-12 from a full repository review.)* Task 76 preserves a permanent
blessing only when callers use `state.useBlessing()`. `applyLose`, however, sends
every named `<lose blessing="…">` to `removeBlessing()`, which also deletes its
`permanentBlessings` marker. The live storm-avoidance paths (including
§5.232/502/716 and §6.160) use `<lose blessing="storm">`, so the permanent Safety
from Storms granted by §6.159 is consumed the first time it protects the player,
contrary to “you can use it any number of times” / “never used up”. Treat a named
blessing spent for its benefit as a use (permanent survives), while the explicitly
punitive `<lose blessing="*">` must still clear everything. Add a direct state
test plus an end-to-end permanent-storm path; retain coverage that an ordinary
Storms blessing is consumed. Web-only; stamp and run all sections.

**Done (2026-07-12).** `applyLose` (engine.js) now routes a NAMED
`<lose blessing="…">` through `state.useBlessing()` — a corpus audit confirmed
all 70 named nodes (storm/storms/disease/poison) are the blessing being spent
for its protection, so a permanent one survives ("never used up") and an
ordinary one is crossed off as before. The punitive forms are unchanged: `"*"`
(`removeAllBlessings`) and the `"?"` robbery pick still remove even a permanent
blessing. Tests: +7 — direct state (permanent survives the named spend incl.
the "storms" alias; `"*"` clears it; ordinary consumed) and end-to-end §1.586
(a permanent blessing protects through two consecutive storms with the →85
branch live; an ordinary one is used up by the first). Web-only — stamped
`26.07.12.f3b1db2`. Suite green: `RESULT ALL PASS pass=836 fail=0`.

---

## 91. COMBAT blessing cannot reroll an attack, and Defence blessing leaks between fights  — MEDIUM (combat/render/state)

*(Filed 2026-07-12 from a full repository review.)* Ability/training/random roll
widgets expose task 76's blessing reroll control, but combat attacks are resolved
inside `fightRound()` and never offer the COMBAT blessing described in §4.324
(“try again when you fail a COMBAT roll”). Separately,
`useDefenceBlessing(state, fight)` marks one fight as used but writes +3 to the
section-global `_fightBonus.defence`; if a section contains sequential fights,
later enemies inherit a blessing promised for “THIS fight only”. Make failed
player strikes rerollable exactly once through the COMBAT blessing without
duplicating the enemy turn or damage, and store the Defence blessing bonus on the
relevant fight/encounter (a simultaneous group remains one encounter), not the
whole section. Test failed/successful attack behaviour, permanent versus ordinary
COMBAT blessings, sequential fights, and group combat. Stamp and run all sections.

**Done (2026-07-12).** Two changes, both headless in `combat.js`:
- **COMBAT retry** — `playerStrike` flags a miss (`fight.lastStrikeMissed`); a new
  exported `rerollAttack(state, fight)` retries that strike once per round
  (`fight.attackRerolled`, both flags reset at the top of `fightRound`/
  `groupFightRound`) with NO repeated enemy reply, consuming the blessing via
  `useBlessing('combat')` (a permanent one survives and re-arms next round). The
  fight widgets offer "Use COMBAT blessing (retry your attack)" after a miss —
  in a group, against the foe that was missed.
- **Defence scoping** — `useDefenceBlessing` now stores the +3 on the fight
  itself (`fight.defenceBonus`, read by `playerDefenceFor` and the widget
  display) instead of the section-global `_fightBonus`, so sequential fights in
  one section no longer inherit a blessing promised for "THIS fight only". A
  simultaneous group stays one encounter: the view passes the members, each
  carries the bonus, and the members' stored bonus doubles as the durable
  once-per-combat guard (the group proxy is rebuilt every rerender).
  `<tick special="defence">` bonuses keep the per-section store (task 49) —
  unchanged.

Tests: +12 and three §80/§83 assertions updated to the per-fight model (the
global store now asserted UNtouched) — miss→retry (enemy stamina falls, the
player's does not, blessing spent), no second retry per round, a hit is not
retryable, a permanent blessing re-arms across rounds, +3 lands on the blessed
fight only (a same-section second fight takes the unblocked blow), and DOM
single + group retry flows. Web-only — stamped `26.07.12.e91b370`. Suite green:
`RESULT ALL PASS pass=848 fail=0`.

---

## 92. Eight live `<adjust>` variants are ignored or applied unconditionally  — MEDIUM (engine/books)

*(Filed 2026-07-12 from a full repository review.)* `adjustAmount()` understands
only `value`/`amount`, core abilities, rank/stamina and named counters;
`adjustApplies()` understands only god/profession/item/codeword/crew/ship. The
remaining live forms therefore produce wrong difficulties:

- §5.343/432 `titleVal="bokh" default="-1"` adds 0 instead of the title value or
  default;
- §4.411 and §5.527 rank `greaterthan=` bonuses apply unconditionally (and
  §4.411's `profession="1"` contradicts its Warrior prose and needs an XML fix);
- §4.63's `title="Nightstalker"` bonus applies to everyone;
- §5.79 `modifier="noweapon"` includes the weapon bonus, while §2.579
  `modifier="natural"` uses the effective rather than natural Stamina value;
- §6.736 `item="?" tags="light"` looks for a literal item named `?`, so its +2
  never applies.

Implement the attributes according to `JaFL-XML-Tags.html`, normalize the §4.411
source typo, and add focused calculation tests plus integration renders for these
eight nodes. Rebuild generated data, stamp, and run all sections.

**Done (2026-07-12).** Both halves implemented per the spec (engine.js):
- **`adjustAmount`** — `titleVal="T" [default="N"]` adds the title's stored value
  (bokh circles of mastery) or the default when unheld; `ability=` now honours
  `modifier=`: the six abilities resolve through `abilityForMode` (noweapon/
  notool/natural — §5.79's unarmed COMBAT), and `stamina` distinguishes
  `natural` (the written unwounded score — §2.579's reset) and `current` (the
  wounded value) from the default effective max.
- **`adjustApplies`** — `greaterthan=`/`lessthan=` turn the `ability=`/`name=`
  VALUE into the condition, with the contribution coming from `value=` (§4.411
  Rank > 3, §5.527 Rank > 5 — previously unconditional); `title=` is a has-title
  gate (§4.63 Nightstalker — previously everyone); `item="?" [tags=…]` routes
  through `hasItemMatch` (§6.736's any-light-source +2 — previously a literal
  item named "?"), name lists keep the exact match.
- **§4.411 source** — `profession="1"` normalized to `profession="Warrior"`
  (matching its prose); data rebuilt under pwsh 7 (book4.json + meta only).

Tests: +18 — unit (titleVal held/default, rank greaterthan/lessthan both ways,
title gate, noweapon vs full score with a +2 weapon, stamina natural=20 vs
current=5 vs effective=22 under a +2 aura) and integration on the shipped nodes
(§6.736 with/without a light source, §4.411 Warrior/Rank 5/good crew = +3 vs
Rogue/Rank 1/poor crew = −1, §5.343 bokh −1/+3, §5.527 galleon/excellent/Rank 6
= +3). Stamped `26.07.12.6aa9e84`. Suite green: `RESULT ALL PASS pass=866
fail=0`.

---

## 93. Item group provenance and rolled `itemAt=` losses are not represented  — MEDIUM (state/engine/render/books)

*(Filed 2026-07-12 from a full repository review.)* Awarded possessions discard
their XML `group=`, and item conditions/losses ignore that selector. Thus
§5.118's `<if item="?" group="5.238" greaterthan="1">` counts unrelated carried
items, §3.132/413 can consume the wrong same-named treasure map, and §5.578's
required donation can remove an unrelated possession instead of one of that
mission's three rewards. The two rolled `<lose itemAt="x">` nodes (§6.63/168) are
also unsupported; because `itemAt` is absent from the pending-variable check they
can memoize a no-op before the roll resolves. Finally §5.14 has the lone source
typo `<lose items="*" shards="*">`, so its total confiscation leaves every item.

Persist award provenance, honor `group=` in possession count/selection/removal,
defer `itemAt` until its variable exists and remove the one-based Adventure Sheet
entry, and normalize §5.14 to the supported singular attribute. Add tests for
same-named items from different groups, group-restricted `?` choice/removal,
rolled indices including out-of-range values, and §5.14. Rebuild, stamp, and run
all sections.

**Done (2026-07-13).** Awarded possessions now carry their XML `group=`:
`makeItem()` gained a `group` field (state.js), threaded from both award sites in
`render.js` (`renderItemAward`, `grantChoosableReward`) and preserved by
`sanitizeItem()` across save/load. `matchItemQuery(items, pattern, tags, group)`
applies a final group filter to *both* the `?`/blank and concrete-name branches;
`applyLose` group-filters its item candidates the same way, and `evaluateCondition`'s
item path passes `group=` through. So §5.118's `<if item="?" group="5.238"
greaterthan="1">` counts only the §5.238 tomb haul, §3.132's `<lose>` crosses off
just the §3.94 map (not a same-named map from elsewhere), and §5.578's donation is
drawn from that mission's three rewards. Rolled `<lose itemAt="x">` (§6.63/168) is
a new `applyLose` branch that removes the 1-based sheet entry at the rolled index
(out-of-range → no-op, per §6.168 "the compass without losing anything"); `itemAt`
was added to `pendingRollVar`'s QTY list so the loss defers until the `<random
var="x">` rolls instead of memoizing a no-op with x=0. §5.14's lone source typo
`<lose items="*" shards="*">` was normalized to the supported singular `item="*"`.

Tests: +19 (block-scoped) — group round-trips through `makeItem`/`sanitizeData`;
the §5.118 count is group-scoped (1 vs 2 group items, 2 unrelated ignored);
same-named §3.94 vs other-island maps don't collide on `<if>` or `<lose>`; §5.578
donation removes one of three group items (chooser offered only those three, and
the no-chooser default) while the unrelated heirloom survives; `itemAt` removes the
x-th entry and no-ops out of range; §6.63 renders inert until the die rolls then
forfeits exactly one possession; §5.14 source uses singular `item="*"` and the
botched teleport empties both possessions and cash. Rebuilt (book5.json +1 line),
stamped `26.07.13.08a83f4`. Suite green: `RESULT ALL PASS pass=886 fail=0`.

---

## 94. `quantity=` is ignored on rewards, cargo ticks and market stock  — MEDIUM (engine/market/render)

*(Filed 2026-07-12 from a full repository review.)* Quantity caps exist for
inline `<buy>`, but `renderItemAward` grants only one possession and memoizes it
even on the 14 live item/weapon/armour awards with `quantity=`. This includes
variable rewards such as §1.561's `x` fish and §4.425's `x` lots of 1000 Shards,
which currently award only one. §3.569's `<tick cargo="textiles" quantity="2">`
loads one unit, and §6.655's one available barque can be purchased repeatedly
because `<trade quantity="1">` does not cap stock.

Resolve numeric/variable quantities consistently: award or load the requested
number subject to carry/cargo capacity, keep uncollected units available where
the player must choose capacity, and enforce trade stock per visit. Test fixed
and rolled item quantities, quantity currency items, partial capacity, two cargo
units, and a one-ship market row. Stamp and run all sections.

**Done (2026-07-13).** `renderItemAward` (render.js) now honours `quantity=` as a
per-visit countdown: each click takes ONE unit (tallied in a new `ctx.awardCounts`
keyed by path) up to the resolved quantity, so a possession award can be picked up
partially when the 12-item cap bites and the rest stay available (§6.257 twelve
nuggets, §3.16/339 three swords, §6.375 two axes). A rolled quantity (§1.561 x
fish, §4.425 x·1000 Shards) waits for its `<random var>` — `quantity` was added to
`pendingRollVar`'s QTY list, and the award renders a disabled "Roll first" button
until the die resolves, rather than granting x=0 and memoising it. Currency awards
(§4.425) bank their value per click with no slot cost; the choose-one grant path
(`grantChoosableReward`) honours quantity too (§4.634's two-ink-sac barter option).
`<tick cargo>` (engine.js) loads `quantity=` units onto the current vessel, capped
by hold capacity — §3.569 loads 2 textiles, and a full hold refuses the overflow
(imported `SHIP_TYPES` for the capacity). `renderShopRow` (render.js) enforces a
per-visit stock cap via a new `ctx.stock` tally: §6.655's lone salvaged barque
sells once then shows "Sold out" instead of being re-buyable. (Inline `<buy
quantity=>` caps were already handled by task 23's `ctx.buys`.)

Tests: +19 (block-scoped) — §6.375 two-axe countdown (one/two taken, then closed);
partial capacity (1 free slot takes 1 axe, holds the 2nd, re-arms when a slot frees);
§1.561 fish award disabled pre-roll then live for exactly x units; §4.425 gold lots
bank x·1000 Shards using no slots; `<tick cargo quantity=2>` loads 2 on a brigantine
and 1 on a barque (cap); §6.655 barque bought once then sold out. Web-only; stamped
`26.07.13.c6bb64c`. Suite green: `RESULT ALL PASS pass=905 fail=0`.

---

## 95. Item `replace=` rewards add a duplicate instead of transforming the possession  — MEDIUM (state/render)

*(Filed 2026-07-12 from a full repository review.)* All five live replacement
awards are rendered as ordinary additions. §5.118 therefore leaves the bag of
gold/plain silver flute/plain black axe in inventory while adding their converted
forms; §6.207 leaves the old royal sceptre; and §6.448a leaves the cursed sword.
The conversion can also be refused at the 12-item cap even though it should not
consume an extra slot. Implement JaFL `replace=` atomically: a named value replaces
that matching possession, while empty `replace=""` replaces the same-named item,
preserving the new node's kind/bonus/ability/tags and not changing slot count.
Disable/refuse only when the required source item is absent, and make the action
visit-safe. Add coverage for all three shapes above and a full-inventory case.
Stamp and run all sections.

**Done (2026-07-13).** `renderItemAward` (render.js) now detects `replace=` and hands
off to a new `renderReplaceAward`, which transforms the matching possession in place
rather than adding a duplicate. The target is the named `replace="X"` or, for empty
`replace=""`, the reward's own name (the same-named item is upgraded). On click the
old possession is removed and the new one added — or, for a "N Shards" reward
(§5.118 bag of gold → 2000 Shards), its value banked — so the slot count never rises
and the 12-item carry cap can't refuse the conversion. The row is disabled while the
source item is absent (you cannot transform what you do not hold), and is memoised
(`ctx.applied`) so a re-render never re-transforms. The transformed item keeps its
provenance group (the reward's own, else the source's) so §5.118's group-scoped
count stays stable across the swap. Covers §5.118 (flute/axe `replace=""`, bag of
gold → currency), §6.207 (sceptre → +5 tool), §6.448a (cursed −2 sword → clean +2 —
removing the −2 blade is itself the curse lift, per §6.677's forced weapon).

Tests: +12 (block-scoped) — §5.118 all three transforms (in-place, no duplicate,
slot count steady, currency banked and a slot freed, rows checked-off after);
§6.207 same-name sceptre upgrade; §6.448a cursed→clean sword; a full (12-item)
inventory still allowing the net-zero replace; and a source-absent row disabled.
Web-only; stamped `26.07.13.1f6b585`. Suite green: `RESULT ALL PASS pass=917 fail=0`.

---

## 96. Hidden item rewards inside `<group>` choices are never granted  — MEDIUM (render)

*(Filed 2026-07-12 from a full repository review.)* The group-choice effect
collector applies `lose`, `tick`, `gain`, `set`, `curse`, `rest` and `goto`, but
not the item family. Consequently the hidden quest rewards in §1.228 and §1.509
(`gold chain mail of Tyrnai`) and §4.189 (`mirror of the Sun Goddess`) record the
group choice/codeword but never enter inventory. Extend group resolution so hidden
`item`/`weapon`/`armour`/`tool` rewards use the normal award transaction exactly
once, including capacity handling, without showing a second independent Take
button. Add end-to-end tests for these three choices. Stamp and run all sections.

**Done (2026-07-13).** `renderGroup` (render.js) now collects the group's
`item/weapon/armour/tool` children alongside its `lose/tick/gain/set/curse/rest`
effects, and grants them on the group-action click through a new headless
`grantItemNode` helper (mirrors `renderItemAward`'s grant minus the widget): a "N
Shards" reward banks its value, a possession is added when a slot is free (12-item
cap), and any `<curse>/<disease>/<poison>` child bites on pickup. Because the group
collapses to a single button, the hidden reward never renders its own Take button,
so there is no double-grant. A corpus check confirmed the only item-family-in-group
cases are exactly the three hidden quest prizes (§1.228/509 gold chain mail of
Tyrnai, §4.189 mirror of the Sun Goddess), so the change is surgical. The
roll-bundled group variant (`renderGroupWithRoll`) needs no change — none of these
sit inside a rolled group.

Tests: +10 (block-scoped) — for each of §1.228/509/189: the group action renders,
the reward is ungranted until clicked, there is no separate Take button, and the
click grants the item exactly once and sets the quest codeword; plus a full-pack
case proving the 12-item cap is respected (no 13th item) while the codeword still
records. Web-only; stamped `26.07.13.f82fedd`. Suite green: `RESULT ALL PASS
pass=927 fail=0`.

---

## 97. Molhern's `itemcache` ignores its `<include>` / `<exclude>` filters  — LOW (render/state)

*(Filed 2026-07-12 from a full repository review.)* §2.617 is the only filtered
item cache: it should store one weapon or suit of armour for the smith, excluding
already `Molherned` equipment and items at bonus 6+, before §2.665 returns it.
`renderItemCache` currently offers every possession and ignores both include and
exclude children, so ordinary items, already-worked equipment and maxed equipment
can all enter the flow. Apply the declared type/tag/bonus filters to the eligible
list while preserving `itemlimit="1"` and the existing return path. Add a focused
DOM/state test with eligible and rejected possessions. Stamp and run all sections.

**Done 2026-07-13.** `renderItemCache`'s deposit list now honours the cache's
`<include>`/`<exclude>` children (JaFL `Node.modifyItemMatches`): with includes
present it starts each item out and lets includes add, then excludes remove — later
filters win, per document order. An eligible possession gets an enabled *Store*
button; a *candidate* of the right kind that an exclude rejects shows a **disabled**
button titled with that filter's `reason=` ("Molhern has already worked on this
item!", "This item is good enough already!"); an item that matches no include at all
(an ordinary item) is not offered. `itemlimit="1"` and the §2.665 return path are
unchanged. The kind/tag/bonus matching is a new DOM-free `engine.filterMatches(pool,
el)`, factored out of the existing `<set>`-selector matcher (`matchesSelectorPool`)
so both share one implementation. Focused DOM/state test on §2.617 covers an
eligible weapon + armour, a Molherned and a bonus-6 rejection (each with its reason),
a hidden ordinary item, and storing one weapon hitting the itemlimit. Suite green:
`RESULT ALL PASS pass=972 fail=0`.

---

## 98. Resurrection arrangements ignore replacement, supplemental and hidden semantics  — MEDIUM (state/render)

*(Filed 2026-07-12 from a full repository review.)* Every Arrange click blindly
pushes another entry. Ordinary arrangements should replace the prior ordinary
deal, while §6.355's `supplemental="t"` arrangement should append; the attribute is
currently ignored. The same offer can be clicked repeatedly, buying duplicate
lives, and §1.616's `hidden="t"` resurrection is rendered as a manual offer rather
than registered automatically by its death flow. Implement standard-versus-
supplemental replacement, once-per-visit purchase/registration and hidden auto-
registration, with costs/effects applied exactly once. Verify revival consumes
the intended arrangement and leaves valid supplemental deals in order. Stamp and
run all sections.

**Done (2026-07-13).** Semantics taken from the original engine
(`java-engine/flands/ResurrectionNode.java` + `Adventurer.addResurrection`, reference
only): a resurrection with `book`+`section` ARRANGES a deal; one with no section is a
"use your deal" trigger. `GameState.addResurrection` (state.js) now replaces any
existing *standard* deal when a new standard one is arranged, while a
`supplemental="t"` boon (§6.355) is appended and never displaces the standard — so at
most one standard deal coexists with any number of supplementals. The `supplemental`
flag is threaded through `buyResurrectionDeal` (engine.js) and persisted by
`sanitizeData`. `renderResurrection` (render.js): a visible arrange offer is armed
once per visit (memoised `res@path`, button becomes "☑ Resurrection arranged") so it
can't be re-clicked to stockpile duplicate lives; a `hidden="t"` offer with a section
(§3.351 Island of Rebirth) auto-registers on entry exactly once with no button; a
no-section resurrection is left as narrative prose. The five death-revival groups
(§3.123/560/6.140/1.680 erase-all, §1.616 lose-ship) — a `<group>` bundling a
no-section `<resurrection/>` with the price of return — now, on the group action,
apply the losses, consume the earliest deal (`reviveWithResurrection` → half max
Stamina) and turn to that deal's own section, instead of ignoring the resurrection
child and stranding the erased player. The choose-one grant path also passes
`supplemental`.

Tests: +15 (block-scoped) — standard-replaces-standard, supplemental-appends, a
further standard replacing only the standard while keeping the supplemental, revival
consuming the earliest and leaving the rest ordered, and a save round-trip of the
supplemental flag; §4.428 arrange armed once (spent button, no duplicate lives);
§3.351 hidden auto-registration on entry with no button and re-entry keeping exactly
one; and the §3.123 revival group erasing possessions/money/ship, consuming the deal,
reviving at half Stamina and navigating to the deal's section. Web-only; stamped
`26.07.13.6da614c`. Suite green: `RESULT ALL PASS pass=942 fail=0`.

---

## 99. `<fightround>` effects are detached manual widgets instead of combat-round rules  — HIGH (combat/engine/render)

*(Filed 2026-07-12 from a full repository review; split from task 32's explicit
passthrough list.)* The three live `<fightround>` sections (§5.24/383/689) attach
rolls and conditional effects to each exchange of a fight. The generic recursive
renderer instead exposes their children as independent widgets, so the player can
skip, repeat or resolve them at the wrong point; combat outcomes and potentially
lethal Stamina changes diverge from the book. Parse these nodes into the DOM-free
combat model and execute their body at the specified phase of every completed
round, exactly once per round, with variables/branches resolved in that round's
context. Add deterministic headless tests for all three sections plus a render
test proving there is no detached manual roll. Stamp and run all sections.

**Done (2026-07-12).** `applyEffectBody` (engine.js) grew into a full round-body
executor: it now honours `<success>/<failure>` branches — matched by their `var=`
(the margin an earlier roll stored; an unwritten var fires nothing, task 50's
rule) or by the walk's last roll — and a `<goto>` ends the walk and is *returned*
(`{goto}`) for the caller to navigate; rolls and effect notes stream into a
supplied log. `combat.fightRound(state, fight, dmgNode, roundNode)` executes the
section's `<fightround>` exactly once per round — `pre="t"` before the exchange
(§5.24's choking, which can kill before a blow lands), else after it, and only
while the fight is undecided — recording any `fight.roundGoto`. The view
(render.js) finds the node like `<fightdamage>`, renders it **inert** (prose, no
live widgets — `renderInert` replaces `renderChildrenOnly`), threads it through
`drawFight`/redraws, and follows `roundGoto` (single and group fights).

Two adjacent live bugs fixed by the same walker upgrade: **§5.489/565/631's
per-wound SANCTITY save** — the old walker descended into `<failure>`
unconditionally, so the Avenger's Bite curse landed on *every* wound regardless
of the roll (now gated); and **§4.238's "if you get wounded, →184"** — the
`<fightdamage>` goto was inert (now redirects the fight).

Tests: +17 (block-scoped) — §5.24 pre-round choke (margin damage, `hang` var,
log line, successful-save no-damage), §5.383 post-round save (after the
exchange; skipped once the demon falls), §5.689 failed save records →7 with the
armour penalty applied, §5.489 curse gated both ways, §4.238 wound redirect, and
DOM: both §5.24/§5.689 fightrounds render inert (no detached/enabled roll), the
§5.24 Attack applies the round rule through the widget with the save in the
fight log, §5.689's Attack navigates to §7. Web-only — stamped
`26.07.12.a2cabcb`. Suite green: `RESULT ALL PASS pass=829 fail=0`.

---

## 100. The two live `<while>` loops execute only one rendered pass  — MEDIUM (engine/render)

*(Filed 2026-07-12 from a full repository review; split from task 32's explicit
passthrough list.)* §5.218 and §6.700 rely on `<while>` to repeat their rules until
the encoded condition changes. The default recursive renderer walks the body once,
so repeated damage/roll/escape logic can stop early. Implement loop evaluation in
the DOM-free engine, advancing effects in order and re-evaluating the condition
after each iteration; interactive rolls must resume the loop rather than creating
all iterations at render time. Add deterministic termination tests for both live
sections and an iteration guard that reports malformed non-progressing content
instead of freezing the page. Stamp and run all sections.

**Done 2026-07-13.** `renderWhile` (render.js) walks one iteration per completed
pass plus the current live one, each under its own `~i` path namespace so its
roll/effects/branches memoise independently; `activeRoll` is reset per pass so a
shared `<success>/<failure>` binds to that pass's roll. A pass advances only when
its interactive roll resolves (the roll renderers set `whileIterPending`), and a
resolved `<random>` re-asserts its var each render (`state.restoreVar`) so §6.700's
per-iteration `<lose stamina="x">`/`<if var="x" equals="6">` read *that* six even
after the live value moves on; `pendingRollVar` treats a var re-rolled this pass as
stale (via `whileIterPendingVars`). The terminal test is the DOM-free
`engine.whileLoopDone` (loop until the var is *assigned*, per JaFL WhileNode). A
live, unterminated loop sets `this.blocked` (JaFL holds execution until the loop
ends — §5.218 hides the troll fight until you wriggle free; §6.700 hides the →529
exit until the six-damage stops), and a 100-iteration guard `console.warn`s and
aborts a non-progressing body. Variables are now cleared on section entry
(`state.clearVars`) so the loop var starts undefined (JaFL vars are section-local).
Headless end-to-end tests drive both sections deterministically (§5.218 via a
cursed/boosted COMBAT ability, §6.700 via forcing seeds 4→6 and 7→1). Suite green:
`RESULT ALL PASS pass=963 fail=0`.

---

## 101. §5.114's `<sectionview>` oracle cannot display its referenced section  — LOW (render)

*(Filed 2026-07-12 from a full repository review; split from task 32's explicit
passthrough list.)* The lone `<sectionview>` is currently reduced to its child
text, so the oracle feature in §5.114 cannot show the requested section while
keeping the player in place. Implement a read-only section preview that resolves
the requested book/section, renders its prose in an isolated view, and cannot
apply effects, mutate navigation/history, expose interactive controls or change
the current visit. Add a DOM test confirming both preview content and zero state
mutation. Stamp and run all sections.

**Done 2026-07-14.** `renderSectionview` (render.js) renders the tag's inner words
as a `.sectionview-link` (text taken via `textContent`, never `appendChildren`, so
its own body applies nothing) that opens `openSectionView` — an isolated popup
(built directly, not via `modal()`, which closes on any button) revealing one random
section's prose at a time, up to the `random=` count, then a Close. Section prose is
rendered by a new exported `previewProse(el)` that walks the parsed element keeping
only paragraphs and inline emphasis (`<b>/<i>/<u>`) and recurses every other tag for
its words alone — mirroring `app.renderStatic` but kept in the view layer (no
app-shell import cycle) and operating on the shared cached parse without mutating it.
The oracle touches no game state: it reads no `state`, calls `getSection`/`loadBook`
(data layer) and `bookTitle` only, arms no controls, and never navigates or changes
the current visit. DOM test on §5.114: the link renders; `previewProse` shows the
section prose ("priestess") with `<p>`s and zero controls; opening the oracle yields
an isolated popup (caption + prose, no controls) while the player's section,
navigation and full state JSON are unchanged. Suite green: `RESULT ALL PASS pass=979
fail=0`.

---

## 102. §1.338's standalone `<price>` does not charge for or complete the poison cure  — LOW (books/render)

*(Filed 2026-07-12 from a full repository review.)* This is the only `<price>`
element in the six books and it has no renderer/effect handler; generic recursion
shows its text but never arms a payment, deducts Shards or activates the linked
flagged cure. The healer therefore cannot complete the advertised transaction.
Check the source against the JaFL tag reference and normalize §1.338 to the
project's supported payment/flag nodes (prefer an XML correction over a one-off
view rule if `<price>` is invalid legacy markup). Add an end-to-end test for
insufficient funds, one successful 25-Shard payment and poison removal exactly
once. Rebuild, stamp, and run all sections.

**Done 2026-07-14.** `<price>` is legacy JaFL markup — `PriceNode.java`'s own
comment says `LoseNode` (a `<lose>` with a `price=` attribute) "handles pretty much
everything… so this class can be removed". So this was an XML correction, not a new
view rule: §1.338's `<price shards="25" flag="p">25 Shards</price>` became `<lose
price="p" shards="25">25 Shards</lose>` — the project's standard paid-purchase cost
form (65 such nodes in the corpus), armed by the existing `renderOptionalPay`. The
linked `<lose poison="?" flag="p">` cure was previously applying **free on entry**
(its `flag=` reward branch only defers when a `[price="k"]` **attribute** node
exists, and the old `<price>` was a tag, not an attribute); now the cost node
carries `price="p"`, so the cure is correctly deferred and applied only on payment.
End-to-end test: with < 25 Shards the Pay button is disabled ("Not enough Shards")
and nothing happens on entry; paying deducts exactly 25, cures the poison and
restores the ability; the button then locks so the cure can't be bought twice. Data
rebuilt with pwsh 7 (only book1.json's §338 line changed). Suite green: `RESULT ALL
PASS pass=986 fail=0`.

---

## 103. §4.658: `initialCrew="oldcrew"` ignores the `oldcrew` variable — the salvaged barque's crew resets to average  — LOW (market)

*(Filed 2026-07-12 while implementing task 89.)* §4.658 (the Disaster Bay wreck)
stores the lost ship's crew with `<set var="oldcrew" value="crew"/>` — the `crew`
expression keyword yields a 1-based `CREW_LEVELS` index — and then buys the
replacement with `<buy ship="barque" initialCrew="oldcrew" …>`. But
`market.canonCrew()` treats any string that is not a literal crew grade as a
keyword and maps `"oldcrew"` (and blanks) straight to `'average'`, so a poor,
good or excellent crew is silently reset to average, and the section's follow-up
one-grade upgrade (`<if crew="poor">…` / `<elseif crew="average">…`) then starts
from the wrong grade. This is the only `initialCrew="oldcrew"` in the corpus.
Fix: in `canonCrew` (or at the `applyInlineBuy`/`goodsFrom` call sites), resolve
the value as a variable/number first — `resolveValue` → `CREW_LEVELS[n-1]` —
and only then fall back to the keyword mapping (`none`→poor, blank→average).
Add a headless §4.658 end-to-end test: wreck a GOOD-crew brigantine at sea, buy
the barque, assert it starts with a good crew and that the upgrade offer shown
is good→excellent. Web-only; stamp and run all sections.

**Done 2026-07-14.** `market.canonCrew` now takes an optional `state` and, when the
value is not a literal grade or `none`, resolves it as a variable/number first
(`resolveValue` → `CREW_LEVELS[n-1]`) before the `average` fallback — so
`initialCrew="oldcrew"` (a 1-based crew index that `<set var="oldcrew" value="crew"/>`
captured from the wrecked ship) maps back to its grade. `state` is threaded through
the two `initialCrew` call sites (`buyTrade`, `applyInlineBuy`); the crew-*upgrade*
sites keep their literal grades. `none`→poor / blank→average / literal-grade
fallbacks are unchanged. Tests: `applyInlineBuy` with `oldcrew`=3 yields a good crew
and the fallbacks still hold; the §4.658 end-to-end wrecks a good-crew brigantine at
sea, salvages the barque (keeps GOOD, not average), shows the good→excellent upgrade
(not from average), and applying it makes the crew excellent. Web-only. Suite green:
`RESULT ALL PASS pass=993 fail=0`.

---

## 104. Travel rolls don't gate the section's onward choices; a "get lost" outcome doesn't suppress them  — **done**

*(Filed 2026-07-14 from playtesting §1.278 and §1.82.)* The overland/river/sea
travel idiom is a **mandatory** `<random>` → `<outcomes>` → a sibling `<choices>`
block of onward destinations. `render.js` drew the `<choices>` independently of
the roll, so (1) the destinations were live *before* the encounter die was
rolled — you could leave without rolling — and (2) a "get lost" outcome carrying
its own `<goto>` (§1.278 → 82, §1.548 → 474) didn't stop the player ignoring it
and picking a destination anyway.

**Scope — the whole corpus, keyed structurally, not on `type="travel"`.** There
are exactly 20 sections with both `<outcomes>` and `<choices>`: 14 book-1
`type="travel"` sections **plus** five with an untyped mandatory `<random>` that
have the identical bug — book1/668 (mining), book2/136 (lepers), book3/335 &
book3/607 (safe-keeping "each time you return, roll"), book5/136 (rent, where a
choice's `shards="rent"` cost is *set by the roll*). The 20th, **§5.674**
(physician cure), is the counter-example that must **not** be gated: its roll is
optional — pay-gated (`<random flag="c">`, a "pay to spin" cost) and inside an
`<if shards="25">` — so declining and leaving via a choice has to stay possible.
The ~185 other travel sections resolve entirely via outcome-`<goto>`s (no onward
`<choices>`), so there is nothing to gate there.

Fix — a general roll gate mirroring `fightGate` (`web/js/render.js`):
- **`computeRollGate(sectionEl)`** (run in `render()`) returns a gate only when a
  section has an `<outcomes>` table fed by a **mandatory** `<random>` before it —
  one with no `price=`/roll-gate `flag=` (excludes §674's pay-to-spin) and not
  inside an `<if>`/branch/`<group>` wrapper (`ROLLGATE_OPTIONAL_WRAP`, also
  excludes §674) — *and* there is onward `choice`/`goto`/`return` nav after the
  roll that sits **outside** the `<outcomes>` (`ROLLGATE_OUTCOME_WRAP`) and isn't
  a `flee="t"` choice. Empty nav ⇒ null (pure roll-to-goto travel is untouched).
- **Tagging** — `renderRandom` records the gate roll's positional `rollPath`;
  `renderBranch`'s `<outcomes>` case records the `matchedOutcome`; the three nav
  renderers (`renderGoto`/`renderReturn`/`renderChoice`) call a new
  `tagRollNav` (beside `tagFightNav`) to mark `data-rollnav`.
- **`applyRollGate(flow)`** (after `applyFightGate`) disables the tagged nav while
  the roll is unresolved; once resolved it stays suppressed iff the matched
  outcome carries a redirect (a `<goto>` child or `section=`), else it unlocks.
  It only ever *adds* a disable, so it composes with the fight gate — a
  fight-in-outcome section (§1.87/§1.299/§1.60/§1.673) stays gated on **both** the
  roll and the fight.

Verified: 11 new headless assertions — §278 (four choices gated pre-roll; roll of
1 → only the `→82` redirect, destinations suppressed; a fresh visit rolling 4 →
all four unlock, no forced goto), §1.668 (a non-travel mandatory roll gates its
choices too, then unlocks), and §5.674 (`rollGate === null`; its three choices
stay live and untagged beside the optional cure roll) — plus the full
render-every-section scan. `RESULT ALL PASS pass=1004 fail=0`.

---

## 105. `<if ticks="N">` reads the live count — this visit's own `<tick/>` flips the guard on a mid-visit rerender  — **done**

*(Filed 2026-07-14 from playtesting §1.496; §1.310 is the same idiom.)* The
standard box idiom is `<if ticks="1">…goto X immediately…</if> If not, <tick/>,
and read on.` `evaluateCondition`'s `ticks=` handler (`engine.js` ~L211) tested
the **live** `state.tickCount()`. On entry the `<if>` (first child) is walked
before the bare `<tick/>`, so it correctly saw `tickCount = 0`, hid the redirect,
and the `<tick/>` then set `tickCount = 1` (task 27 caps it; task 70 draws the
box ☑ this visit — intended).

The defect appeared on any **mid-visit rerender**: §496 lets you take a
`<weapon name="magic spear">`, whose Take button calls `rerender()` → `render()`
(not `begin()`, so `tickCount` stays 1). On that re-walk `<if ticks="1">` now
matched, so *"If there is a tick in the box, [→317] immediately."* wrongly
appeared on the **same visit**, alongside the loot and the real `→85`. §310 shows
*only* the box-ticked-on-entry display (task 70's intended behaviour) because it
has no rerender trigger — no functional defect there; that display is by design.

Root cause: JaFL processes the section sequentially (the `ticks` guard is read
once, before the `<tick>`, and the section is never re-run within a visit); the
port's rerender-in-place re-evaluated the guard against the now-incremented count.

Fix — evaluate the guard against an **entry snapshot**:
- **`state.js`** — new transient `setEntryTicks(n)` / `entryTickCount()`. The
  snapshot is null/undefined ⇒ `entryTickCount()` falls back to the live
  `tickCount()`, so direct headless `evaluateCondition` calls (task 27's
  guard-eval) are unchanged.
- **`render.js`** — `begin()` snapshots `setEntryTicks(this.state.tickCount())`
  once per visit (before `render()` walks the children / runs the `<tick/>`), so
  it survives in-place rerenders but a genuine re-entry re-snapshots. Uses the
  no-args box key — the same one `addTick` and the guard use — and the position
  is already current (navigate calls `goTo` before `begin`).
- **`engine.js`** — the `ticks=` handler now reads `state.entryTickCount()`.

Verified: 5 new headless assertions on §496 (entry ticks the box yet the ticks=1
redirect stays inactive; taking the spear rerenders without flipping the guard;
the spear is taken; a genuine second visit *does* activate the →317 redirect) +
the existing task-27/task-70 tick tests still green + the full every-section
scan. `RESULT ALL PASS pass=1009 fail=0`.

---

## 106. Light mode is force-darkened on Chrome/Edge — Chromium "Auto Dark Theme" not opted out  — MEDIUM (css)

*(Filed 2026-07-14 from a mobile bug report; narrowed after the reporter
confirmed light mode is correct in Firefox but wrong in Chrome **and** Edge.)*
The theme *mechanism* is fine: `index.html` sets `data-theme` before first paint,
the header toggle persists `fl-theme`, and the reading surfaces re-skin via the
`--reading-bg`/`--card`/`--field`/`--ink` tokens overridden under
`:root[data-theme="dark"]`. Firefox (Gecko) renders light mode correctly.

Chrome and Edge are both Chromium (Blink), and both wrongly darken light mode:
**Chromium's "Auto Dark Theme" (force-dark)** algorithmically darkens the page
when the OS/browser is in dark mode, unless the page opts out. `style.css` *tried*
to opt out — `:root { color-scheme: light }` with a comment to that effect — but
that value does **not** disable force-dark: Chromium only skips a page whose
declared `color-scheme` **contains `dark`** or uses the **`only`** keyword. A bare
`color-scheme: light` marks the page light-*only* and is exactly what force-dark
targets, so the light surfaces got inverted/darkened. The app's *dark* theme was
unaffected (`color-scheme: dark` contains `dark`, so it was already opted out) —
which is why only light mode looked broken.

**Fixed 2026-07-14.** Changed the light `:root` declaration to
`color-scheme: only light;` (the documented Chromium opt-out) and rewrote the
comment to explain the `only` keyword is required. Dark theme's `color-scheme:
dark` is unchanged. Web-only, so `stamp-version.ps1` bumped the build/SW cache
key (→ `26.07.14.edcd53d`) — the reporter must let the Chrome/Edge PWA pull the
new bundle (close/reopen or clear site data) for the fix to take. Suite green:
`RESULT ALL PASS pass=993 fail=0`. (Force-dark is a browser-chrome feature the
headless scan can't exercise; the run only confirms the CSS change renders
cleanly — verify the actual light/dark appearance on-device.)

Not part of this fix, kept as a design note: the `.game-header`, adventure sheet
`.sheet-pane`, `.toast`, and title/create/saves screens are hard-coded
leather-dark in **both** themes by design (they don't use the re-skinnable
tokens). On mobile the sheet is a full-screen drawer, so opening it still shows
dark even in light mode. If lightening the chrome in light mode is wanted, file a
follow-up: tokenize those surfaces (a `--chrome-bg`/`--chrome-fg` pair per
`data-theme`), and optionally make `<meta name="theme-color">` follow the theme.

---

## Review log

*Running audit log of the backlog — each pass re-verifies the open items against
the current code and records what was filed, split, or re-confirmed. Task
numbers refer to the contents checklist at the top of the file.*

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
