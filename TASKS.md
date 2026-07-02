# Fabled Lands — Web Edition · Engineering TODO

Backlog of recommended improvements. Ordered roughly by impact. Items marked
**done** were completed while auditing the engine; the rest are open.

---

## 1. Gate combat progression / model fight outcomes  ⚠️ gameplay bug — HIGH

**Problem.** A fight's continuation is written in prose as a bare link —
`<fight .../> … If you win, <goto section="X"/>. If you lose, …` — and the
renderer draws that `<goto>` as an immediately-clickable button. Nothing ties it
to the fight being won, so **the player can skip essentially any fight** by
clicking the "if you win" link without attacking. First spotted in
`books/book1/570.xml`; it affects fight sections generally.

**Scope (measured across all six books):**
- **166** sections contain a `<fight>`.
- **50** have an explicit `if you lose … <goto>` (a *non-death* loss path). A
  naive "disable all gotos until you win" would break these.
- **4** use a `flee="N"` attribute — a win/knock-out threshold (win by reducing
  the enemy to N Stamina, not 0). The engine currently **ignores** this
  attribute, so e.g. 570's "reduce the Tree Guard to 5" never triggers.
  (Sections: grep `books/*/[0-9]*.xml` for `<fight[^>]*flee="`.)
- **20** use a `<flee>` *child element* — the Flee button, which already works.

**Fix (proper, not naive).** In `render.js` + `combat.js`:
1. Give a fight an explicit resolved/unresolved state and a `win`/`lose`/`fled`
   outcome (combat.js already has `fight.outcome`).
2. While an unresolved fight exists in the section, **disable subsequent
   navigation controls** (`.goto`, `.choice`) with a tooltip ("Defeat the enemy
   first"); re-enable on resolution.
3. Distinguish the **win-goto** from the **lose-goto**. The books put them in
   `if you win … <goto A>` / `if you lose … <goto B>` prose — parse/associate,
   or (cleaner) wrap them so the renderer knows which is which.
4. Honour `flee="N"`: winning threshold = enemy Stamina ≤ N (not 0), and model
   the resulting knock-out loss as a branch rather than death.

**Do not** ship the naive gate alone — verify against the 50 lose-goto sections
and the 4 `flee="N"` sections (esp. `book1/570`) before/after.

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

Remaining: add the unit tests these now enable — see item #7.

---

## 3. Implement `<items group … limit="N">` "choose up to N" pickup  — MEDIUM

Standalone award rows (`<weapon group=…>`, `<tool group=…>`, `<item group=…>`)
and their `<items group="…" limit="N"/>` controller are **not rendered as
pickable** — they fall through to the default prose branch. Affects ~7 sections
(e.g. `book1/16.xml`, "choose up to three treasures"). The Java original handled
this via `ItemNode` group/limit. Add a renderer + a `state` group-pick that
enforces the limit and the 12-item carry cap.

---

## 4. Centralise tag dispatch into a registry  — LOW (maintainability)

Tag handling is spread across two hand-rolled switches (`render.js`
`renderElement`, `engine.js` `applyEffect`). For ~40 tags this is fine, but a
single table `tag → { render, applyEffect, condition }` would make adding a tag a
one-place change and mirror the Java `Node.createChild` factory (minus the
UI coupling).

---

## 5. Dice RNG quality / reproducibility  — LOW

`engine.js` rolls with `Math.random()` — uniform and unbiased for 1–6 (no modulo
bias), statistically fine for play, but **not seedable**. A small seedable PRNG
(and a `?seed=` hook) would enable reproducible replays and deterministic tests;
`crypto.getRandomValues` would raise entropy quality if ever wanted. Not required
for correctness.

---

## 6. Harden the per-visit memoization assumption  — LOW

`render.js` memoises applied effects / rolls by a node path (`basePath + '.' +
idx`). This is safe today because the XML tree shape is static per visit. Add a
comment (and ideally an assertion) noting that any future feature which
conditionally reorders siblings would break effect-dedup.

---

## 7. Add headless unit tests for the extracted rules  — LOW

`web/_test.html` renders every section (catches throws) but doesn't assert
combat/economy outcomes. Now that `combat.js` / `market.js` / `engine.applyRest`
are DOM-free, add focused tests: a fight to the death, an over-Defence miss,
a `<fightdamage>` application, buy/sell with the 12-item cap and cargo capacity,
and rest healing (fixed + dice).

---

## 8. Optional: build-time XML validation  — LOW

`build/build-data.ps1` bundles section XML unchecked. A lightweight schema/lint
pass (or wiring the render-every-section smoke test into the build) would catch
malformed sections before deploy. The smoke test already covers most of this.
