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
- [ ] 3. Fix multi-attribute `<if>` conditions
- [ ] 4. Prevent silent save-slot overwrite
- [ ] 15. Fix `<gain>`/`<lose>`/`<tick>` ability effects (rank, stamina, "?", "*", fatal)
- [ ] 16. Make wildcard/choice losses actually take things
- [ ] 17. Recognise all spec'd `<if>` attributes; stop defaulting unknown conditions to true
- [ ] 18. Preserve item `tags` and support tag-filtered item conditions
- [ ] 19. Implement the curse / disease / poison system end-to-end
- [ ] 20. Implement caches, banks, `<adjustmoney>` and `<transfer>`
- [ ] 21. Fix `<flee>`/`<fightdamage>`: no render-time auto-apply, find them anywhere, honour `flee="t"`, `type="replace"`
- [ ] 22. Render `<success>`/`<failure>`/`<outcome>` children of `<choices>`
- [ ] 23. Make inline `<buy>`/`<sell>` functional (ships, tools, quantity, item sells)

**MEDIUM**
- [ ] 5. Implement `<items group … limit="N">` "choose up to N" pickup
- [ ] 6. Harden save import and migration
- [ ] 7. Surface persistence failures to the player
- [ ] 8. Make service-worker upgrades atomic
- [ ] 24. Canonicalise ship types (`brig`, `gall`) and fix crew-upgrade steps
- [ ] 25. Fix value/expression parsing: vars containing "d", unary minus, division
- [ ] 26. Implement the remaining `<fight>` attributes
- [ ] 27. Cap visit-box ticks and make `ticks=` guards robust
- [ ] 28. Honour `dead="t"` on `<goto>`/`<choice>`
- [ ] 29. Market & item polish: currency items, `currency=`, pipe names, headers, item `<effect>`s
- [ ] 30. Gate `<random flag=…>` rolls behind their payment
- [ ] 31. `<rest>` with no `stamina=` should restore to full

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

**Done**
- [x] 1. Gate combat progression / model fight outcomes
- [x] 2. Finish the logic/view split (combat/market/rest)
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
item+profession case. (Task 17 extends the same function with the attribute
handlers it is missing entirely — do them together if convenient.)

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

## 15. Fix `<gain>`/`<lose>`/`<tick>` ability effects (rank, stamina, "?", "*", fatal)  — HIGH

`firstAbility` (`web/js/engine.js:47`) accepts only the six core abilities, so
`ability="rank"`, `ability="stamina"`, `ability="?"` (player's choice) and
`ability="*"` (all six) are silently dropped by `applyLose` (engine.js:172) and
`applyTick` (engine.js:241). Worse, in a `<gain>`/`<tick>` the dropped effect
leaves `did` false, so the bare-tick fallback (engine.js:257–261) **ticks the
section's visit box instead** — the series' 39 `<gain ability="rank">` rank-ups
do nothing *and* corrupt tick state (e.g. `books/book2/157.xml`, the wheel of
fortune, which also uses stamina gains/losses — 27 `ability="stamina"` gains and
~25 stamina/rank losses corpus-wide). Also unread: `fatal="t"` (ability reduced
to 0 kills — book2/157, book5/356) and `<tick ability=… effect="+fixed|+cursed|
-…">` (fix-at-1 / auto-fail effects — book2/643, book6/78/332/353).

Fix: route `rank`/`stamina` to their real fields, loop all six for `"*"`, honour
`fatal`, implement the `effect=` forms, and make the fallback fire only for a
genuinely bare `<tick>`. `"?"` and `"a|b"` need a player chooser — reuse the
`opts.chooser` pattern `applyLose` already has for items. The same chooser fixes
two relatives: bare `<training>` / `ability="?"` currently "trains" a phantom
`''`/`'?'` key and memoises the one-time opportunity away (render.js:842,
engine.js:429, state.js:226; book5/59/63/108/347/652, book2/615), and
multi-ability `<difficulty ability="combat|magic">` (14×; book1/344/399,
book6/18) always rolls the first ability instead of offering the choice.
Add engine unit tests for each form.

---

## 16. Make wildcard/choice losses actually take things  — HIGH

Robbery, imprisonment, disarming and death-cleanup sections currently leave the
player untouched. In `applyLose` (`web/js/engine.js:159`):
- `item="*"` is deliberately skipped (engine.js:185) and `shards="*"` resolves
  to 0 (via `resolveValue` → `getVar('*')`), so "lose all your money and
  possessions" no-ops (book1/218, book1/157, book5/7 death cleanup; ~12
  `shards="*"`, ~10 player-side `item="*"`).
- `blessing="*"`/`"?"` never match (`removeBlessing` is exact-match,
  state.js:284) — book2/157 outcome 5, book2/394 (13 occurrences).
- There are **no** `weapon=`/`armour=`/`tool=` attributes at all (~15 nodes,
  incl. `using="t"` = "the one you're wielding"), so confiscation scenes leave
  the player armed.
- `cargo="?"` ("lose one cargo unit of your choice", 18×) does
  `indexOf('?')` → removes nothing (engine.js:221).
- `resurrection="t"` shifts only the first arrangement; spec says clear all
  (engine.js:180; book6/230, book2/394). `removeCurse('*')` removes only the
  first match (state.js:292).

Implement `*` (all matches), `?` (player chooser — `opts.chooser` exists),
the weapon/armour/tool kinds with `using=`, and multi-match wildcards for
blessing/curse/resurrection. Unit-test each.

---

## 17. Recognise all spec'd `<if>` attributes; stop defaulting unknown conditions to true  — HIGH

`evaluateCondition` (`web/js/engine.js:54`) starts with `result = true` and has
no handlers for `weapon=`, `armour=`, `tool=`, `disease=`, `poison=`, `cache=`,
`using=` or `bonus=`-filtered forms, so those conditions silently pass (or, with
`not="t"`, silently fail): book2/90's `<if not="t" weapon="?">` ("if you have no
weapon") is always false, book6/614's `<elseif weapon="?">` always true, ~30
nodes affected. Also wrong in the same function: `docked="Smogmaw"` ignores the
location — any ship anywhere passes (book3/53/222/345; relatedly `applySet`'s
dock, engine.js:296, docks *all* ships); `modifier="natural"` is ignored so the
item-boosted score is compared (book2/554, book5/435); `<if god="">` ("worships
no god", book2/578) is always false so its `<else>` always runs.

Add the missing attribute handlers per `rules/JaFL-XML-Tags.html`, implement
docked-at-location, natural-score compare and empty-god, and make genuinely
unknown condition attributes log a console warning (plus, ideally, a build-time
scan that lists them) instead of silently passing. Same function as task 3 —
do them together if convenient. Note `disease=`/`poison=` conditions also need
task 19's storage to exist.

---

## 18. Preserve item `tags` and support tag-filtered item conditions  — HIGH

`makeItem` accepts a `tags` parameter (`web/js/state.js:373`) but **no caller
passes it**: item awards (render.js:651), market purchases (market.js:73 and
:107) and save-load migration (state.js:107) all drop tags. `findItems` also has
no `"?"`-wildcard/tags support on the condition path. Consequence: all 51 tagged
awards (e.g. `<item name="candle" tags="light,useonce"/>`) lose their tags, and
every `<if item="?" tags="light">` check is permanently false — the Yellowport
sewers questline is unenterable for non-mages (`books/book1/460.xml` → §164;
same pattern in book1/164, book2/291/440/720/744, book3/11/25/196, …). Distinct
from task 3: AND-combining does not fix this. Pass tags through all four call
sites, add wildcard+tags support to the item condition, update the now-stale
comment at engine.js:189 (it documents the lose-path as harmless, but the
condition path is a hard block), and test the lantern/candle sewers path.

---

## 19. Implement the curse / disease / poison system end-to-end  — HIGH

The affliction system doesn't work at any stage:
- `applyCurse` (engine.js:307) ignores the spec'd `name=` and the `<effect>`
  children, storing only `{type:'curse'}` — so book4/31's Curse of Tambu can
  never be lifted by book4/12's `<lose curse="Curse of Tambu">` nor detected by
  book4/111/231's `<if curse=…>`.
- `<disease>`/`<poison>` elements aren't handled in `applyEffect` at all
  (engine.js:145) — Ghoulbite / Scorpion Poison are never stored, and their
  `<effect ability=… bonus=…>` penalties are never applied
  (`state.effectBonus` reads only `data.effects`).
- `<if disease=>`/`<if poison=>` are unrecognized ⇒ **always true** (task 17) —
  §532 auto-consumes the scorpion antidote of a player who was never stung.
- Cure sections no-op: `<lose disease="*">` (11×), `<lose poison="*">` (4×),
  `<lose curse="?">` (3×); `removeCurse('*')` removes only the first match
  (state.js:292).

Store afflictions with name + type + effect list, apply their ability effects,
wire the `<if>`/`<lose>` paths incl. wildcards, and unit-test inflict → detect →
suffer penalty → cure. The curse-flavoured `special=` effects
(armourlock/weaponlock, difficultyCurse/difficultyRestore — task 36) pair
naturally with this work.

---

## 20. Implement caches, banks, `<adjustmoney>` and `<transfer>`  — HIGH

The whole stash/bank economy is missing: `state.data.caches` (state.js:45) is
declared but written by nothing; `cache=` is ignored on `<if>`/`<lose>`/`<tick>`;
and there are no handlers for `<moneycache>` (25×), `<itemcache>` (31×),
`<transfer>` (25×), `<adjustmoney>` (89×) or `<tick special="lock|unlock"
cache=…>` (~50×). Player-visible today:
- The gambling/investment mechanic does nothing — book1/91's guild investment
  (×5/×2/×0), book2/62/107/108/134/177/594, book4/263/355, book5/116,
  book6/198/483/496; "lose half your money" (`<adjustmoney multiply="0.5">`,
  book2/745, book3/640, book6/139/191) shows as prose and takes nothing.
- Bank conditions test *pocket* money: `<if cache="MerchantBank" shards="150">`.
- Confiscate-and-return scenes (`<transfer weapon="*" to="2.462">`) leave the
  player fully armed.
- One real **inventory corruption**: `<lose item="?" cache="4.468">` (book4/468
  chain) ignores `cache=` and removes the player's own first possession.

Implement the cache store (keyed by cache name), route `cache=` on
if/lose/tick, implement adjustmoney (add/multiply, clamped), transfer, and the
lock/unlock specials, plus renderers for the money/item cache widgets. Fix the
`cache=`-on-lose corruption first — it destroys player data. Unit tests for
deposit/withdraw/lock and the ×N payouts.

---

## 21. Fix `<flee>`/`<fightdamage>`: no render-time auto-apply, find them anywhere, honour `flee="t"`, `type="replace"`  — HIGH

Four related defects around fights:
1. **Render-time auto-apply (worst):** `renderElement`'s default case
   (render.js:307) recurses into unknown containers, so the `<lose>`/`<tick>`
   children of `<flee>` and `<fightdamage>` apply the moment the section
   renders. Entering book2/207 immediately costs the 1d6-Stamina flee penalty
   and sets the "ran away" codeword even if you fight and win (~13 flee
   sections: book2/207/297/581/595/770, book3/73/85/326/662, book4/171,
   book5/657, book6/305); book1/105's ScorpionSting codeword is set unwounded,
   then double-applied per wound (all 14 `<fightdamage>` sections).
2. **Discovery:** `findSibling` (render.js:1050) scans only forward same-level
   siblings of `<fight>`, so a `<flee>` inside a `<p>` (book3/662, book2/207) or
   before the fight (book2/297) gets no Flee button, and a `<fightdamage>`
   placed before the fight (book2/152/208/313) never reaches `fightRound`.
3. **Gate:** `applyFightGate` disables `<choice flee="t">` (15×) until the
   fight resolves — book3/662's "flee at any time" becomes win-or-die.
4. **Semantics:** `<fightdamage type="replace">` should *replace* the Stamina
   loss, but combat.js:53–55 still applies it and then applies only
   `firstElementChild` — book5/356 (hangman) wrongly loses Stamina and the
   replacement never runs; multi-node bodies dropped (book5/489/565, book4/238).

Render flee/fightdamage as inert containers (children display but never
auto-apply), search the whole section subtree for them, exempt `flee="t"`
choices from the gate, honour `type="replace"`, and apply **all** child nodes
per wound. Extend the fight tests in `web/_test.html`.

---

## 22. Render `<success>`/`<failure>`/`<outcome>` children of `<choices>`  — HIGH

`renderChoices` keeps only `<choice>` children (render.js:664), silently
dropping the roll-branch elements the books place inside choice tables — so
book1/123's swim-the-river SCOUTING roll renders but leads nowhere (its
`<success book="2" section="53">` / `<failure book="2" section="76">` never
appear). 12 bundled sections: book1/123/554, book2/53/61/122/138/190,
book3/533, book4/456/457 (`<outcome>`), book5/333, book6/735. Route these
children through the normal success/failure rendering and add a regression
test on book 1 §123.

---

## 23. Make inline `<buy>`/`<sell>` functional (ships, tools, quantity, item sells)  — HIGH

**Buys:** `renderInlineBuy` (render.js:1216) forwards only `crew`/`item` to
`market.applyInlineBuy` (market.js:103), so `buy ship=` (8 sections) and
`buy tool=` (5) deduct Shards and grant nothing — book3/406's 320-Shard barque
and book5/548's up-to-2000-Shard wands are pure money sinks, and the
plot-critical free/cheap ships (book2/663, book3/393, book4/114 galleon,
book4/559/658, book5/192) are never granted, breaking all subsequent sea play.
The buy button also has no `ctx.applied` memo and ignores `quantity=`, so any
inline item buy (e.g. book1/30 treasure map) repeats indefinitely per visit.

**Sells:** `renderInlineSell` (render.js:1282) reads only `cargo=`/`price=`,
but 5 of the 6 inline sells in the corpus use `item=` + `shards=` — book 5's
main income (rime ice at 350 Shards, book5/457; also book1/30,
book5/141/446/594) renders as inert prose or an invisible empty span. The
comment at render.js:1300 claiming non-cargo sells are unused is wrong — fix it.

Extend `market.applyInlineBuy` with ship (canonicalised — task 24) and tool
branches plus quantity, memoise applied buys, implement item sells in
`market.js`, and while there move the existing inline cargo-sell transaction
(render.js:1313–1331 mutates `ship.cargo`/money directly in the view) into
`market.js` too (task 34). Test a buy-ship and a sell-item round trip.

---

## 24. Canonicalise ship types (`brig`, `gall`) and fix crew-upgrade steps  — MEDIUM

The books abbreviate ship types: `<trade ship="brig">` / `"gall"` (book4/141,
book5/145/225) store `type:'brig'/'gall'`, so `shipCap` (market.js:10) falls to
the default 1 cargo unit (instead of brigantine 2 / galleon 3) and none of the
27 `<if ship="brigantine|galleon">` checks (nor `<elseif ship="brig">` on a
brigantine bought under its full name — book4/11/161) ever match
(engine.js:114 compares raw strings). Canonicalise the type at purchase and
compare canonically in conditions. Also in `applyShipLose` (engine.js:214):
`<lose crew="-1">` (a crew *upgrade*, 4×, plus one `crew="-2"`) on an excellent
crew indexes past the array end and resets it to `'poor'` — clamp both ends.

---

## 25. Fix value/expression parsing: vars containing "d", unary minus, division  — MEDIUM

`resolveValue` (engine.js:39–45) tests `isDiceExpr` with `/d/i`, so any
variable whose name contains a "d" is misparsed: `<adjust amount="d">` rolls a
die instead of reading var `d` (book6/696/527/742 — `<set var="d"
value="-armour"/>`), `"RandomPlus"` yields 0 (book2/322), and `"-bonus"`/`"-s"`
(book2/726/750/770/579) look up a var literally named `-bonus` → 0.
`evalExpression` (engine.js:337) tokenizes only `[A-Za-z_]+|\d+|[+\-*]` — no
`/`, no parens — so `"(shards+9)/10"`, `"shards/1000"`, `"(x+1)/2"` etc.
(book2/322/617, 8 nodes) return the undivided left-hand side, and
`value="-armour"` (book4/679, book6/696) yields 0. Also `applyLose` never calls
`childAdjustment`, so `<lose stamina="3d"><adjust god="The Three Fortunes"
amount="-1"/></lose>` gives worshippers no damage reduction (book4/556, 4/679,
6/306/527/696/742; spec lists `<lose>` as adjust-modifiable). Tighten
`isDiceExpr` to a real dice pattern, extend the tokenizer (division, parens,
unary minus), apply child adjustments in `applyLose`, and unit-test every
expression form found in the corpus.

---

## 26. Implement the remaining `<fight>` attributes  — MEDIUM

`makeFight` (combat.js:11) reads only name/combat/defence/stamina/flee/
playerFirst. Documented attributes that occur in the data and are ignored:
`attackDice="1"` (player attacks with one die — Haniwa Warrior),
`playerDefence="s"/"d"` (a variable replaces your Defence — Chimerical Beast,
Talanexor), `preDamage`/`staminaLost` (damage carries between the paired
Dawatsu Morituri fights), `attacks="3"` (book5/345 Tripling),
`modifiers="noarmour"` (Water Drake), `group=` (simultaneous multi-enemy
fights — book6/192/273/291/618) and `useCache` (book6/635). Occur in
book5/689, book6/460/473/481/563/718 among others. Implement per
`rules/JaFL-XML-Tags.html` with combat.js unit tests per attribute.

---

## 27. Cap visit-box ticks and make `ticks=` guards robust  — MEDIUM

`state.addTick` (state.js:268) has no cap at the section's `boxes=` count and
`<if ticks="1">` matches with strict equality (engine.js:70). In book1/16
(`boxes="1"`): visit 1 ticks the box; on visit 2 the `<if ticks="1">` guard
matches (goto 251) but the sibling bare `<tick/>` still fires → count 2; from
visit 3 on the guard never matches and the one-time dragon-hoard loot is
offered again. The `ticks="1"` guard pattern appears in ~30 sections in book 1
alone. Cap `addTick` at the section's box count (the section's `boxes=` needs
to reach state) and/or match guards with `>=` after verifying JaFL's own
behaviour; add a three-visit regression test.

---

## 28. Honour `dead="t"` on `<goto>`/`<choice>`  — MEDIUM

61 `<goto dead="t">` and 11 `<choice dead="t">` occurrences render as normal
enabled navigation for living players (render.js renderGoto/renderChoice) — a
book4/16 trample survivor sees an enabled link "7" into the you-are-dead
section, whose dead-end fallback then funnels them into real death. Fight
sections are mostly covered by the lose-branch prose heuristic, but 15
non-fight sections have no protection (book2/555, book3/550,
book4/16/37/60/151/203/578/679, book5/104/271/344/426/617/640). Hide (or
disable) `dead="t"` navigation while the player is alive, and prefer it over
the prose heuristic as the fight gate's lose-branch signal where present.

---

## 29. Market & item polish: currency items, `currency=`, pipe names, headers, item `<effect>`s  — MEDIUM

Five smaller market/item divergences:
1. `<item name="500 Shards">` (dragon hoard book1/16 and 7 similar
   150–2000-Shard items) is created as an ordinary possession — burns one of
   the 12 slots and adds no money. Spec: "N things" names are stackable
   currency (state.js:373 `makeItem`).
2. `<market currency="Mithral">` (book2/495) deducts Shards — `market.js` has
   no `currency=` support.
3. Multi-name rows (`fur cloak|wolf pelt` — book4/417, book5/101/416) store the
   literal pipe name (market.js:73), so the same row's Sell button never
   enables and `<if item="wolf pelt">` fails; pick one name (or match either).
4. `header1=`/`header2=` column titles are dropped — the 13 markets using them
   (book4/111 "Potions"/"Artifacts") all render the fallback "Goods for sale"
   (render.js:1128).
5. The 96 `<effect>` children of items are inert at award and purchase —
   `applyItemEffect` (engine.js:313) is a stub (book4/111 potions, book5/549
   Vade Mecum with its use-goto). Also `<sold>` rows (4×, incl. 2 market rows
   at book3/86/318) are unhandled.

---

## 30. Gate `<random flag=…>` rolls behind their payment  — MEDIUM

`renderRandom` (render.js:793) ignores `flag=`, so pay-gated rolls are free and
the paired "Pay N Shards" button burns money for nothing — book2/157's golden
wheel (20 Shards per spin), book3/314, book5/674, book6/171. Honour the
`flag=`/`price=` idiom the way `renderPassive`/`renderOptionalPay` already do:
the roll enables only after payment, and re-arms per payment.

---

## 31. `<rest>` with no `stamina=` should restore to full  — MEDIUM

Per `rules/JaFL-XML-Tags.html`, a `<rest>` without a `stamina` attribute
"restores Stamina to its full" — the corpus has **62** such tags (all
"heal you of all lost Stamina points" prose: safe houses, temples, healers)
versus 86 with an amount. `render.js:1348` defaults the missing attribute to
`'1'` per click. Add a restore-to-max mode to `engine.applyRest`, use it when
the attribute is absent, and unit-test both modes.

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

## 36. Minor rule divergences (grab-bag)  — LOW

Small confirmed divergences to sweep in one pass, each with a test:
- `applySpecial` (engine.js:265) gaps: `bonus="s"` parses NaN→0 (book6/183);
  `godless` doesn't clear the current god (book6/118); `armourlock`/
  `weaponlock`, `lock`/`unlock` (cache locks — task 20) and `difficultyCurse`/
  `difficultyRestore` (one-die difficulty rolls, book3/91 — pairs with task 19)
  are unimplemented.
- Anything newly discovered of similar size should be appended here rather
  than left in conversation (per the workflow in `AGENTS.md`).
