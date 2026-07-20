# Fabled Lands — Web Edition · Engineering TODO

Backlog of recommended improvements. The checklist below is grouped by
priority — work the first open (`- [ ]`) item top-down. Task numbers are
stable IDs pointing at the detail sections below (sections are in the order
the tasks were filed, not work order).

**HIGH**

- [x] 123. "Immunity to Disease and Poison" is stored under two un-aliased names — the blessing never protects
- [x] 124. Loading/importing a save clamps Stamina to the written max — aura Stamina (ring of ultimate power) is silently stripped
- [x] 120. Split the 4,790-line single-scope browser test into focused ES-module suites *(before the test-heavy 115–117 chain)*
- [x] 115. Adventure-Sheet item detours bypass `Story.navigate`, so `<return>` still re-enters the source section
- [x] 116. Save/load restarts the current visit — effects can repeat and rolls/return state disappear
- [x] 117. Priced equipment/cargo losses can arm their reward without taking the required payment
- [x] 118. Choice/equipment losses can remove `keep`-tagged possessions *(immediately after 117 — same shared loss matcher)*
- [x] 125. Flag-linked item rewards outside choose-one menus are free, and paying can never grant them
- [x] 126. A collapsed `<group>` action never executes its `<buy>` children — §5.192's ship and §4.622's cargo are unobtainable
- [x] 127. Abbreviated cargo names (`grai`, `meta`, …) are never canonicalised — the trans-book trading economy is broken
- [x] 128. A bare `ability=` disjunct on `<if>` is always true — §5.680 gives away the ring of ultimate power

**MEDIUM**

- [x] 129. Free fixed-amount `<rest stamina="N">` is infinitely repeatable — every hospitality rest heals to full
- [x] 130. Inline `<buy>` allows one purchase per visit; JaFL's default is unlimited ("buy as many as you can afford")
- [x] 131. Cache `max=` semantics: `max="0"` must bar deposits (§4.263 money-doubling), and item caches must store Shards (§6.512)
- [x] 132. `<if blessing="?">` never matches — §5.365's chapel stacks blessings
- [x] 133. Adventure-Sheet mutations (drop/lift) leave the story pane stale — item-gated choices stay live after the item is gone
- [x] 121. The documented `powershell` build command no longer parses `build-data.ps1` on Windows PowerShell 5.1
- [ ] 119. Re-establish the rules/view boundary and split the 4,060-line renderer by responsibility

**LOW**

- [ ] 134. Market sells with several candidates silently take the first match — JaFL asks which ship/item to sell
- [ ] 135. Renouncing a god keeps that god's resurrection deal
- [ ] 136. Engine grab-bag #2: `transfer tenth=`, named-cargo loss quantity, `effect description=`, `<set>` identifier edges, `<buy force="t">`
- [ ] 137. A save blob can persist without its `fl_meta` entry — the orphaned slot turns invisible and gets overwritten
- [ ] 138. Offline navigations with a query string bypass the service-worker cache
- [ ] 139. The Adventure Sheet never shows foreign-currency balances

**Done**

*Completed items are listed by task number (the stable ID pointing at the detail
section below); detail sections remain in filed order, not this order.*

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
- [x] 107. Visible `<transfer>` actions auto-execute and ignore chooser/filter/price semantics *(fixed; surfaced the §4.456 `<lose bonus>` gap → task 113)*
- [x] 108. `<outcome blessing="…">` ignores Safety from Storms and exposes the capsize/storm redirect *(fixed; surfaced the reroll-form non-consume → task 114)*
- [x] 109. Multi-ability success routing ignores `<success ability="…">` (§2.37 always takes SANCTITY)
- [x] 110. `<return>` starts a fresh visit instead of restoring the section at the point it was left
- [x] 111. Rolled `itemAt=` losses can remove `keep`-tagged possessions
- [x] 112. The Adventure Sheet stores but cannot activate a curse's `lift=` prompt (§5.505)
- [x] 113. `<lose item="?" bonus="N">` ignores `bonus=` — §4.456 accepts any item as a +2/+3 offering
- [x] 114. Reroll-form storm sections (§232/502/716) never consume the blessing — the rerunnable `keepblessing=1` set resets the guard each render
- [x] 141. Archive completed task details out of TASKS.md
- [x] 140. Docs/CI accuracy: AGENTS.md's smoke-test URL 404s and the CI grep misses `RESULT FATAL`
- [x] 122. Roll-less `<outcome codeword=…>` decision tables never resolve — eight sections render as dead ends

---

> **Completed task details (tasks 1–114) are archived** in [`TASKS-archive.md`](TASKS-archive.md) (task 141) to keep this file focused on open work. The checklist above still carries every task's stable ID and status; a done task's detail lives in the archive under the same `## <N>.` heading. Open-task details and the Review log follow below.

---

## 115. Adventure-Sheet item detours bypass `Story.navigate`, so `<return>` still re-enters the source section — HIGH (app/render)

*(Filed 2026-07-15 from a third full repository review; follow-up to task 110.)*
Task 110 fixed normal choices/gotos by wrapping the app router in
`Story.navigate`: it captures the source visit's return frame, runs leave hooks,
then calls the raw async navigation function. `app.js:onUseItem`, however, sends
an effect's `res.goto` straight to the raw app-level `navigate()`. The destination
therefore has history but no `_returnFrame`; its `<return>` takes `goBack()`'s
fallback and re-enters the origin through `goTo()`/`begin()` — exactly the fresh-
visit bug task 110 was meant to eliminate.

This is live in the treasure map (§1.30 → §1.200), Black Diptych (§5.412/712 →
§5.410), Vade Mecum (§5.549 → §5.550), blue potion (§5.698 → §5.306), and
lacquer box (§6.252 → §6.272). Returning can repeat the source's entry rewards/
costs/ticks, discard its variables/rolls/action state, and add an `A → B → A`
history bounce. The existing task-41 test checks only that `useItemEffect` returns
a target; task 110's synthetic test leaves through a Story-rendered link, so
neither covers the app seam.

Route every in-game navigation source through one public Story/controller entry
point (item use included), leaving only that entry point able to call the raw app
router. Preserve the item effect/removal before capturing/leaving so the detour's
legitimate state changes remain. Add an app/Story integration test using one live
item detour: return restores the exact source visit, does not repeat its entry
effect/tick or add a forward visit, and marks the source action consistently with
task 110. Web-only; stamp and run all sections.

*Correction (2026-07-16 fourth review):* the dominant failure mode is worse than
the fresh-visit fallback described above. `begin()` (render.js:218-278) never
clears `_returnFrame`, and only `goBack()` consumes it (render.js:1950-1958) — so
after arriving at the source section via a normal choice, the detour destination
holds a **stale** frame and its `<return>` restores the section *before* the
source, with the wrong position/vars, while `restoreReturn` (state.js:852-860)
pops the source off history leaving a duplicate top. The null-frame fallback only
occurs when the item is used right after a load. The fix (single entry point)
cures both modes, but the test must assert against the stale-frame mode too. The
sweep must also cover `app.js:649` (death → resurrection navigation), another raw
caller that skips leave hooks and leaves a stale frame; the fresh-start/load
callers at app.js:58/613/619/622 are safe (frame is null there).

---

## 116. Save/load restarts the current visit — effects can repeat and rolls/return state disappear — HIGH (state/app/render)

*(Filed 2026-07-15 from a third full repository review.)* Every state mutation
autosaves (`GameState.changed()` → `save()`), but all per-visit execution state is
held only in `Story.ctx` / `_returnFrame`. Loading a slot builds a new `Story` and
`loadCurrent()` calls `story.begin()` on the already-mutated current section.
`begin()` creates an empty memo, clears variables and temporary bonuses, resets
price/flag coordination, resets rolls/fights/market stock/action picks, and walks
the section's passive effects again. A save made after receiving Shards/items,
ticking a box, paying, rolling, or entering an item detour can therefore reload
as a different visit: one-shot effects can repeat, interactive progress vanishes,
and a later `<return>` falls back to fresh navigation.

Persist a versioned, serializable current-visit record alongside the game state:
at minimum the section identity, variables, applied/action memo, resolved rolls
and fights, stock/pick state, used source action, entry tick baseline, deferred
leave bookkeeping, and the one-level return visit needed by task 110. Store stable
node paths/IDs rather than DOM nodes and rebuild their references from the parsed
section on load. Loading must resume the current visit without `begin()`'s entry
side effects; new/legacy saves without the record need a conservative migration
that cannot duplicate rewards. State changes earned during a detour must remain
when its source frame is restored.

Add a real save-slot round-trip test: save after a synthetic gain+tick and resolved
roll/action, reconstruct `GameState` and `Story`, and prove the effect/tick do not
repeat and the roll/action remains resolved. Add a second round trip while inside
a live return detour and prove return restores the source variables/memo/history
without incrementing turns. Web-only; schema/migration may change; stamp and run
all sections.

---

## 117. Priced equipment/cargo losses can arm their reward without taking the required payment — HIGH (engine/render)

*(Filed 2026-07-15 from a third full repository review; follow-up to task 113.)*
Task 113 made `renderOptionalPay` and `applyLose` validate `item=` offerings, but
the equivalent equipment/cargo selectors still bypass that contract. The view's
eligibility guard looks only at `item=` and Shards; the price branch also runs
before the renderer's equipment-choice path. In `applyLose`, the `price` flag is
set before `loseEquipment` / `applyShipLose`, and is unconditional whenever there
is no `item=` attribute.

Two live consequences are exploitable:

- §2.90 offers `<lose weapon="?" price="x">` or `<lose armour="?" price="x">`.
  Either button stays enabled without that kind of equipment, sets `x`, and the
  linked loss renounces Elnir; with several matches it silently takes the first
  instead of asking which one to forfeit.
- §3.569 exchanges one named Cargo Unit for two textiles. A named-cargo button
  remains enabled when the current ship lacks that cargo; it sets `x` anyway and
  the linked textile gain can run for free.

Create one DOM-free loss plan/matcher shared by eligibility, chooser candidates,
and commit. It must cover item/equipment/cargo selectors, bonus/tags/using/cache,
current-ship locality, required quantities, and report whether the requested loss
actually completed. A priced action may set its flag/apply linked rewards only
after the full payment is taken. Wire visible `?` equipment/cargo losses to choose
the exact candidate rather than silently defaulting; keep deterministic/all forms
headless. Test both live sections with no eligible payment, wrong cargo, multiple
equipment choices, and a successful payment/reward. Web-only; stamp and run all
sections.

*Scope note (2026-07-16 fourth review):* the shared plan has one more consumer —
`renderPayment` (render.js:1452-1482), the forced economic payment with a decline
path. Its only ownership guard today is the Shards balance: a forced, unpriced
`<lose item=/cargo=/ship=>` payment with the possession absent still renders an
enabled Pay button, and clicking it memoizes `pay@` and unblocks the section
having taken nothing. Route its eligibility and commit through the same matcher.

---

## 118. Choice/equipment losses can remove `keep`-tagged possessions — HIGH (engine/render)

*(Filed 2026-07-15 from a third full repository review as MEDIUM; moved to HIGH
2026-07-16 to sit immediately after task 117 — it implements the keep-tag rules
inside 117's shared loss matcher, and doing the two back-to-back keeps that
design context warm instead of rebuilding it four tasks later; the consequence
— irreversibly losing a plot item the books say cannot be lost — also supports
HIGH. Follow-up to tasks 16 and 111.)* `applyLose(item="*")` and `itemAt=` protect `keep`, but
`loseItemMatches()` still includes protected possessions for `item="?"` /
`multiple=`, while `loseEquipment()` includes them for weapon/armour/tool `?` and
`*`. A generic theft/confiscation can therefore offer or silently select the royal
ring (§1.385) or white sword (§4.103), whose source text says they cannot be lost
or stolen. The current default-first behavior makes the bug reachable even
without a chooser.

The reference semantics first match while respecting `keep`; only when an
explicit *named* item has no ordinary match may that exact kept item be handed
over deliberately. The open `?` form never falls back to protected possessions,
and all-of-kind removal also skips them. Implement that distinction in the shared
loss matcher/plan from task 117 (not as a renderer-only filter), preserving valid
scripted named handovers. Add tests for `item="?"`, `multiple=`, equipment `?`/`*`,
only-protected inventories, mixed protected/ordinary inventories, and an explicit
named kept-item handover. Web-only; stamp and run all sections.

---

## 119. Re-establish the rules/view boundary and split the 4,060-line renderer by responsibility — MEDIUM (architecture)

*(Filed 2026-07-15 from a third full repository review.)* The overall module map
is still sound: state, combat, economy, data, shell, UI and TTS have recognizable
homes, and the core modules do not depend on browser UI globals. `render.js` has
nevertheless grown to 4,060 lines and now owns section lifecycle/return state,
XML traversal, payment and reward semantics, roll/branch/fight/transfer gates,
storm-blessing veto/spend rules, caches, markets, combat widgets and modal choices.
Recent fixes added bespoke rule decisions such as `isGuardedBlessingLoss`,
`blessingSpendForGoto` and reroll consumption directly to this DOM class. That no
longer matches the documented invariant that the renderer wires controls while
DOM-free modules decide and execute rules; the duplicated eligibility seam behind
tasks 113/117 and the raw-navigation seam behind task 115 are concrete costs.

Refactor incrementally, preserving `render.js` as the small public facade that
exports `Story`/`previewProse`. Move composite rule planning and transactions
(loss/payment eligibility, blessing outcomes, branch/gate resolution, return-
visit serialization) into tested DOM-free helpers. Split DOM construction into a
few responsibility-based ES modules — section/lifecycle, actions/rolls, combat
view, and market/cache view are the current natural seams — without introducing a
framework, build tool, speculative abstraction, or circular dependency. DOM code
may call a state/engine operation from a click handler, but must not independently
encode the rule or mutate several rule fields as its own transaction.

Keep the existing `Story` API so `app.js` and tests do not churn unnecessarily;
update README's module table and service-worker inputs for any new files. Add
focused unit tests for every extracted planner before moving the corresponding
view. Success: no behavior change beyond the filed fixes, no browser globals in
the rule modules, the all-section suite stays green after each extraction, and no
single replacement file simply inherits the same god-object role. Web-only;
stamp and run all sections.

*Trap (2026-07-16 fourth review):* `build/stamp-version.ps1:32` collects
`web/js/*.js` **non-recursively**. If the split puts modules in a subdirectory,
they silently drop out of the version hash (stale PWA caches on deploy) — extend
the stamp collector alongside the sw.js precache list and README table.

*Progress (2026-07-19, user scope = phases 1+2; view-file split deferred):* the
rules/view boundary is re-established — the composite rule logic the DOM class
had grown to encode inline now lives in three new DOM-free, unit-tested modules,
each added to `sw.js` REQUIRED + the README table (kept FLAT in `web/js/` so the
non-recursive stamp collector still hashes them — trap avoided):
- **1a** `render-rules.js` — blessing veto / spend / guarded-loss rules.
- **1b** `render-rules.js` (cont.) — reward/payment eligibility (choose-one,
  priced-item award, roll-gate, forced/optional action, reward-waste) + the
  shared `ITEM_FAMILY_TAGS`/`CHOOSE_ONE_TAGS` sets.
- **1c** `render-gates.js` — fight/roll/transfer navigation-gate computation +
  post-fight deferral decisions (the `tag*`/`apply*` DOM helpers stay in the view).
- **2** `visit-state.js` — per-visit ctx factory + ctx/return-frame serialization.

`render.js` keeps the `Story`/`previewProse` API unchanged (app.js and tests
un-churned) and shrank from ~4,450 to under 4,000 lines. Smoke suite RESULT ALL
PASS (1288) after each slice. **Still open (deferred): Phase 3** — physically
split the DOM view methods into responsibility-based modules (combat / market /
actions view), structure TBD (prototype-mixin vs collaborator objects). The
core "rules out of the view" invariant is now met; Phase 3 is a further
file-organisation step, not a behaviour or boundary fix.

---

## 120. Split the 4,790-line single-scope browser test into focused ES-module suites — HIGH (tests)

*(Filed 2026-07-15 from a third full repository review as LOW; moved to HIGH
2026-07-16, positioned after the quick severe fixes 122–124 and before the
test-heavy 115–117 chain: every open task adds test blocks, and doing the split
first means they land in focused suites instead of deepening the single-scope
monolith — and the async silent-pass gaps below get closed before the results of
the big fixes are trusted.)* `web/_test.html` now
contains about 4,790 lines inside one `async function run()`. The repository's own
instructions warn that reusing any top-level `const`/`let` is a parse-time fatal;
task 82 only made that failure visible, and newer blocks already need manual `{}`
scopes to avoid collisions. The single function also makes it hard to find a rule's
coverage or run a focused subset, while mixing pure engine assertions, DOM
integration, persistence, and the every-section scan.

Keep `_test.html` as the zero-dependency browser harness and result reporter, but
move suites into plain ES modules grouped by responsibility (engine/state,
combat, market, render/app integration, corpus scan). Export one async runner per
suite and pass a tiny shared assertion/context object; do not add npm or a test
framework. Preserve the fatal bootstrap handler, deterministic RNG controls,
`RESULT ALL PASS`/`TESTS_OK` contract, fresh-profile compatibility, and the final
render of all six books. Document the suite map next to the README test command.
Web-only; stamp and run the aggregate and at least one focused suite.

*Harness gaps to close in the same rework (2026-07-16 fourth review):* (a) there
is no `unhandledrejection` handler — a rejected un-awaited promise in exercised
app code fails nothing; (b) a mid-run async `window.error` fires the task-82
bootstrap handler and writes `RESULT FATAL`, but `run()`'s unconditional final
report (_test.html:4786-4788) then **overwrites** it — potentially as `ALL PASS`.
Make the fatal state sticky and fail the aggregate on any captured async error.

*Done 2026-07-17:* `_test.html` is now only the harness + reporter; the former
`run()` body was split verbatim (order preserved, so behaviour is unchanged) into
seven ES-module suites under `web/tests/` — `suite-engine`, `suite-render`,
`suite-inventory`, `suite-combat`, `suite-economy`, `suite-actions`, and
`suite-corpus` (the six-book scan, run last). Each exports one `async run(ctx)`
taking the shared `{ok, parse}`, rebuilds its own fixtures (so `?suite=<name>` runs
any subset hermetically), and is its own module scope (a duplicate top-level
`const` now aborts only that suite). Gap (a): added an `unhandledrejection`
listener; gap (b): the reporter honours a sticky `window.__FL_ASYNC_FATAL__` flag,
so a captured async error/rejection forces a failure that a later "ALL PASS" can
never overwrite (verified by fault injection). Aggregate `RESULT ALL PASS pass=1098
fail=0`; every suite also passes in isolation (147+87+293+226+266+78+1 = 1098). No
version stamp: the stamp hashes shipped app source only and deliberately excludes
`_test.html`/`web/tests/`, so a test-only change must not bust the PWA cache.

---

## 121. The documented `powershell` build command no longer parses `build-data.ps1` on Windows PowerShell 5.1 — MEDIUM (build/docs)

*(Filed 2026-07-15 while verifying the third full repository review.)* Both
README and `AGENTS.md` prescribe:
`powershell -ExecutionPolicy Bypass -File build/build-data.ps1`. Running that
exact command with Windows PowerShell 5.1 fails at parse time around lines 48/162.
The script is BOM-less UTF-8 and contains em dashes in double-quoted messages;
5.1 reads those bytes through its legacy code page, and the mojibake smart-quote
byte is treated as a string delimiter. `pwsh` 7 reads the same file correctly,
which is why recent builds passed there, but PowerShell 7 is not declared as a
dependency and the documented built-in Windows command is currently unusable.

Keep the no-dependency Windows workflow working: make both build scripts parse
under Windows PowerShell 5.1 (prefer ASCII punctuation in `.ps1` source/messages,
or a deliberately BOM-encoded file if the repository can preserve it), then run
the exact README command as well as `pwsh` if available. Add a lightweight CI or
documented verification step that exercises the prescribed command so script
encoding cannot silently regress. Do not merely change the docs to require an
undeclared tool. Build-only; confirm XML validation, generated output and stamp,
then run all sections.

*Rescope (2026-07-16 fourth review, verified by live runs):* (a)
`stamp-version.ps1` already parses **and runs** under 5.1 — only
`build-data.ps1`'s two em dashes (lines 48/162) need the punctuation fix. (b)
Parsing is not sufficient: the **outputs are engine-dependent**. `Sort-Object
FullName` (stamp-version.ps1:48) is culture-aware — .NET Framework (NLS) and
.NET Core (ICU) order the hyphenated asset names differently, so 5.1 produced
stamp `e9c6e17` from the identical content that pwsh 7 stamps `ca63008`; and
`ConvertTo-Json` escaping differences reformat all six book JSONs wholesale
under 5.1. Either make the outputs engine-invariant (ordinal sorts, stable JSON
escaping) or make an explicit decision to require pwsh 7 and update README,
AGENTS.md and CI to match — full 5.1 output parity is substantially more work
than the punctuation fix. Any added verification step must pin the engine it
runs under, or it will "verify" engine-dependent output.

*Resolution (2026-07-19, user-decided):* **require pwsh 7.** Normalising
`ConvertTo-Json` escaping across engines is fragile, high-effort work for a
Windows-dev edge case end-users never hit (they load the static site; no build).
Instead: (1) fixed the two em dashes and cleaned every remaining non-ASCII
comment byte so `build-data.ps1` is pure ASCII and parses under any code page;
(2) added `#Requires -Version 7.0` to **both** scripts so 5.1 *refuses to run*
(clear message, exit 1) rather than silently emitting a divergent build —
verified live; (3) README + AGENTS.md now prescribe `pwsh -File …`, noting only
the offline build needs pwsh 7 (the web app stays dependency-free); (4) a new CI
job (`build-scripts` in smoke.yml) lints both `.ps1` for non-ASCII bytes and the
`#Requires` guard — a pure source check that never runs the engine-dependent
build. Verified: pwsh 7.6.3 regenerates byte-identical book JSONs (only the
meta.json `generated` date + stamp move), smoke suite RESULT ALL PASS.

---

## 122. Roll-less `<outcome codeword=…>` decision tables never resolve — eight sections render as dead ends — HIGH (render)

*(Filed 2026-07-16 from a fourth full repository review; verified live in the
running app.)* `branchResolved` (render.js:2563-2566) returns `!!roll` for any
branch without a `var=` attribute, and both branch renderers gate on it before
ever reaching the codeword test: the `<outcomes>` loop at render.js:2666 and the
lone-outcome path at render.js:2641 (whose codeword check at :2643 is therefore
unreachable without a roll). But the books use `<outcome codeword=…>` as a
roll-less dispatch idiom — "Which of these codewords do you have?" with a bare
`<outcome section=…>None of them</outcome>` default. With no `<random>` in the
section, `activeRoll` stays null (render.js:307, only set at :512-514), so **no
row reveals — including the default**, and the app's no-navigation fallback
renders the "Your tale ends here — accept your fate ▸" death button (confirmed
headlessly at `?demo=4.2`: prose plus the fate button, zero links).

Live sections: §2.12, §2.68, §2.301, §4.2, §4.132, §4.184, §5.303 (tables;
§4.184 has *no* default row), and §4.457 (lone `<outcome codeword="4.457">`
inside `<choices>` — not a softlock, but the Initiate route never shows). §4.2
and §4.132 are book 4 hub dispatches; §5.303 is the Hall of Heroes parlour;
§2.301/§4.457 key on a *box codeword* ticked `hidden="t"` earlier in the same
visit (the entry tick renders before the table, so same-visit writes must be
visible to the match).

Fix in `branchResolved`/`renderBranch`: a `codeword=`-keyed branch (like a
`flag=` one, task 113's §4.456 precedent) needs no roll — evaluate it against
live codewords; a bare default `<outcome>` in a table whose every keyed sibling
is roll-less must also resolve without a roll, while roll-fed tables keep
waiting. Test §4.2 (no codewords → default reveals §97; with Defend → §57),
§4.184 (either codeword reveals; nothing else), §2.301 (initiate tick this visit
→ §269), and §4.457 (Initiate row only for Tambu initiates), plus a regression
that rolled tables still wait. Web-only; stamp and run all sections.

---

## 123. "Immunity to Disease and Poison" is stored under two un-aliased names — the blessing never protects — HIGH (state/engine)

*(Filed 2026-07-16 from a fourth full repository review.)* It is one blessing in
the books ("Immunity to Disease and Poison") but the XML grants it under two
spellings, and the engine treats them as unrelated: `BLESSING_ALIASES`
(state.js:19) maps only `storms → storm`, and `hasBlessing` (state.js:630) does
literal canon-name matching. JaFL's `Blessing.getBlessing()` maps any type
containing "disease" **or** "poison" to the same `DISEASE_TYPE`.

Corpus: granted as `blessing="poison"` at §2.133 (`<tick blessing="poison"
flag="x">Immunity to Disease and Poison</tick>`) and as `blessing="disease"` in
9 places (§1.481, §2.402, …); tested/spent under the *other* name throughout —
`<if blessing="poison">` ×15 (§2.377, §2.430, §3.162, §6.191, …) with paired
`<lose blessing="poison">` ×17, and `<if blessing="disease">` ×8 / `<lose>` ×9.
A player holding the §2.133 blessing gets no protection at any disease check
(and vice versa): the death/damage branch fires while the sheet still shows the
blessing.

Fix: alias `poison` and `disease` to one canonical name in `BLESSING_ALIASES`
(mirroring the storm/storms precedent), and sanitize existing saves so a stored
blessing under either name survives as the canonical one. Test: grant under
"poison", check `<if blessing="disease">` passes and `<lose blessing="disease">`
consumes it (and the reverse); confirm §5.365's storm/disease/injury menu still
grants three distinct blessings. Web-only; stamp and run all sections.

---

## 124. Loading/importing a save clamps Stamina to the written max — aura Stamina is silently stripped — HIGH (state)

*(Filed 2026-07-16 from a fourth full repository review; reproduced headlessly.)*
`sanitizeData` clamps `out.stamina` with `max: out.staminaMax`
(state.js:1017-1018) — the *written* maximum, not `effectiveStaminaMax()`
(state.js:221), which adds aura Stamina. The ring of ultimate power (§5.564,
`<effect type="aura" ability="Stamina" bonus="10">`) legitimately lets
`healStamina` (state.js:518-521) fill to staminaMax+10, but `migrate()` runs
`sanitizeData` on **every** `GameState.load` (state.js:889-899) and on import —
so a ring-holder saved at 30/20 reloads at 20/20. Repro confirmed in Node: the
ring's effects round-trip intact while `stamina` drops from 30 to 20. The
service worker's `controllerchange → location.reload()` (app.js:116-123) even
triggers it with no player action after a deploy.

Fix: clamp against `staminaMax` plus the summed aura-Stamina of the sanitized
items (or defer the clamp to a post-construction reconcile pass that can use
`effectiveStaminaMax()`), keeping the conservative floor for hand-edited
imports. Test a save/load round trip at 30/20 with the ring (survives), the same
save without the ring (clamps to 20 — reconcileEquipment's drop rule, task 44),
and an import of both. Web-only; stamp and run all sections.

---

## 125. Flag-linked item rewards outside choose-one menus are free, and paying can never grant them — HIGH (render/engine)

*(Filed 2026-07-16 from a fourth full repository review; follow-up to tasks 43/63
and sibling of open task 117's cost side.)* `renderItemAward` honours a `flag=`
only when `isChooseOne(flag)` says the flag feeds a choose-one menu
(render.js:2022-2023); a **single** flag-linked reward falls through to the
ordinary always-enabled Take button, the flag dropped. The payment side cannot
compensate: `renderOptionalPay`'s click applies linked rewards via
`applyEffect` (render.js:1520-1524), but `EFFECT_APPLIERS` (engine.js:406-418)
has **no entry for `item`/`weapon`/`armour`/`tool`** — an item reward is a
silent no-op there.

Live: §3.346 — pay `<lose item="pirate captain's head" price="x">` (or witch's
hand) for `<item name="200 Shards" flag="x"/>`; the Take button is live with no
payment, and since `begin()` resets flags and the `take@` memo is per-visit,
looping the §44 hub makes it a **repeatable free 200 Shards**, while clicking a
cost button destroys the trophy and grants nothing. §1.342/§4.111 — the potion
of restoration (`<item … flag="x">` behind a `<group>` of `<lose shards="250"
price=""/>` + `<lose item="ink sac" price="x"/>`) is free to take while merely
*holding* the ingredients, and paying yields nothing. (§4.634's Take-button
status quo is documented under task 63 — supersede it here.)

Fix: gate every flag-linked award on its flag (armed → live, taken → consumed),
not only choose-one menus, and give the item family a real applier (reuse the
award transaction `grantItemNode` uses, capacity-checked) so payment-side
rewards land. Test §3.346: no trophy → Take disabled; pay head → medallion
granted once, not repeatable on re-entry; and §1.342: potion only after the
group payment. Web-only; stamp and run all sections.

---

## 126. A collapsed `<group>` action never executes its `<buy>` children — §5.192's ship and §4.622's cargo are unobtainable — HIGH (render)

*(Filed 2026-07-16 from a fourth full repository review; follow-up to tasks 96/
107/61.)* `renderGroup` collects a collapsed group's click effects with
`querySelectorAll('lose, tick, gain, set, curse, transfer')` plus item-family
awards and `<rest>` (render.js:912-922) — `<buy>`/`<sell>` are in neither list,
and a collapsed group renders only its label, so the trade never runs. JaFL's
`BuyNode` is an `Executable` that runs with its group (`TradeNode.java:248`,
with a `GroupNode` special case at :403).

Live: §5.192 — `<group><text>50 Shards</text><buy ship="brig" name="Wrath of
God" shards="50" initialCrew="none" quantity="1"/><lose item="deed to the Wrath
of God"/></group>`: clicking destroys the deed, charges nothing, and **the ship
is never added** — permanently unobtainable. §4.622 (×3) — `<group><text>Metals
</text><buy cargo="metals" quantity="1" shards="0" force="t"/><tick
codeword="4.622.1"/></group>`: the codeword hides the option forever, the free
salvage Cargo Unit never loads.

Fix: include `buy`/`sell` in the group's executable collection, routing them
through the same `buyTrade`/inline-buy transaction as standalone rows (price
charged from the group click, ship-here/cargo-space checks enforced, `force=`
and `quantity=` honoured). Test §5.192 (deed + 50 Shards → ship exists, docked
here, crew poor) and §4.622 (click Metals → cargo aboard + codeword ticked).
Web-only; stamp and run all sections.

---

## 127. Abbreviated cargo names are never canonicalised — the trans-book trading economy is broken — HIGH (market/engine/rules)

*(Filed 2026-07-16 from a fourth full repository review.)* Three whole markets
sell cargo under abbreviated names — §4.252 and §5.145/§5.225 use `grai`,
`meta`, `mine`, `spic`, `text`, `timb`, `slav` — and §5.447 sells `mineral`
(vs `minerals` everywhere else). The port stores the raw attribute on the
manifest (`buyTrade`, market.js:101) and matches exactly everywhere:
`ownsGoods`/`sellTrade`/`sellCargo` via `Array.includes` (market.js:73/126/217)
and `matchCargo` via normalized equality (engine.js:377-383). JaFL's
`Ship.getCargo` matches by **prefix** and stores a canonical enum.

Consequence: cargo bought at those ports can never be sold at any full-name
market and vice versa; §5.447's units are unsellable anywhere; `<if cargo=>` /
`<lose cargo=>` full-name checks miss the abbreviated units; the manifest
displays raw `meta`. The buy-low/sell-high shipping loop between books is dead
through those ports.

Fix: one canonical cargo list (rules.js, mirroring `SHIP_TYPE_ALIASES`, task 24)
with prefix matching applied at every entry point — trade-row parsing, manifest
writes, `matchCargo`, and ship-loss/transfer paths — plus a save sanitize that
canonicalises already-stored names. Test: buy `meta` at §4.252, sell `metals` at
a full-name port; `<if cargo="minerals">` sees a §5.447 unit; round-trip a save
holding `grai`. Web-only; stamp and run all sections.

---

## 128. A bare `ability=` disjunct on `<if>` is always true — §5.680 gives away the ring of ultimate power — HIGH (engine)

*(Filed 2026-07-16 from a fourth full repository review.)* `evaluateCondition`
ORs its recognized attributes (engine.js:191-192), and the `ability=` condition
with no `equals/greaterthan/lessthan` comparator defaults to `v > 0`
(engine.js:250) — always true, since abilities floor at 1. In JaFL an ability
condition without a comparator never matches, and in `<if tool="…" ability="…"
bonus="…">` the ability/bonus attributes belong to the *item pattern* (a
MAGIC+6 tool), not a standalone test (`IfNode.java:110`, :335-339).

The only live no-comparator ability `<if>` is the one that matters most:
§5.680's `<if tool="hyperium wand" ability="magic" bonus="6">…<goto
section="564"/></if>` — the always-true ability disjunct forces the branch open
with no wand, §5.564's `<lose item="hyperium wand"/>` removes nothing, and
Targdaz forges the ring of ultimate power (+2 Rank, +10 Stamina auras, task 44):
the entire Akatsurai tomb quest is skippable and the game's best item free.

Fix: a no-comparator `ability=` condition must not match (mirror JaFL), and when
an equipment selector (`tool=`/`weapon=`/`armour=`) is present, fold `ability=`/
`bonus=` into that selector's pattern instead of treating them as disjuncts
(`matchEquipment` already receives the element — engine.js:252-254). Test §5.680
with no wand (branch inert, "If not" live), with a plain hyperium wand vs the
MAGIC+6 one if distinguishable, and a regression that comparator forms
(`<if ability="rank" greaterthan=…>`, task 68) still work. Web-only; stamp and
run all sections.

---

## 129. Free fixed-amount `<rest stamina="N">` is infinitely repeatable — every hospitality rest heals to full — MEDIUM (render/engine)

*(Filed 2026-07-16 from a fourth full repository review.)* `renderRest`
(render.js:3706-3728) keeps the button clickable until Stamina is full, with no
per-visit memo. JaFL's `RestNode` defaults `useOnce = (shards == 0)`: an
**unpriced** rest may be used once per visit; only priced rests (pay per day)
repeat. The corpus never sets `once=`, so the Java default is the operative rule
everywhere.

Live: §2.61 ("you are allowed to stay **one night**", `stamina="2"`), §1.518
(+3), §1.614 (+5), §2.385/§2.519/§2.662/§3.153 (+1), §2.481/§2.677/§3.150
(`1d`), §2.739 (`2d`), §3.314's per-day `<rest stamina="1">` — all currently
click-to-full free heals.

Fix: memoize an unpriced rest per visit (`rest@path` in ctx, like other one-shot
actions); priced rests and the no-`stamina=` heal-to-full form (task 31) keep
their current behaviour. Test: §2.61 heals 2 once then disables until re-entry;
a priced rest still repeats; `<rest/>` still fills. Web-only; stamp and run all
sections.

---

## 130. Inline `<buy>` allows one purchase per visit; JaFL's default is unlimited — MEDIUM (render)

*(Filed 2026-07-16 from a fourth full repository review; adjusts a task-23
default.)* `renderInlineBuy` defaults `quantity` to 1 (render.js:3576); JaFL's
default is −1 = infinite (`TradeNode.java:319`; spec: quantity = "the number of
times this action may be used", absent ⇒ no limit). Task 23 chose 1 "so a buy
can no longer repeat forever", but three sections sell in bulk by prose:
§1.342 and §5.639 ("You can buy as many as you can afford — each one costs 50
Shards", six potions each) and §5.447 ("It costs you 350 … for every such Cargo
Unit"). Players must leave and re-enter per unit today.

Fix: default inline `<buy>` to unlimited-per-visit (disabled only by funds/
capacity), honouring an explicit `quantity=` as the cap — matching the reference
and the prose — and keep the §4.658-style `quantity="1"` rows one-shot. Test
§1.342: buy the same potion twice in one visit while affordable; §4.658's
barque still buys once. Web-only; stamp and run all sections.

---

## 131. Cache `max=` semantics: `max="0"` must bar deposits, and item caches must store Shards — MEDIUM (render)

*(Filed 2026-07-16 from a fourth full repository review; follow-ups to tasks
20/38.)* Two `max=` divergences from the spec ("Use '0' to bar money from this
cache"; "an `<itemcache>` may contain both" items and money — JaFL `CacheNode`
uses −1 as its no-limit default and renders a Shards field on item caches):

- `renderMoneyCache` treats `max="0"` as *no cap* (`if (max > 0)` —
  render.js:3764). §4.263's arena Winnings cache (`<moneycache name="4.127"
  text="Winnings" max="0"/>`) therefore accepts fresh deposits at the result
  section, and its sibling `<adjustmoney name="4.127" multiply="2">` becomes a
  repeatable **money-doubling exploit**: deposit anything, double it, withdraw.
  With `max="0"` honoured, only the bet locked in at §4.127 is doubled.
- `renderItemCache` (render.js:3793-3882) ignores `max=` entirely and offers no
  money controls, so §6.512's lacquer cabinet ("store up to 5000 Shards and six
  possessions", `<itemcache … itemlimit="6" max="5000"/>`) cannot hold Shards.

Fix: parse `max` with 0 = barred / absent = unlimited in both cache widgets, and
add deposit/withdraw money controls (capped by `max=`) to item caches. Test
§4.263: deposit refused, the ×2 still applies to the §4.127 bet; §6.512: deposit
5000 accepted, 5001st refused, items still capped at 6. Web-only; stamp and run
all sections.

---

## 132. `<if blessing="?">` never matches — §5.365's chapel stacks blessings — MEDIUM (engine/state)

*(Filed 2026-07-16 from a fourth full repository review.)* `evaluateCondition`
delegates to `state.hasBlessing('?')` (engine.js:229), which looks for a
blessing literally named "?" (state.js:630) — always false. JaFL maps `"?"` to
`MATCHANY_TYPE` (any blessing held). The only live use is §5.365: `<if
blessing="?">If you already have a blessing of any sort, he cannot give you
another.</if><else>…choose storm/disease/injury…</else>` — the `<else>` always
renders, so a player already blessed takes another, violating "only one blessing
at a time" (and, with task 123 unfixed, can hold several spellings at once).

Fix: special-case `"?"` (and `"*"` for symmetry with the item matcher) in
`hasBlessing` or at the condition site: any stored blessing matches. Test §5.365
blessed (menu blocked) and unblessed (menu live); `<lose blessing="?">`'s
existing chooser behaviour unchanged. Web-only; stamp and run all sections.

---

## 133. Adventure-Sheet mutations leave the story pane stale — item-gated choices stay live after the item is gone — MEDIUM (app/render/market)

*(Filed 2026-07-16 from a fourth full repository review.)* Choice gating is
render-time only: eligibility (incl. `hasItemMatch`) is computed when the choice
renders (render.js:2219), and the click handler's `payChoiceCost`
(market.js:198-203) never re-validates — a missing item is silently skipped
(`if (it) state.removeItemById(…)`) and navigation proceeds; `adjustMoney`
floors at 0 likewise. Sheet-initiated mutations only refresh the sheet:
`state.onChange` (app.js:522) never rerenders the story, and the Drop handler
(ui.js:163-168) and curse-lift (ui.js:240-263, task 112) mutate state directly —
unlike `onUseItem` (app.js:553-564), which already calls `story.rerender()`.

Repro: enter a section with `<choice item="X" pay="t">` (task 55's §2.400 green
gem / §6.740 rope) holding X; Drop X from the sheet; the choice is still
enabled — click it and cross for free. Curse-lift similarly leaves
`<if curse=>`-gated content stale on screen.

Fix (both belts): make `payChoiceCost` return success and block navigation when
the cost cannot be taken in full, and rerender the story after sheet-initiated
mutations (drop/move/lift) the way `onUseItem` does. Test: drop-then-click pays
nothing and refuses; the rerendered choice greys out; lifting a curse reveals
its gated content without re-entering. Web-only; stamp and run all sections.

---

## 134. Market sells with several candidates silently take the first match — LOW (market)

*(Filed 2026-07-16 from a fourth full repository review.)* `sellTrade` picks the
first ship of the type (market.js:122 — a **cargo-laden** ship can be sold,
destroying its cargo, while an empty same-type ship sits in the same berth), and
generic weapon/armour/item rows pick the first bonus/name match
(market.js:131/137). JaFL prompts ("You have multiple ships of this type.
Select one…", "Please select which one you want to sell") whenever matches are
non-identical. Any generic `<weapon bonus="1" sell=…>` row (e.g. §1.215) with a
mixed inventory, or any ship sale with two same-type ships, can take the wrong
possession irrevocably.

Fix: when candidates are non-identical, surface the same chooser UI the loss
path uses (tasks 93/107; open 117/118 build the shared matcher — reuse its
candidate enumeration), preferring cargo-empty ships and unnamed duplicates as
the no-prompt fast path. Headless callers keep first-match determinism via an
explicit chooser callback. Test: two brigantines (one laden) — sell offers a
choice / defaults to the empty one headlessly; two bonus-1 weapons — the named
one survives unless chosen. Web-only; stamp and run all sections.

---

## 135. Renouncing a god keeps that god's resurrection deal — LOW (state/engine)

*(Filed 2026-07-16 from a fourth full repository review.)* `removeGod`
(state.js:730-738) strips god-sourced effects but leaves `data.resurrections`
untouched; JaFL's `removeAGod` cancels resurrections tied to the god, and a deal
bought while *not* a worshipper is stored god-less (`Adventurer.java:518-534`,
:833-843 — the port stores `god` unconditionally, engine.js:1333-1336). Seven
live god-linked deals (§1.33/§1.478/§1.599 Tyrnai/Nagil, §2.41/§2.204/§2.316,
§4.268); renounce paths: `<lose god=>` (engine.js:567) and `special="godless"`
(§6.118, engine.js:809-811). A renouncer keeps a free extra life the rules
forfeit.

Fix: cancel resurrections whose `god` matches on renounce (both paths), and only
stamp `god` on a deal when the buyer worships that god at purchase time. Test:
buy the Tyrnai deal as a worshipper, renounce → deal gone; buy it godless →
renouncing anything leaves it. Web-only; stamp and run all sections.

---

## 136. Engine grab-bag #2: five small reference divergences — LOW (engine/render)

*(Filed 2026-07-16 from a fourth full repository review; precedent task 36.)*
Each verified against code, corpus and the Java reference; none shares a fix
seam with the others, all are a few lines:

1. **`<transfer shards="tenth">` hardcodes floor(purse/10)** (engine.js:972),
   shadowing §6.496's own `<set var="tenth" value="(shards+9)/10"/>` (rounded
   *up*). JaFL has no `tenth` keyword — delete the special case and let the var
   resolve; the tithe stops under-paying by 1 on non-multiples of 10.
2. **Named `<lose cargo="grain">` removes one unit; JaFL removes every unit** of
   the commodity (`LoseNode.java:600`). §5.634's salvage ("they are lost")
   leaves extras aboard. Remove-all for plain named losses only — §3.569's
   priced one-for-one exchange (open task 117) must stay single-unit.
3. **`<effect description="+5 Stamina">` is dropped** — `readItemEffects`
   (engine.js:1195-1216) reads only `text=`; §5.638 is the sole `description=`
   corpus-wide. Accept it as a `text=` fallback so the sheet shows the effect.
4. **`<set>` identifier edges**: `value="rank"` ignores `modifier="natural"`
   (engine.js:1275 always returns `rankValue()` incl. the ring's +2 aura) and
   the keyword shadows a same-named var — §2.270-style book 2 ceremonies
   (`<set var="rank" value="rank" modifier="natural"/>` then `lessthan="rank"`)
   misjudge ring-holders; and a **cursed** ability read under
   `modifier="natural"/"affected"` returns the `CURSED_ABILITY` −1000 sentinel
   (state.js:302-303) where JaFL's value-purpose read returns 0 — §6.332's
   `value="12-charisma"` would yield 1012 under a CHARISMA curse. Resolve
   value-context reads like JaFL (natural honours the modifier; cursed → 0).
5. **`<buy force="t">` is not forced** — §4.658's free barque ("Note it on your
   Adventure Sheet", the section's only ship) renders as an optional button a
   player can walk past; JaFL blocks onward execution while an enabled forced
   buy is pending. Gate the section's onward goto until the forced buy runs
   (the task-104 gate pattern).

Test each with a focused headless assertion (§6.496 tithe of 995 → 100; §5.634
with 2 grain → 0 left; §5.638 effect text visible; §2.270 with +2 aura ring —
natural rank compared; §6.332 under a charisma curse → 12−0; §4.658 goto gated
until the barque is taken). Web-only; stamp and run all sections.

---

## 137. A save blob can persist without its `fl_meta` entry — the orphaned slot turns invisible and gets overwritten — LOW (state/app)

*(Filed 2026-07-16 from a fourth full repository review; the seam tasks 4/7
missed.)* `save()` writes `fl_save_<slot>` then `fl_meta` (state.js:866-887); if
the meta write throws (quota reached between the writes) the blob **is**
persisted while `nextFreeSlot()` (state.js:1247-1251), the title screen's
`hasSaves` (app.js:167-168) and the save list consult only `fl_meta` — the
adventurer vanishes from "Your Adventurers" and the next New Adventure or import
claims the slot and silently overwrites it. `loadSlotMeta` also degrades corrupt
meta JSON to `{}` wholesale, orphaning every slot at once; and `readSlotData`
(state.js:1216-1219) has no try/catch, so exporting a corrupt-but-present slot
throws uncaught from the click handler.

Fix: make `nextFreeSlot` (and the overwrite confirm) probe
`localStorage.getItem(SAVE_PREFIX + i)` as well as meta; on load, rebuild
missing meta entries from readable blobs; guard `readSlotData`. Test: delete the
meta entry for an occupied slot → the slot still lists (reconstructed) and is
not offered as free; corrupt blob → export fails with the task-7 toast, no
throw. Web-only; stamp and run all sections.

---

## 138. Offline navigations with a query string bypass the service-worker cache — LOW (sw)

*(Filed 2026-07-16 from a fourth full repository review.)* The fetch handler
uses `caches.match(req)` with no `ignoreSearch` (sw.js:99); the precache stores
`./` and `./index.html` without queries, so an offline navigation to
`./?demo=1.10` or `./?seed=42` (both documented hooks — README's deep-link
section) misses, `fetch` rejects, and the `.catch(() => cached)` fallback
(sw.js:107) returns `undefined` → a network-error page instead of the cached
shell. Installed launches (`start_url: "./"`) are unaffected.

Fix: for navigation requests, fall back to `caches.match(req, { ignoreSearch:
true })` (or explicitly to `./index.html`). Test in the harness by faking a
query-string navigation against the cache contract, and manually: install,
offline, open `?seed=1`. Web-only; stamp and run all sections.

---

## 139. The Adventure Sheet never shows foreign-currency balances — LOW (ui)

*(Filed 2026-07-16 from a fourth full repository review; completes task 40.)*
`renderSheet` (ui.js:79-228) shows Shards only; `state.data.currencies`
round-trips saves (state.js:1075-1076) but surfaces nowhere outside a
same-currency market/choice widget. Sell a boar's tusk for 15 Mithral at §2.495
and the wealth is invisible until the player happens into another Mithral
widget (§2.545 toll) — a paper-sheet player would have it written down.

Fix: list non-zero foreign balances under the Shards line (name + amount, same
styling as ability rows). Test: adjustCurrency('Mithral', 15) → sheet shows
"Mithral 15"; zero balances hidden. Web-only; stamp and run all sections.

---

## 140. Docs/CI accuracy: AGENTS.md's smoke-test URL 404s and the CI grep misses `RESULT FATAL` — HIGH (docs/ci)

*(Filed 2026-07-16 from a fourth full repository review as LOW; moved to second
position the same day, on the same logic as task 141: zero-risk, no
dependencies, and it corrects the build-and-test instructions every subsequent
task follows — the misleading docs should be fixed before the burn-down, not
after.)* Two verified
discrepancies that mislead exactly when something is failing:

- AGENTS.md says "serve from the repo root" then drives Chrome at
  `http://localhost:8848/_test.html` — a 404 from a root-rooted server (the file
  is at `/web/_test.html`), producing the "no RESULT line" symptom the same doc
  then misattributes to "server/Chrome never loaded the page". CI (smoke.yml:38)
  uses the correct `/web/_test.html`. README's Testing section is internally
  consistent (serve `web/` itself) but disagrees with AGENTS.md's serving
  directory — align both on one recipe (serve repo root, test at
  `/web/_test.html`) and fix the misattribution note.
- smoke.yml:41 greps `RESULT (ALL PASS|FAILURES) …` — the task-82 bootstrap's
  `RESULT FATAL pass=0 fail=1` line (_test.html:17) is unmatched, so a module
  parse failure prints CI's "(no RESULT line — the suite did not run)": the
  precise misleading diagnosis task 82 was built to eliminate (the job still
  fails, via the ALL PASS check). One-line pattern fix; add a FATAL branch with
  its own message.

Docs/CI-only; no stamp needed; run the suite once to confirm the documented
commands work as written. *(Related but filed separately: task 121 owns the
`powershell` vs `pwsh` build-command question — keep the two consistent.)*

---

## 141. Archive completed task details out of TASKS.md — HIGH (process)

*(Filed 2026-07-16 from a fourth full repository review as LOW; moved to the top
of the list the same day: it is zero-risk cut-and-paste, has no dependencies,
and every subsequent task pays the cost of reading this file — do it first.)* TASKS.md is ~290KB /
4,500+ lines and ~88% of it is detail sections for the 100+ **done** tasks; the
workflow makes every agent read the file each task, and new open details land
thousands of lines deep. Move the done detail sections verbatim to
`TASKS-archive.md`, keyed by the same stable task numbers; keep in TASKS.md the
header, the full checklist (open **and** done lines unchanged — they are the
stable IDs commit messages reference), the open-task detail sections, the Review
log, and a one-line pointer to the archive. Invariants: task numbering stays
stable, new filings still append to TASKS.md, the Review log stays in the main
file, and a moved section is never edited in transit (pure cut-and-paste).
Docs-only; no build or test impact; verify by grepping a sample of done task
numbers in both files (checklist line in TASKS.md, detail in the archive).

---

## Review log

*Running audit log of the backlog — each pass re-verifies the open items against
the current code and records what was filed, split, or re-confirmed. Task
numbers refer to the contents checklist at the top of the file.*

Reviewed 2026-07-16 (fourth full pass): started clean at `b012eff` (no code
changes since the third pass — this pass was an independent re-audit with fresh
eyes: six parallel subsystem sweeps over engine/render/state/app/combat/market/
corpus/build, each finding verified against code, live XML, the JaFL reference
and TASKS.md before filing; the sweep was interrupted mid-run by an org spend
limit and resumed, so its coverage is recorded per area below). All seven open
premises re-verified: **115** confirmed but corrected (the live failure mode is
a *stale* return frame, not the fresh-visit fallback; the death→resurrection
path at app.js:649 added to the sweep), **116/117/118/119/120** confirmed as
filed (scope notes added: 117 gains the forced-payment seam, 119 the
non-recursive stamp collector trap, 120 two async-error harness gaps), and
**121** confirmed by live repro but rescoped — stamp-version.ps1 already runs
under 5.1, and the real blocker is engine-dependent output (culture-aware
`Sort-Object` changed the stamp hash; `ConvertTo-Json` escaping reformats the
book JSONs), so 5.1 parity is more than the punctuation fix. Filed tasks
**122–141**: roll-less `<outcome codeword=>` tables dead-end eight sections —
confirmed live at `?demo=4.2`, which renders the accept-your-fate button (122);
the disease/poison blessing's two un-aliased names (123); load/import stripping
aura Stamina (124); ungated flag-linked item rewards — §3.346's repeatable free
200 Shards (125); collapsed groups dropping `<buy>` — §5.192's Wrath of God
unobtainable (126); un-canonicalised abbreviated cargo names breaking the
shipping economy (127); §5.680's always-true bare-ability disjunct handing out
the ring of ultimate power (128); repeatable free fixed rests (129); inline-buy
quantity default (130); cache `max=` semantics incl. §4.263's money-doubling
(131); `<if blessing="?">` (132); stale story pane after sheet mutations (133);
market-sell first-match (134); renounce keeping god-tied resurrections (135); an
engine grab-bag — `tenth`, cargo-loss quantity, `description=`, `<set>`
identifier edges, `<buy force>` (136); save/meta orphan slots (137); offline
query-string navigations (138); foreign currencies missing from the sheet (139);
AGENTS.md's 404 test URL + CI's unrecognised `RESULT FATAL` (140); and archiving
done details out of this file (141). A fresh strict corpus pass re-confirmed
**4,369 sections, 0 parse errors, 0 name mismatches, 0 dangling Book 1–6
targets** (11 sections with no inbound markup link are inherited data quirks,
e.g. book4/69's own text says so). Checked and deliberately **not** filed:
market-level `buy=/sell="f"` column flags are ignored but harmless (no
opposite-side prices exist in any of the 9 affected markets); `inferDice`'s
1-die inference is correct for the corpus's only all-≤6 table (book3/411); the
six non-storm `<reroll>`s carry no effect children; `<outcomes var="z">`
(book6/731) works because every child repeats the `var=`; `<goto visit="t">`
(§4.231) is a spec'd no-op; `<trade name=>` ship rows and `header type="ships"`
are handled/display-only; task 30's documented repeat-outcome limitation was
re-examined (§5.674's pay-per-attempt cure is its worst live case) and left as
documented. Suite green at the reviewed tree, fresh profile:
`RESULT ALL PASS pass=1076 fail=0`.

Re-prioritised 2026-07-16 (same day, follow-up): tasks **141** and **120** moved
LOW → HIGH. 141 (archive done details) goes **first** — zero-risk, no
dependencies, and every subsequent task pays the cost of reading this file. 120
(test split + async-gap hardening) slots after the quick severe fixes 122–124
and **before** the test-heavy 115–117 chain, so the ~20 open tasks write their
tests into focused suites rather than deepening the single-scope monolith, and
the silent-pass vectors are closed before the big fixes' green runs are trusted.
A second ordering pass the same day moved **140** LOW → HIGH second position
(same logic as 141: zero-risk, and it corrects the test instructions every task
follows) and **118** MEDIUM → HIGH immediately after 117 (hard dependency on
117's shared loss matcher — back-to-back keeps the design context warm; the
irreversible plot-item loss also supports HIGH). Checked and deliberately left:
119 stays after the bug burn-down (the fixes build its planners and their tests
de-risk the refactor); 121 stays MEDIUM (dev-only, and its rescope made it a
decision + larger job, not a quick win); 132 stays MEDIUM despite sharing 123's
blessing seam (that seam is trivial to re-enter, unlike 117's matcher); 137
stays after 116 (116 rewrites the persistence schema 137 would touch); 134/136
stay after the matcher and buy-transaction work they reuse. Work order is now
141 → 140 → 122 → 123 → 124 → 120 → 115 → 116 → 117 → 118 → 125–128.

> Older audit passes (the 2026-07-15 third full pass and everything before it) are archived in [`REVIEW.md`](REVIEW.md), alongside the 2026-07-09 external repository review. The most recent pass stays above.
