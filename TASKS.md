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
- [ ] 56. `hidden="t"` payments render a phantom "Pay" button instead of arming silently
- [ ] 57. Adventure Sheet: curses all display as "curse"; diseases/poisons invisible
- [ ] 58. Market `<sold>` hooks match the shop row's tags, not the sold item's
- [ ] 59. `<tick god=…>` drops `<effect>` children — Sig initiates never get +1 THIEVERY
- [ ] 60. Affliction `<effect>` forms `divide`/`target`/`stamina` inert; item `<curse>` children never attach
- [ ] 61. book6/628: the rerunnable `<set>` clobbers the roll's var — inn rest/dysentery never fires

**LOW**
- [ ] 9. Centralise tag dispatch into a registry
- [ ] 10. Dice RNG quality / reproducibility
- [ ] 11. Harden the per-visit memoization assumption
- [ ] 12. Add headless unit tests for the extracted rules
- [ ] 13. Optional: build-time XML validation
- [ ] 32. Implement or explicitly stub the remaining unhandled tags
- [ ] 33. Narrate sections without `<p>` wrappers (TTS)
- [ ] 34. Finish moving rules out of the view layer
- [ ] 35. iOS home-screen icons: provide PNG apple-touch-icon
- [ ] 36. Minor rule divergences (grab-bag)
- [ ] 37. Fix the `safeAddGodd` typo in the source XML
- [ ] 38. Gate cache widgets on `lock`/`unlock` under the single-pass render (book1/91 gamble)
- [ ] 39. Defer confiscate-and-return `<transfer … from=>` until a fight resolves (book2/462)
- [ ] 42. `<rest>` (and other roll/action children) inside a `<group>` are ignored
- [ ] 44. Fold the ring of ultimate power's `Rank`/`Stamina` auras (book5/564)
- [ ] 62. Render `<image file=…>` and use-effect images (map of Bazalek, book3/75)

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

## 9. Centralise tag dispatch into a registry  — LOW (maintainability)

Tag handling is spread across two hand-rolled switches (`render.js`
`renderElement`, `engine.js` `applyEffect`). For ~40 tags this is fine, but a
single table `tag → { render, applyEffect, condition }` would make adding a tag a
one-place change and mirror the Java `Node.createChild` factory (minus the
UI coupling).

---

## 10. Dice RNG quality / reproducibility  — LOW

`engine.js` rolls with `Math.random()` — uniform and unbiased for 1–6 (no modulo
bias), statistically fine for play, but **not seedable**. A small seedable PRNG
(and a `?seed=` hook) would enable reproducible replays and deterministic tests;
`crypto.getRandomValues` would raise entropy quality if ever wanted. Not required
for correctness.

---

## 11. Harden the per-visit memoization assumption  — LOW

`render.js` memoises applied effects / rolls by a node path (`basePath + '.' +
idx`). This is safe today because the XML tree shape is static per visit. Add a
comment (and ideally an assertion) noting that any future feature which
conditionally reorders siblings would break effect-dedup.

---

## 12. Add headless unit tests for the extracted rules  — LOW

`web/_test.html` renders every section (catches throws) but doesn't assert
combat/economy outcomes. Now that `combat.js` / `market.js` / `engine.applyRest`
are DOM-free, add focused tests: a fight to the death, an over-Defence miss,
a `<fightdamage>` application, buy/sell with the 12-item cap and cargo capacity,
and rest healing (fixed + dice). (Partial coverage already exists — the suite
has ~94 assertions incl. a fight-termination loop, a market sell round-trip and
blessing purchases — so scope this to the listed gaps.)

---

## 13. Optional: build-time XML validation  — LOW

`build/build-data.ps1` bundles section XML unchecked. A lightweight schema/lint
pass (or wiring the render-every-section smoke test into the build) would catch
malformed sections before deploy. The smoke test already covers most of this.

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

## 32. Implement or explicitly stub the remaining unhandled tags  — LOW

Tags with no handler in either switch that still occur in the corpus:
`<extrachoice>` (7× — book1/122's "note this option" never surfaces at §1.10),
`<field>` (6×), `<while>` (2×), `<fightround>` (3×), `<sectionview>` (1×).
Implement per spec where feasible; otherwise add an explicit, commented no-op
case per tag (so the default-case recursion of task 21 can become strict) and
note the gap here. (`<adjustmoney>`/caches → task 20, `<poison>`/`<disease>` →
task 19, `<sold>` → task 29.)

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

## 37. Fix the `safeAddGodd` typo in the source XML  — LOW

One `<if safeAddGodd="…">` exists in `books/` — a misspelling of `safeAddGod`.
Task 17 made `evaluateCondition` accept `safeAddGodd` as an alias so the section
works, but the source XML is the true fix: correct the attribute name in the
offending `books/book*/*.xml`, rebuild the data, and then the engine alias can be
removed. (Find it with `grep -rl 'safeAddGodd' books`.)

---

## 36. Minor rule divergences (grab-bag)  — LOW

Small confirmed divergences to sweep in one pass, each with a test:
- `applySpecial` (engine.js) gaps: `bonus="s"` parses NaN→0 (book6/183);
  `godless` doesn't clear the current god (book6/118); `armourlock`/
  `weaponlock` and `difficultyCurse`/`difficultyRestore` (one-die difficulty
  rolls, book3/91 — pairs with task 19) are unimplemented. (`lock`/`unlock`
  cache locks are now implemented — task 20.)
- `useCache` fights (combat.js:56–58) add the cached weapon's bonus to the
  enemy's **Combat only** — `best('armour')` is 0 for a weapon-only cache — but
  book6/656 says to add the given weapon's COMBAT bonus to the Warrior Maid's
  COMBAT **and Defence**, and JaFL's `FightNode` adds `combatRaise` to both.
  With a +2 sword given she should be Combat 10 / Defence 18, not 10/16.
  *(Found 2026-07-07.)*
- Anything newly discovered of similar size should be appended here rather
  than left in conversation (per the workflow in `AGENTS.md`).

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

## 42. `<rest>` (and other roll/action children) inside a `<group>` are ignored  — LOW

Found while doing task 30. `renderGroup` (render.js) collects only
`lose, tick, gain, set, curse` as the group's on-click effects, so a `<rest>`
child is silently dropped. In book6/628 the "regain 1 Stamina point"
`<group force="t">` wraps `<text>` + `<rest stamina="1"/>` + `<lose flag="x"/>`:
clicking it clears the flag but **never heals** the Stamina point. Any
`<difficulty>`/`<random>`/`<rankcheck>` inside a group is likewise unrun (e.g.
book3/680's "make a MAGIC roll" group holds the `<difficulty>` inline). Fix:
either apply an inner `<rest>` on the group click (headlessly via
`engine.applyRest`) and run any inner roll, or lift such children out of the
group so they render as their own widgets. Add a §628 heal test.

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

## 44. Fold the ring of ultimate power's `Rank`/`Stamina` auras (book5/564)  — LOW

Found while doing task 41. The item aura system (`state.auraBonus`) folds aura
effects into `ability()`/`defence()`, which covers every aura/wielded effect in
the corpus **except** the ring of ultimate power (book5/564), whose three auras are
`ability="*" bonus="1"` (all abilities — handled), `ability="Rank" bonus="2"` and
`ability="Stamina" bonus="10"`. The Rank and Stamina auras are **not** applied,
because Rank and Stamina aren't derived through `ability()` — they are read as
`state.data.rank` / `state.data.staminaMax` in many places (Defence, rank checks,
the sheet). Wiring them would mean routing every rank/stamina read through an
accessor that adds `auraBonus('rank')`/`auraBonus('stamina')` (and clamping current
Stamina when the ring is dropped). It affects exactly one legendary late-game item,
so it was deferred. Fix: add `state.rankValue()`/`state.staminaMaxValue()` (base +
aura) and route Defence, `rollRankCheck`, `<adjust ability="rank|stamina">`, the
`abilityForCheck` natural path and `ui.renderSheet` through them; on removing an
aura item, re-clamp current Stamina to the new max. Add a §5.564 test (carrying the
ring raises Rank by 2 and Stamina max by 10; dropping it restores both).

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

## 56. `hidden="t"` payments render a phantom "Pay" button instead of arming silently  — MEDIUM

`renderRollPayment` (render.js:688–715) and `renderOptionalPay`
(render.js:645–672) never check `hidden=` — `renderPassive` honours it only on
the plain-effect path (render.js:431/437). JaFL executes a hidden price node
silently on entry (one arming per visit). Seven sections show a bare, unlabelled
"Pay"/"Confirm" button the player must discover: book1/597, book2/122,
book3/472, book3/680, book4/127, book5/365, book6/630 — and because the button
is gated purely on the flag, it can be re-clicked for unlimited re-arms within a
visit where JaFL grants one. Interacts with task 51 (these hidden prices arm the
either-or difficulty rolls). Fix: a `hidden="t"` payment auto-fires once per
visit with no widget; cap re-arms accordingly. Test: §6.630 shows no Pay button
and the rolls are armed exactly once on entry.

---

## 57. Adventure Sheet: curses all display as "curse"; diseases/poisons invisible  — MEDIUM

`ui.js:183` renders `d.curses.map((c) => c.type)` — the literal word "curse" for
every entry (afflictions are stored `{name, type, …}`) — and **nothing renders
`d.diseases` or `d.poisons` at all**. A player afflicted with Ghoulbite
(book1/196) or Scorpion Poison (book1/532) sees nothing on the sheet while the
penalty silently depresses their abilities; multiple curses are
indistinguishable. Fix: chip by `c.name` (fall back to type) and add Diseases /
Poisons sections beside Curses. Test: renderSheet output lists an inflicted
disease by name.

---

## 58. Market `<sold>` hooks match the shop row's tags, not the sold item's  — MEDIUM

`soldMatches` (render.js:1659–1664) tests the *row descriptor's* tags (built
from `buytags=`), not the tags on the possession actually sold. In book3/318 the
free-goods rows carry `buytags="318.free"` and the hook is `<sold item="?"
tags="318.free"><tick codeword="3.318.sold"/></sold>` — JaFL matches the sold
**item instance's** tags, so only goods actually obtained free there are marked.
Actual: selling *any* bonus-1 armour or bonus-0 weapon through those rows (e.g.
the leather jerkin many characters start with) fires the hook, and book3/20
routes to book3/372 — pelted with cobblestones, `<lose stamina="1d">`, and loss
of the "Saviour of Vervayens Isle" title, as punishment for a legitimate sale.
(The book3/86 row-level `<sold>` is fine.) Fix: pass the sold possession into
`runSoldHooks` and match its own tags/name. Tests: §3.318 selling starting
leather doesn't tick `3.318.sold`; selling the free leather does.

---

## 59. `<tick god=…>` drops `<effect>` children — Sig initiates never get +1 THIEVERY  — MEDIUM

`applyTick`'s `god=` path (engine.js:512–568) never reads `<effect>` children,
and the group-click path likewise applies only the tick. book1/437 and book2/334
initiate the player with `<tick god="Sig"><effect ability="thievery"
bonus="1"/></tick>` — "add 1 to your THIEVERY score, as Sig will watch over your
pilfering activities". JaFL attaches the effect to the god on initiation and
removes it on renunciation. Actual: the bonus is never granted. Fix: store
god-linked effects (e.g. in `data.effects` with a `source: god` marker folded
into `effectBonus`) and strip them whenever that god is lost (renounce,
`godless`, `<lose god=…>`). Tests: initiate → THIEVERY +1; renounce → restored.

---

## 60. Affliction `<effect>` forms `divide`/`target`/`stamina` inert; item `<curse>` children never attach  — MEDIUM

`readEffects` (engine.js:716–728) reads only `ability` + `bonus`, and
`firstAbility` rejects `stamina`, so four book-5 afflictions do nothing:
- **book5/198** `<curse name="Champion's Curse"><effect ability="combat"
  divide="2"/></curse>` — "fight the champion at half your COMBAT score" →
  recorded with zero effect; fought at full COMBAT. (JaFL
  `AbilityEffect.createAbilityDivider`.)
- **book5/238** the stone-bracelet trap item carries that curse as an
  `<item><curse…>` child — `renderItemAward` never reads a `<curse>` child, so
  taking the bracelet is harmless; the trap doesn't exist.
- **book5/705** `<effect ability="charisma" target="1"/>` — "CHARISMA falls to 1
  … until the curse is lifted" → `target=` unsupported, curse inert.
- **book5/306** `<poison…><effect ability="stamina" bonus="-6"/></poison>` —
  "lose 6 Stamina permanently … until you find a cure" → dropped.
Fix: extend the affliction-effect records to `{bonus | divide | target}` +
`ability="stamina"`, honour them in `afflictionBonus`/`ability()` (divide after
bonuses; target pins; stamina hits `staminaMax` while afflicted), and attach
`<curse>` children at item award (curse joins the sheet when the item is taken).
Tests: one per section above.

---

## 61. book6/628: the rerunnable `<set>` clobbers the roll's var — inn rest/dysentery never fires  — MEDIUM

Task 25 made an absolute `<set value=…>` re-evaluate on every render
(render.js:510) so roll-derived vars stay correct — but book6/628 uses
`<set var="y" value="7"/>` as a *sentinel* ("not yet rolled"; JaFL sets it once
on entry) before a pay-gated `<random dice="1" flag="x" var="y">`, then branches
`<if var="y" lessthan="6">` (rest +1 Stamina) / `equals="6"` (dysentery).
After paying and rolling, the rerender re-applies `y=7` **before** the if-chain
evaluates, so neither branch ever activates: the player pays 1 Shard a day and
rolls, but never heals (nor risks dysentery). This is the only corpus collision —
every other `<set>` sharing a var with a roll sits in a mutually exclusive
branch (book2/138, book3/43/102/149/304/642/653, book6/480). Fix: don't re-run a
`<set>` whose var a roll has written this visit (track roll-written vars in
`ctx`, which task 50 needs anyway). Test: §6.628 pay → roll 3 → the rest branch
heals 1.

---

## 62. Render `<image file=…>` and use-effect images (map of Bazalek, book3/75)  — LOW

`render.js:352–354` reads `src|name` off an `<image>`, but the corpus uses
`file=` (plus `title=`/`book=`), so the inline image in book3/75 never renders;
and `applyEffectBody`/`useItemEffect` have no `<image>` handling, so the map of
Bazalek's `<effect type="use" verb="Read">…<image …/></effect>` Use button is a
no-op — the item's sole purpose (viewing the island map) is inaccessible. Fix:
read `file=` (resolve against the owning book's asset folder) and let a use
effect surface an image (e.g. the existing image modal). Test: §3.75 award
carries the use effect and Read produces an image element.
