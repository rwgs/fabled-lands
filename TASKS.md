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

**HIGH**
- *(all clear — 20, 21, 23 done)*

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
- [ ] 40. `<market currency="…">` alternate-currency markets
- [ ] 41. Item `<effect>` system (use/aura/wielded/ability) and `<sold>` sell-hooks

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
- [ ] 43. price/flag "choose one" purchases over-apply every linked reward

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

## 40. `<market currency="…">` alternate-currency markets  — MEDIUM

Split from task 29 (part 2). `<market currency="Mithral">` (book2/495, the Trau
trader) currently deducts **Shards** — `market.js`/`renderShopRow` have no
`currency=` support. Note that in the shipped corpus there is no way to *acquire*
Mithral (no `<item name="Mithral">`, `<gain>` or `<adjustmoney currency=…>`), so
the practical bug is only that the market wrongly lets you spend Shards; a correct
implementation should let the player spend/receive only the named currency (of
which they have none → nothing is buyable). Options: (a) a named-currency pool
`state.data.currencies[name]` threaded through `buyTrade`/`sellTrade`/`renderShopRow`
(clean, general — also lets a future section grant Mithral), or (b) the minimal
fix — disable buy buttons in a non-Shards-currency market and price them in that
currency. Prefer (a); add tests (buy refused with 0 Mithral; a granted Mithral
pool lets a buy through and is debited; Shards untouched).

---

## 41. Item `<effect>` system (use/aura/wielded/ability) and `<sold>` sell-hooks  — MEDIUM

Split from task 29 (part 5). The ~54 `<effect>` children of items are inert at
award and purchase (`applyItemEffect`, engine.js, is a stub), and `<sold>` rows
are unhandled. Concretely:
- **`type="use"`** (39×) — a usable item (book4/111 potions raise an ability;
  book5/549 Vade Mecum; `<effect type="use" uses="1" verb="Drink"><rest/></effect>`
  potion of restoration heals all Stamina). Needs: item effects stored on the
  possession (extend `makeItem` + the award/buy call sites so `<effect>` is
  preserved, not discarded), a **Use/Drink** affordance in the Adventure Sheet
  (`ui.js renderSheet` — add an `onUse` callback wired from `app.js`), the effect
  applied via `engine.applyEffectBody` (honouring an inner `<goto>` use-target),
  and `uses=` consumption (remove/decrement when spent).
- **`type="aura"`** (11×) / **`type="wielded"`** (2×) — passive ability effects
  while the item is carried/worn; fold into `state.ability()` like afflictions.
- **`type="ability"`** (2×) — a permanent ability change applied at award.
- **`<sold>`** (book3/86/318) — a child of an `<item>`/`<market>` holding actions
  that fire **when the good is sold** (e.g. `<tick codeword="3.86.sold"/>`); run
  them from the sell path (`market.sellTrade` / the inline sell), matching
  `item=`/`tags=` for a market-level `<sold>`.
Cover each effect type + the sell-hook with headless unit tests.

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

## 43. price/flag "choose one" purchases over-apply every linked reward  — MEDIUM

Found while doing task 30. For a *non*-roll price/flag purchase,
`renderOptionalPay` applies **every** `[flag="k"]` node on a single payment. When
the linked rewards are a "choose one" menu this grants them all:
- **book6/171** (`price="y"`, 60 Shards) — "choose the blessing you want … [one
  of charisma, combat, magic, sanctity, scouting, thievery]" currently grants
  *all six* blessings for 60 Shards.
- **book5/152** (`price="curse1"`) — "for each curse you want lifted, pay …"
  currently lifts *every* listed curse from one payment (and `price="curse2"`).

The Java engine renders each linked reward as its own enabled action that the
player activates individually once the flag is set (`LoseNode`/`TickNode` flag
listeners), consuming the flag as it fires. Port that: after a `price=` payment
sets flag `k`, reveal the `[flag="k"]` rewards as click-to-apply options (or a
chooser) rather than auto-applying the lot; a single-reward flag (book2/202
storm) still auto-applies as today. Add tests (§171 grants exactly one chosen
blessing for 60; §152 lifts exactly one curse per payment).
