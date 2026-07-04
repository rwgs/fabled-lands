# Fabled Lands — Web Edition · Engineering TODO

Backlog of recommended improvements, ordered roughly by impact. Work the first
open (`- [ ]`) item; the numbered sections below hold the detail for each.

- [x] 1. Gate combat progression / model fight outcomes
- [x] 2. Finish the logic/view split (combat/market/rest)
- [ ] 3. Fix multi-attribute `<if>` conditions — HIGH
- [ ] 4. Prevent silent save-slot overwrite — HIGH
- [ ] 5. Implement `<items group … limit="N">` "choose up to N" pickup — MEDIUM
- [ ] 6. Harden save import and migration — MEDIUM
- [ ] 7. Surface persistence failures to the player — MEDIUM
- [ ] 8. Make service-worker upgrades atomic — MEDIUM
- [ ] 9. Centralise tag dispatch into a registry — LOW
- [ ] 10. Dice RNG quality / reproducibility — LOW
- [ ] 11. Harden the per-visit memoization assumption — LOW
- [ ] 12. Add headless unit tests for the extracted rules — LOW
- [ ] 13. Optional: build-time XML validation — LOW
- [x] 14. Fix save-card button overflow on mobile

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

## 3. Fix multi-attribute `<if>` conditions  — HIGH

`engine.evaluateCondition` currently uses an `else if` chain, so a node such as
`<if codeword="Dove" title="Arena Champion">` checks only the first recognized
attribute instead of requiring both. Examples include `books/book4/122.xml`,
`books/book1/184.xml`, `books/book3/222.xml`, `books/book6/160.xml`, and
`books/book1/460.xml`. Change condition evaluation to combine all recognized
condition attributes as an AND expression, then apply `not="t"` to the final
result. Add targeted tests for at least one codeword+item/title case and one
item+profession case.

---

## 4. Prevent silent save-slot overwrite  — HIGH

`state.nextFreeSlot()` returns `0` when all 20 slots are occupied, so starting a
new game, opening a demo link, or importing a save can overwrite slot 0. Return
`null`/throw when full and have the UI ask the player to delete/export a save
before continuing. Demo mode should also avoid creating a persistent save unless
the player chooses to keep it.

---

## 5. Implement `<items group … limit="N">` "choose up to N" pickup  — MEDIUM

Grouped award rows (`<weapon group=…>`, `<tool group=…>`, `<item group=…>`) are
each rendered as an independent "Take" button by `renderItemAward`, which ignores
the `group` and `limit` attributes; the `<items group="…" limit="N"/>` controller
has no renderer (falls through the switch to `appendChildren`, producing nothing).
So the "choose up to N" cap is **not enforced** — the player can take every listed
treasure (only the global 12-item carry cap limits them). Affects 6 sections
(`book1/16.xml`, `book4/113.xml`, `book4/137.xml`, `book4/218.xml`,
`book5/671.xml`, `book5/709.xml`; e.g. 16's "choose up to three treasures"). The
Java original handled this via `ItemNode` group/limit. Add an `<items>` renderer +
a `state` group-pick that enforces the limit across the shared group id and the
12-item carry cap.

---

## 6. Harden save import and migration  — MEDIUM

`importSave()` only checks for an object with `abilities` and `stamina`;
malformed imported JSON can still create saves with wrong array/object shapes
that later break rendering or sheet logic. Validate/clamp the imported schema
deeply (`items`, `ships`, `titles`, `curses`, `resurrections`, numeric fields,
current book/section) and reject unsupported shapes with a clear import error.

---

## 7. Surface persistence failures to the player  — MEDIUM

`GameState.save()` catches `localStorage` failures and logs them, but gameplay
continues as if progress was saved. Return a success/failure signal or expose
`lastSaveError` so the UI can warn when storage is unavailable, full, or blocked
by browser privacy settings.

---

## 8. Make service-worker upgrades atomic  — MEDIUM

`sw.js` catches individual precache misses, then `skipWaiting()`/`clients.claim()`
activates the new worker and deletes all old caches. A partial install could
discard the last complete offline cache. Split required shell/data assets from
optional maps, fail installation if required assets miss, and delete older caches
only after the new required cache is complete.

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
and rest healing (fixed + dice).

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
