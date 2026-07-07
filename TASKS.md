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
- [ ] 37. Fix the `safeAddGodd` typo in the source XML
- [ ] 38. Gate cache widgets on `lock`/`unlock` under the single-pass render (book1/91 gamble)
- [ ] 39. Defer confiscate-and-return `<transfer … from=>` until a fight resolves (book2/462)

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
