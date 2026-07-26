# Fabled Lands — Web Edition · Engineering TODO

Backlog of recommended improvements. Open tasks are filed under priority buckets
(**HIGH** / **MEDIUM** / **LOW**) — work the first open (`- [ ]`) item top-down;
each task's detail section carries the same stable ID. **All filed tasks are
complete through 181**. The eleventh full review filed tasks 180–202 below; 203
was filed while working task 180, and 204–205 while working task 181.
Completed detail sections are archived in
[`TASKS-archive.md`](TASKS-archive.md); the Review log at the end records each
audit pass.

**HIGH**

- [x] 180. Imported visit/combat memos can execute HTML/JavaScript on resume
- [x] 181. Finish task 175: a blessing-reroll result is still observable before Keep
- [x] 182. Delayed rolls and attacks can mutate a save after Save & quit
- [x] 183. Disease/poison immunity blessings do not prevent infection
- [x] 184. Named removal leaves stacked cumulative curses behind

**MEDIUM**

- [x] 185. Wildcard affliction effects (`ability="*"`) are discarded
- [x] 186. Automatic highest-bonus equipment can select a worse loadout
- [x] 187. Named market sales ignore item kind and equipment stats
- [x] 188. `<rest hidden="t"/>` is optional instead of automatic
- [x] 189. A failed initial adventure load strands a new save on a blank game screen
- [ ] 190. Service-worker activation and lookup touch unrelated origin caches
- [ ] 191. Speech-enabled narrow headers clip critical controls
- [ ] 192. The mobile Adventure Sheet is visually hidden but remains keyboard-exposed
- [ ] 193. Stale speech callbacks can advance or cancel a newer narration
- [ ] 194. SPA section transitions provide no focus target or announcement
- [ ] 195. DOM-free rule modules are not directly importable in Node
- [ ] 196. The build stamp is date/EOL dependent and omits service-worker code
- [ ] 197. CI tests committed bundles without rebuilding their XML source
- [ ] 203. An imported return frame restores unvalidated vars, ticks and location

**LOW**

- [ ] 198. A failed save deletion can leave an unrecoverable ghost slot
- [ ] 199. Build validation misses source-schema typos and bundled-book dangling targets
- [ ] 200. AGENTS.md overstates test-suite parse-error isolation
- [ ] 201. A service-worker update can erase an unsaved character-creation draft
- [ ] 202. Complete remaining form, selection and progress semantics
- [ ] 204. A derived `<set>` inside a `<while>` body is not traced per iteration
- [ ] 205. The provisional-result gate locks a flee exit the fight gate deliberately leaves open

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
- [x] 115. Adventure-Sheet item detours bypass `Story.navigate`, so `<return>` still re-enters the source section
- [x] 116. Save/load restarts the current visit — effects can repeat and rolls/return state disappear
- [x] 117. Priced equipment/cargo losses can arm their reward without taking the required payment
- [x] 118. Choice/equipment losses can remove `keep`-tagged possessions *(immediately after 117 — same shared loss matcher)*
- [x] 119. Re-establish the rules/view boundary and split the 4,060-line renderer by responsibility
- [x] 120. Split the 4,790-line single-scope browser test into focused ES-module suites *(before the test-heavy 115–117 chain)*
- [x] 121. The documented `powershell` build command no longer parses `build-data.ps1` on Windows PowerShell 5.1
- [x] 122. Roll-less `<outcome codeword=…>` decision tables never resolve — eight sections render as dead ends
- [x] 123. "Immunity to Disease and Poison" is stored under two un-aliased names — the blessing never protects
- [x] 124. Loading/importing a save clamps Stamina to the written max — aura Stamina (ring of ultimate power) is silently stripped
- [x] 125. Flag-linked item rewards outside choose-one menus are free, and paying can never grant them
- [x] 126. A collapsed `<group>` action never executes its `<buy>` children — §5.192's ship and §4.622's cargo are unobtainable
- [x] 127. Abbreviated cargo names (`grai`, `meta`, …) are never canonicalised — the trans-book trading economy is broken
- [x] 128. A bare `ability=` disjunct on `<if>` is always true — §5.680 gives away the ring of ultimate power
- [x] 129. Free fixed-amount `<rest stamina="N">` is infinitely repeatable — every hospitality rest heals to full
- [x] 130. Inline `<buy>` allows one purchase per visit; JaFL's default is unlimited ("buy as many as you can afford")
- [x] 131. Cache `max=` semantics: `max="0"` must bar deposits (§4.263 money-doubling), and item caches must store Shards (§6.512)
- [x] 132. `<if blessing="?">` never matches — §5.365's chapel stacks blessings
- [x] 133. Adventure-Sheet mutations (drop/lift) leave the story pane stale — item-gated choices stay live after the item is gone
- [x] 134. Market sells with several candidates silently take the first match — JaFL asks which ship/item to sell
- [x] 135. Renouncing a god keeps that god's resurrection deal
- [x] 136. Engine grab-bag #2: `transfer tenth=`, named-cargo loss quantity, `effect description=`, `<set>` identifier edges, `<buy force="t">`
- [x] 137. A save blob can persist without its `fl_meta` entry — the orphaned slot turns invisible and gets overwritten
- [x] 138. Offline navigations with a query string bypass the service-worker cache
- [x] 139. The Adventure Sheet never shows foreign-currency balances
- [x] 140. Docs/CI accuracy: AGENTS.md's smoke-test URL 404s and the CI grep misses `RESULT FATAL`
- [x] 141. Archive completed task details out of TASKS.md
- [x] 142. CI's smoke verdict greps the whole DOM dump — failing runs are misdiagnosed as bootstrap FATALs
- [x] 143. A failing `ok()` fired after the report is silently lost — a latent silent-pass vector
- [x] 144. meta.json embeds the build date — a no-op rebuild busts every installed player's cache
- [x] 145. payChoiceCost validates a tag/wildcard item payment it can never consume *(latent — no corpus trigger)*
- [x] 146. A roll's dice animation leaves other controls live — the pending result lands on the wrong visit
- [x] 147. Navigation has no in-flight guard — a double-click double-runs leave hooks and entry effects
- [x] 148. undo() leaves a stale return frame — a post-undo `<return>` re-enters a pre-undo visit
- [x] 149. A priced sail choice pays before the ship chooser — an abandoned chooser eats the payment
- [x] 150. renderIfChain's list path runs `<else>`/`<elseif>` unconditionally *(latent — no corpus trigger)*
- [x] 151. The dead-end fallback counts disabled controls — an unaffordable forced payment can softlock
- [x] 152. View-layer polish grab-bag #1: begin() scaffold duplication, modal close handle, demo dead end, TTS nits, buy-parse duplication
- [x] 153. Accessibility quick wins: aria-live for toasts/rolls/fight log; dialog semantics + Escape for modals
- [x] 154. begin() autosaves the NEW section paired with the OLD visit ctx — resume aliases foreign memos onto the new section
- [x] 155. One-shot memos are written after the state mutation they guard — a reload repeats rests, buys, and failed rolls
- [x] 156. A mid-visit reload silently drops armed `<tick special="attack|defence">` bonuses and penalties
- [x] 157. Item-name glob patterns never match — §4.482/§6.201 unreachable, §6.144's trophy head never taken
- [x] 158. Two written-max Stamina clamps still strip aura headroom (task 124's remaining siblings)
- [x] 159. Resurrection revives at half Stamina — the book and JaFL both say full
- [x] 160. Loss-matcher follow-ups: named equipment losses never filter by name; `losePaymentPlan` ignores `multiple=` *(both latent)*
- [x] 161. Visit transitions can persist a destination position with the source visit memo — reload drops exact return/undo state
- [x] 162. Continuing combat redraws without persisting the updated fight memo — reload rewinds the round
- [x] 163. Post-refactor module/docs cleanup: break the roll/choice cycle and align the architecture contract
- [x] 164. Focused test suites still import the old whole-harness dependency set and boot unrelated app code
- [x] 165. Re-archive completed task details 115–160 and clear them out of the priority buckets
- [x] 166. Direct visit commits bypass persistence observers — save failures stay silent and activity timestamps go stale
- [x] 167. Mutation-bearing navigation is not atomic — a failed/pending cross-book load can consume payment without completing the move
- [x] 168. An open navigation transaction leaves unrelated UI live and globally suppresses its saves
- [x] 169. Durable-consequence navigation has no abort/retry contract — failed resurrection, flee, combat or item detours can strand the action
- [x] 170. Centralise duplicated display helpers already owned by `render-util.js`
- [x] 171. Deduplicate the single/group combat control shell without merging their rules
- [x] 172. Deduplicate roll-widget/gate/memo scaffolding without building a generic roll renderer
- [x] 173. Durable-navigation retry targets disappear on reload — the spent consequence can become a permanent dead end
- [x] 174. The controllable async-navigation test fixture is copied three times in one suite
- [x] 175. Blessing rerolls keep the rejected roll's branch effects — damage/rewards can survive or stack
- [x] 176. Unavailable-book demo links and imported saves reject outside the recoverable UI
- [x] 177. Complete modal keyboard isolation/focus restoration, including the section-view oracle
- [x] 178. Direct `choice[flee="t"]` navigation omits the durable retry contract
- [x] 179. Lazy service-worker cache writes can be terminated before `cache.put()` completes
- [x] 180. Imported visit/combat memos can execute HTML/JavaScript on resume

---

> **Completed task details (tasks 1–165) are archived** in [`TASKS-archive.md`](TASKS-archive.md) (tasks 141, 165) to keep this file focused on open work. The checklist above still carries every task's stable ID and status; a done task's detail lives in the archive under the same `## <N>.` heading. Open-task details and the Review log follow below.

---

## 166. Direct visit commits bypass persistence observers — save failures stay silent and activity timestamps go stale

**Priority: HIGH — reopens the player-facing guarantee from task 7 on every
ctx-only save path.**

`GameState.changed()` updates `data.updated`, calls `save()`, then notifies the
listeners through which `app.js` runs `surfaceSaveError()`. The explicit visit
commits added for tasks 155, 161 and 162 call `save()` directly instead:
`Story.begin()`, `resumeStale()`, `rerender()`, and eight continuing-combat or
blessing branches in `render-combat.js`. `save()` only sets `lastSaveError`; it
does not publish the result. A quota failure that occurs on the final, larger
visit write can therefore go unwarned even when the preceding state mutation
saved successfully. A pure combat round can have no `GameState` mutation at
all, making its direct visit save the only persistence attempt. Direct commits
also leave `data.updated` unchanged, so the save-card timestamp/order does not
reflect ctx-only combat or roll progress.

Implement one semantic current-visit commit path at the state/persistence
boundary and route every raw renderer/combat `save()` through it. It must:

1. advance the persisted `updated` time for real player progress (without
   causing a sheet rerender or a recursive save);
2. publish both failure and recovery so the existing warning/export UI shows a
   direct-commit failure and re-arms after a successful retry; and
3. retain the provider-written visit record and ephemeral-game behaviour.

Add focused persistence tests that force storage to fail only on a direct
visit commit, assert that a save-status observer receives the failure and later
recovery, and verify that a ctx-only combat/roll commit advances the persisted
metadata timestamp. Keep the existing normal/quota/ephemeral save tests green,
then run the full build + browser suite.

## 167. Mutation-bearing navigation is not atomic — a failed/pending cross-book load can consume payment without completing the move

**Priority: MEDIUM — an uncommon fetch/reload window can irreversibly take
Shards, an item, a blessing, or a ship action while leaving the source live.**

The task-161 transition commit makes the destination coherent *after*
`begin()`, but the source-side transaction is still split. `renderChoice()`
calls `payChoiceCost()` first (which autosaves the deduction), then records
`_pendingSourceNode` and starts `Story.navigate()`. The wrapper installs the
spent-action return frame only in memory and does not save again until the
destination fetch resolves. If the tab closes during that fetch, the persisted
source visit has paid but still presents the same unspent choice on reload. If
`data.getSection()` rejects, the move never completes, the payment is already
gone, and `_navInFlight` is never released because the wrapper neither returns
nor catches the raw navigation promise. This is live on paid cross-book routes,
including §1.123 (1 Shard), §1.495 (50 Shards), §1.656 (100 Shards), §2.190,
§5.333 and several Book 6 voyages. The same ordering must be audited for flee
effects, blessing spends, sailing, item-use detours and any combat/action branch
that mutates state immediately before navigating.

Make a mutation-bearing move transactional across target validation and the
source/destination visit hand-off. A rejected or missing target must leave the
source's resources, action availability, return frame and navigation guard in a
coherent recoverable state; a successful target must apply the mutation once,
run leave hooks once and persist the destination plus its source frame once.
Do not solve this with a second uncoordinated save that merely chooses a
different half-finished state.

Add focused navigation tests with a controllable pending/rejected raw navigate:
cover a paid cross-book choice and at least one other mutation-before-navigation
path, inspect the persisted source record while pending and after rejection,
then resolve successfully and verify one deduction, one turn, one return frame
and a released `_navInFlight` guard. Run the full build + browser suite.

## 168. An open navigation transaction leaves unrelated UI live and globally suppresses its saves

**Priority: MEDIUM — the task-167 transaction is global while the rest of the game
remains interactive, so a slow cross-book load can lose, misroute or falsely report
unrelated progress even when the original move succeeds.**

`beginTxn()` snapshots the whole `GameState.data` and sets one global `_txnSuppress`
flag. Until the target settles, **every** `save()` refreshes the in-memory visit, clears
`lastSaveError` and returns `true` without touching storage. `_navInFlight` blocks only a
second `Story.navigate()` call; it does not disable the current section's non-navigation
actions, Adventure-Sheet controls, app header or game menu. During a slow cross-book
fetch the player can therefore drink/drop/use an item, buy/rest/resolve another immediate
action, or press **Save & quit**:

- on rejection, `rollbackTxn(snap)` replaces the whole data object and discards every
  concurrent mutation along with the move's price;
- on success, a concurrent mutation can be committed at the destination even though its
  source-visit memo/return frame was captured before it; an item use that tries its own
  detour applies/consumes first, then has that second navigation silently ignored by the
  guard; and
- explicit Save & quit sees the suppressed `save()` return `true` and can leave the game
  screen claiming success despite no write for that action.

This is broader than the originally filed failed-fetch/drop intersection. Same-book
moves still have only a microtask-sized window because their book is cached, but a slow
or failing cross-book request leaves the live controls exposed long enough to matter.

Make the transition isolate only its own tentative mutations, or enter one explicit
app-wide transition state that blocks every state-mutating story/sheet/menu action until
the move settles. A raw persistence primitive must never report a successful explicit
save merely because a transaction suppressed it. Keep destination+price atomicity,
failure refund, return-frame semantics and the navigation guard from task 167. While
touching the commit path, have `commitTxn()` reuse the identical timestamp/save/status
logic in `commitVisit()` rather than maintaining a second four-line copy.

Add focused tests for a pending cross-book move plus (a) a concurrent non-navigation
mutation on rejection and success, (b) a charged item whose own detour is attempted, and
(c) an explicit save attempt. Assert that no action is silently lost/misrouted, no save
claims success without a write, the original move still commits/rolls back once, and all
controls/guards recover. Run the full build + browser suite.

## 169. Durable-consequence navigation has no abort/retry contract — failed resurrection, flee, combat or item detours can strand the action

**Priority: MEDIUM — a target-load failure is uncommon, but these paths can consume a
resurrection or item, apply a wound/reward, and then leave no way to reach or retry the
section that consequence was meant to open.**

Task 167 transacts only the move's deferred `opts.pay`. Several callers deliberately
apply and autosave a legitimate consequence **before** calling `Story.navigate()`, so
`beginTxn()` snapshots the already-mutated state and `abort()` restores only to that
post-consequence point:

- `handleDeath()` and `renderGroup()` call `reviveWithResurrection()` first, consuming
  the chosen deal and healing, then navigate to its recorded section. A deal from another
  book makes this a real cross-book fetch whenever the player dies elsewhere.
- `Story.useItem()` applies the effect, decrements/removes its charge, then follows an
  inner goto (Vade Mecum/books/boxes). A failed target can leave the charge spent with no
  durable pending detour.
- the duplicated single/group flee handlers apply the parting consequence and mark the
  fight fled before navigating; a failed target rerenders a spent/fled source with no
  retry control.
- combat `roundGoto` and group-action goto paths clear or memoise the triggering action
  before navigation, so abort can retain the effect while losing the redirect.

Define an abort policy for consequence-bearing moves. Either validate/enter the target
before committing the consequence, roll the whole action back safely, or persist a
pending transition/retry control that reaches the target without reapplying the effect.
Different actions may need different policies (a flee wound may be durable while its
redirect remains retryable); do not treat them all as refundable prices. Audit every
`story.navigate()`/`this.navigate()` caller, including resurrection, item use, combat and
group actions, and document the chosen boundary.

Add rejected/missing-target tests for at least a cross-book resurrection and a charged
item or flee/round redirect. After failure the player must be in one coherent state:
either the full action is restored, or the consequence is present exactly once with a
working retry that cannot repeat it. Success must still consume/apply once and preserve
the return frame. Run the full build + browser suite.

## 170. Centralise duplicated display helpers already owned by `render-util.js`

**Priority: LOW — small exact copies have already drifted in null/type and bonus-label
behaviour, but this is presentation/maintenance debt rather than a rules defect.**

The duplication scan found two string helpers in both `ui.js` and
`render-util.js`: `titleCase()` and `escapeHtml()`. The escape variants already differ
(`render-util` safely stringifies numbers/null; `ui` assumes a truthy value has
`.replace`). Item bonus suffixes are also hand-built three times (`ui.js`,
`render-market.js`, `render-rewards.js`) despite `render-util.itemLabel()` owning the
same weapon/armour/tool vocabulary; the copies disagree about title casing and whether
zero bonuses print as `+0`.

Keep `render-util.js` dependency-free and make the view/shell import one canonical
escape/title implementation. Extract/reuse the smallest bonus-label helper that preserves
each caller's intentional item-name casing while standardising bonus text; do not force
all item rendering through one DOM builder. Add direct string tests covering null,
numbers, HTML metacharacters, weapon/armour/tool bonuses and zero bonus, then keep the
sheet, award and market render assertions green. Stamp and run the full browser suite.

## 171. Deduplicate the single/group combat control shell without merging their rules

**Priority: LOW — the current duplication works, but it has repeatedly produced parity
bugs and doubles every persistence/blessing/flee maintenance change.**

`drawGroupFight()` and `drawFight()` correctly use different headless combat rules, but
their view shells duplicate player stats, live log setup, animated attack guards, flee
target routing, COMBAT retry, Divine Wrath, Defence through Faith, redraw and
`commitVisit()` tails. Tasks 83, 87, 91, 162 and 166 all had to repair or update the two
branches separately; the current file still carries eight parallel commit calls and two
nearly identical flee handlers. This is now a demonstrated drift risk, not a reason to
merge `fightRound()` with `groupFightRound()`.

Extract only small local view helpers inside `render-combat.js`: shared player/log rows,
the animation/visit guard, flee-target routing, and/or a control builder driven by
explicit callbacks for “living targets”, “resolved”, “redraw” and “commit”. Keep target
selection, outcome aggregation, group proxy state and the single/group headless rule
calls visibly separate. Do not create a generic combat framework or move rules into the
view. Add parity assertions that both widgets expose/consume each blessing, route a flee
once, drop a stale animated strike and persist a continuing action once. Stamp and run
the full browser suite.

## 172. Deduplicate roll-widget/gate/memo scaffolding without building a generic roll renderer

**Priority: LOW — bounded view duplication is currently correct, but gate and memo
changes must be repeated across four roll types and have already diverged.**

`renderDifficulty`, `renderRandom`, `renderRankcheck` and `renderTraining` repeat the
same keyed `.roll`/`aria-live` widget construction; difficulty/random repeat description
rendering; difficulty/rankcheck use `rollGateState()` while random reimplements its three
lines; and result-to-var writes repeat the `setVar` + `wroteVars` + `rolledVars` sequence.
The exact-window scan found the widget block at four sites and the gate block at two.
The roll calculations and labels are genuinely different and should remain explicit.

Extract narrow helpers for widget creation, pay-gate/re-arm state and result/memo writes.
Do not replace the four renderers with a configuration-driven generic roll function —
that would hide the meaningful differences (ability picker/mode, random var replay and
travel blessing, rank comparison, training gain). Add focused parity tests for a gated
difficulty/random/rank check, while-loop pending state, var memo sets and blessing reroll,
then stamp and run the full browser suite.

## 173. Durable-navigation retry targets disappear on reload — the spent consequence can become a permanent dead end

**Priority: MEDIUM — a destination failure is uncommon, but reloading is a natural
recovery attempt; it currently keeps the irreversible wound/item/group/combat effect
while deleting the only control that can finish the move.**

Task 169 keeps an already-applied consequence and arms `Story._pendingRetry` when its
destination rejects or is missing. `abort()` then calls `rerender()`, whose
`commitVisit()` correctly persists the post-consequence state. The retry target itself
is only a transient Story field, however: `serializeVisit()` writes the ctx/frame but no
pending target, `sanitizeVisit()` only whitelists the existing visit fields, and
`resume()` never restores `_pendingRetry`. Closing/reloading at the retry screen therefore
resumes the source with the item charge gone, flee/combat outcome resolved or group action
memoised, but with neither the original action nor “Try again” available. Task 169's tests
exercise an in-memory retry only and do not cover this persisted boundary.

Add an optional, validated `{ book, section }` durable-retry field to the v1 visit record
(or an equivalently coherent persisted transition record), serialise it while the retry
screen is armed, pass it through `sanitizeVisit()`, and restore it before `resume()` renders.
Keep the existing boundaries: a fresh/successful `begin()` clears it; refundable failures
do not create it; a malformed/imported target is discarded; clicking the restored retry
captures the current source as the return frame and must not re-apply the consequence.
Do not persist `_navInFlight` or reopen a navigation transaction on load.

Extend the task-169 charged-item or flee fixture through a real save/sanitize/new-Story
resume: reject the target, assert the saved visit contains the retry, reload and assert the
retry-only screen is restored, then succeed and verify the target/return frame plus exactly
one spent charge/wound. Add malformed-field sanitisation coverage and keep a legacy v1
record without the optional field resumable. Run the full build + browser suite.

## 174. The controllable async-navigation test fixture is copied three times in one suite

**Priority: LOW — test-only maintenance duplication; behaviour is correct, but the mock
defines the transition contract and can drift when that contract changes again.**

The fresh eight-line window scan finds three overlapping duplicate windows in
`suite-actions.js`, all from the same `controllable(g, storyRef, dstEl)` helper copied into
the task-167, task-168 and task-169 blocks (currently near lines 920, 1014 and 1135). Each
copy builds the identical pending Promise with `ok()` performing `goTo()`/`snapshot()`/
`begin()` and `reject()` simulating a failed book fetch. This is not intentional suite
isolation: all three copies are inside the same module and test the same navigation seam.

Move that mock to one suite-local helper and reuse it from the three blocks. Keep each
scenario's GameState/Story/destination independent, retain the explicit success/rejection
controls and do not introduce a production abstraction or a shared cross-suite fixture
framework. Run the focused `actions` suite and the full browser suite.

## 175. Blessing rerolls keep the rejected roll's branch effects — damage/rewards can survive or stack

**Priority: HIGH — a core blessing rule can permanently damage or kill the player even
when the replacement roll succeeds, and random-result rewards/consequences can apply twice.**

`render-rolls.js` reveals the matched `<success>`/`<failure>`/`<outcome>` immediately;
`revealBranch()` walks that branch through `Story.appendChildren()`, which applies its
passive effects and records their visit memos. `appendBlessingReroll()` subsequently only
consumes the chosen blessing, replaces `ctx.rolls[key]` and rerenders. It neither defers
the first branch nor restores its state/memos. Live consequences include §5.104's 7
Stamina loss, §5.282's permanent all-ability loss and §6.607's permanent SANCTITY loss.
The sharpest proof is §6.49: the failed branch removes every blessing before the already
rendered ability/Luck reroll button can call `useBlessing()`, so the offered reroll cannot
run at all. A random reroll can likewise retain one outcome's automatic reward/penalty and
then apply the replacement outcome too.

Make a rerollable result a decision boundary: no result-dependent branch effect, award,
redirect or control may become committed until the player keeps that result or exhausts
the available rerolls. Prefer a pending-result/accept-result lifecycle over broad rollback
of arbitrary state after the branch has already become interactive. Keep the rule/planning
decision DOM-free; the view may render the dice, reroll choices and a clear “Keep this
result” action. Persist the pending/accepted decision in the visit record so reload neither
auto-accepts nor re-applies it. A result with no eligible reroll must retain today's immediate
branch behaviour, and chained eligible blessings after another failed reroll must remain
well-defined.

Add deterministic regressions that prove:

1. a failed difficulty branch containing `<lose stamina>` changes nothing while the result
   is pending, and a successful blessing reroll never applies that loss;
2. §6.49 still holds the offered blessing before the decision, rerolls successfully when
   chosen, and removes all blessings exactly once only when the failure is kept;
3. a Luck reroll between two random outcomes applies only the final outcome's automatic
   effect/reward;
4. save/resume preserves a pending result and an accepted result without losing controls or
   replaying effects; and
5. a roll with no eligible blessing still reveals/applies its branch immediately.

Run the focused render/inventory/action suites and the full build + browser suite.

## 176. Unavailable-book demo links and imported saves reject outside the recoverable UI

**Priority: MEDIUM — malformed but user-controlled input can leave a blank game screen and
an imported slot that cannot be played; valid saves and book data are not at risk.**

`startDemo()` calls `data.getSection(book, section)` as its validation step, but an
unavailable book rejects in `loadBook()` rather than returning `null`. `boot()` starts that
async function without awaiting/catching it, so `?demo=999.1` becomes an unhandled rejection
instead of the documented title-screen fallback. The import path has the same boundary gap:
`sanitizeData()` accepts any integer book ≥1, writes the save, and `loadCurrent()` later
awaits `getSection(state.data.book, sec)` without a rejection handler. Clicking Play on such
a slot first builds the game screen and then strands it when the unavailable-book fetch
rejects. A hand-edited/corrupt localStorage blob can reach the same path even after import
validation is tightened.

Validate a demo/import's current book against `data.availableBooks()` before fetching or
persisting it, without importing the data/UI module into the DOM-free state model. Reject an
unavailable-book import before allocating/writing a slot and show the existing Import failed
UI. Also make `startDemo()` and `loadCurrent()` catch book-load failures and return to a
usable title/save screen with an actionable message; do not overwrite, relocate or delete
the bad save implicitly. Preserve the existing Book 1 fallback for a missing section inside
an available book unless the new tests demonstrate a safer explicit message.

Add regressions for an unavailable `?demo=` target, an import whose current book is not
bundled (including no slot write), and a pre-existing invalid slot whose Play action fails
recoverably. Keep valid imports and invalid-section-in-valid-book behaviour covered. Run the
focused state/app-facing coverage and the full browser suite.

## 177. Complete modal keyboard isolation/focus restoration, including the section-view oracle

**Priority: MEDIUM — dialogs are widely used and currently let keyboard focus escape into
obscured controls or disappear when the focused button is removed.**

Task 153 added dialog semantics, initial focus and dismissable Escape handling to
`ui.modal()`, but it does not trap Tab/Shift+Tab, make the obscured page non-interactive, or
restore focus to the element that opened the dialog. Closing removes the focused subtree,
usually leaving focus on `<body>`. The §5.114 section-view oracle builds a separate modal in
`render.js`; it has none of the shared dialog role/name, initial focus, Escape handling,
keyboard containment or focus restoration.

Bring both paths to one consistent modal contract with the minimum reusable shell needed:
remember and safely restore the invoking focus, keep sequential focus inside the topmost
dialog, prevent assistive technology/pointer interaction with the obscured app, preserve the
existing dismissable versus non-dismissable Escape rule, and clean every listener/temporary
attribute on every close path. Prefer routing the oracle through the shared contract (or a
small shared dialog primitive) without turning `ui.js` into a framework; its Reveal another
button must update content without closing the dialog.

Add DOM regressions for initial focus, Tab and Shift+Tab wrapping, Escape behaviour,
non-dismissable dialogs, focus restoration after button/backdrop/programmatic close, and the
oracle's role/name/focus/reveal/close flow. Run the focused render/inventory suites and the
full browser suite.

## 178. Direct `choice[flee="t"]` navigation omits the durable retry contract

**Priority: LOW — the live targets are valid same-book sections, so a rejection is rare,
but the consequence-first path can reapply an irreversible wound/codeword if entry fails.**

The fight widget's Flee button applies the `<flee>` body and routes its target with
`{ durable: true }`, correctly preserving the consequence while arming the task-169/173
retry screen on a missing/rejected destination. Clicking the section's visible
`<choice flee="t">` directly applies the same body and marks the fight fled, but calls
`Story.navigate()` with only `pay` and `sourceNode`. Abort therefore restores the already
post-consequence state without setting `_pendingRetry`; the source rerenders with the flee
choice still available and another click can apply the wound again. §6.305 is a concrete
parting-wound example; fifteen direct flee choices exist across books 3, 4 and 6.

Route the direct choice through the same durable consequence policy as the fight widget and
retain its source-node return semantics. Do not pass contradictory refundable and durable
policies merely because `renderChoice()` currently supplies a no-op payment callback for
every move; make the actual payment/consequence order explicit and revalidate any real paid
flee form before mutation (the current corpus has none).

Extend the controllable navigation fixture with a direct `choice[flee="t"]`: reject the
target, assert one consequence plus a retry-only screen, retry successfully, and prove no
second wound/codeword. Cover a fatal parting wound (no navigation/retry) and keep the widget
Flee regression green. Run the focused actions/combat suites and the full browser suite.

## 179. Lazy service-worker cache writes can be terminated before `cache.put()` completes

**Priority: LOW — required and known optional assets are precached correctly; the race only
weakens later caching of same-origin cache misses.**

The fetch handler returns the network `Response` while launching
`caches.open(VERSION).then(cache => cache.put(req, copy))` as an unobserved side promise.
Neither the `respondWith()` promise nor `event.waitUntil()` owns that write, so the service
worker may be terminated after delivering the response but before the cache entry lands.
An optional/general illustration fetched successfully online can therefore still be absent
on the next offline visit.

Tie a successful basic-response cache write to the fetch event lifetime. Either await the
write in the response chain with a deliberate cache-write failure fallback, or attach the
write to a valid `waitUntil()` promise before the event settles; do not turn a cache-storage
failure into a failed network response. Keep cache-first lookup, cross-origin exclusion,
query-string navigation fallback and the required/optional install policies unchanged.

Add a source-contract regression alongside the task-64/138 service-worker checks and, if
stable in headless Chrome, a CacheStorage round-trip proving an initially uncached
same-origin resource is present after the fetch completes. Record a short manual online →
offline verification if browser lifecycle control remains unsuitable for automation. Run
the focused economy suite and the full browser suite.

---

## 180. Imported visit/combat memos can execute HTML/JavaScript on resume

**Priority: HIGH — task 6 treats imported saves as untrusted, but this path can execute
attacker-controlled script with access to every save on the origin.**

`sanitizeVisit()` passes `visit.ctx` and its return frame through as arbitrary objects;
`deserializeCtx()` then accepts every two-element `fights` entry verbatim. Group combat
interpolates the restored `fight.name`, Combat, Defence and Stamina fields into
`stats.innerHTML`; the single-fight row does the same for its numeric fields. A crafted
Book 6 §192 import whose `fightgrp@s.0` memo contains an `<img onerror=…>` name therefore
creates and executes that element when the visit resumes.

Validate imported visit/frame memos field by field against the current section tree. Rebuild
static fight identity from the source node where possible, bound/coerce the genuinely dynamic
fields, and construct every fight-stat row with elements and `textContent`; do not rely on
sanitizing one string before another state-derived field is interpolated.

Add malicious group- and single-fight import regressions: no injected element, handler or
sentinel side effect may appear, while an ordinary mid-fight save must still resume the same
opponents, Stamina, outcome, bonuses and log. Re-run the focused persistence/combat suites
and the full browser suite.

## 181. Finish task 175: a blessing-reroll result is still observable before Keep

**Priority: HIGH — rejected Luck/blessing results can still grant rewards, inflict permanent
losses, reveal choices or let the player leave before accepting a result.**

Task 175 protects direct random→`<outcomes>` effects, but the provisional-result boundary is
not general. Ordinary `<if>/<elseif var>` chains evaluate the live roll variable directly:
§2.389 can grant 150 Shards, or expose a Take control, before Keep. A stored pending roll lets
`<while>` advance: at §5.218 the player can start later attempts and escape without accepting
earlier 3-Stamina failures. `_scanPendingRerolls()` also tracks only the direct roll variable,
so a following `<set value="roll*100">` commits a derived value; §2.698 pays it immediately
and leaves its plain goto live, while §2.684 reveals the derived success/failure branch.

Define one DOM-free invariant: an eligible reroll result is wholly provisional until Keep or
the replacement roll settles. Propagate dependency through `<set>` expressions and suppress
dependent conditions, passive effects, controls, redirects, loop completion and onward
navigation. Persist the boundary in the visit record; do not patch each view widget with a
different special case.

Test §2.389 (no reward/control until final), §5.218 (one pending iteration; Keep applies one
loss; a successful reroll exits), §6.700 (a rejected non-six cannot set `y`, damage or stop
the loop), §2.698 (no Shards/live goto before Keep; final amount exactly once), §2.684
(branches hidden until final), and save/resume at each pending state. Run all sections.

**Done.** One DOM-free dependency trace now decides the whole boundary in `render-rules.js`:
`expressionVars` reports what an attribute value reads, `provisionalVarClosure` grows a seed
through the section's derived `<set>`s transitively, and three refusal points consume the
result — `conditionPending` (an `<if>/<elseif>` reading a provisional var holds the WHOLE
chain, so no `<else>` slips active), `setPending` (a `<set>` deriving from one writes nothing)
and `pendingRollVar`/`branchResolved` (effects and var-keyed branches wait). `render()`
pre-scans the section into `rerollPendingVars` before the walk, so document order is
irrelevant; `markWhilePending` holds a `<while>` pass on a resolved-but-provisional roll (a
loop roll's var is scoped to its own pass, per task 100, so §6.700's loop-entry gate still
reads the roll that opened it); and `applyPendingRerollGate` disables every rendered exit while
the decision's own controls are on screen. The boundary still rides in the roll memo's
`accepted` flag alone — nothing new is persisted.

Tracing the dependency through `<set>` also exposed and fixed a pre-existing leak with no
connection to rerolls: a derived `<set>` ran on ENTRY with its roll var unset, so `<gain
shards="s">`/`<lose amount="y">` applied against **0** and memoised that no-op — the award
could never arrive. Seven sections were silently paying nothing (§2.266, §2.698, §6.17,
§6.352, §6.488, §6.625, §6.86). `unsettledRollVars` closes over the roll vars a section has
still to fill so those effects wait for the real value; `setPending` deliberately tests only
the READ side, leaving task 61's set-sentinel idiom (§6.628 `y=7`, §2.138 `open=1`) applying on
entry as before. Two residual gaps filed as tasks 204 and 205. Full browser suite:
RESULT ALL PASS pass=1791 fail=0, all 4,369 sections rendering.

## 182. Delayed rolls and attacks can mutate a save after Save & quit

**Priority: HIGH — a detached action can overwrite the explicit quit save and advance or
damage an adventurer while the title or another game is visible.**

`rollButton()` and `animatedStrike()` capture only `story.ctx` while awaiting the dice
animation. Save & quit removes the game DOM but does not replace that context, so the guard
still passes when the animation resolves: the old roll/round mutates state, rerenders the
detached Story and commits over the save made immediately before `showTitle()`. Task 146
tests a section-context swap and therefore misses this same-visit shell disposal.

Give Story/app actions an active-screen generation or disposal token in addition to the
visit identity, and invalidate it whenever the game shell is left, replaced or rebound.
Keep controls locked for the action lifetime and release them in `finally`; normal rolls and
task-146 navigation cancellation must retain their current behavior.

With a controllable dice promise, start a roll and a single/group attack, invoke Save & quit
or replace the game screen, then resolve the promise. Assert no variable, fight, Stamina,
death UI or persisted slot changes after the quit save. Also prove a normal action resolves
once and navigation to a new ctx still drops the stale callback.

**Done.** The Story now carries a screen-lifetime token beside its visit identity: `dispose()`
sets `disposed` (and releases both transition locks, which gate app.js's shell guard and would
otherwise stay latched over the title screen), and `app.js`'s new `releaseGameScreen()` calls it
from every shell teardown — `showTitle`, `showCreate`, `showSaves` and `buildGameScreen`'s
rebuild. Both delayed actions were funnelled through one arming point, `Story.beginAction()`,
which freezes the pane, takes the `_actionInFlight` lock and returns `live()` — false once the
ctx has been swapped (task 146's navigation case, unchanged) **or** the Story disposed —
plus `end()`, released in each handler's `finally`. `animatedStrike` resolves to the armed
action or `null`, so `drawFight`/`drawGroupFight` wrap their whole round in that `try/finally`.
The lock is also honoured by app.js's capture guard, so "Save & quit" can no longer even be
clicked between a strike and the round it is about to resolve; being a counter and not DOM
state, releasing it cannot re-enable a control the render deliberately disabled.

Tests use deliberately lethal fixtures so the silence is not vacuous — §6.700 at Stamina 1
(its die is always ≥ 1, so a landed roll always kills through `<lose stamina="x">`) and a
Combat-30 foe with 99 Stamina against Stamina 1 — with a real save slot byte-compared across
the quit. Each control proves the action still lands (and kills) with the screen live, resolves
exactly once and releases the lock; the quit/teardown cases then assert no roll memo, no var,
no fight-log or foe-Stamina movement, no player Stamina change, no `onDeath`, and an unchanged
persisted slot. Task 146's navigation drops still pass through the new guard, now also
asserting the lock is released on the dropped path. Full browser suite: RESULT ALL PASS
pass=1806 fail=0, all 4,369 sections rendering.

## 183. Disease/poison immunity blessings do not prevent infection

**Priority: HIGH — blessings explicitly bought for immunity are consumed by neither the
rules engine nor the affliction model, so permanent penalties land anyway.**

`GameState.addAffliction()` always adds a disease or poison and `applyAffliction()` delegates
to it without consulting blessings. Several source nodes rely on the affliction rule itself,
not an enclosing XML guard: §2.136 says Maka's blessing negates Leprosy; §5.306 and §5.620
say Immunity to Disease/Poison is crossed off instead of taking the poison/disease. Task 123
aliased the two blessing names but did not implement this admission rule.

Centralize immunity in affliction admission so both canonical aliases protect against either
`disease` or `poison`. Spend an ordinary blessing through the existing blessing API, retain a
permanent blessing, and add neither the record nor any effect/Stamina clamp when protected.
Curses remain unaffected.

Test grant/check under both aliases and both affliction types, ordinary consumption,
permanent retention, absence of every penalty/record, and unchanged unprotected infection.
Exercise the three live sections and persistence, then run all sections.

**Done.** Immunity now lives in one place — `GameState.addAffliction()`, the single admission
point every disease/poison passes through (`applyAffliction` for `<disease>`/`<poison>`, and
any direct caller). A `disease`/`poison` admission spends the blessing via the existing
`useBlessing('disease')` and returns *before* the record is pushed, so no record, no ability
effect and no Stamina-total cut/clamp land. Because task 123 canonicalises `poison` → `disease`,
either spelling of the grant protects against either affliction type. `useBlessing` already
retains a permanent blessing, so a permanent immunity protects indefinitely; curses never
consult it. The "already afflicted" no-op check was hoisted above the immunity check so a
re-infection with an affliction already held cannot burn the blessing, and a `cumulative="t"`
re-application still stacks without spending it — the same ordering as the reference
`CurseList.addCurse`, where immunity is only tested inside the not-already-held branch.

32 new assertions: all four alias × type combinations (no record, no penalty, blessing spent),
the §5.306-style `ability="stamina"` cut leaving `effectiveStaminaMax()` and current Stamina
untouched, permanent retention across two infections and a save round-trip, the unprotected
infection still landing its penalty, a curse still landing with the blessing intact, and the
re-infection-keeps-the-blessing case. The three live sections run through a real `Story`:
§5.306 (immune → no poison, blessing crossed off, total unchanged and persisted through
`sanitizeData`; unprotected → −6 from the total), §5.620 (immune → no Red Ague and no
COMBAT/CHARISMA loss; unprotected → both penalties), and §2.136 driven on a seeded die into
the 1–3 branch (immune → Leprosy negated and the blessing used up; unprotected → contracted).
Full browser suite: RESULT ALL PASS pass=1838 fail=0, all 4,369 sections rendering.

## 184. Named removal leaves stacked cumulative curses behind

**Priority: HIGH — a temporary per-wound COMBAT drain can survive its explicit cleanup and
become a permanent penalty.**

Every `cumulative="t"` application is stored as a separate record, but
`removeAffliction(type, name)` splices only the first match. §5.489 can stack Avenger's Bite
once per wound; the hidden named loss on entering §5.565 is intended to clear the first
fight's entire temporary drain, yet it removes only one copy. The reference model aggregates
same-name cumulative curses before named removal.

Either aggregate compatible cumulative records or make named removal clear the complete
same-name aggregate. Preserve `?` as removal of one arbitrary affliction and `*` as removal
of all; do not accidentally collapse unrelated same-name records with incompatible metadata
without defining their merge.

Test two or more Avenger wounds stacking, §5.565 restoring the whole prior COMBAT loss, new
drains in the second fight, named/`?`/`*` semantics and a save/load round trip.

**Done.** Took the second option — `removeAffliction(type, name)` now filters out every
same-name record instead of splicing the first, so a named removal clears the complete
aggregate. This needs no merge rules and no save migration (a legacy save already holding N
stacked records is cured correctly on load), and it cannot collapse unrelated records: only a
`cumulative="t"` stack can ever hold two records under one name, because a repeat application
of a non-cumulative affliction is already a no-op in `addAffliction`. `?` still drops one
arbitrary affliction and `*` still clears the list; matching stays case-insensitive via
`normalize`, so the sheet's "Lift…" action and `<lose curse|disease|poison>` all inherit the
fix. All four cumulative afflictions in the corpus (§5.203 Vampire's Kiss, §5.489/§5.565/§5.631
Avenger's Bite) carry only additive `bonus` effects, so no divide/target aggregate arises.

12 new assertions, driving the real §5.489 `<curse>` node as a wound: three wounds stack three
records and −3 COMBAT, the stack survives a `sanitizeData` round trip, one named removal
reports true and restores the full score, a second reports false. Live, two wounds then
`Story.begin(§5.565)` — whose hidden `<lose curse="Avenger's Bite">` fires on entry — clears
every record and restores COMBAT, after which the second fight's own drain still lands. `?`
removes exactly one of three curses, `*` clears all, and a case-insensitive named removal
leaves an unrelated Skunk-juice curse and its CHARISMA penalty untouched. Full browser suite:
RESULT ALL PASS pass=1850 fail=0, all 4,369 sections rendering.

## 185. Wildcard affliction effects (`ability="*"`) are discarded

**Priority: MEDIUM — §2.136 records Leprosy but silently omits its stated one-point penalty
to all six abilities.**

`afflictionAbility()` accepts the six named abilities and Stamina but returns null for `*`,
so `readEffects()` drops Leprosy's sole `<effect ability="*" bonus="-1"/>`. The state-side
affliction calculations likewise match only an exact ability key. The prose explicitly says
to reduce every ability down to a minimum score of 1.

Preserve a wildcard affliction effect through parsing, sanitization and persistence, and
apply it to each core ability (not Rank/Stamina unless separately named). Keep the existing
minimum-one rule and natural/affected semantics.

Test all six scores before/after Leprosy, the floor at 1, save/load, duplicate infection
semantics and full restoration on cure.

**Done.** Three small changes on one rule: `afflictionAbility()` now returns `*` alongside
`stamina` and the six named abilities, so `readEffects()` keeps the wildcard; a new
`afflictionHits(e, ability)` helper in `state.js` states the match rule once (exact key, or
`*` against any of the six core abilities) and both `afflictionBonus()` and `afflictionMod()`
use it, so a wildcard `divide`/`target` cannot become a new silent drop now that `*` parses.
`sumAfflictionStamina()` deliberately still requires the explicit `ability="stamina"` key, so
the wildcard reaches neither the Stamina total nor Rank — the same boundary as the item-aura
wildcard (`sumAuraBonus`). `sanitizeAffliction` already accepted any non-empty ability string,
so the wildcard persists without a schema change, and the "minimum score of 1" is the existing
`clampAbility` floor in `ability()`/`abilityNoWeapon()`. §2.136's Leprosy is the corpus's only
wildcard affliction effect; §5.564's `type="aura"` wildcard was already handled.

9 new assertions taken from the real §2.136 `<disease>` node: the wildcard effect is stored on
the record as `{ability:'*', bonus:-1}`, all six affected scores drop by exactly one, an ability
seeded at 1 floors at 1, Rank and `effectiveStaminaMax()` are untouched, the wildcard survives a
`sanitizeData` round trip with the same six scores, a duplicate infection adds nothing further,
and `removeDisease('Leprosy')` restores all six. Live, §2.136 driven on a seeded die into the
1–3 branch contracts Leprosy and drops every score by one. Full browser suite: RESULT ALL PASS
pass=1859 fail=0, all 4,369 sections rendering.

## 186. Automatic highest-bonus equipment can select a worse loadout

**Priority: MEDIUM — a numerically stronger weapon can disable a lower-bonus weapon whose
wielded effect produces the better or required rules outcome.**

`wieldedWeapon()`, `wornArmour()` and `reconcileEquipment()` always select the highest numeric
bonus; the Adventure Sheet only decorates those computed flags. The Jade Defender is a
+3 weapon with a +3 wielded Defence effect (§5.628/§5.672), explicitly worth +6 Defence.
Owning any plain +4 weapon automatically unwields it, lowering Defence and changing which
possession a `using="t"` loss can target. The player has no way to choose the legal loadout.

Store explicit selected weapon/armour IDs and provide compact Sheet controls to change them.
Reconciliation should choose a sensible default only when selection is absent/invalid, and
the selected items must be the single source for base bonuses, wielded effects, display and
`using="t"` matching. Migrate old saves deterministically.

Test choosing either Jade Defender or a plain +4 weapon, the resulting COMBAT/Defence and
loss target, selection persistence, and fallback after dropping the selected item. Cover
armour and equipment-lock behavior too.

**Done.** `data.equipped = {weapon, armour}` stores the chosen item ids. One pair of readers,
`wieldedWeapon()`/`wornArmour()`, resolves the choice — the stored id while it still names a
carried item of that kind, else the strongest of that kind as the default — and everything
else already went through them: `using="t"` matching (`matchEquipment`, `selectEquipment`,
`loseEquipmentCandidates`), `setSelectorBonus`, the `type="wielded"` effects in
`sumAuraBonus`, and the sheet's ⚔/🛡 markers. `itemBonus('combat')` and `armourBonus()` now
read that one weapon/armour instead of scanning for the biggest number, so the selection is
the single source for base bonuses too. `reconcileEquipment()` writes the resolved pick back,
so a stale id self-heals and a *new* stronger weapon no longer steals the wield — matching
JaFL's `ItemList.addItemEffects`, which wields a newly acquired weapon only when nothing is
wielded. `setEquipped(kind, id)` is the sheet's entry point (rejects an unknown id, the wrong
kind, or a locked slot); each weapon/armour row gained a `Wield`/`Wear` button (`aria-pressed`,
disabled when it is the current pick or the slot is locked), and `onSheetChange` already
rerenders the story so a `<if weapon="*sword*" using="t">` gate (§2.267) re-evaluates at once.

Migration is deterministic: `sanitizeData` keeps a stored id only while it names a carried
item of that kind, else falls back to the legacy per-item `wielded`/`worn` flag — which every
pre-186 save carries on the piece the old reconcile had picked — so an old save loads exactly
the loadout it was showing; with neither, the default applies.

This also makes `<tick special="weaponlock|armourlock">` real. It was documented as a
justified no-op *because* selection was automatic; now that the player can swap, §6.135's
"Remove that weapon" group (a click-to-apply button) leaves a window to dodge the loss. The
locks are transient (`_equipLock`, never saved), released on entering a section — JaFL clears
both on its NEW_SECTION event — or when the locked possession itself goes.

27 new assertions. From the real §5.628 `<weapon>` node: the Jade Defender arrives with its
`type="wielded"` Defence effect, a later plain +4 does not steal the wield, switching to it
trades 2 Defence for 1 COMBAT, switching back restores both the effect and the flags; a
`<lose weapon="?" using="t">` takes the *chosen* weapon and the slot then falls back to the
strongest remaining; the choice survives a `sanitizeData` round trip, a stale id falls back to
the flag, and a save with neither defaults to the strongest. Armour repeats the shape
(default = best Defence, choosing the lesser is honoured by `defence()`, a `using="t"` armour
loss takes the worn piece) plus `setEquipped` rejections. Live: §6.135 locks the weapon slot
on entry, refuses a swap, renders every `Wield` control disabled, breaks the weapon actually
in hand when its group is clicked, releases the lock with that loss, and the lock is gone
after entering another section; §2.290's `armourlock` holds the armour slot only, and its acid
takes the worn jerkin while sparing the better mail with no Stamina lost. The pre-existing
"wielded aura drops when the item is not wielded" check in `suite-economy` was updated: it
asserted the old auto-unwield, and now proves the aura survives the acquisition and drops only
on an explicit switch. Full browser suite: RESULT ALL PASS pass=1886 fail=0, all 4,369
sections rendering.

## 187. Named market sales ignore item kind and equipment stats

**Priority: MEDIUM — a cheap/plain possession can be sold as a distinct enchanted tool or
weapon merely because its display name matches.**

For named non-armour goods, `ownsGoods()` falls through to `hasItem(name)` and
`sellCandidates()` to `findItems(name)`, ignoring `kind`, `ability`, `bonus` and tags.
§5.238 awards a plain item named “silver flute”; §5.244 sells a CHARISMA +2 tool with the
same name for 360 Shards, and the ordinary tomb trinket currently satisfies that row.

Match named equipment sale candidates by descriptor kind plus the relevant ability, bonus
and tags as well as name. Retain the intentional armour-by-Defence-tier rule and unnamed
weapon-by-bonus rule; keep the task-134 candidate picker for genuinely interchangeable or
ambiguous matches.

Test that the plain silver flute cannot be sold on the tool row, the exact tool can, and
same-name equipment with the wrong kind/ability/bonus/tags cannot. Audit the corpus for other
cross-kind name collisions and run the economy/full suites.

**Done.** One predicate, `matchesNamedGoods(it, goods)`, now decides whether a possession
satisfies a named non-armour row: same kind, the stated `ability`, at least the stated `bonus`,
and every stated tag. `ownsGoods()` and `sellCandidates()` both call it (and `sellTrade`/
`sellPlan` go through `sellCandidates`), so a row can no longer advertise a sale it cannot
complete. The armour-by-Defence-tier and unnamed-weapon-by-bonus branches are untouched, as is
task 134's picker — it still sees only genuine matches.

The one deliberate looseness: a `kind="item"` row accepts a possession of any kind. The corpus
audit (every named row carrying `sell=`, compared against every other declaration of that
name) found exactly three cross-kind collisions, and two of them are the books being loose with
`item` for something they elsewhere declare a weapon — §1.452/§2.493 sell a "pickaxe" awarded
as `<weapon>` in §3.376/§3.396/§4.248 (book4/248 even carries the comment "is the pickaxe a
weapon or just an item?"), and §3.715 sells a "golden katana" that every award declares as a
weapon. Requiring strict kind equality there would have made two legitimate sales impossible.
The third is the reported bug: §5.238's plain `<item name="silver flute">` tomb trinket against
§5.244/§4.417/§5.101's CHARISMA +2 `<tool>` row (§5.118 is where the trinket becomes the real
tool). A second audit pass found **no** tag mismatches at all, so requiring the row's tags is
safe. Using `bonus >= row.bonus` rather than equality keeps a stronger same-kind piece
sellable at the row's price, matching the pre-existing behaviour for named rows.

17 new assertions in `suite-economy`: the plain trinket yields no candidate, no sale and no
Shards while staying in the pack; the real tool sells for 360; same-name pieces with a lower
bonus, the wrong ability or the wrong kind are all refused, while a better same-kind piece is
accepted; §3.480's `tags="light"` lantern row rejects an untagged lantern and accepts a tagged
one; the weapon pickaxe and weapon golden katana still sell on their `<item>` rows; armour
still sells by tier (and the wrong tier still cannot), and an unnamed weapon row still takes
any weapon of that bonus. Live §5.244 renders the silver-flute row with `Sell 360`, disabled
("You have none to sell") while holding only the trinket, enabled with the real tool, and the
click pays exactly 360 and removes it. Full browser suite: RESULT ALL PASS pass=1903 fail=0,
all 4,369 sections rendering.

## 188. `<rest hidden="t"/>` is optional instead of automatic

**Priority: MEDIUM — the sole live hidden rest lets the player leave wounded despite the
section stating that every injury has already been healed.**

Book 6 §479 contains `<rest hidden="t"/>` followed by “All your injuries are mysteriously
healed.” `renderRest()` never reads `hidden`; it always creates a Rest button and therefore
turns the mandatory full heal into an optional action.

Auto-apply a hidden rest once on entry, render no control, and memoize the action before its
state mutation so reload/rerender ordering cannot repeat it. Use the effective Stamina
maximum and preserve ordinary priced/fixed visible-rest behavior.

Test wounded entry to §6.479 (full Stamina, no button), damage plus rerender/resume during the
same visit (no re-heal), a fresh visit (heal again), and entry while already full.

**Done.** `renderRest()` now takes an early branch for `hidden="t"`: it adds the `rest@<path>`
memo, calls `applyRest` and returns no DOM. The memo is added **before** the mutation because
`applyRest` → `changed()` → autosave can rerender this very node, and an unset memo would heal
(and, for a hypothetical priced hidden rest, charge) twice. `applyRest` already heals to
`effectiveStaminaMax()` (task 158), so aura headroom is included. The branch is skipped while
`story.inactive`, so a hidden rest inside an untaken `<if>` cannot fire — the same rule the
passive renderers follow. Visible rests keep every existing behaviour: the heal-to-full form,
the task-129 once-per-visit lock on an unpriced fixed amount, and repeatable priced nights.
§6.479 is the corpus's only hidden rest.

10 new assertions against the real §6.479: a wounded arrival is restored to full with no Rest
control rendered; taking damage and rerendering inside the same visit does not heal again;
neither does a reload — `serializeVisit` → `sanitizeData` → `Story.resume` carries the memo, and
the resumed render still draws no control; a fresh `begin()` of the section heals again;
entering already whole is a no-op. Plus a hidden rest inside an untaken `<if>` branch that must
not fire, and a visible `<rest>` that is still an opt-in button which heals on click. Full
browser suite: RESULT ALL PASS pass=1913 fail=0, all 4,369 sections rendering.

## 189. A failed initial adventure load strands a new save on a blank game screen

**Priority: MEDIUM — a transient first-book fetch failure leaves an unhandled rejection,
blank shell and already-claimed slot with no recovery action.**

The Begin Adventure handler creates and saves the character, then calls `startGame(1)`
without awaiting it. `startGame()` builds the game screen before `navigate()`; a rejected
book fetch escapes the click handler, while a missing §1 returns false and leaves the empty
story pane. The demo/load/import paths already recover these failures.

Await and handle both rejected and false initial navigation. Show an actionable retry/back
state instead of a blank game, keep at most one successfully persisted new adventurer, and
do not report a failed storage write as a recoverable saved slot. Reuse the existing
load-failure language/policy rather than adding another screen framework.

Test failed fetch, missing start section, successful retry and normal creation. Assert no
unhandled rejection, duplicate/ghost slot or unusable blank game.

**Done.** `startGame()` now returns its `navigate()` result, and the Begin Adventure handler
awaits a new `openNewAdventure()` that owns both failure modes: `open()` resolving false (the
start section is not in the book) and `open()` rejecting (the book fetch failed, which used to
escape the click handler as an unhandled rejection). It loops on "Try again", so a retry
re-opens **this** character — the creation handler, and therefore `nextFreeSlot()`/`save()`, run
exactly once, so no second or ghost slot can appear. The dialog (`askNewAdventureRecovery`)
reuses the load-failure language and is driven by whether `state.save()` actually succeeded:
"Back to saves" is offered only for a persisted character, and `openNewAdventure` ignores a
`saves` answer when `persisted` is false, so a blocked/full storage write is never reported as
a recoverable slot. Backing out to the title screen is always available; both exits tear down
the shell via task 182's `releaseGameScreen`, so the blank game screen cannot be left behind.

`openNewAdventure` takes its collaborators as parameters and is exported, which is what makes
this testable at all — app.js's screens are unreachable from the harness, and importing app.js
is side-effect free because it only auto-boots when a `#app` element exists (task 65). 11 new
assertions in `suite-economy`: a normal start opens once with no dialog; a rejected fetch is
caught (nothing thrown out of the call) and its message is passed to the dialog; a retry
re-opens and succeeds while `loadSlotMeta()` is byte-identical before and after; a missing start
section reports its own reason and survives two retries; a persisted character can be routed to
the saves screen; an unpersisted one is routed to the title screen instead, with the dialog told
which case it is; and backing out returns to the title. The app page was also loaded headlessly
to confirm the title screen still renders after the handler became async. Full browser suite:
RESULT ALL PASS pass=1924 fail=0, all 4,369 sections rendering.

## 190. Service-worker activation and lookup touch unrelated origin caches

**Priority: MEDIUM — hosting another scoped app on the same origin can have its offline data
deleted or returned through Fabled Lands' cache lookup.**

Fabled Lands cache names use the `fl-` prefix, but activation deletes every cache key except
the current version. Fetch handling also calls origin-global `caches.match(req)`. CacheStorage
is shared by origin, not service-worker scope, so these operations can delete an unrelated
app's cache or select its matching URL.

Restrict cleanup to obsolete `fl-*` caches. Implement current/older Fabled Lands fallback
lookup without searching unrelated namespaces, preserving task 8's incomplete-upgrade
fallback, task 138's query navigation behavior and task 179's event-owned lazy write.

In a service-worker contract test, seed `other-app-v1`, the current cache and an obsolete
`fl-*` cache. Prove the unrelated cache survives and is never read, obsolete FL cache is
removed only after a complete install, and all required/optional/offline paths remain green.

## 191. Speech-enabled narrow headers clip critical controls

**Priority: MEDIUM — at common 320/360 px widths the non-wrapping action strip exceeds the
viewport, while horizontal overflow is hidden.**

Below 600 px the title disappears and icons shrink, but the header still contains the menu,
four general quick actions, three speech controls, Save and Adventure Sheet. Their fixed
widths, gaps and header padding require roughly 388 px, so trailing critical controls can be
clipped on narrow phones when Speech API support enables the full set.

Define a narrow-chrome policy: keep only the essential reachable controls in the header and
move duplicated quick/speech actions into the existing More menu or another compact control.
Do not shrink touch targets below an accessible size.

At 320 and 360 CSS pixels with speech support enabled, verify in a real browser that
`scrollWidth <= clientWidth`, every visible control is inside the viewport, and
Menu/Save/Sheet plus narration remain keyboard- and touch-reachable. Keep desktop layout and
speech-disabled widths covered. A connected browser was unavailable during filing, so retain
this explicit live layout check as acceptance evidence.

## 192. The mobile Adventure Sheet is visually hidden but remains keyboard-exposed

**Priority: MEDIUM — keyboard and assistive-technology users can tab through off-screen
controls, with no announced drawer state or reliable way back.**

`toggleSheet()` changes only `body.sheet-open`; the closed `aside` is translated off-screen
but remains in the accessibility tree and tab order. The toggle has no `aria-expanded` or
`aria-controls`, opening does not move focus or isolate the story, and there is no Escape,
explicit Close or focus restoration behavior. Task 177 fixed modal isolation, not this
separate drawer.

Give the mobile Sheet a drawer lifecycle: synchronize `inert`/`aria-hidden`, expanded state
and control relationship; move focus on open, support Close/Escape/backdrop, restore the
invoker, and isolate the background while open. Clear mobile-only state cleanly on the
desktop breakpoint so the permanent aside remains usable.

Add keyboard tests for closed/open Tab order, Escape/backdrop/button close, focus restoration
and mobile↔desktop transitions, plus touch behavior and the existing sheet mutation tests.

## 193. Stale speech callbacks can advance or cancel a newer narration

**Priority: MEDIUM — a delayed callback from cancelled speech can skip the first chunk of a
new section or stop its playback.**

`Narrator.stop()`/`play()` cancel utterances without changing a session identity.
`onend`/`onerror` guard only on `playing` and the numeric chunk index. If an old index-0
utterance fires after a new index-0 narration starts, it satisfies both checks and advances
the new session to chunk 1. Navigation, rerender and autoplay make this hand-off routine.

Increment a narration generation on play, stop and rerender; capture it in each utterance
callback and ignore older generations. Keep the existing chunk/highlight/state behavior and
normal completion sequence.

With a speech-synthesis stub, begin a new narration and then fire the cancelled utterance's
late start/end/error callbacks. Assert the new first chunk and highlight remain current;
verify ordinary multi-chunk completion, manual stop and autoplay navigation.

## 194. SPA section transitions provide no focus target or announcement

**Priority: MEDIUM — after activating a choice, keyboard and screen-reader focus falls off
the removed control without conveying the newly loaded section.**

The Story article has no focus target/live-region labeling and the rendered section number
is a plain `div`. Navigation, undo and return only reset scroll position. When the activated
button is replaced, focus commonly falls to the document body; same-section rerenders make
it important not to solve this with an indiscriminate focus steal.

Expose an accessible section heading/story target and focus or announce it exactly once for
real navigation, undo and return. Preserve the user's focus during rolls, markets, combat
redraws and other same-section rerenders; narration/autoplay should not duplicate the
announcement.

Add DOM/browser regressions for choice, goto, undo and return transitions, plus negative
checks for roll, inventory and market rerenders.

## 195. DOM-free rule modules are not directly importable in Node

**Priority: MEDIUM — the documented architecture/test seam fails before any test can run and
rule modules acquire a browser-data dependency.**

`engine.js` and `render-rules.js` import `availableBooks()` from `data.js`, whose module top
level constructs `new DOMParser()`. Direct Node import therefore throws
`ReferenceError: DOMParser is not defined`; the dependency also reaches the engine/combat/
market chain despite the rule-module invariant forbidding browser globals.

Move bundled-book availability behind a DOM-free registry or an explicit value supplied by
the app/planner. Keep XML parsing/fetching in `data.js`; do not make the rules query the view
or install a Node DOM dependency merely to mask the coupling.

Add a direct Node import check for `engine`, `combat`, `market`, `state`, `render-rules`,
`render-gates` and `visit-state`, plus browser tests for every available/unavailable-book
condition and navigation gate.

## 196. The build stamp is date/EOL dependent and omits service-worker code

**Priority: MEDIUM — identical deployed content can get a new cache key, while a real
service-worker-only release can keep the old version identity.**

`stamp-version.ps1` culture-sorts absolute paths, hashes raw checkout bytes, excludes all of
`sw.js`, and prefixes `Get-Date`. With `core.autocrlf=true` and mixed working EOLs, the same
tracked content hashes differently: this review's no-source-change build changed
`26.07.22.5eb892d` to `26.07.26.a39de8b`; canonical-LF content yields a third digest,
`5143ac4`. Task 144 removed the same no-op date churn from `meta.json`, but the stamp itself
still has it.

Hash ordinal-sorted repo-relative paths plus LF-normalized content. Include `sw.js` after
replacing only its generated VERSION assignment in memory with a fixed placeholder, avoiding
the circularity noted in task 64. Preserve the existing date when the digest is unchanged
(or remove the date component); choose a new date only for a genuine content change.

Verify LF/CRLF checkouts and a later-day no-op yield the identical full stamp and clean tree;
a service-worker body edit and ordinary app edit change the digest/cache key; changing only
the generated VERSION line does not; repeated builds are byte-identical.

## 197. CI tests committed bundles without rebuilding their XML source

**Priority: MEDIUM — source-of-truth XML can be malformed or changed without regenerated
JSON, while CI passes by exercising the old committed bundle.**

The workflow's `build-scripts` job only checks ASCII/`#Requires`; the smoke job immediately
serves `web/data`. It never runs `build-data.ps1`, so neither its 4,377-file validation nor a
source/generated drift check protects a pull request.

After task 196 makes output machine-stable, run the PowerShell 7 build in CI and fail on any
generated diff (`web/data`, copied assets, `version.js`, `sw.js`) before running smoke against
the newly built files. Keep the dependency-free runtime and current full-section browser
test.

Verify clean HEAD builds with zero diff, malformed source fails validation, a valid XML-only
edit fails generated-drift, and the same edit with regenerated output passes build plus
smoke.

## 198. A failed save deletion can leave an unrecoverable ghost slot

**Priority: LOW — the failure needs a storage exception at one narrow point, but it can lose
the save blob while permanently reserving its slot.**

`deleteSlot()` removes `fl_save_<slot>` before rewriting `fl_meta`. If the metadata write
throws, the blob is already gone while its stale card remains. `reconcileSlotMeta()` repairs
only blob-without-meta, not the inverse, and `nextFreeSlot()` treats the ghost metadata entry
as occupied. The async Delete handler neither catches nor reports the error.

Write the metadata deletion first and remove the blob only after it succeeds, so interruption
leaves the task-137 recoverable blob-only form. Catch both storage operations and surface the
existing persistence warning without redrawing a false-success list.

Force the metadata write to throw: the blob and visible slot must remain and no rejection may
escape. Then retry successfully and prove both records disappear and the slot is reusable.

## 199. Build validation misses source-schema typos and bundled-book dangling targets

**Priority: LOW — the corpus is currently clean, but the validation step would accept the
same tag/attribute mistakes that caused earlier player-facing tasks.**

`Test-XmlDoc` checks well-formedness and numeric section root/name only; Adventurers/Rules
even pass no expected root. Unknown live tags/attributes, invalid enumerated values, malformed
referenced pregen biographies and explicit missing targets inside Books 1–6 can reach output.
Historical `safeAddGodd` and `tag`/`tags` source typos illustrate the silent failure mode.

Before writing any generated file, validate required roots, live tag/attribute/value
allowlists (including documented project extensions), referenced pregen XML, and explicit
targets whose destination book is bundled. Continue to allow intentional Books 7–12 links,
computed targets and missing optional artwork.

Add small mutation fixtures for wrong root, unknown tag/attribute, bad enum, dangling
bundled target and malformed referenced bio. The unmodified 4,377-file corpus must pass with
byte-identical output.

## 200. AGENTS.md overstates test-suite parse-error isolation

**Priority: LOW — the false troubleshooting advice can waste time precisely when a focused
suite refuses to start.**

AGENTS.md says separate module scopes mean a duplicate top-level declaration aborts only
that suite. `_test.html` statically imports all seven suites, so a syntax error in any
dependency prevents the harness module from evaluating and the classic bootstrap reports one
global `RESULT FATAL`; `?suite=` does not isolate an unselected suite from parse failure.
Separate scopes only prevent declarations in different valid modules from colliding.

Correct the paragraph to match the current static import/bootstrap behavior. This is a
docs-only change; verify the revised troubleshooting text agrees with `_test.html` and CI.

## 201. A service-worker update can erase an unsaved character-creation draft

**Priority: LOW — the race is infrequent, but every creation field exists only in local
variables until Begin Adventure.**

On `controllerchange`, `registerSW()` reloads immediately because game progress normally
autosaves. The creation screen's selected book/profession, edited name and gender are not
state yet, so an update that activates while the form is open silently resets the entire
draft. `skipWaiting()` makes that timing possible without a user reload.

Defer the reload while an unsaved screen is active (or preserve and restore the minimal
draft), then apply it once the user safely leaves/commits. Keep the one-reload guard and
automatic update behavior for title/saved gameplay.

Mock `controllerchange` during edited creation: no immediate reload and every field survives;
after Begin/Back, exactly one deferred reload may occur. A controller change during normal
autosaved play should keep the existing behavior.

## 202. Complete remaining form, selection and progress semantics

**Priority: LOW — the controls work visually, but several common interactions expose no
programmatic label or selected/value state.**

Starting book, name and gender render adjacent `<label>` elements without `for`/nesting;
voice and speed repeat the pattern. Profession cards and map tabs show selection only by
class. Cache amount inputs lack names, and the Stamina meter is only styled divs rather than
a value-bearing progress object. Task 153/177 covered live regions and dialogs, not these
semantics.

Associate labels/inputs, expose profession and map selection with the appropriate
pressed/tab state and keyboard model, name numeric cache controls from their action/context,
and give Stamina current/max progress semantics. Preserve the current visual design and avoid
inventing a generic component system.

Add focused DOM/accessibility assertions for each control family and keyboard selection,
then check creation, narration settings, maps, caches and the mobile/desktop Sheet manually.

## 203. An imported return frame restores unvalidated vars, ticks and location

**Priority: MEDIUM — a `<return>` from an imported save can push non-numeric variables and a
bogus tick baseline into live state, bypassing `sanitizeData`'s own rules for those fields.**

Found while doing task 180. `sanitizeVisit()` keeps `visit.frame` as a bare `asObj`, and
`Story.deserializeFrame()` then copies its payload verbatim: `vars` is spread as-is,
`entryTicks`/`book` are passed through unconverted, and `location`/`sectionTodock` are taken
without coercion. `restoreReturn()` writes all of them straight into `data.vars`,
`data.location` and the entry-tick snapshot — so until the next load re-sanitizes, a string or
object var feeds `resolveValue()` arithmetic and every `<if var=>` gate, and a negative or
fractional `entryTicks` skews the `<if ticks=>` comparison. The frame's `book`/`section` are
already effectively validated (`data.getSection` must return a real element), and task 180
now rebuilds the frame's fight memo, so this is the remaining unvalidated slice.

Coerce these frame fields on the way in, mirroring `sanitizeData`: keep only finite numeric
vars, floor `entryTicks` to a non-negative integer, force `book` to a positive integer and
`location`/`sectionTodock` to a string or null. `serializeFrame` lives in `visit-state.js`, so
put its inverse there too and let the Story method delegate — keep the pair in one place
rather than validating in the view module.

Test a crafted frame (string/object/NaN vars, a negative fractional `entryTicks`, a non-string
location) resuming and then returning: no non-numeric var reaches `data.vars`, the tick gate
compares against a sane baseline, and an ordinary detour-and-`<return>` still restores its
exact vars, location, todock and used action. Run the focused persistence suites and the full
browser suite.

## 204. A derived `<set>` inside a `<while>` body is not traced per iteration

**Priority: LOW — latent: no section in the corpus derives a value inside a loop body, so
today nothing reaches the gap. It is a hole in an otherwise complete invariant.**

Found while doing task 181. The provisional-dependency trace has two seeds. The
section-scoped one (`rerollPendingVars`, and `unsettledVars` for not-yet-rolled vars) is run
through `provisionalVarClosure`, so a derived `<set>` defers with its source. The per-pass one
is not: `whileIterPendingVars` collects only the roll var the current `<while>` iteration
re-rolls — deliberately, because a loop roll's var must not suppress the loop-entry gate that
is showing it (§6.700 reads `x` both inside and outside) — and `viewPendingVars` unions that
raw set. So a `<set var="s" value="x*5">` inside a loop body, with `x` re-rolled per pass,
would apply against the PREVIOUS pass's `x` (or 0 on the first), and an effect keyed on `s`
would not defer. All seven derived-`<set>` sections (§2.266, §2.698, §6.17, §6.352, §6.488,
§6.625, §6.86) sit outside any loop, which is why `viewPendingVars` documents the limit rather
than paying for it.

Close it without re-introducing the leak the scoping prevents: the closure must be computed
over the pass's own vars and confined to the loop body, so a derived var inside the loop
defers while the same names outside it stay readable. Prefer growing the per-pass set (the
`<set>` nodes within the `<while>` subtree) over widening the section-scoped one, and keep the
computation DOM-free in `render-rules.js`.

Add a synthetic `<while>` whose body derives a value from its per-pass roll: prove the derived
effect applies once per pass with THAT pass's value, that an unrolled pass defers it entirely,
and that a loop-entry gate outside the body still reads the roll that opened the loop (§6.700
stays green). Run the focused render/inventory suites and the full browser suite.

## 205. The provisional-result gate locks a flee exit the fight gate deliberately leaves open

**Priority: LOW — latent: no section pairs a `<choice flee="t">` with a die roll, so no live
combat can currently be reached through it.**

Found while doing task 181. Every other navigation gate exempts fleeing: `computeRollGate`,
`computeTransferGate` and `computeBuyGate` each skip a node with `flee="t"`, and
`computeFightGate` leaves both the flee choice and the mid-fight escape `box=` choice ungated,
because abandoning a fight must stay available. `applyPendingRerollGate` (task 181) works on
rendered buttons instead of nodes and disables every `.goto`/`.choice`, so a direct
`<choice flee="t">` would be locked behind a provisional roll while the fight widget's own
Flee button (a `.btn-secondary`) stays live — the same escape offered twice, gated once. There
is no softlock (Keep is one click away), but the two paths disagree.

Bring the gate in line with the established convention: leave a flee/escape exit clickable and
gate only the ordinary onward navigation. That needs the flee/escape role to be legible to the
gate — tag the rendered button the way `tagFightNav`/`tagRollNav` already tag theirs, rather
than re-deriving the rule in the view.

Add a fixture with a rerollable roll beside a `<choice flee="t">`: the ordinary exits lock
while the result is provisional, the flee choice stays live, and taking it still routes through
the task-178 durable consequence contract. Run the focused actions/combat suites and the full
browser suite.

---

## Review log

*Running audit log of the backlog — each pass re-verifies the open items against
the current code and records what was filed, split, or re-confirmed. Task
numbers refer to the contents checklist at the top of the file.*

Reviewed 2026-07-26 (eleventh full pass, after tasks 175–179): started clean at
`d8e8c59`. Re-read the rule/state/economy modules, every renderer and app lifecycle,
service worker/build/CI paths, focused suites and workflow docs; compared live rule seams
against the XML/reference implementation; and checked source/generated parity, all explicit
bundled-book targets and every live tag/condition family. Filed **180–184** (HIGH):
untrusted fight memos reach `innerHTML`; task 175 leaves ordinary/derived/loop/navigation
consumers of a provisional reroll live; dice callbacks survive Save & quit; disease immunity
does not block affliction admission; and named cleanup removes only one stacked cumulative
curse.

Filed **185–197** (MEDIUM): wildcard affliction penalties, explicit equipment selection,
descriptor-correct market sales, hidden rest, failed-new-game recovery, cache namespace
ownership, narrow header and mobile-Sheet behavior, speech callback generations, transition
focus, the DOM-free import boundary, canonical app stamping and CI source/generated
verification. Filed **198–202** (LOW): deletion failure ordering, stronger source validation,
accurate suite-fatal documentation, creation-draft survival across SW activation, and the
remaining bounded accessibility semantics. The optional full-art basename collision was
reviewed but not filed: all three shipped illustrations are unique and broader art import is
not current scope.

Organization verdict remains the same: no framework, dependency, folder move or wholesale
module split is warranted. The fixes have existing owners; task 181 belongs in the DOM-free
planner/visit boundary, 180 at import rehydration plus safe DOM construction, 182 in Story
lifecycle, and the accessibility items are small app/view contracts. PowerShell 7 build:
**4,377 XML files valid**, 4,369 sections generated, with source/data parity intact. The
build exposed task 196 by changing only the generated stamp/cache identity on unchanged
tracked content. Fresh-profile aggregate smoke: **`RESULT ALL PASS pass=1692 fail=0`**,
including every section of all six books. The review changed only this backlog.

Reviewed 2026-07-22 (tenth full pass, after tasks 173–174): started clean at
`2245eae`. Reviewed every first-party runtime/rule/view/persistence module, the web shell
and service worker, build scripts, focused suites, XML integration and generated/reference
boundaries. Rechecked the architecture/import graph and sampled the corpus at each suspected
rule seam. Filed **175** (HIGH): blessing rerolls occur after branch effects have committed;
§6.49 removes the offered blessing before its button can work, while damage/permanent losses
and random rewards can survive a replacement result. Filed **176–177** (MEDIUM): unavailable
book input rejects outside the demo/import/load recovery UI; and the shared/custom modal
paths still lack complete keyboard isolation/focus restoration. Filed **178–179** (LOW): the
direct flee-choice path missed task 169's durable retry option, and lazy service-worker cache
writes are not held by the fetch event lifetime.

Organization verdict remains unchanged: these are bounded lifecycle and accessibility
contracts, not evidence for a framework, directory move or broad module split. Task 175's
pending-result rule belongs in a DOM-free planner/visit record with the view limited to its
controls; 176 belongs at the app/data validation boundary; 178 should reuse the existing
navigation policy; and 179 is a local service-worker promise fix. PowerShell 7 build:
**4,377 XML files valid**, 4,369 sections generated, **no generated-file drift**.
Fresh-profile aggregate smoke: **`RESULT ALL PASS pass=1619 fail=0`**, including every
section of all six books. The review itself changed no production/generated files.

Reviewed 2026-07-22 (ninth full pass): started clean at `68f7b8f` after tasks
168–172. Re-read the five implementations and their regressions line-by-line,
re-traced every navigation consequence/transaction/save/resume boundary, then
rechecked the unchanged engine/state/combat/market ownership, renderer split,
production/test imports, source/generated boundary, build/SW inputs and docs.
Filed **173** (MEDIUM): task 169 persists the durable consequence after a failed
target but leaves its retry in `Story._pendingRetry`; the v1 visit serializer,
sanitizer and resume path all omit it, so a reload at the recovery screen keeps
the spent item/wound/outcome and permanently loses the destination. Existing
tests prove only the same in-memory Story instance.

Duplication verdict remains **bounded**. A fresh normalized eight-line scan now
finds one production clone: the local click/append/return tail shared by the
equipment and profession pickers in `render-rewards.js`; extracting that tail
would obscure two short, policy-specific controls, so it stays. The only
actionable copy is the identical controllable navigation Promise repeated three
times inside `suite-actions.js`; filed as test-only LOW task **174**. Tasks
170–172 otherwise removed the display/combat/roll copies without creating a
generic framework, and their rules remain explicit.

Organization verdict: the flat dependency-free ES-module structure is still the
right shape. The production import graph has no direct cycle; rules modules do
not construct UI DOM; `render.js` remains a lifecycle/walk facade while the five
focused view modules own their named controls; and the large `engine.js` and
`state.js` are well-sectioned single owners rather than candidates for a
line-count split. Every shipped module is documented and precached. No folder
move, framework, build layer or broad refactor is recommended. PowerShell 7
build: **4,377 XML files valid**, 4,369 sections generated, **no generated-file
drift**. Fresh-profile aggregate smoke: **`RESULT ALL PASS pass=1605 fail=0`**,
including every section of all six books.

Reviewed 2026-07-21 (eighth full pass, including duplication audit): started
clean at `eac1790` after tasks 166–167 and the initial filing of 168. Re-read
both implementations line-by-line, traced every `Story.navigate` caller and
save/commit/status boundary, checked all story/sheet/menu interactions that stay
live during an async move, and re-audited engine/state/combat/market, renderer
ownership, production/test imports, content/source-generated boundaries,
build/SW inputs and documentation. Task **168** is confirmed but upgraded LOW →
MEDIUM and materially rescoped: `_txnSuppress` is global while unrelated story,
sheet and explicit Save & quit controls remain active, so the risk includes
successful moves, ignored secondary detours and false-success explicit saves —
not only a dropped sheet mutation on a rejected fetch. Filed **169** (MEDIUM):
task 167 transacts prices but consequence-first resurrection/item/flee/combat
paths have no rollback-or-retry contract; a cross-book resurrection proves a
live target can fail after the deal is already consumed.

Duplication verdict: there is **bounded duplication, not repository-wide
copy-paste sprawl**. A normalized exact-window scan found no eight-line clones
across the seven focused test suites and only four production windows at that
size. The actionable copies are filed as LOW maintenance tasks **170–172**:
canonicalise the duplicated `titleCase`/`escapeHtml` and three item-bonus label
implementations (170); extract small shared controls from the parallel
single/group combat views, whose drift already caused tasks 83/87/91/162/166
(171); and share roll widget/gate/memo primitives while keeping the four roll
algorithms explicit (172). `commitTxn()`'s exact copy of `commitVisit()` is
folded into 168 because that transaction must change anyway. Deliberately left
alone: the purpose-specific `previewProse`/`renderStatic` tree walkers, the
forced-buy/transfer gate collectors and small market/reward button tails — their
similarity is local, their policies differ, and another abstraction would cost
more clarity than it saves. Test fixture rebuilding is intentional suite
isolation; generated JSON and ignored `*temp.xml`/`*old.xml` source files are not
production-code duplication.

Organization verdict: the flat dependency-free ES-module structure remains the
right shape. Rules still live in DOM-free engine/state/planner modules, view
files remain responsibility-based, the production import graph has no direct
cycle, and `engine.js`/`state.js` are large but cohesive. No directory move,
framework, build layer or broad file split is recommended; the targeted tasks
above are enough. PowerShell 7 build: **4,377 XML files valid**, 4,369 sections
generated, **no generated-file drift**. Fresh-profile aggregate smoke:
**`RESULT ALL PASS pass=1526 fail=0`**, including every section of all six books.

Reviewed 2026-07-21 (seventh full pass): started clean at `793ab8e` after tasks
161–165. Re-traced the cumulative transition/combat persistence changes,
renderer lifecycle, state/save API and live navigation call sites; rechecked the
production/test import graph, rules/view boundary, module ownership, source vs
generated files, build/SW inputs, documentation and the new Markdown rule-doc
copies; and scanned the corpus for concrete triggers before filing tasks
**166–167**. Task 166 (HIGH) is a direct regression in task 7's safety contract:
the new explicit visit saves bypass `changed()`'s listeners, so final quota
failures are silent, recovery is not observed, and ctx-only progress does not
advance the save-card timestamp. Task 167 (MEDIUM) is the remaining pre-arrival
atomicity gap: paid cross-book choices persist the deduction before the target
fetch is accepted or the spent source frame is durable, and rejected promises
also strand the navigation guard. Live paid routes prove this is not synthetic.

Organization verdict: the repository is still arranged the right way. The flat
dependency-free ES-module layout remains appropriate; the task-119 view split is
cohesive, task 163 removed the one direct roll/choice module cycle, task 164's
focused suites no longer boot `app.js`, and rules still live behind DOM-free
engine/state/planner modules. `engine.js` and `state.js` remain large but have
single, well-sectioned ownership, so a directory reshuffle or line-count split
would add indirection rather than clarify responsibilities. The two findings
are persistence protocol defects, not evidence that the file layout needs a
redesign. PowerShell 7 build: **4,377 XML files valid**, 4,369 sections
generated, **no generated-file drift**. Fresh-profile aggregate smoke:
**`RESULT ALL PASS pass=1493 fail=0`**, including every section of all six books.

Reviewed 2026-07-21 (sixth full pass): started clean at `cb082e1` after the
task-115–160 burn-down. This pass reviewed the cumulative persistence and
renderer changes since the fifth audit, traced every visit-transition/combat
save boundary against the provider-written record, checked the production and
test import graphs, re-read the module/build/SW/docs contracts, rebuilt all
bundled data, and ran the aggregate browser suite on a fresh Chrome profile.
Filed tasks **161–165**. The severe finding is the remaining visit-transition
atomicity hole (161, HIGH): `goTo()`/`restoreReturn()`/`undo()` can autosave the
new state position while Story still serializes the old visit, and neither
`begin()` nor `goBack()` guarantees a final correcting save. A no-entry-effect
destination therefore reloads through stale migration; pure `<return>` sections
§4.69/§5.410/§6.448a lose their frame and can fresh-re-enter the source. The
independent combat gap (162, MEDIUM) is the same invariant at an action boundary:
continuing single/group rounds and blessing retries redraw directly without a
post-mutation visit save, so reload can heal the foe or restore a partial round.

Organization verdict: the production layout is still fundamentally sound. The
task-119 split made `render.js` a 1,210-line lifecycle/dispatch facade and left
cohesive view modules; `engine.js` and `state.js` are large but internally
sectioned around one rule engine and one aggregate game model, so splitting them
for line count alone would add indirection without a cleaner ownership boundary.
No directory reshuffle or framework/build layer is warranted. The concrete
post-split debts are bounded: break the direct `render-rolls` ↔ `render-choices`
ES-module cycle and align AGENTS/README plus stale comments/help text (163); prune
the copied whole-harness imports so focused suites stop evaluating unrelated
`app.js` boot code (164); and repeat task 141's archive maintenance now that
115–160 are complete (165). Source/generated ownership, the flat no-dependency
module scheme, core rules/view separation, service-worker required-module list,
content-hash inputs and licence boundary all checked clean. PowerShell 7 build:
**4,377 XML files valid**, 4,369 sections generated, **no generated-file drift**.
Fresh-profile smoke: **`RESULT ALL PASS pass=1462 fail=0`**, including every
section of all six books.

Re-prioritised 2026-07-20 (backlog re-review — no new code audit; the fifth-pass
verdicts stand). The burn-down cleared every HIGH and MEDIUM task, leaving all 17
open items in LOW. Two were under-ranked and are moved LOW → MEDIUM: **134** (a
multi-candidate market sell irreversibly destroys the wrong ship+cargo, or the
named weapon over a generic one — the same irreversible-loss severity that moved
118 to HIGH; its dependency, the 117/118 shared loss matcher, is now done) and
**137** (a save persisted without its `fl_meta` entry silently overwrites a whole
adventurer — a high-consequence save-integrity loss, unblocked now that 116 has
rewritten the persistence schema). 134 leads the MEDIUM block, then 137. The
remaining LOW bucket — never impact-ranked before (it carried filing order) — is
reordered: zero-risk signal protection first (**142** CI verdict grep, **143**
post-report silent-pass, **144** no-op rebuild cache-bust — the logic that moved
140/141 up), then the real-but-rare player-facing bugs (**149**, **148**, **138**),
a11y + info UX (**153**, **139**), the divergence/robustness/polish grab-bags
(**135**, **136**, **151**, **152**), and the three latent, no-corpus-trigger
items last (**145**, **150**, **160**). Everything else was re-confirmed LOW.
Work order is now 134 → 137 → 142 → 143 → 144 → 149 → 148 → 138 → 153 → 139 →
135 → 136 → 151 → 152 → 145 → 150 → 160.

Reviewed 2026-07-19 (fifth full pass): started clean at `383aede` (task 119
phases 1+2 freshly landed), suite green on a fresh profile at the reviewed
tree (`RESULT ALL PASS pass=1288 fail=0`). Method: two deep subsystem sweeps
(engine/state core; renderer/view), each finding verified against the code,
the live XML and the JaFL reference, with the highest-severity premises
re-verified line-by-line by a second reader; combat/market, build/CI/SW/docs
and the test harness were reviewed inline (three further parallel sweeps were
started and deliberately stopped; their scopes were re-covered inline). Filed
tasks **142–160**. The headline is a save/load atomicity family that is the
systemic successor to task 116 — the persisted visit record is not atomic with
the live visit: `begin()` autosaves the new section against the OLD ctx on
almost every navigation (154, HIGH — work this first); one-shot rest/buy/roll
memos are written after the saving mutation, so a reload repeats them,
re-opening 129/130 via save-scumming (155); and a mid-visit reload drops armed
`<tick special=>` fight bonuses/penalties (156) — one deferred-save fix likely
closes all three. Independent rules divergences: item-name globs never match —
§4.482/§6.201 unreachable, §6.144's trophy head never taken (157); two
written-max Stamina clamps still strip aura headroom, 124's siblings (158);
resurrection revives at half Stamina where the book and JaFL say full, a rule
that predates task 34 and was never reference-checked (159). View-layer races:
the dice-animation window lands pending rolls on the wrong visit (146) and
navigation has no in-flight guard — double-clicks double-run leave hooks and
entry effects (147); plus undo's stale return frame (148), pay-before-chooser
leaks (149), the latent renderIfChain else/elseif divergence (150), the
dead-end fallback counting disabled controls (151), a view polish grab-bag
(152) and a11y quick wins (153). Infra/tests: CI's verdict grep matches the
whole DOM dump — failing runs are misdiagnosed as bootstrap FATALs today, and
a source literal could false-pass tomorrow (142, proven against a real and a
hand-flipped dump); a failing `ok()` after report() is the harness's one
remaining silent-pass vector (143); meta.json's embedded build date busts
every installed player's cache on a no-op rebuild (144); payChoiceCost
validates a tag/wildcard payment it can never consume, latent (145); and the
task-117 loss matcher's two latent gaps (160). Task 119 gained a phase-3
guidance note: extract the remaining rule pockets (renderPassive's cascade,
grantChoosableReward, renderChoice's gates, branch resolution, the group
planner) as tested DOM-free planners BEFORE moving view files, and plan a
fourth rolls+branches view module. Checked clean this pass: task-115 detours
(every navigation routes through `Story.navigate`), 116's ctx serialization
round-trip, the memo-path tripwire, listener/XSS hygiene, a 4,437-section
corpus scan for the mixed flag-reward double-grant seam (zero fall-throughs),
`sanitizeData` field coverage, `canonCargo` folding, the task-128 equipment
fold (the real hyperium wand matches), combat.js blessing/reroll/group-fight
semantics, market transactions (the sole `currency=` market, book2/495, holds
no inline buys), the build scripts (validation-first, deterministic, the stamp
covers everything the SW precaches), the README module table, regression
coverage for all sixteen recent fixes, the every-section corpus suite, and
the NOTICE/licence split. Open items 134–139 were deliberately not re-verified
this pass (the fourth-pass verdicts stand); 119's progress claim was assessed
(~80% true) and extended rather than re-litigated.

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
