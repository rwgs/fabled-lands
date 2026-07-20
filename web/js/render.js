// render.js — renders a parsed <section> tree into interactive DOM.
//
// Model: the whole section is re-rendered on every state change. Passive
// effects and roll results are memoized per-visit by a stable node path, so:
//   * passive effects apply exactly once per visit,
//   * conditionals re-evaluate against live state after each roll,
//   * revealed branches only appear (and only apply their effects) once resolved.

import {
  evaluateCondition, applyEffect, applyEffectBody, boolAttr, resolveValue, isDiceExpr,
  rollDifficulty, rollRankCheck, rollTraining, rollDice, matchRange, childAdjustment,
  applyRest, buyResurrectionDeal, reviveWithResurrection, abilityChoiceOptions, readItemEffects,
  whileLoopDone, useItemEffect, losePaymentPlan,
} from './engine.js';
// combat.js → render-combat.js (fight view); most of market.js → render-market.js (economy
// view). render.js keeps only what its remaining methods use directly. (task 119)
import { applyInlineBuy, payChoiceCost } from './market.js';
import { GameState, normalize, makeItem, parseTags, currencyAward, splitItemName, isShardsCurrency } from './state.js';
import { ABILITY_LABEL } from './rules.js';
import { bookTitle, availableBooks, loadBook, getSection } from './data.js';
import { animateDice, modal } from './ui.js';
import {
  computeOutcomeBlessings, blessingVeto, isGuardedBlessingLoss,
  blessingSpendForGoto, blessingSpendForReroll, ownsSoleLinkedBlessing,
  ITEM_FAMILY_TAGS,
  linkedRewards as linkedRewardsRule, isCounterReward as isCounterRewardRule,
  isChooseOne as isChooseOneRule, isPricedItemAward as isPricedItemAwardRule,
  hasVisiblePay as hasVisiblePayRule, isRollGate as isRollGateRule,
  rewardWasteReason as rewardWasteReasonRule, isOptionalForce as isOptionalForceRule,
  forcedChoiceGroup as forcedChoiceGroupRule, isEconomicPayment as isEconomicPaymentRule,
} from './render-rules.js';
import {
  computeFightGate, computeEscapeCodewords, aggregateFightOutcome,
  isDeferredEscapeClear, isDeferredTagCleanup, isDeferredDeadChain,
  computeRollGate, computeTransferGate,
} from './render-gates.js';
import {
  newCtx, resolveNodePath, serializeCtx, deserializeCtx, serializeFrame,
} from './visit-state.js';
import { MARKET_TITLES, titleCase, diceWord, escapeHtml, itemLabel } from './render-util.js';
import { combatView } from './render-combat.js';
import { marketView } from './render-market.js';

const INLINE_STYLE = { b: 'strong', i: 'em', u: 'u', caps: 'span' };
const BRANCH_TAGS = new Set(['success', 'failure', 'outcomes']);
const ROLL_TAGS = new Set(['difficulty', 'random', 'rankcheck', 'training']);
// The ROLLGATE_*/TRANSFER_GROUP wrapper tag sets moved to render-gates.js (task 119),
// used only by the navigation-gate computations that also moved there.
// Note: <adjust> is deliberately NOT here. In this corpus it is always a die-roll
// MODIFIER (a child of <difficulty>/<random>/<rankcheck>, consumed by
// childAdjustment) — never a passive effect. Auto-applying it on view would
// silently upgrade the crew ("<adjust crew='good'>") or bump codeword counters.
const PASSIVE_TAGS = new Set(['lose', 'tick', 'gain', 'set', 'curse', 'disease', 'poison', 'adjustmoney']);
// ITEM_FAMILY_TAGS / CHOOSE_ONE_TAGS moved to render-rules.js (task 119); ITEM_FAMILY_TAGS
// is imported back for the award/label views, CHOOSE_ONE_TAGS is used only by isChooseOne.

// Tag-dispatch table for renderElement (task 9): tag → Story method name. Every
// method has the signature (container, node, path); tags that share a handler are
// listed under each alias. This is the view half of the tag registry; the DOM-free
// effect half lives in engine.js (EFFECT_APPLIERS). Adding a renderable tag is a
// one-line change here plus its method — no switch to hunt through. (Kept separate
// from the engine table on purpose: render is DOM, the rules layer is DOM-free.)
const TAG_RENDERERS = {
  p:               'renderParagraph',
  group:           'renderGroup',
  text:            'renderTextWrapper',
  desc:            'renderTextWrapper',
  if:              'renderIfChain',
  elseif:          'renderIfChain',
  else:            'renderIfChain',
  goto:            'renderGoto',
  return:          'renderReturn',
  items:           'renderItemsController',
  item:            'renderItemAward',
  weapon:          'renderItemAward',
  armour:          'renderItemAward',
  tool:            'renderItemAward',
  choices:         'renderChoices',
  choice:          'renderChoiceElement',
  difficulty:      'renderDifficulty',
  random:          'renderRandom',
  rankcheck:       'renderRankcheck',
  training:        'renderTraining',
  fight:           'renderFight',
  // <flee>/<fightdamage> describe a consequence that fires on an EVENT (the player
  // fleeing, or the enemy landing a blow), never on render. Show their prose but
  // render them inert — combat.js / the Flee button apply the effects.
  flee:            'renderInert',
  fightdamage:     'renderInert',
  market:          'renderMarket',
  buy:             'renderInlineBuy',
  sell:            'renderInlineSell',
  rest:            'renderRest',
  moneycache:      'renderMoneyCache',
  itemcache:       'renderItemCache',
  transfer:        'renderTransfer',
  resurrection:    'renderResurrection',
  reroll:          'renderReroll',
  image:           'renderImage',
  table:           'renderTable',
  'choices-table': 'renderTable',
  // task 32: previously unhandled tags. <field>/<extrachoice> are implemented;
  // <while>/<sectionview> render their inner prose (as the default recursion
  // already did — no behaviour change) with the automated mechanic deferred.
  // Explicit entries let the default case become strict later.
  field:           'renderField',
  extrachoice:     'renderExtraChoice',
  // <while var="V"> repeats its body until V is assigned (task 100): each pass is a
  // fresh iteration with its own roll/effects, and a live unterminated loop blocks
  // the rest of the section (JaFL WhileNode holds execution until the loop ends).
  while:           'renderWhile',
  // <fightround> is a combat-round RULE (task 99): its body executes headlessly
  // between rounds (combat.fightRound), so it renders as inert prose — visible
  // words, no live roll widgets the player could work out of sequence.
  fightround:      'renderInert',
  // <sectionview> (§5.114's trance oracle) opens a read-only popup showing random
  // sections' prose — no effects, no controls, no visit change (task 101).
  sectionview:     'renderSectionview',
};

// Render a section's prose READ-ONLY for the <sectionview> oracle (§5.114): walk the
// parsed element keeping paragraphs and inline emphasis, and for every game tag just
// recurse into its words — so no effect is applied, no control is armed and the player's
// state/visit is untouched. (A deliberate sibling of app.renderStatic, kept here so the
// view layer needn't import the app shell.) (task 101)
export function previewProse(sectionEl) {
  const wrap = document.createElement('div');
  wrap.className = 'sectionview-prose';
  const walk = (node, parent) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) { const t = n.nodeValue.replace(/\s+/g, ' '); if (t.trim()) parent.appendChild(document.createTextNode(t)); return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const tag = n.tagName.toLowerCase();
      if (tag === 'p') { const p = document.createElement('p'); walk(n, p); parent.appendChild(p); }
      else if (tag === 'b') { const b = document.createElement('strong'); walk(n, b); parent.appendChild(b); }
      else if (tag === 'i') { const i = document.createElement('em'); walk(n, i); parent.appendChild(i); }
      else if (tag === 'u') { const u = document.createElement('u'); walk(n, u); parent.appendChild(u); }
      else walk(n, parent); // any other tag: keep its words, drop its behaviour
    });
  };
  walk(sectionEl, wrap);
  return wrap;
}

// resolveNodePath / newCtx / (de)serializeCtx / serializeFrame moved to visit-state.js
// (task 119); the Story visit methods below delegate to them.

export class Story {
  constructor(rootEl, state, opts) {
    this.root = rootEl;
    this.state = state;
    // Wrap navigation so leaving a section honours its todock= before the transition —
    // the single "leaving" hook. A sail exit marks the ship being taken (this._sailExempt)
    // so only the OTHER at-large ships relocate and the voyage continues; a non-sail exit
    // (gone ashore) exempts nothing, so every at-large ship docks and the voyage ends. (task 81)
    const rawNavigate = opts.navigate;
    this.navigate = (book, section) => {
      // Snapshot the section being LEFT as the one-level return frame BEFORE the leave
      // hooks / rawNavigate mutate anything — so a <return> in the destination restores
      // this exact visit (position, section-local vars, render memo) rather than
      // re-entering it fresh. (task 110)
      const frame = this._captureReturnFrame();
      this._applyLeaveHooks();
      this._returnFrame = frame;
      rawNavigate(book, section);
    };
    this.onDeath = opts.onDeath || (() => {});
    this.notify = opts.notify || (() => {});
    this.onRender = opts.onRender || (() => {}); // called after each (re)render
    this.ctx = null;
    this.sectionEl = null;
    this.outcomeBlessings = new Set(); // blessing-guarded outcomes this section (task 108)
    this.sectionTodock = null;  // current section's todock= (task 81)
    this._sailExempt = null;    // ship id exempted from todock on a sail exit (task 81)
    // <while> loop iteration state (task 100), live only while renderWhile is walking
    // an iteration body: whether the current pass is still waiting on an interactive
    // roll, and which roll vars that pass has not yet resolved (so a re-rolled var is
    // treated as stale until this pass rolls it — see pendingRollVar).
    this.inWhileIter = false;
    this.whileIterPending = false;
    this.whileIterPendingVars = null;
    this.deferredCleanups = new Map(); // hidden removetag cleanups to apply on leaving (task 88)
    // One-level "return frame" (task 110): the immediately previous visit, snapshotted
    // as we leave it so a <return> can restore that section at the point it was left —
    // its position, section-local variables and render memo (ctx) — instead of
    // re-entering it fresh (which would clear vars/roll state and re-run entry effects).
    // Consumed (and cleared) by goBack; the format only ever promises one level.
    this._returnFrame = null;
    // The choice/goto node the player clicked to leave the current section — recorded
    // into the return frame so, on <return>, that one source action is marked spent
    // (crossed off) unless it carries revisit="t". (task 110)
    this._pendingSourceNode = null;
  }

  // Snapshot the current visit so a later <return> can restore it (task 110). Null
  // before the first section is entered (nothing to return to). Keeps references to
  // the live ctx/sectionEl (neither is mutated once we leave — begin() builds fresh
  // ones for the destination) and a copy of the section-local variables (begin()
  // reassigns state.data.vars). usedSource is the choice/goto just clicked, if any.
  _captureReturnFrame() {
    if (this.section == null) { this._pendingSourceNode = null; return null; }
    const frame = {
      book: this.book,
      section: this.section,
      sectionEl: this.sectionEl,
      ctx: this.ctx,
      sectionTodock: this.sectionTodock,
      vars: { ...this.state.data.vars },
      location: this.state.data.location ?? null,
      entryTicks: this.state.entryTickCount(),
      usedSource: this._pendingSourceNode || null,
    };
    this._pendingSourceNode = null;
    return frame;
  }

  // The single "leaving a section" hook, shared by navigate() and goBack() (task 110).
  _applyLeaveHooks() {
    // End-of-section cleanups deferred during the visit (a hidden <tick removetag>):
    // apply them now, on the way out, so a selection tag survives the whole visit for
    // its own roll/outcome ticks and is still stripped exactly once. (task 88)
    if (this.deferredCleanups && this.deferredCleanups.size) {
      for (const n of this.deferredCleanups.values()) applyEffect(n, this.state, {});
      this.deferredCleanups.clear();
    }
    if (this.sectionTodock) {
      this.state.applyTodock(this.sectionTodock, this._sailExempt != null ? this._sailExempt : null);
      if (this._sailExempt == null) this.state.data.sailingShipId = null;
    }
    this._sailExempt = null;
  }

  /** Begin a fresh visit of a section element. */
  begin(sectionEl, book, section) {
    this.sectionEl = sectionEl;
    this.book = book;
    this.section = section;
    // A drunk-potion boost lasts only for the section it was used in (task 41):
    // clear it on entering a new section so it can't be carried forward.
    this.state.clearPotionBonuses();
    // Likewise a per-fight attack/Defence bonus from <tick special="attack|defence">
    // (task 49) applies only to the current section's fight — clear it on entry.
    this.state.clearFightBonuses();
    // Variables are section-local (JaFL clears them per section): reset them on entry
    // so a `<while var>` loop starts undefined and a roll var can't be read stale from
    // an earlier section (§6.700's `<if var="x" equals="6">` gate, §5.218's free). (task 100)
    this.state.clearVars();
    this.deferredCleanups = new Map(); // fresh per visit (task 88)
    // Record the player's location from the section's dock= attribute and berth any
    // at-large ship here (it was sailed in); a section without dock= is inland/at sea,
    // so the location clears and no ship is "here" unless it is at large. (task 73)
    this.state.arriveAtDock(sectionEl.getAttribute('dock'));
    // Remember this section's todock= so the wrapped navigate applies it on leaving. (task 81)
    this.sectionTodock = sectionEl.getAttribute('todock') || null;
    this.ctx = this._newCtx();
    // Gambling-bet lock (task 38): a <tick special="lock" cache="X"> bundled inside
    // a roll <group> means "freeze the bet once you roll" (book1/91, book2/134) — as
    // opposed to a top-level lock, which is stash bookkeeping and must NOT disable
    // its widget. Record those caches so only their widget gates on the lock flag,
    // and reset each to unlocked on entry so a fresh visit lets you re-bet (the
    // deferred lock, applied on the roll in renderGroupWithRoll, re-locks it).
    Array.from(sectionEl.querySelectorAll('group')).forEach((g) => {
      if (!g.querySelector('random, difficulty, rankcheck, training')) return;
      g.querySelectorAll('tick[special="lock"][cache]').forEach((t) => {
        const name = t.getAttribute('cache');
        if (!name) return;
        this.ctx.rollLockCaches.add(name);
        if (this.state.isCacheLocked(name)) this.state.lockCache(name, false);
      });
    });
    // Pre-scan grouped-award controllers (<items group="X" limit="N"/>) so the
    // individual award rows know their "choose up to N" cap no matter whether the
    // controller sits before or after them in the section (both orders occur).
    Array.from(sectionEl.querySelectorAll('items[group]')).forEach((c) => {
      const g = c.getAttribute('group');
      const lim = parseInt(c.getAttribute('limit') || '0', 10);
      if (g && lim > 0) this.ctx.groupLimits.set(g, lim);
    });
    // Reset this section's coordination flags (price=/flag= keys). They gate the
    // "pay to spin" roll idiom (task 30) and the paid-offering outcomes (book4/456)
    // within a single visit; a flag left set by a previous incomplete visit must
    // not pre-arm a roll or reveal an outcome for free. Only clear ones actually
    // set, so a fresh visit (all clear) triggers no needless save.
    sectionEl.querySelectorAll('[price], [flag]').forEach((n) => {
      const p = n.getAttribute('price'); if (p && this.state.getFlag(p)) this.state.setFlag(p, false);
      const f = n.getAttribute('flag'); if (f && this.state.getFlag(f)) this.state.setFlag(f, false);
    });
    // Snapshot the box-tick count as this section is ENTERED (before its <tick/> runs),
    // so <if ticks="N"> reads the entry count and a tick applied this visit can't flip
    // the guard on a mid-visit rerender (task 105). Position is already current here
    // (navigate() calls goTo before begin), matching addTick's no-args box key.
    this.state.setEntryTicks(this.state.tickCount());
    this.render();
  }

  rerender() { this.render(); }

  // Use a usable Adventure-Sheet item effect (task 41) and route any section detour it
  // opens through the SAME navigation entry point as a choice/goto (task 115). Applying
  // the effect and consuming the charge FIRST keeps those legitimate state changes; the
  // detour's <goto> then goes via this.navigate so the source visit's return frame is
  // captured and its leave hooks run — otherwise a raw jump left the destination with a
  // stale/blank frame and its <return> re-entered the wrong section. Returns the engine
  // result so the caller can surface a revealed illustration (the map of Bazalek, task 62).
  useItem(item, effect, bodyNode = null) {
    const res = useItemEffect(this.state, item, effect, bodyNode);
    if (res.removeItem) this.state.removeItemById(item.id);
    if (res.goto && res.goto.section != null) {
      this.navigate(res.goto.book || this.book || this.state.data.book, res.goto.section);
    } else {
      this.rerender();
    }
    return res;
  }

  // ---- current-visit persistence (task 116) --------------------------------
  // The ctx factory and (de)serialization primitives live in visit-state.js (task 119);
  // these Story methods keep the API and delegate to them.
  _newCtx() { return newCtx(); }

  // Installed as the GameState visit provider (setVisitProvider) so every autosave writes
  // the current visit. Serialises the section identity, entry-tick baseline, section memo
  // and the one-level return frame. Null before the first section (nothing to resume).
  serializeVisit() {
    if (this.section == null || !this.ctx) return null;
    return {
      v: 1,
      book: this.book,
      section: this.section,
      entryTicks: this.state.entryTickCount(),
      sectionTodock: this.sectionTodock,
      ctx: serializeCtx(this.ctx),
      frame: this._returnFrame ? serializeFrame(this._returnFrame) : null,
    };
  }

  // Rebuild a return frame from its serialised form, given the frame's re-parsed section
  // element (the caller fetches it — getSection is async). Mirrors _captureReturnFrame's shape.
  deserializeFrame(rec, frameSectionEl) {
    if (!rec || typeof rec !== 'object' || !frameSectionEl) return null;
    return {
      book: rec.book,
      section: rec.section,
      sectionEl: frameSectionEl,
      ctx: deserializeCtx(rec.ctx, frameSectionEl),
      sectionTodock: rec.sectionTodock ?? null,
      vars: rec.vars && typeof rec.vars === 'object' ? { ...rec.vars } : {},
      location: rec.location ?? null,
      entryTicks: rec.entryTicks,
      usedSource: rec.usedSourcePath ? resolveNodePath(rec.usedSourcePath, frameSectionEl) : null,
    };
  }

  // Resume a saved visit WITHOUT begin()'s entry side-effects (task 116): no clearing of
  // vars/potion/fight bonuses, no re-walking of passive effects, no dock arrival. The
  // restored ctx already memoises every applied effect and resolved roll, so render()
  // re-applies nothing and shows the visit exactly where it was saved. `frame` is the
  // pre-hydrated return frame (or null). Wrapped by the caller with a resumeStale() fallback.
  resume(sectionEl, book, section, record, frame = null) {
    this.sectionEl = sectionEl;
    this.book = book;
    this.section = section;
    this.ctx = deserializeCtx(record && record.ctx, sectionEl);
    this.sectionTodock = (record && record.sectionTodock != null) ? record.sectionTodock : (sectionEl.getAttribute('todock') || null);
    this.deferredCleanups = new Map(); // re-detected as the section re-renders (task 88)
    this.state.setEntryTicks(record && record.entryTicks != null ? record.entryTicks : this.state.tickCount());
    this._returnFrame = frame || null;
    this.render();
  }

  // Conservative migration for a save with no matching visit record (legacy saves, or a
  // record dropped by sanitize). We cannot know which one-shot effects already ran, so we
  // replay entry on a THROWAWAY clone of the state and adopt its memo: the real state keeps
  // its persisted totals (nothing is re-applied to it), while the shared parsed section's
  // PASSIVE entry effects are all marked done so the real render re-fires none of them —
  // curing the common "reload repeats the on-entry gain/tick" bug. Interactive progress
  // (rolls, picks, fights) is unknowable from a legacy blob and is reset for the player to
  // redo; this is exact only for saves that carry the record (all new saves do). (task 116)
  resumeStale(sectionEl, book, section) {
    const probeData = JSON.parse(JSON.stringify(this.state.data));
    const probeState = new GameState(probeData);
    probeState.ephemeral = true; // never touch storage from the probe
    const probe = new Story(document.createElement('div'), probeState, { navigate() {}, onDeath() {}, notify() {} });
    probe.begin(sectionEl, book, section); // applies entry effects to the CLONE, populates probe.ctx
    this.sectionEl = sectionEl;
    this.book = book;
    this.section = section;
    this.ctx = probe.ctx; // memoises every entry effect (nodes are the shared, static section tree)
    this.state.data.vars = { ...probeState.data.vars }; // deterministic entry-written vars
    this.sectionTodock = probe.sectionTodock;
    this.deferredCleanups = new Map();
    this.state.setEntryTicks(probeState.entryTickCount());
    this._returnFrame = null;
    this.render();
  }

  render() {
    this.root.innerHTML = '';
    const el = this.sectionEl;

    // Section illustration (gracefully hidden if the image file is absent).
    const imgName = el.getAttribute('image');
    if (imgName) this.root.appendChild(this.makeIllustration(imgName));

    const label = document.createElement('div');
    label.className = 'section-num';
    label.textContent = `${bookTitle(this.book)} · ${this.section}`;
    this.root.appendChild(label);

    // Tick boxes for this section (the empty boxes printed beside the number in
    // the books). setSectionBoxes must run before appendChildren so an in-section
    // <tick/> is capped (task 27), but the row is DRAWN after the walk (below) so a
    // box ticked *this* visit shows ☑ now, not a render later (task 70).
    const nBoxes = parseInt(el.getAttribute('boxes') || '0', 10);
    this.state.setSectionBoxes(nBoxes); // cap this section's box ticks (task 27)

    const flow = document.createElement('div');
    flow.className = 'flow';
    // The most-recent roll in document order. Persists across nesting so that
    // `<outcomes>`/`<success>` at section level can attach to a `<difficulty>`
    // nested inside a preceding `<p>` (a very common structure).
    this.activeRoll = null;
    this.blocked = false; // set true by an unresolved forced economic payment
    // An economic <lose> is treated as an opt-in *payment* only when the section
    // offers a way to avoid it — an optional (force="f") "turn back"/decline goto.
    // Without such an escape the loss is unavoidable (e.g. §106 "buy the pearls"),
    // so it auto-applies as a plain effect rather than gating behind a click.
    this.hasDecline = !!el && Array.from(el.querySelectorAll('goto')).some((g) => {
      const f = g.getAttribute('force');
      return f != null && !boolAttr(f, true);
    });
    // Mid-fight escape brackets (task 54): codewords ticked in-section that also gate
    // a box= choice mark a "flee/surrender while the fight is live" option — computed
    // before the fight gate so it can leave those choices ungated.
    this.escapeCodewords = computeEscapeCodewords(el);
    // Fight gating: while an unresolved <fight> exists, the navigation that
    // follows it must not be clickable (else the player skips the fight). See
    // computeFightGate (render-gates.js) / applyFightGate.
    this.fightGate = computeFightGate(el, this.escapeCodewords);
    // Travel/encounter roll gating: a mandatory <random> feeding an <outcomes> table
    // must be rolled before the section's onward <choices> unlock, and a "get lost"
    // outcome that carries its own <goto> suppresses those choices (task 104). See
    // computeRollGate / applyRollGate.
    this.rollGate = computeRollGate(el);
    // Forced-transfer gating (task 107): a visible, forced (default force="t"),
    // unpriced <transfer> is a mandatory action — the onward navigation after it
    // stays locked until it runs. renderTransfer flags pendingTransfer while such a
    // transfer is still live this pass; applyTransferGate then disables the tagged
    // navs. Reset per render.
    this.transferGate = computeTransferGate(el);
    this.pendingTransfer = false;
    // Blessing-guarded storm/capsize outcomes (task 108): the blessings named on this
    // section's <outcome blessing="X"> hazards. A held blessing vetoes that outcome
    // (renderBranch), and a non-hidden sibling <lose blessing="X"> is the deferred
    // "spend to avoid it" step (renderPassive/renderGoto), not an on-entry loss.
    this.outcomeBlessings = computeOutcomeBlessings(el);
    this.sectionFight = null; // aggregate proxy for the section's fight(s) (set in renderFight)
    this.sectionFights = []; // every sequential (non-group) fight drawn this pass, in order (task 45)
    this.renderedGroups = new Set(); // group= ids already drawn this pass (task 26)
    this.appendChildren(flow, el, 'r');
    this.applyFightGate(flow);
    this.applyRollGate(flow); // gate onward nav on the mandatory travel/encounter roll (task 104)
    this.applyTransferGate(flow); // gate onward nav on an unresolved forced transfer (task 107)
    this.surfaceExtraChoices(flow); // persistent <extrachoice> options active here (task 32)
    // Draw the box row now (after the walk) so a <tick/> applied this visit reads
    // as ☑ immediately; it sits above the prose, beside the section number (task 70).
    if (nBoxes > 0) {
      const ticked = this.state.tickCount(this.book, this.section);
      const boxRow = document.createElement('div');
      boxRow.className = 'section-boxes';
      for (let i = 0; i < nBoxes; i++) {
        const b = document.createElement('span');
        b.className = 'tick-box' + (i < ticked ? ' ticked' : '');
        b.textContent = i < ticked ? '☑' : '☐';
        boxRow.appendChild(b);
      }
      this.root.appendChild(boxRow);
    }
    this.root.appendChild(flow);

    // Dead-end fallback: a fully-resolved section offering no way forward is a
    // narrative death (the original game exposed an "Extra Choice: Death" for this).
    // Controls inside an untaken (grayed) branch don't count — they're disabled.
    const controls = Array.from(flow.querySelectorAll('.goto, .choice, .btn-roll, .btn-secondary, .btn-mini, .fight, .group-action, .pay-action, .reward-pick'))
      .filter((c) => !c.closest('.cond-inactive'));
    if (!controls.length && !this.state.isDead()) {
      const end = document.createElement('button');
      end.className = 'goto goto-primary end-fate';
      end.textContent = 'Your tale ends here — accept your fate ▸';
      end.addEventListener('click', () => this.onDeath());
      flow.appendChild(end);
    }

    this.onRender();
    // If a lost fight offers a non-death "if you lose…" branch (e.g. §570 → §195
    // restores you), don't trigger death: the player takes that branch instead.
    const deathDeferred = this.sectionFight && this.sectionFight.outcome === 'lose'
      && this.fightGate && this.fightGate.hasLosePath;
    if (this.state.isDead() && !deathDeferred) this.onDeath();
  }

  makeIllustration(name, title = '') {
    const fig = document.createElement('figure');
    fig.className = 'illus';
    const img = document.createElement('img');
    img.alt = title || '';
    img.loading = 'lazy';
    // Filenames carry spaces ("Map of Bazalek Isle.JPG"), so encode the segment.
    img.src = 'assets/illus/' + encodeURIComponent(name);
    img.onerror = () => fig.remove();
    fig.appendChild(img);
    if (title) { const cap = document.createElement('figcaption'); cap.textContent = title; fig.appendChild(cap); }
    return fig;
  }

  // An <image file="…" title="…">: with inner text it's an inline link that opens
  // the illustration in a modal (keeping the prose — book1/200, book5/410,
  // book3/75); a self-closing one drops in the figure. The corpus uses file= (not
  // src=/name=); build-data.ps1 copies each into web/assets/illus/. (task 62)
  renderImage(container, node, path) {
    const file = node.getAttribute('file') || node.getAttribute('src') || node.getAttribute('name') || '';
    const title = node.getAttribute('title') || '';
    const inner = document.createElement('span');
    this.appendChildren(inner, node, path);
    if (inner.textContent.trim()) {
      const link = document.createElement('button');
      link.className = 'image-link';
      link.innerHTML = inner.innerHTML;
      link.title = title ? `View ${title}` : 'View illustration';
      link.addEventListener('click', () => this.showImageModal(file, title));
      container.appendChild(link);
      return link;
    }
    container.appendChild(this.makeIllustration(file, title));
    return null;
  }

  showImageModal(file, title) {
    modal({ title: title || 'Illustration', body: this.makeIllustration(file, title), buttons: [{ label: 'Close', value: null }] });
  }

  // ---- core walk -----------------------------------------------------------
  appendChildren(container, parent, basePath) {
    const nodes = Array.from(parent.childNodes);
    let chainActive = false, chainDone = false, chainDeferred = false; // if/elseif/else chain state

    nodes.forEach((node, idx) => {
      // A forced economic payment (see renderPayment) blocks the rest of the
      // section — nothing after it renders until the player resolves it. This
      // mirrors JaFL's forced-action model so an optional exit shown *before*
      // the payment (e.g. "turn back to 142") costs nothing.
      if (this.blocked) return;
      const path = basePath + '.' + idx;
      // Per-visit memoization invariant (task 11): every memo key — fx@/roll@/
      // grp@/pay@/chain@ — is derived from this positional `path` (parent path +
      // child index). That is stable ONLY because the parsed section tree is never
      // mutated during a visit, so a given node keeps the same sibling index across
      // re-renders. If a future feature ever *conditionally reorders, inserts, or
      // removes* siblings between renders, a node's path would slide onto another
      // node's memo slot — an already-applied effect could re-fire, or a resolved
      // roll be lost. This tripwire catches exactly that: a path seen mapped to a
      // different node than before means the assumption is broken. It never fires
      // under the current static-tree model (a dev aid, not a hot-path cost).
      const prevNode = this.ctx.pathNodes.get(path);
      if (prevNode && prevNode !== node) {
        console.warn(`[render] memoization path "${path}" reused for a different node — conditionally reordering siblings breaks effect-dedup (see appendChildren, task 11).`);
      } else if (!prevNode) {
        this.ctx.pathNodes.set(path, node);
      }
      if (node.nodeType === Node.TEXT_NODE) {
        this.appendText(container, node.nodeValue);
        // Prose between branches does NOT break an if/elseif/else chain: the books
        // join them with connector text ("</if>, <elseif>…, or <else>…" — the §1.586
        // storm idiom), and JaFL binds each elseif/else to the nearest preceding if
        // regardless of interleaved text. The old reset here re-armed the <else>
        // after a MATCHED <if>, offering both the barque's 1-die roll and the
        // galleon's 3-dice roll at once. Only another element breaks the chain
        // (below); a fresh <if> always starts one. (task 89)
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();

      // if / elseif / else chain: exactly one branch is "active". Like JaFL, the
      // others are still shown — grayed out and non-interactive — rather than
      // hidden, so the reader keeps the full context ("If you have codeword X…").
      if (tag === 'if' || tag === 'elseif' || tag === 'else') {
        let active = false;
        if (tag === 'if' || !chainActive) {
          chainActive = true;
          // A dead=-gated chain sitting AFTER an unresolved fight is that fight's
          // win/lose outcome. The player is "alive" throughout the fight, so a naive
          // dead="f" test fires the "if you win" branch — and its rewards / the
          // confiscate-return <transfer> (book2/462) — mid-fight. Hold the WHOLE chain
          // inactive until the fight is decided (won or lost); the else must not slip
          // active either, so the flag rides the whole chain. (task 39)
          chainDeferred = tag === 'if' && isDeferredDeadChain(node, this.sectionFights);
          active = chainDeferred ? false : (tag === 'else' ? true : evaluateCondition(node, this.state));
          chainDone = active;
        } else if (chainDeferred) {
          active = false; // still inside the deferred (fight-outcome) chain
        } else if (chainDone) {
          active = false; // a previous branch already matched
        } else if (tag === 'else') {
          active = true; chainDone = true;
        } else { // elseif with no prior match
          active = evaluateCondition(node, this.state); chainDone = active;
        }
        this.renderConditionalBranch(container, node, path, active);
        return;
      }
      chainActive = false; chainDone = false; chainDeferred = false;

      if (tag === 'success' || tag === 'failure' || tag === 'outcomes') {
        this.renderBranch(container, node, path, this.activeRoll);
        return;
      }
      this.renderElement(container, node, path);
      // Track the roll a shared <success>/<failure> binds to. An inactive branch's
      // roll never counts. When two rolls feed ONE shared branch ("make a MAGIC roll
      // …or a SCOUTING roll", book2/122/book6/630), bind to whichever ACTUALLY
      // resolved — only fall back to the last-listed roll when none has resolved
      // yet — so a successful first-listed roll isn't ignored (task 51).
      if (ROLL_TAGS.has(tag) && !this.inactive) {
        const curResolved = this.activeRoll && this.ctx.rolls.has('roll@' + this.activeRoll.path);
        if (this.ctx.rolls.has('roll@' + path) || !curResolved) this.activeRoll = { node, path };
      }
    });
  }

  // Render one branch of an if/elseif/else chain. The taken branch renders
  // normally; an untaken branch renders grayed and non-interactive (JaFL's model):
  // its words show, but effects are not applied and its links/buttons are disabled.
  renderConditionalBranch(container, node, path, active) {
    if (active && !this.inactive) {
      this.appendChildren(container, node, path);
      return;
    }
    const span = document.createElement('span');
    span.className = 'cond-inactive';
    const prev = this.inactive;
    this.inactive = true;              // suppress effects (see renderPassive)
    this.appendChildren(span, node, path);
    this.inactive = prev;
    // Neutralise any interactive controls the branch produced (gotos, choices,
    // roll/market/group buttons). Effects already skipped via this.inactive.
    span.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    if (span.textContent.trim() || span.querySelector('*')) container.appendChild(span);
  }

  // Render an element for display only: show its prose but apply NO effects and
  // leave any controls it produced disabled. Used for <flee>/<fightdamage>, whose
  // effects must fire on an event (fleeing / being wounded), not on render.
  renderInert(container, node, path) {
    const span = document.createElement('span');
    span.className = 'fx ' + node.tagName.toLowerCase();
    const prev = this.inactive;
    this.inactive = true;              // suppress effect application (see renderPassive)
    this.appendChildren(span, node, path);
    this.inactive = prev;
    span.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    if (span.textContent.trim() || span.querySelector('*')) container.appendChild(span);
    return span;
  }

  appendText(container, raw) {
    if (raw == null) return;
    let t = raw.replace(/\s+/g, ' ');
    if (t === '') return;
    t = t.replace(/ - /g, ' – ').replace(/\.\.\./g, '…');
    // Swallow stray punctuation left dangling after a block widget (e.g. the
    // "." that follows an inline <difficulty>…</difficulty> in the source).
    const last = container.lastElementChild;
    if (last && /\b(roll|fight|market|choices)\b/.test(last.className || '') && /^[\s.,;:–-]+$/.test(t)) return;
    container.appendChild(document.createTextNode(t));
  }

  renderElement(container, node, path) {
    const tag = node.tagName.toLowerCase();

    // inline text styles
    if (INLINE_STYLE[tag]) {
      const e = document.createElement(INLINE_STYLE[tag]);
      if (tag === 'caps') e.className = 'caps';
      if (tag === 'b') e.className = 'item-name';
      this.appendChildren(e, node, path);
      container.appendChild(e);
      return e;
    }

    const method = TAG_RENDERERS[tag];
    if (method) return this[method](container, node, path);

    if (PASSIVE_TAGS.has(tag)) return this.renderPassive(container, node, path);
    // Unknown element: render children so we don't lose prose.
    this.appendChildren(container, node, path);
    return null;
  }

  // ---- small element renderers dispatched from TAG_RENDERERS ---------------
  renderParagraph(container, node, path) {
    const p = document.createElement('p');
    this.appendChildren(p, node, path);
    container.appendChild(p);
    return p;
  }

  // <text>/<desc>: an inline grouping wrapper.
  renderTextWrapper(container, node, path) {
    const span = document.createElement('span');
    this.appendChildren(span, node, path);
    container.appendChild(span);
    return span;
  }

  // A <choice> reached directly (not via its <choices> parent) renders the whole
  // choices table, flagging which row is this node.
  renderChoiceElement(container, node, path) {
    return this.renderChoices(container, node.parentNode, path, node);
  }

  renderReroll(container, node, path) {
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    const inner = document.createElement('span');
    this.appendChildren(inner, node, path);
    btn.textContent = inner.textContent.trim() || 'Roll again';
    const roll = this.activeRoll;
    btn.addEventListener('click', () => {
      // §232/502/716 storm form: the reroll IS the "lose the blessing and roll again"
      // spend. The intended hidden <lose blessing> never fires (its keepblessing guard
      // is reset by a rerunnable entry set every render), so consume the guarded storm
      // blessing here — exactly one reroll's worth of protection. (task 114)
      const spend = blessingSpendForReroll(this.sectionEl, this.state, this.outcomeBlessings);
      if (spend) this.state.useBlessing(spend);
      if (roll) this.ctx.rolls.delete('roll@' + roll.path);
      this.rerender();
    });
    container.appendChild(btn);
    return btn;
  }

  // After a resolved roll, offer any blessing the player may spend to reroll it (task 76).
  // `opts` = { ability, success, kind:'check'|'random', travel }; eligibility lives in
  // state.rerollBlessings. `reroll` re-runs the SAME roll and stores the fresh result (it
  // must not itself re-render — this does). A used blessing is consumed unless permanent.
  appendBlessingReroll(widget, opts, reroll) {
    if (this.inactive) return;
    for (const name of this.state.rerollBlessings(opts)) {
      const label = name === 'luck' ? 'Luck' : name === 'travel' ? 'Safe Travel' : name.toUpperCase();
      const btn = document.createElement('button');
      btn.className = 'btn-secondary blessing-reroll';
      btn.textContent = `Use your blessing of ${label} to reroll`;
      btn.addEventListener('click', () => { if (this.state.useBlessing(name)) reroll(); this.rerender(); });
      widget.appendChild(btn);
    }
  }

  // <field name="X" label="L"/> — display the live value of a codeword counter
  // (0 if unset), e.g. the Uttaku court status or the running bribery/offering
  // bonus. Re-reads on every render so it tracks <tick name="X">. (task 32)
  renderField(container, node, path) {
    const name = node.getAttribute('name') || '';
    const label = node.getAttribute('label') || node.getAttribute('text') || name;
    const span = document.createElement('span');
    span.className = 'field';
    span.textContent = `${label}: ${this.state.codewordValue(name)}`;
    container.appendChild(span);
    return span;
  }

  // <extrachoice> — register (or remove) a persistent, keyed navigation option
  // the books "note on your Adventure Sheet": e.g. book1/122 "Enter the sewers"
  // available back at Yellowport (§10), or Targdaz's Recall usable in any temple.
  // Registration is silent book-keeping applied once per visit; the descriptive
  // inner prose (the sheet-note wording) is still shown inline. The choices are
  // surfaced at their target section by surfaceExtraChoices() in render(). (task 32)
  renderExtraChoice(container, node, path) {
    const remove = node.getAttribute('remove');
    const memo = 'xc@' + path;
    if (!this.ctx.applied.has(memo)) {
      this.ctx.applied.add(memo);
      if (remove) {
        this.state.removeExtraChoice(remove);
      } else {
        const section = node.getAttribute('section');
        if (section) {
          this.state.addExtraChoice({
            key: node.getAttribute('key') || null,
            atBook: node.hasAttribute('atbook') ? parseInt(node.getAttribute('atbook'), 10) : null,
            atSection: node.getAttribute('atsection'),
            tag: node.getAttribute('tag') || null,
            book: node.hasAttribute('book') ? parseInt(node.getAttribute('book'), 10) : this.book,
            section,
            text: node.getAttribute('text') || '',
          });
        }
      }
    }
    // Show the note's descriptive text (a <extrachoice remove> is silent).
    if (!remove) { const span = document.createElement('span'); this.appendChildren(span, node, path); container.appendChild(span); return span; }
    return null;
  }

  // An explicit no-op case for a tag whose automated mechanic is deferred: render
  // the inner prose (exactly what the default recursion did) so no text is lost,
  // and no more. Used by <sectionview> (task 32), and by <while> when it sits in an
  // untaken branch (grayed, not looping). Making the dispatch explicit lets the
  // default case tighten to a strict warning later.
  renderChildrenOnly(container, node, path) {
    this.appendChildren(container, node, path);
    return null;
  }

  // <while var="V"> — repeat the body until V is assigned a value (JaFL WhileNode:
  // "while no value has been assigned to this variable, the block will keep looping").
  // The section re-renders on every state change, so rather than pre-building every
  // iteration we render one per completed pass plus the current live one, each under
  // its own path namespace (`~i`) so its roll/effects/branches memoize independently.
  // A pass advances only when its interactive roll resolves; the resolved roll re-
  // asserts its var (renderRandom) so a var re-rolled each pass reads correctly per
  // iteration even though the live value has moved on. A live, unterminated loop
  // blocks the rest of the section (as JaFL holds execution until the loop ends), and
  // an iteration guard aborts a non-progressing (malformed) body instead of freezing.
  renderWhile(container, node, path) {
    // In an untaken conditional branch the loop isn't running — show the body once,
    // grayed (the branch wrapper disables its controls); don't loop or block.
    if (this.inactive) return this.renderChildrenOnly(container, node, path);

    const wrap = document.createElement('span');
    wrap.className = 'while-loop';
    container.appendChild(wrap);

    const MAX_ITERS = 100; // backstop for a malformed body that never assigns var=
    const prevActiveRoll = this.activeRoll;
    const prevInWhile = this.inWhileIter;
    const prevPendingVars = this.whileIterPendingVars;
    this.inWhileIter = true;

    let i = 0, pending = false, terminated = false;
    for (; i < MAX_ITERS; i++) {
      if (whileLoopDone(node, this.state)) { terminated = true; break; } // var assigned → stop
      if (this.state.isDead()) break;                                    // died mid-loop → stop
      const iterEl = document.createElement('span');
      iterEl.className = 'while-iter';
      // Each pass rolls afresh: its own roll owns any shared <success>/<failure>
      // branch, and its roll-dependent effects wait for THIS pass's roll.
      this.activeRoll = null;
      this.whileIterPending = false;
      this.whileIterPendingVars = new Set();
      this.appendChildren(iterEl, node, path + '~' + i);
      const iterPending = this.whileIterPending;
      wrap.appendChild(iterEl);
      if (iterPending) { pending = true; break; } // an unresolved roll — wait for the player
    }

    this.activeRoll = prevActiveRoll;
    this.inWhileIter = prevInWhile;
    this.whileIterPendingVars = prevPendingVars;

    if (i >= MAX_ITERS && !terminated) {
      console.warn(`[render] <while var="${node.getAttribute('var')}"> hit the ${MAX_ITERS}-iteration guard without assigning its variable — aborting to avoid a freeze (malformed, non-progressing body?).`);
    }
    // A live loop that has not yet terminated holds back the rest of the section.
    if (!terminated) this.blocked = true;
    return wrap;
  }

  // <sectionview random="N" title="T"> — §5.114's trance oracle. Renders its inner
  // words as a link that opens a read-only popup showing up to N random sections'
  // prose ("read any sequence of up to six paragraphs"). The preview applies no
  // effects, arms no controls and never touches the player's section/history/state —
  // it is pure divination flavour. (task 101)
  renderSectionview(container, node, path) {
    const link = document.createElement('button');
    link.className = 'sectionview-link';
    // Take the words directly (textContent), never appendChildren — the oracle link
    // must not render or apply anything from its own body.
    link.textContent = (node.textContent || '').replace(/\s+/g, ' ').trim() || 'Consult the oracle';
    link.title = 'A read-only vision — it does not affect your adventure';
    const count = parseInt(node.getAttribute('random') || '1', 10);
    const title = node.getAttribute('title') || 'Vision';
    link.addEventListener('click', () => this.openSectionView(title, count > 0 ? count : 1));
    container.appendChild(link);
    return link;
  }

  // A random section (book + parsed element) drawn from the available books, for the
  // oracle. Read-only: getSection returns the shared cached parse, which previewProse
  // never mutates. Retries a few times in case a random key misses.
  async randomSectionEl() {
    const books = availableBooks();
    if (!books.length) return null;
    for (let tries = 0; tries < 8; tries++) {
      const b = books[Math.floor(Math.random() * books.length)];
      let raw;
      try { raw = await loadBook(b); } catch { continue; }
      const keys = Object.keys(raw || {});
      if (!keys.length) continue;
      const key = keys[Math.floor(Math.random() * keys.length)];
      const el = await getSection(b, key);
      if (el) return { book: b, section: key, el };
    }
    return null;
  }

  // The oracle popup: an isolated modal (built directly rather than via modal(), which
  // closes on any button) that reveals one random section's prose at a time, up to
  // `count` reveals, then a Close. Nothing here reads or writes game state. (task 101)
  async openSectionView(title, count) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal sectionview-modal';
    const h = document.createElement('h2'); h.textContent = title; box.appendChild(h);
    const body = document.createElement('div'); body.className = 'modal-body'; box.appendChild(body);
    const bar = document.createElement('div'); bar.className = 'modal-buttons';
    const another = document.createElement('button'); another.className = 'btn btn-primary';
    const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
    bar.appendChild(another); bar.appendChild(close); box.appendChild(bar);
    overlay.appendChild(box);
    const teardown = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    close.addEventListener('click', teardown);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) teardown(); });

    let remaining = count;
    const reveal = async () => {
      another.disabled = true;
      const found = await this.randomSectionEl();
      body.innerHTML = '';
      if (found) {
        const cap = document.createElement('div');
        cap.className = 'sectionview-cap';
        cap.textContent = `${bookTitle(found.book)} · ${found.section}`;
        body.appendChild(cap);
        body.appendChild(previewProse(found.el));
      } else {
        body.textContent = 'The vision is clouded…';
      }
      remaining--;
      if (remaining > 0) { another.disabled = false; another.textContent = `Reveal another (${remaining} left)`; }
      else { another.disabled = true; another.textContent = 'The vision fades'; }
    };
    another.addEventListener('click', reveal);
    document.body.appendChild(overlay);
    await reveal(); // show the first vision
    return overlay;
  }

  // Surface the player's active extra choices (<extrachoice>) at this section: a
  // labelled row of buttons that navigate like a <goto>. Matched by an exact
  // atBook/atSection target or by the section's tag= (e.g. "temple"). (task 32)
  surfaceExtraChoices(flow) {
    const tag = this.sectionEl ? this.sectionEl.getAttribute('tag') : null;
    const choices = this.state.extraChoicesFor(this.book, this.section, tag);
    if (!choices.length) return;
    const box = document.createElement('div');
    box.className = 'extra-choices';
    const h = document.createElement('div');
    h.className = 'extra-choices-label';
    h.textContent = 'Extra choices';
    box.appendChild(h);
    for (const c of choices) {
      const btn = document.createElement('button');
      btn.className = 'goto extra-choice';
      btn.textContent = c.text || `Turn to ${c.section}`;
      const targetBook = c.book || this.book;
      btn.addEventListener('click', () => {
        if (!availableBooks().includes(targetBook)) { this.notify(`“${bookTitle(targetBook)}” (Book ${targetBook}) isn’t included in this edition.`, 'warn'); return; }
        this.navigate(targetBook, c.section);
      });
      box.appendChild(btn);
    }
    flow.appendChild(box);
  }

  // ---- conditionals --------------------------------------------------------
  renderIfChain(container, node, path) {
    // Walk the if/elseif/else run. `node` is the first <if>. Its elseif/else
    // siblings follow it in the parent; but in this corpus they are usually
    // nested/sequential. Evaluate this node; render children if true.
    const tag = node.tagName.toLowerCase();
    if (tag === 'else') { this.appendChildren(container, node, path); return null; }
    const ok = evaluateCondition(node, this.state);
    // mark chain state on the element run using a data attr in ctx
    const chainKey = 'chain@' + path;
    if (ok) {
      this.ctx.applied.add(chainKey); // this branch taken
      this.appendChildren(container, node, path);
    }
    return null;
  }

  // ---- group: an optional, click-to-apply action --------------------------
  // The books bundle the effects of an *optional* choice (buy a house, become an
  // initiate, purchase a blessing, accept a mission…) inside a <group> with a
  // <text> label. These must NOT auto-apply — the player opts in by clicking.
  renderGroup(container, node, path) {
    // A <group> that bundles a roll (difficulty/random/rankcheck) can't collapse
    // into a single button — the roll must render as its own widget so the
    // section's <success>/<failure>/<outcomes> resolve. Render it inline and apply
    // the group's non-roll effects on the roll event. (task 42)
    const rollNode = node.querySelector('difficulty, random, rankcheck');
    if (rollNode) return this.renderGroupWithRoll(container, node, path, rollNode);

    const label = (node.textContent || '').replace(/\s+/g, ' ').trim();
    // <adjust> is excluded: inside a group it is a modifier for a nested roll
    // (e.g. "Difficulty 15 if you have climbing gear"), not a group effect. A
    // bundled <transfer> is the group's own action (§6.490 "fight without a weapon"
    // stashes the weapon), so it applies headlessly on the group click. (task 107)
    const effects = Array.from(node.querySelectorAll('lose, tick, gain, set, curse, transfer'));
    // A bundled item/weapon/armour/tool reward (the hidden quest prize in §1.228/509
    // gold chain mail, §4.189 Sun Goddess mirror): the group collapses to one button,
    // so the award can't render its own Take button — grant it headlessly on the
    // click via the normal award transaction (capacity-checked). (task 96)
    const itemNodes = Array.from(node.querySelectorAll('item, weapon, armour, tool'));
    // A bundled <buy> (ship/cargo/tool/item/crew): §5.192 claims the Wrath of God for
    // 50 Shards and the deed; §4.622 salvages a free Cargo Unit and ticks its codeword.
    // A collapsed group renders only its label, so without executing the trade the ship/
    // cargo was never added — permanently unobtainable. Run each through the standalone
    // market transaction on the group click (price charged here, ship-here/cargo-space
    // checks enforced, quantity= honoured). No collapsed group carries a <sell>. (task 126)
    const buyNodes = Array.from(node.querySelectorAll('buy'));
    // Item/weapon/... rewards linked by flag= to a price this group pays but rendered
    // OUTSIDE the group — §1.342/§4.111's potion of restoration sits after the group,
    // inside an affordability <if shards><if item> that flips false the moment the group
    // is paid, so the reward's own gated Take button vanishes before it can be clicked.
    // The group is the real payment, so grant those awards on its click and consume the
    // flag so the (now-hidden) Take can never double-grant. (task 125)
    const linkedAwards = [];
    if (this.sectionEl) {
      effects.forEach((fx) => {
        const k = fx.getAttribute('price');
        if (!k) return;
        this.sectionEl.querySelectorAll(`[flag="${k}"]`).forEach((r) => {
          if (ITEM_FAMILY_TAGS.has(r.tagName.toLowerCase()) && !node.contains(r)) linkedAwards.push(r);
        });
      });
    }
    // A <rest> child heals on the group click (book6/628 "regain 1 Stamina point"):
    // applyRest headlessly, since the group renders as one button, not a rest widget.
    // Without this the daily inn group cleared its flag but never healed. (task 61)
    const restNodes = Array.from(node.querySelectorAll('rest'));
    // A group may also carry navigation (e.g. "cross off 30 Shards and turn to 99
    // in that book"): apply the effects and then follow the goto/return on click.
    const gotoNode = node.querySelector('goto');
    const returnNode = node.querySelector('return');
    // A death-revival group bundles the "use your deal" trigger (a no-section
    // <resurrection/>) with the price of coming back — erase possessions/money/ship
    // (§3.123/560/6.140/1.680) or just the ship (§1.616). On the group action, apply
    // those losses, consume the earliest deal (revive at half Stamina) and turn to
    // the deal's own section — instead of ignoring the resurrection child and leaving
    // the player erased but stranded. (task 98)
    const resNode = node.querySelector('resurrection');
    const isRevival = !!resNode && !resNode.getAttribute('section');
    if (!label || (!effects.length && !itemNodes.length && !buyNodes.length && !restNodes.length && !gotoNode && !returnNode && !isRevival)) {
      // no visible action (or nothing to apply) — plain inline wrapper
      const span = document.createElement('span');
      this.appendChildren(span, node, path);
      container.appendChild(span);
      return span;
    }
    const key = 'group@' + path;
    const done = this.ctx.applied.has(key);
    const btn = document.createElement('button');
    btn.className = 'group-action' + (done ? ' done' : '');
    btn.disabled = done;
    btn.textContent = (done ? '☑ ' : '☐ ') + label;
    if (!done) {
      btn.addEventListener('click', () => {
        effects.forEach((fx) => applyEffect(fx, this.state, {}));
        buyNodes.forEach((b) => this.runBuyNode(b));
        itemNodes.forEach((n) => this.grantItemNode(n));
        linkedAwards.forEach((n) => { this.grantItemNode(n); const f = n.getAttribute('flag'); if (f) this.state.setFlag(f, false); });
        restNodes.forEach((r) => {
          const perUse = r.hasAttribute('stamina') ? r.getAttribute('stamina') : null;
          const cost = r.getAttribute('shards') ? resolveValue(this.state, r.getAttribute('shards')) : 0;
          applyRest(this.state, perUse, cost);
        });
        this.ctx.applied.add(key);
        if (isRevival) {
          // Consume the deal and turn to its section (the revive rule — half max
          // Stamina — lives in engine.js). Guard against a missing deal.
          const target = reviveWithResurrection(this.state);
          if (target) { this.navigate(target.book, target.section); return; }
          this.rerender();
        } else if (gotoNode) {
          const b = gotoNode.getAttribute('book') ? Number(gotoNode.getAttribute('book')) : this.book;
          this.navigate(b, gotoNode.getAttribute('section'));
        } else if (returnNode) {
          this.goBack();
        } else {
          this.rerender();
        }
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // A <group> that bundles a roll with its effects (task 42). Renders the label and
  // the roll widget inline; the roll then drives the section's success/failure/
  // outcomes. The group's non-roll effects apply exactly once the roll resolves
  // (JaFL treats the roll as the group's action), so a bundled cost/consequence —
  // lose shards/item/god (book6/94/215/293, book3/273/629, book6/691), a codeword
  // marker (book2/53…), or a rest that heals the roll's own var (book2/438) — fires
  // on the attempt, never on entry. Hidden book-keeping (an armed price flag /
  // cache lock — book3/680, book1/91, book2/138) still applies on entry.
  renderGroupWithRoll(container, node, path, rollNode) {
    const span = document.createElement('span');
    span.className = 'group-roll';
    const kids = Array.from(node.childNodes);
    const rollKey = 'roll@' + path + '.' + kids.indexOf(rollNode);
    const rollResolved = this.ctx.rolls.has(rollKey);
    const deferred = [];
    kids.forEach((k, i) => {
      const kp = path + '.' + i;
      if (k.nodeType === Node.TEXT_NODE) { this.appendText(span, k.nodeValue); return; }
      if (k.nodeType !== Node.ELEMENT_NODE) return;
      const tag = k.tagName.toLowerCase();
      if (k === rollNode) {
        this.renderElement(span, k, kp);
        // Bind the section's shared <success>/<failure>/<outcomes> to this roll —
        // appendChildren does this for top-level rolls; a group-nested one needs it here.
        if (!this.inactive) {
          const curResolved = this.activeRoll && this.ctx.rolls.has('roll@' + this.activeRoll.path);
          if (this.ctx.rolls.has(rollKey) || !curResolved) this.activeRoll = { node: k, path: kp };
        }
        return;
      }
      if (tag === 'text') { this.appendChildren(span, k, kp); return; }
      if (PASSIVE_TAGS.has(tag) || tag === 'rest') {
        // A bundled cache lock/unlock (task 38) means "freeze the bet on the roll",
        // so it defers with the visible consequences even when hidden — unlike a
        // hidden price-flag arming, which must still fire on entry.
        const special = (k.getAttribute('special') || '').toLowerCase();
        const cacheLockTick = tag === 'tick' && (special === 'lock' || special === 'unlock');
        if (boolAttr(k.getAttribute('hidden')) && !cacheLockTick) {
          this.renderElement(span, k, kp); // hidden book-keeping arms on entry (renderPassive)
        } else {
          deferred.push(k); // visible cost/consequence (or a bet lock/unlock) — apply on the roll
          const desc = (k.textContent || '').trim();
          if (desc) this.appendText(span, desc);
        }
        return;
      }
      this.renderElement(span, k, kp);
    });
    // Apply the deferred (visible) effects exactly once, after the roll resolves.
    if (rollResolved && deferred.length && !this.ctx.applied.has('grp@' + path)) {
      this.ctx.applied.add('grp@' + path);
      deferred.forEach((fx) => {
        if (fx.tagName.toLowerCase() === 'rest') {
          const perUse = fx.hasAttribute('stamina') ? fx.getAttribute('stamina') : null;
          const cost = fx.getAttribute('shards') ? resolveValue(this.state, fx.getAttribute('shards')) : 0;
          applyRest(this.state, perUse, cost);
        } else {
          const note = applyEffect(fx, this.state, {});
          if (note) this.notify(note);
        }
      });
    }
    container.appendChild(span);
    return span;
  }

  // Grant an <item>/<weapon>/<armour>/<tool> reward headlessly — no button — for a
  // reward bundled inside a <group> action, which collapses to a single button and so
  // can't show the award its own Take button (§1.228/509 gold chain mail, §4.189 Sun
  // Goddess mirror). Delegates to the engine's item-family applier (the DOM-free award
  // transaction): a "N Shards" reward banks its value, a possession is added when a slot
  // is free (the 12-item carry cap), and any <curse>/<disease>/<poison> child bites on
  // pickup. (tasks 96, 125)
  grantItemNode(node) {
    applyEffect(node, this.state, {});
  }

  // Execute a <buy>'s market transaction headlessly (no widget) — for a collapsed
  // <group> that bundles a purchase with its other effects (§5.192 buy the Wrath of
  // God, §4.622 salvage cargo). Routes ship/cargo/tool/item/crew through the same
  // applyInlineBuy transaction as a standalone row and honours quantity=; a buy that
  // can't proceed (no Shards, no ship here for cargo) simply doesn't apply — matching
  // JaFL's GroupNode, which runs its children in sequence without gating on them. (task 126)
  runBuyNode(node) {
    const price = node.getAttribute('shards') != null ? resolveValue(this.state, node.getAttribute('shards')) : 0;
    const quantity = node.getAttribute('quantity') ? Math.max(1, parseInt(node.getAttribute('quantity'), 10) || 1) : 1;
    const opts = {
      price, crew: node.getAttribute('crew'),
      ship: node.getAttribute('ship'), shipName: node.getAttribute('name'), initialCrew: node.getAttribute('initialCrew'),
      tool: node.getAttribute('tool'), item: node.getAttribute('item'), cargo: node.getAttribute('cargo'),
      bonus: node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0,
      ability: node.getAttribute('ability'),
      tags: parseTags(node.getAttribute('buytags') || node.getAttribute('tags')),
      effects: readItemEffects(node),
    };
    for (let k = 0; k < quantity; k++) { if (!applyInlineBuy(this.state, opts).ok) break; }
  }

  // ---- passive effects -----------------------------------------------------
  renderPassive(container, node, path) {
    const tag = node.tagName.toLowerCase();
    const hidden = boolAttr(node.getAttribute('hidden'));

    // Inside an untaken conditional branch: show the words (the wrapper grays
    // them), but never apply the effect, gate a payment, or memoize — the branch
    // isn't taken, and a later state change re-renders it live if it becomes active.
    if (this.inactive) {
      if (!hidden) {
        const span = document.createElement('span');
        span.className = 'fx';
        this.appendChildren(span, node, path);
        if (span.textContent.trim()) container.appendChild(span);
      }
      return null;
    }

    // A guarded storm-blessing loss (§200/250/60) is the deferred "spend to avoid
    // the storm" step, not an on-entry loss: render its words, but let the safe goto
    // spend the blessing on click (renderGoto/blessingSpendForGoto). (task 108)
    if (tag === 'lose' && isGuardedBlessingLoss(node, this.outcomeBlessings)) {
      const span = document.createElement('span');
      span.className = 'fx';
      this.appendChildren(span, node, path);
      if (span.textContent.trim()) container.appendChild(span);
      return null;
    }

    // Defer an effect whose magnitude depends on a variable that a roll in this
    // section has not filled yet (e.g. §521 "<lose multiple="x">" sitting above its
    // "<random var="x">"). Applying now would use x=0 and then memoise that no-op;
    // instead show the words and let the post-roll rerender apply the real count.
    if (this.pendingRollVar(node)) {
      if (!hidden) {
        const span = document.createElement('span');
        span.className = 'fx';
        this.appendChildren(span, node, path);
        if (span.textContent.trim()) container.appendChild(span);
      }
      return null;
    }

    // A fight-escape bracket's closing <lose codeword> (after the fight) is deferred
    // until the fight is won, so the mid-fight surrender/flee box= choice stays live
    // while the fight is unresolved or the player is fleeing (task 54).
    if (isDeferredEscapeClear(node, this.escapeCodewords, this.sectionFights)) {
      if (!hidden) {
        const span = document.createElement('span');
        span.className = 'fx';
        this.appendChildren(span, node, path);
        if (span.textContent.trim()) container.appendChild(span);
      }
      return null;
    }

    // A hidden <tick removetag="X"> is an end-of-section tag cleanup (§5.386's Targdaz
    // enchant tags a weapon "Tz", routes its interactive roll/outcomes to that weapon,
    // then strips the tag). Applying it on entry — as any hidden effect would — removes
    // the selection tag before the roll and <outcomes> can target the weapon, so the
    // raise/lower/destroy never lands; a stray tag would also leak onto the weapon for a
    // later re-visit. Defer it to when the section is left (see the navigate wrapper) so
    // the tag survives the whole visit for its own ticks and is stripped exactly once. (task 88)
    if (isDeferredTagCleanup(node)) {
      this.deferredCleanups.set('cleanup@' + path, node);
      return null; // hidden bookkeeping: renders nothing; applied on leaving the section
    }

    const price = node.getAttribute('price');
    const flag = node.getAttribute('flag');

    // A hidden price node (<tick price="k" hidden="t"/> — book6/630, book2/122,
    // book4/127, book5/365; a <success><tick price="x" hidden/> in book3/472) arms
    // its linked roll / choose-one / reward silently on entry — JaFL runs it once per
    // visit with no widget. Fire it once (memoised) and render nothing, instead of a
    // phantom "Pay"/"Confirm" button the player must find (and could re-click to
    // re-arm). A lone linked reward is granted too (book3/472's codeword Chance on a
    // SCOUTING success); roll gates and choose-one menus arm only, their rolls/picks
    // doing the granting. (task 56)
    if (price != null && hidden) {
      const memo = 'pay@' + path;
      if (!this.ctx.applied.has(memo)) {
        this.ctx.applied.add(memo);
        applyEffect(node, this.state, {}); // set the flag (and apply any real cost)
        const rewards = this.linkedRewards(price);
        // Skip an item-family reward here — it grants through its own gated Take button
        // (renderChoosableReward), so firing it now would double-grant. (task 125)
        if (!this.isRollGate(price) && rewards.length === 1 && !ITEM_FAMILY_TAGS.has(rewards[0].tagName.toLowerCase())) applyEffect(rewards[0], this.state, {});
      }
      return null;
    }

    // JaFL "price/flag" optional purchase: a node with price="k" is a click-to-pay
    // cost; nodes with flag="k" are its linked rewards. These must NOT auto-apply —
    // the player opts in by clicking the cost, which also applies the linked rewards.
    if (price != null) {
      // A payment that arms a die roll (a <random flag="k"> gated on this cost) is
      // the repeatable "pay to spin" idiom (book2/157, book3/314, book5/674…), not a
      // one-shot reward purchase: route it to renderRollPayment so paying arms the
      // roll instead of firing every outcome's effect at once (task 30).
      if (this.isRollGate(price)) return this.renderRollPayment(container, node, path, price);
      return this.renderOptionalPay(container, node, path, price);
    }
    if (flag != null && this.sectionEl && this.sectionEl.querySelector(`[price="${flag}"]`)) {
      // A roll-gated reward (an <outcome> effect under a <random flag="k">) applies
      // when its outcome is revealed by the roll — never on payment; fall through so
      // it applies as a normal effect (it only renders once its outcome shows). Only
      // a *non*-roll dependent reward is deferred to the linked cost click below.
      if (!this.isRollGate(flag)) {
        // A "choose one" reward (two or more effect rewards share this cost key):
        // render it as a pick button, enabled only once the cost is paid, so a
        // single payment grants exactly the ONE the player clicks — not the whole
        // menu (book6/171 blessings, book5/152 curses, book6/690 blessings). (task 43)
        if (this.isChooseOne(flag)) return this.renderChoosableReward(container, node, path, flag);
        if (!hidden) { // single dependent reward: show its words; effect applies with the linked cost
          const span = document.createElement('span');
          span.className = 'fx';
          this.appendChildren(span, node, path);
          if (span.textContent.trim()) container.appendChild(span);
        }
        return null;
      }
    }

    // A force="f" action is OPTIONAL (JaFL ActionNode defaults force=true): the player
    // opts in by clicking, rather than it applying on entry — so an optional mission
    // codeword / Tyrnai initiation can be declined, and a "choose one" (a dock, or
    // "cross off one of these") does not apply every option. Render it as a once-per-
    // visit button; specialised gates above (price/flag/hidden/payment) still win, so
    // only a plain optional effect reaches here. (task 74)
    if (!hidden && this.isOptionalForce(node)) {
      return this.renderForcedOptional(container, node, path);
    }

    // Economic payment (Shards/item/cargo/ship) in a section with an escape route:
    // follows JaFL's forced-action model — click-to-apply, and blocks the rest of
    // the section until resolved, so the optional exit shown before it (e.g. "turn
    // back to 142") costs nothing. Narrative losses (Stamina, codewords, blessings…)
    // and unavoidable payments fall through and auto-apply.
    if (tag === 'lose' && !hidden && this.hasDecline && this.isEconomicPayment(node)) {
      return this.renderPayment(container, node, path);
    }

    // "Lose/gain 1 point from any ability" (ability="?" or "a|b"): the player
    // picks which ability rather than the engine defaulting — defer to a chooser
    // instead of auto-applying on entry.
    if (!hidden && this.needsAbilityChoice(node)) {
      return this.renderAbilityChoice(container, node, path);
    }

    // A <tick weapon|item="?" addbonus|addtag|removetag> where more than one possession
    // qualifies: let the player pick which is enchanted rather than defaulting. (task 75)
    if (!hidden && this.needsEquipmentChoice(node)) {
      return this.renderEquipmentChoice(container, node, path);
    }
    // A <tick profession="a|b|c"> — the former Priest chooses a new profession. (task 75)
    if (!hidden && this.needsProfessionChoice(node)) {
      return this.renderProfessionChoice(container, node, path);
    }

    // A bare <lose>/<gain> written after a <fight> in win/lose prose is a
    // fight-OUTCOME effect (task 69). Applying it on entry (as a plain effect would)
    // hands over the reward / exacts the penalty before a blow is struck — §570
    // stripped every Shard and dropped you to 1 Stamina the instant you arrived.
    // Hold it until the fight resolves, then apply only on the branch actually taken
    // (win / unconditional → on a win; lose → on a loss). computeFightGate tagged it.
    const fightRole = this.fightGate && this.fightGate.effectNodes.get(node);
    if (fightRole && !this.inactive) {
      const outcome = aggregateFightOutcome(this.sectionFights);
      const take = outcome === 'win' ? fightRole !== 'lose'
                 : outcome === 'lose' ? fightRole === 'lose'
                 : false; // unresolved or fled → hold (show the words, apply nothing)
      if (!take) {
        if (!hidden) {
          const span = document.createElement('span');
          span.className = 'fx';
          this.appendChildren(span, node, path);
          if (span.textContent.trim()) container.appendChild(span);
        }
        return null;
      }
    }

    const key = 'fx@' + path;
    const setVarName = tag === 'set' ? node.getAttribute('var') : null;
    // A roll this visit has taken ownership of this var: freeze the <set> so it can
    // never clobber the die result. book6/628 uses <set var="y" value="7"/> as a
    // "not yet rolled" sentinel above a pay-gated <random var="y">; without this the
    // rerunnable set re-applies y=7 on the post-roll rerender, so the <if var="y">
    // rest/dysentery branches never fire (the player pays daily but never heals). (task 61)
    const rollOwned = setVarName != null && this.ctx.rolledVars.has(setVarName);
    // An absolute <set value="…"> is a pure function of current state, so it is
    // re-evaluated on every render — this keeps variables derived from a roll
    // result correct after that roll resolves (rather than frozen at first render).
    const rerunnable = tag === 'set' && node.hasAttribute('value') && !node.hasAttribute('modifier') && !rollOwned;
    if (!rollOwned && (rerunnable || !this.ctx.applied.has(key))) {
      if (!rerunnable) this.ctx.applied.add(key);
      const note = applyEffect(node, this.state, { chooser: null });
      // Record a <set var>'s write so a var-keyed <success>/<failure>/<outcome>
      // knows the var holds a real value this visit — the set-sentinel idiom
      // (book2/138 key holder, book3/43 Chill) resolves the branch with no roll,
      // while an unwritten/stale var keeps the branch pending (task 50).
      if (setVarName) this.ctx.wroteVars.add(setVarName);
      if (note && !hidden) this.notify(note);
    }
    // Render its descriptive text (the words the author wrote around the effect).
    if (!hidden) {
      const span = document.createElement('span');
      span.className = 'fx';
      this.appendChildren(span, node, path);
      // A bare section-box <tick/> carries no words of its own, so the printed
      // instruction "…, tick the box, and read on" would collapse to "…, , and
      // read on"; supply the words so the sentence reads naturally (task 70).
      if (!span.textContent.trim() && this.isBareBoxTick(node)) span.textContent = 'tick the box';
      if (span.textContent.trim()) container.appendChild(span);
    }
    return null;
  }

  // A plain visit-box <tick/> — no words of its own and no attribute that would
  // route it elsewhere (codeword/god/special/price/flag/shards/ability…); only an
  // optional count= multiplier. These are the "tick the box" instructions (task 70).
  isBareBoxTick(node) {
    if (node.tagName.toLowerCase() !== 'tick') return false;
    if (node.textContent.trim()) return false;
    return node.getAttributeNames().every((a) => a.toLowerCase() === 'count');
  }

  // Does this <gain>/<lose>/<tick> ask the player to choose which ability it
  // affects (ability="?" or "a|b")? effect= forms target one named ability, so
  // they never need a chooser.
  needsAbilityChoice(node) {
    const tag = node.tagName.toLowerCase();
    if (tag !== 'lose' && tag !== 'gain' && tag !== 'tick') return false;
    if (node.getAttribute('effect') != null) return false;
    const ab = node.getAttribute('ability');
    if (ab == null) return false;
    const s = ab.trim().toLowerCase();
    return s === '?' || s.includes('|');
  }

  // Render an ability-choice effect as a row of pick buttons; applying it only on
  // click (once per visit), with the chosen ability fed to the engine's chooser.
  renderAbilityChoice(container, node, path) {
    const memo = 'fx@' + path;
    const isLoss = node.tagName.toLowerCase() === 'lose';
    const desc = document.createElement('span');
    desc.className = 'fx';
    this.appendChildren(desc, node, path);
    if (desc.textContent.trim()) container.appendChild(desc);
    if (this.ctx.applied.has(memo)) return null; // already chosen this visit
    const opts = abilityChoiceOptions(node.getAttribute('ability'), this.state, isLoss);
    if (!opts.length) { this.ctx.applied.add(memo); return null; } // nothing eligible
    this.appendAbilityPicker(container, opts, (ab) => {
      const note = applyEffect(node, this.state, { chooser: () => [ab] });
      this.ctx.applied.add(memo);
      if (note) this.notify(note);
      this.rerender();
    }, isLoss ? '−' : '+');
    return null;
  }

  // Does a <tick …="?" addbonus|addtag|removetag> ask the player to choose WHICH
  // possession is enchanted? Only when the target is an open "?"/blank of a kind with
  // more than one candidate — a name/all, a tags=/using= narrowing, or a cache target
  // is deterministic and applies without a picker. (task 75)
  needsEquipmentChoice(node) {
    if (node.tagName.toLowerCase() !== 'tick') return false;
    if (node.getAttribute('addbonus') == null && node.getAttribute('addtag') == null && node.getAttribute('removetag') == null) return false;
    const eqAttr = ['weapon', 'armour', 'tool', 'item'].find((k) => node.getAttribute(k) != null);
    if (eqAttr == null) return false;
    const pat = String(node.getAttribute(eqAttr) || '').trim();
    if (pat !== '?' && pat !== '') return false;
    if (boolAttr(node.getAttribute('using')) || node.getAttribute('tags') || node.getAttribute('cache')) return false;
    const kind = eqAttr === 'item' ? null : eqAttr;
    const candidates = kind ? this.state.data.items.filter((it) => it.kind === kind) : this.state.data.items;
    return candidates.length > 1;
  }

  renderEquipmentChoice(container, node, path) {
    const memo = 'fx@' + path;
    const eqAttr = ['weapon', 'armour', 'tool', 'item'].find((k) => node.getAttribute(k) != null);
    const kind = eqAttr === 'item' ? null : eqAttr;
    const candidates = kind ? this.state.data.items.filter((it) => it.kind === kind) : this.state.data.items.slice();
    const desc = document.createElement('span');
    this.appendChildren(desc, node, path);
    if (desc.textContent.trim()) container.appendChild(desc);
    if (this.ctx.applied.has(memo)) return null; // already chosen this visit
    const box = document.createElement('span');
    box.className = 'ability-choice';
    candidates.forEach((it) => {
      const btn = document.createElement('button');
      btn.className = 'btn-mini ability-pick';
      btn.textContent = it.name + (it.bonus ? ` (${it.bonus >= 0 ? '+' : ''}${it.bonus})` : '');
      btn.addEventListener('click', () => {
        applyEffect(node, this.state, { chooser: () => [it] });
        this.ctx.applied.add(memo);
        this.rerender();
      });
      box.appendChild(btn);
    });
    container.appendChild(box);
    return box;
  }

  // A <tick profession="a|b|c"> asks the player to choose a new profession. (task 75)
  needsProfessionChoice(node) {
    if (node.tagName.toLowerCase() !== 'tick') return false;
    const p = node.getAttribute('profession');
    return p != null && p.includes('|');
  }

  renderProfessionChoice(container, node, path) {
    const memo = 'fx@' + path;
    const desc = document.createElement('span');
    this.appendChildren(desc, node, path);
    if (desc.textContent.trim()) container.appendChild(desc);
    if (this.ctx.applied.has(memo)) return null;
    const box = document.createElement('span');
    box.className = 'ability-choice';
    node.getAttribute('profession').split('|').map((s) => s.trim()).filter(Boolean).forEach((prof) => {
      const btn = document.createElement('button');
      btn.className = 'btn-mini ability-pick';
      btn.textContent = prof.charAt(0).toUpperCase() + prof.slice(1).toLowerCase();
      btn.addEventListener('click', () => {
        this.state.setProfession(prof);
        this.ctx.applied.add(memo);
        this.rerender();
      });
      box.appendChild(btn);
    });
    container.appendChild(box);
    return box;
  }

  // A reusable inline "choose an ability" control (used by ability-choice effects,
  // multi-ability difficulty rolls and open-choice training).
  appendAbilityPicker(container, options, onPick, prefix = '') {
    const box = document.createElement('span');
    box.className = 'ability-choice';
    options.forEach((ab) => {
      const btn = document.createElement('button');
      btn.className = 'btn-mini ability-pick';
      btn.textContent = (prefix ? prefix + ' ' : '') + (ABILITY_LABEL[ab] || ab.toUpperCase());
      btn.addEventListener('click', () => onPick(ab));
      box.appendChild(btn);
    });
    container.appendChild(box);
    return box;
  }

  // The name of a not-yet-set variable that this effect's magnitude depends on and
  // that a roll in this section will fill — or null. Only such vars defer (see
  // renderPassive): a literal, a dice expression, or an already-set var applies now,
  // and a var no roll here fills is left to apply (harmlessly as 0) rather than hang.
  pendingRollVar(node) {
    const QTY = ['multiple', 'shards', 'stamina', 'staminato', 'amount', 'count', 'itemAt', 'quantity'];
    for (const a of QTY) {
      const v = node.getAttribute(a);
      if (v == null) continue;
      const s = String(v).trim();
      if (/^-?\d/.test(s) || isDiceExpr(s)) continue; // numeric literal or dice expr
      const bare = s.replace(/^[+-]/, '');            // a signed var ref ("-hang") → "hang" (task 50)
      // Inside a <while> pass, a var this iteration re-rolls is STALE until this
      // pass's roll resolves — defer even though hasVar() is true from a prior pass
      // (§6.700's per-iteration `<lose stamina="x">` must use this six, not the last). (task 100)
      if (this.whileIterPendingVars && this.whileIterPendingVars.has(bare)) return bare;
      if (this.state.hasVar(bare)) continue;          // already set (e.g. by an earlier <set>/roll)
      if (this.sectionEl && this.sectionEl.querySelector(`random[var="${bare}"], rankcheck[var="${bare}"], difficulty[var="${bare}"]`)) return bare;
    }
    return null;
  }

  // Rule in render-rules.js (task 119).
  isEconomicPayment(node) { return isEconomicPaymentRule(node); }

  // A forced economic payment: click-to-apply, and (until applied) blocks the rest
  // of the section. Once paid it renders as a quiet "done" note and no longer blocks.
  renderPayment(container, node, path) {
    const memo = 'pay@' + path;
    const cost = node.getAttribute('shards') ? resolveValue(this.state, node.getAttribute('shards')) : 0;
    const label = document.createElement('span');
    this.appendChildren(label, node, path);
    const text = label.textContent.trim() || (cost ? `Pay ${cost} Shards` : 'Pay');

    if (this.ctx.applied.has(memo)) {
      const span = document.createElement('span');
      span.className = 'fx paid';
      span.textContent = text;
      container.appendChild(span);
      return null;
    }

    const btn = document.createElement('button');
    btn.className = 'btn-mini pay-action';
    btn.textContent = text;
    // A forced possession/cargo/ship payment must be inert when the player has nothing to
    // give up — else clicking "Pay" memoises pay@ and unblocks the section having taken
    // nothing (the task-117 scope note: an absent item/cargo/ship). (task 117)
    const plan = losePaymentPlan(node, this.state);
    const commit = (chooser) => {
      applyEffect(node, this.state, chooser ? { chooser } : {});
      this.ctx.applied.add(memo);
      this.rerender();
    };
    if (cost && this.state.data.shards < cost) {
      btn.disabled = true; btn.title = 'Not enough Shards';
    } else if (plan.present && !plan.eligible) {
      btn.disabled = true; btn.title = 'You have nothing to give up here.';
    } else if (plan.needsChoice) {
      btn.addEventListener('click', () => { btn.disabled = true; this.showForfeitPicker(container, plan, commit); });
    } else {
      btn.addEventListener('click', () => commit(null));
    }
    container.appendChild(btn);
    this.blocked = true; // hide the rest of the section until this is resolved
    return btn;
  }

  // Optional purchase via the price/flag idiom. The cost node becomes a click-to-apply
  // button; clicking applies it plus its linked reward(s) (flag == this price key).
  //  - Two-or-more effect rewards → a "choose one" purchase: the cost only *arms* the
  //    choice, and the reward pick buttons grant exactly one (renderChooseOnePay). (task 43)
  //  - A single counter reward (<tick name= count|amount=>) is repeatable: pay again
  //    to add again, so it is never permanently memoised (book4/93, book6/117/731). (task 43)
  //  - Otherwise a one-shot purchase: apply once and lock the button for this visit.
  renderOptionalPay(container, node, path, key) {
    // A choose-one menu or a priced item-family award grants through its own pick/Take
    // button, so the payment must only ARM the flag — never fire the reward here, or a
    // single payment would over-grant the whole menu and double with the Take button.
    // (tasks 43, 125)
    if (this.isChooseOne(key) || this.isPricedItemAward(key)) return this.renderChooseOnePay(container, node, path, key);
    const rewards = this.linkedRewards(key);
    const repeatable = rewards.some((r) => this.isCounterReward(r));
    const memo = 'pay@' + path;
    const done = !repeatable && this.ctx.applied.has(memo);
    const cost = node.getAttribute('shards') ? resolveValue(this.state, node.getAttribute('shards')) : 0;
    const label = document.createElement('span');
    this.appendChildren(label, node, path);
    const btn = document.createElement('button');
    btn.className = 'btn-mini pay-action' + (done ? ' done' : '');
    btn.textContent = (done ? '☑ ' : '') + (label.textContent.trim() || (cost ? `Pay ${cost} Shards` : 'Confirm'));
    // A paid offering that gives up a possession/cargo/ship (§4.456 Tambu's +2/+3 gifts,
    // §2.90's weapon/armour, §3.569's named cargo) must be inert when the player has
    // nothing that qualifies — else an ineligible offer would arm the price flag and open
    // its linked reward for free. The shared plan reports eligibility and whether an open
    // "?" forfeit needs a which-one picker. (tasks 113, 117)
    const isLose = node.tagName.toLowerCase() === 'lose';
    const plan = isLose ? losePaymentPlan(node, this.state) : null;
    const commit = (chooser) => {
      applyEffect(node, this.state, chooser ? { chooser } : {});
      rewards.forEach((r) => applyEffect(r, this.state, {}));
      if (!repeatable) this.ctx.applied.add(memo);
      this.rerender();
    };
    if (done) {
      btn.disabled = true;
    } else if (plan && plan.present && !plan.eligible) {
      btn.disabled = true; btn.title = 'You have nothing to give up for this offering.';
    } else if (ownsSoleLinkedBlessing(node, key, this.sectionEl, this.state)) {
      // "You can have only one X blessing at a time" — refuse the re-buy so the
      // Shards aren't spent for a blessing that addBlessing would just dedupe away.
      btn.disabled = true; btn.title = 'You already have this blessing';
    } else if (cost && this.state.data.shards < cost) {
      btn.disabled = true; btn.title = 'Not enough Shards';
    } else if (plan && plan.needsChoice) {
      // Open "?" weapon/armour/cargo with more than one candidate: reveal a picker so the
      // player names the exact forfeit rather than the engine silently taking the first.
      btn.addEventListener('click', () => { btn.disabled = true; this.showForfeitPicker(container, plan, commit); });
    } else {
      btn.addEventListener('click', () => commit(null));
    }
    container.appendChild(btn);
    return btn;
  }

  // Reveal a "give up which?" picker for an open "?" equipment/cargo forfeit, so the exact
  // item/cargo the player chooses is what leaves — not whatever the engine finds first.
  // Each button commits the loss with a chooser bound to that candidate. (task 117)
  showForfeitPicker(container, plan, commit) {
    const box = document.createElement('div');
    box.className = 'ship-choice forfeit-choice';
    box.appendChild(document.createTextNode('Give up which? '));
    plan.candidates.forEach((cand) => {
      const b = document.createElement('button');
      b.className = 'btn-mini';
      b.textContent = plan.kind === 'cargo' ? String(cand) : (cand.name + (cand.bonus ? ` (${cand.bonus >= 0 ? '+' : ''}${cand.bonus})` : ''));
      b.addEventListener('click', () => commit(() => [cand]));
      box.appendChild(b);
    });
    container.appendChild(box);
  }

  // Rules in render-rules.js (task 119).
  isOptionalForce(node) { return isOptionalForceRule(node); }

  forcedChoiceGroup(node) { return forcedChoiceGroupRule(node); }

  // Render a force="f" optional effect as a once-per-visit opt-in button (task 74). When
  // it belongs to a choose-one group, taking any member locks the untaken ones so exactly
  // one option is applied. The effect fires only on click — never on entry.
  renderForcedOptional(container, node, path) {
    const memo = 'force@' + path;
    const done = this.ctx.applied.has(memo);
    const token = this.forcedChoiceGroup(node);
    const chosen = token != null ? this.ctx.forcedChosen.get(token) : null;
    const lockedByGroup = chosen != null && chosen !== memo;
    const label = document.createElement('span');
    this.appendChildren(label, node, path);
    const btn = document.createElement('button');
    btn.className = 'btn-mini pay-action' + (done ? ' done' : '');
    btn.textContent = (done ? '☑ ' : '') + (label.textContent.trim() || 'Do this');
    if (done) {
      btn.disabled = true;
    } else if (lockedByGroup) {
      btn.disabled = true; btn.title = 'You may choose only one.';
    } else {
      btn.addEventListener('click', () => {
        const note = applyEffect(node, this.state, {});
        this.ctx.applied.add(memo);
        if (token != null) this.ctx.forcedChosen.set(token, memo);
        if (note) this.notify(note);
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // Rules in render-rules.js (task 119).
  linkedRewards(key) { return linkedRewardsRule(this.sectionEl, key); }

  isCounterReward(node) { return isCounterRewardRule(node); }

  isChooseOne(key) { return isChooseOneRule(this.sectionEl, key); }

  // Rule in render-rules.js (task 119).
  isPricedItemAward(key) { return isPricedItemAwardRule(this.sectionEl, key); }

  // The "choose one" cost button: paying only *arms* the choice (deducts the cost
  // and sets flag key) — the linked reward pick buttons then grant a single reward
  // and consume the flag, which re-enables this cost for another round. Gated purely
  // on the flag (no permanent memo), so the pay→pick cycle repeats. (task 43)
  renderChooseOnePay(container, node, path, key) {
    const armed = this.state.getFlag(key);
    const shards = node.getAttribute('shards');
    const item = node.getAttribute('item');
    const cost = shards != null ? resolveValue(this.state, shards) : 0;
    const label = document.createElement('span');
    this.appendChildren(label, node, path);
    const text = label.textContent.trim()
      || (cost ? `Pay ${cost} Shards`
        : (item && item !== '?' && item !== '*' ? `Hand over the ${titleCase(item)}` : 'Pay'));

    const btn = document.createElement('button');
    btn.className = 'btn-mini pay-action' + (armed ? ' done' : '');
    btn.textContent = (armed ? '☑ ' : '') + text;
    if (armed) {
      btn.disabled = true; btn.title = 'Paid — now choose your reward.';
    } else if (shards != null && this.state.data.shards < cost) {
      btn.disabled = true; btn.title = 'Not enough Shards';
    } else if (item != null && !this.state.hasItemMatch(item, node.getAttribute('tags'))) {
      btn.disabled = true; btn.title = 'You have nothing to give.';
    } else {
      btn.addEventListener('click', () => {
        applyEffect(node, this.state, {}); // deduct the cost + set flag key (arms the choice)
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // One option of a "choose one" purchase: an inline pick button, live only while the
  // linked cost is armed (flag set). Clicking applies just this reward — which clears
  // the flag (consumes the payment) — so exactly one is granted per payment, and the
  // cost re-enables for another round. Blessings already held / afflictions not held
  // are disabled so a payment is never wasted on a no-op. (task 43)
  renderChoosableReward(container, node, path, key) {
    const armed = this.state.getFlag(key);
    const btn = document.createElement('button');
    btn.className = 'btn-mini reward-pick';
    btn.textContent = this.rewardLabel(node);
    const held = this.rewardWasteReason(node);
    if (!armed) {
      btn.disabled = true;
      // With a visible cost the player must pay first; a hidden/earned arming
      // (book1/597's <tick price hidden>) means the single pick has been spent.
      btn.title = this.hasVisiblePay(key) ? 'Pay first to choose this.' : 'You may choose only one of these rewards.';
    } else if (held) {
      btn.disabled = true; btn.title = held;
    } else {
      btn.addEventListener('click', () => {
        const note = this.grantChoosableReward(node, key); // grant reward + clear flag key
        if (note) this.notify(note);
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // Rule in render-rules.js (task 119).
  hasVisiblePay(key) { return hasVisiblePayRule(this.sectionEl, key); }

  // Grant one chosen reward and consume the payment (clear its flag). Effect rewards
  // (tick/lose/gain) clear their own flag via applyEffect; an item/weapon/armour/tool
  // award or a resurrection deal is granted here and the flag cleared explicitly. (task 63)
  grantChoosableReward(node, key) {
    const tag = node.tagName.toLowerCase();
    if (ITEM_FAMILY_TAGS.has(tag)) {
      const rawName = node.getAttribute('name') || tag;
      const currency = tag === 'item' ? currencyAward(rawName) : null;
      // A quantity= choose-one option grants that many of the reward (§4.634's ink-sac
      // barter option is two sacs), currency stacking freely and possessions limited by
      // the 12-item carry cap. (task 94)
      const quantity = node.getAttribute('quantity') != null ? Math.max(1, resolveValue(this.state, node.getAttribute('quantity'))) : 1;
      if (currency != null) {
        for (let k = 0; k < quantity; k++) this.state.adjustMoney(currency);
      } else {
        const { name, alts } = splitItemName(rawName);
        const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
        const ability = node.getAttribute('ability') || null;
        const tags = [...parseTags(node.getAttribute('tags')), ...alts];
        const group = node.getAttribute('group');
        const effects = readItemEffects(node);
        for (let k = 0; k < quantity && this.state.freeSlots() > 0; k++) this.state.addItem(makeItem(tag, name, bonus, ability, tags, effects, group));
      }
      this.state.setFlag(key, false);
      return '';
    }
    if (tag === 'resurrection') {
      buyResurrectionDeal(this.state, {
        book: node.getAttribute('book') ? Number(node.getAttribute('book')) : this.book,
        section: node.getAttribute('section'), text: node.getAttribute('text') || (node.textContent || '').trim(),
        god: node.getAttribute('god'), cost: 0, supplemental: boolAttr(node.getAttribute('supplemental')),
      });
      this.state.setFlag(key, false);
      return 'Resurrection deal arranged.';
    }
    return applyEffect(node, this.state, {});
  }

  // A short label for a "choose one" reward button: its own words, else the
  // blessing/curse/disease/poison it grants or lifts.
  rewardLabel(node) {
    const tag = node.tagName.toLowerCase();
    // Item/weapon/armour/tool award: "Take amber wand (Magic +1)".
    if (ITEM_FAMILY_TAGS.has(tag)) {
      const rawName = node.getAttribute('name') || tag;
      const currency = tag === 'item' ? currencyAward(rawName) : null;
      if (currency != null) return `Take ${currency} Shards`;
      const { name } = splitItemName(rawName);
      const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
      const ability = node.getAttribute('ability');
      let tail = '';
      if (tag === 'weapon' && bonus) tail = ` (Combat +${bonus})`;
      else if (tag === 'armour' && bonus) tail = ` (Defence +${bonus})`;
      else if (tag === 'tool' && ability) tail = ` (${titleCase(ability)} +${bonus})`;
      else if (bonus) tail = ` (+${bonus})`;
      return `Take ${titleCase(name)}${tail}`;
    }
    const txt = (node.textContent || '').trim();
    if (txt) return txt;
    // A bare shards tick ("<tick shards='500' flag='x'/>") — book1/597's 500 Shards.
    if (tag === 'tick' && node.getAttribute('shards') != null) return `${node.getAttribute('shards')} Shards`;
    const bl = node.getAttribute('blessing');
    if (bl) return titleCase(bl);
    const af = node.getAttribute('curse') || node.getAttribute('disease') || node.getAttribute('poison');
    if (af) return af;
    return 'Choose';
  }

  // Rule in render-rules.js (task 119).
  rewardWasteReason(node) { return rewardWasteReasonRule(this.state, node); }

  // Rule in render-rules.js (task 119).
  isRollGate(k) { return isRollGateRule(this.sectionEl, k); }

  // The "pay to spin" cost: paying arms the linked <random flag="k"> (sets flag k)
  // but does NOT fire the outcome effects — the roll reveals the single outcome that
  // applies. Repeatable: once the roll consumes the flag the cost re-enables, so a
  // per-day / per-attempt section can be paid again (book3/314, book5/674, book6/628).
  // Gated purely on the flag (no permanent memo), so it tracks the pay↔roll cycle.
  renderRollPayment(container, node, path, key) {
    const armed = this.state.getFlag(key);
    const shards = node.getAttribute('shards');
    const item = node.getAttribute('item');
    const cost = shards != null ? resolveValue(this.state, shards) : 0;
    const label = document.createElement('span');
    this.appendChildren(label, node, path);
    const text = label.textContent.trim()
      || (cost ? `Pay ${cost} Shards` : (item && item !== '?' && item !== '*' ? `Hand over the ${titleCase(item)}` : 'Pay'));

    const btn = document.createElement('button');
    btn.className = 'btn-mini pay-action' + (armed ? ' done' : '');
    btn.textContent = (armed ? '☑ ' : '') + text;
    if (armed) {
      btn.disabled = true; btn.title = 'Paid — now make the roll.';
    } else if (shards != null && this.state.data.shards < cost) {
      btn.disabled = true; btn.title = 'Not enough Shards';
    } else if (item != null && item !== '?' && item !== '*' && !this.state.hasItem(item)) {
      btn.disabled = true; btn.title = `You need the ${titleCase(item)}`;
    } else {
      btn.addEventListener('click', () => {
        applyEffect(node, this.state, {}); // deduct the cost + set flag key (arms the roll)
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // ---- navigation ----------------------------------------------------------
  targetBook(node) {
    const b = node.getAttribute('book');
    return b ? Number(b) : this.book;
  }

  // A dead="t"/"f" attribute gates navigation on the player's alive/dead state:
  // dead="t" is a "you are dead" link (only for a dead player) — while alive it
  // must not be clickable, else a survivor walks into the you-are-dead section
  // (book4/16's trample → §7). dead="f" is the mirror (only while alive). Returns
  // true (and disables the button) when the node is gated out. (task 28)
  deadGate(node, btn) {
    const d = node.getAttribute('dead');
    if (d == null) return false;
    const needDead = boolAttr(d);
    if (needDead === this.state.isDead()) return false;
    btn.disabled = true;
    btn.classList.add('gated');
    btn.title = needDead ? 'Only if you are dead.' : 'Only while you live.';
    return true;
  }

  // price/flag gate on navigation (JaFL GotoNode.canUse): a <goto flag="k"> is
  // usable only once flag k is set; a <goto price="k"> only while it is clear —
  // the "pay to spin" exit (book2/157 → 19, book6/628 → 8, book3/680 → 407): while
  // the payment is armed (paid, not yet resolved) the exit is withheld, and once the
  // roll consumes the flag it reopens. Returns a reason when gated out, else null.
  flagGate(node) {
    const flag = node.getAttribute('flag');
    const price = node.getAttribute('price');
    if (flag != null && !this.state.getFlag(flag)) return 'not yet available';
    if (price != null && this.state.getFlag(price)) return 'resolve this first';
    return null;
  }

  renderGoto(container, node, path) {
    const section = node.getAttribute('section');
    if (section == null) return null;
    const targetBook = this.targetBook(node);
    const isSail = boolAttr(node.getAttribute('sail'));
    const force = node.getAttribute('force');
    // force defaults to true (a primary "continue"), EXCEPT a sail goto, which the spec
    // makes optional by default. (task 73)
    const primary = force == null ? !isSail : boolAttr(force, true);

    // A sail goto needs a ship at the CURRENT dock (not merely any owned ship — a ship
    // left at Smogmaw can't sail from Kunrir). (task 73)
    const canSail = !isSail || this.state.shipsHere().length > 0;
    const bookAvailable = availableBooks().includes(targetBook);

    const link = document.createElement('button');
    link.className = 'goto' + (primary ? ' goto-primary' : '');
    // Text: use the node's own text if any, else the section number.
    const inner = document.createElement('span');
    this.appendChildren(inner, node, path);
    link.appendChild(inner.textContent.trim() ? inner : document.createTextNode(String(section)));

    if (!canSail) { link.disabled = true; link.title = 'You need a ship here.'; }
    this.deadGate(node, link); // dead="t" only for a dead player, dead="f" only while alive
    const fg = this.flagGate(node); // price/flag "pay to spin" exit gate (task 30)
    if (fg) { link.disabled = true; link.classList.add('gated'); link.title = fg; }
    // A source goto the player took before a <return> is spent — crossed off on the
    // restored section — unless it carries revisit="t" (task 110).
    if (this.isSpentSource(node)) { link.disabled = true; link.classList.add('disabled'); link.title = 'You have already taken this path.'; }

    // The storm-safe goto (§200/250/60) spends the guarded Safety from Storms on the
    // way out — the roll gate only leaves it clickable in the protected state. (task 108)
    const spendBlessing = blessingSpendForGoto(node, this.sectionEl, this.state, this.outcomeBlessings);
    link.addEventListener('click', () => {
      if (!bookAvailable) { this.notify(`“${bookTitle(targetBook)}” (Book ${targetBook}) isn’t included in this edition.`, 'warn'); return; }
      this._pendingSourceNode = node; // record the source action for a possible <return> (task 110)
      if (spendBlessing && this.state.hasBlessing(spendBlessing)) this.state.useBlessing(spendBlessing);
      // A sail goto puts a ship "at large" before leaving; prompt when more than one
      // ship is at this dock, else sail the single one. (task 73)
      if (isSail) { this.sailThenGo(container, link, targetBook, section); return; }
      this.navigate(targetBook, section);
    });
    this.tagFightNav(node, link);
    this.tagRollNav(node, link);
    this.tagTransferNav(node, link);
    container.appendChild(link);
    return link;
  }

  // Perform a sail action: set a ship "at large", then navigate. When several ships are
  // at this dock, prompt the player to choose which one to sail (JaFL ship selection);
  // otherwise sail the single ship here. (task 73)
  sailThenGo(container, link, targetBook, section) {
    const here = this.state.shipsHere();
    // Sail the chosen ship, exempt it from this section's todock (it leaves with you),
    // then navigate. (tasks 73, 81)
    const go = (ship) => { const s = this.state.sailShip(ship && ship.id); this._sailExempt = s ? s.id : null; this.navigate(targetBook, section); };
    if (here.length <= 1) { go(here[0]); return; }
    link.disabled = true;
    const box = document.createElement('div');
    box.className = 'ship-choice';
    box.appendChild(document.createTextNode('Sail which ship? '));
    here.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'btn-mini';
      b.textContent = (s.name && s.name !== 'Ship') ? `${s.name} (${s.type})` : String(s.type);
      b.addEventListener('click', () => go(s));
      box.appendChild(b);
    });
    container.appendChild(box);
  }

  // <return>: reverse the last goto and restore the section it came from at the point
  // it was left (task 110). When a return frame is held, run the temporary section's
  // leave hooks, pop the history bounce, and re-render the previous visit WITHOUT
  // goTo()/begin() — so its variables, resolved roll and used-action state are intact,
  // its one-shot entry effects/ticks are not repeated, and no second forward visit is
  // pushed or turn counted. State changed legitimately during the detour is kept.
  // With no frame (a loaded save, or a second-level return the format doesn't promise)
  // fall back to the old history-driven navigate.
  goBack() {
    const frame = this._returnFrame;
    if (!frame) {
      const hist = this.state.data.history || [];
      const prev = hist.length ? hist[hist.length - 1] : null;
      if (prev) this.navigate(Number(prev.book), prev.section);
      return;
    }
    this._applyLeaveHooks();          // leave the temporary detour section
    this._returnFrame = null;         // one level only — consume it
    this.state.restoreReturn(frame);  // pop history + restore position/vars/location (no goTo)
    this.book = frame.book;
    this.section = frame.section;
    this.sectionEl = frame.sectionEl;
    this.ctx = frame.ctx;
    this.ctx.usedSource = frame.usedSource; // the source action taken (spent unless revisit="t")
    this.sectionTodock = frame.sectionTodock;
    this.deferredCleanups = new Map(); // rebuilt as the restored section re-renders (task 88)
    this.render();
  }

  // True for the one choice/goto node the player took before the current <return>
  // restored this section: it is spent (crossed off) unless it carries revisit="t",
  // which marks a hub action the player may take again. Only ever set right after a
  // return, so a normal render leaves every source action enabled. (task 110)
  isSpentSource(node) {
    return this.ctx && this.ctx.usedSource === node && !boolAttr(node.getAttribute('revisit'));
  }

  // <return> — a "go back to where you came from" link.
  renderReturn(container, node, path) {
    const hist = this.state.data.history || [];
    const link = document.createElement('button');
    link.className = 'goto goto-primary';
    const inner = document.createElement('span');
    this.appendChildren(inner, node, path);
    link.appendChild(inner.textContent.trim() ? inner : document.createTextNode('Go back'));
    if (hist.length) link.addEventListener('click', () => this.goBack());
    else { link.disabled = true; link.title = 'Nowhere to return to'; }
    this.tagFightNav(node, link);
    this.tagRollNav(node, link);
    this.tagTransferNav(node, link);
    container.appendChild(link);
    return link;
  }

  // A standalone item/weapon/armour/tool award in prose (e.g. "Catch a smoulder
  // fish. Note it on your Adventure Sheet."). Shows the item and lets you take it
  // once, respecting the 12-item carry limit.
  // <items group="X" limit="N"/> — a controller for a "choose up to N" award
  // group; the individual <weapon|armour|tool|item group="X"> rows share the id
  // and enforce the cap (see renderItemAward). This element itself renders a small
  // live status line so the player can see how many picks remain.
  renderItemsController(container, node, path) {
    const group = node.getAttribute('group');
    const limit = group ? this.ctx.groupLimits.get(group) : null;
    if (!limit) return null;
    const taken = this.ctx.groupPicks.get(group) || 0;
    const remaining = Math.max(0, limit - taken);
    const status = document.createElement('span');
    status.className = 'items-pick-status';
    status.textContent = remaining > 0
      ? `Choose up to ${limit} — ${remaining} left`
      : `Chosen all ${limit}`;
    container.appendChild(status);
    return status;
  }

  renderItemAward(container, node, path) {
    const kind = node.tagName.toLowerCase();
    // A flag-linked item award inside a heterogeneous "choose one" reward menu
    // (book1/597 amber wand | 500 Shards | resurrection) renders as a single pick,
    // live only once the choice is armed and blocking its siblings when taken. (task 63)
    const awardFlag = node.getAttribute('flag');
    if (awardFlag != null && this.isChooseOne(awardFlag)) return this.renderChoosableReward(container, node, path, awardFlag);
    // A single priced item reward or a pure item-family barter (§3.346, §1.342, §4.634):
    // gate the Take button on the flag its payment arms — armed → live, taken → consumed —
    // so it is neither free to take unpaid nor a no-op once paid. (task 125)
    if (awardFlag != null && this.isPricedItemAward(awardFlag)) return this.renderChoosableReward(container, node, path, awardFlag);
    const rawName = node.getAttribute('name') || (kind === 'weapon' ? 'weapon' : kind);
    // A "N Shards" award is stackable currency, not a possession (dragon hoard §1.16).
    const currency = kind === 'item' ? currencyAward(rawName) : null;
    // A multi-name label ("fur cloak|wolf pelt") displays under its first name; the
    // rest ride along as tags so ownership/<if> match either name (task 29).
    const { name, alts } = splitItemName(rawName);
    const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
    const ability = node.getAttribute('ability') || null;
    let tag = '';
    if (kind === 'weapon') tag = ` (Combat +${bonus})`;
    else if (kind === 'armour') tag = ` (Defence +${bonus})`;
    else if (kind === 'tool' && ability) tag = ` (${titleCase(ability)} +${bonus})`;
    else if (bonus) tag = ` (+${bonus})`;
    const display = currency != null ? `${currency} Shards` : titleCase(name) + tag;
    const key = 'take@' + path;
    // replace= TRANSFORMS an existing possession into this reward instead of adding a
    // duplicate: a named replace="X" converts the item named X, an empty replace=""
    // converts the same-named item (§5.118 plain flute/axe → enchanted, bag of gold →
    // 2000 Shards; §6.207 old sceptre → +5; §6.448a cursed sword → clean +2). It is
    // net-zero on slots so the 12-item cap never blocks it, and it is disabled while
    // the source item is absent. Visit-safe (memoised once done). (task 95)
    if (node.getAttribute('replace') != null) return this.renderReplaceAward(container, node, path, { kind, name, alts, bonus, ability, currency, display, key });
    // Grouped "choose up to N" award: consult the shared group tally so the extra
    // rows lock once the player has taken their allotment (book1/16, book4/218…).
    const group = node.getAttribute('group');
    const limit = group ? this.ctx.groupLimits.get(group) : null;
    const groupCount = group ? (this.ctx.groupPicks.get(group) || 0) : 0;

    // quantity= awards more than one of the same reward — a fixed count (§6.257
    // twelve silver nuggets, §3.16 three swords) or a rolled one (§1.561 x fish,
    // §4.425 x lots of 1000 Shards). Each click takes ONE unit, so a possession
    // award can be picked up partially when the 12-item cap bites and the rest stay
    // available; a rolled quantity waits for its <random var> before it is live
    // (else x=0 would grant nothing and memoise it). (task 94)
    const qtyAttr = node.getAttribute('quantity');
    if (qtyAttr != null && this.pendingRollVar(node)) {
      const wait = document.createElement('button');
      wait.className = 'btn-mini take-item';
      wait.disabled = true;
      wait.textContent = 'Take ' + display;
      wait.title = 'Roll first';
      container.appendChild(wait);
      return wait;
    }
    const quantity = qtyAttr != null ? Math.max(0, resolveValue(this.state, qtyAttr)) : 1;
    const takenCount = this.ctx.awardCounts.get(key) || 0;
    const remaining = Math.max(0, quantity - takenCount);
    const taken = remaining <= 0;
    const countSuffix = quantity > 1 ? ` (${remaining} of ${quantity} left)` : '';
    const groupFull = limit != null && !taken && groupCount >= limit;
    const btn = document.createElement('button');
    btn.className = 'btn-mini take-item' + (taken ? ' done' : '');
    if (taken) {
      btn.disabled = true;
      btn.textContent = '☑ ' + display + (quantity > 1 ? ` (×${quantity})` : '');
    } else if (groupFull) {
      btn.disabled = true;
      btn.textContent = display + countSuffix;
      btn.title = `You may choose only ${limit}`;
    } else if (currency == null && this.state.freeSlots() <= 0) {
      btn.disabled = true;
      btn.textContent = display + countSuffix;
      btn.title = 'No room (12-item carry limit)';
    } else {
      btn.textContent = 'Take ' + display + countSuffix;
      const tags = [...parseTags(node.getAttribute('tags')), ...alts];
      const effects = readItemEffects(node); // <effect> use/aura/wielded children (task 41)
      // A trapped treasure carries a <curse>/<disease>/<poison> child that only
      // bites once the item is taken (book5/238 stone bracelet → half MAGIC). (task 60)
      const afflictions = Array.from(node.querySelectorAll(':scope > curse, :scope > disease, :scope > poison'));
      btn.addEventListener('click', () => {
        if (currency != null) this.state.adjustMoney(currency); // stackable "N Shards" treasure
        else {
          this.state.addItem(makeItem(kind, name, bonus, ability, tags, effects, group));
          afflictions.forEach((aff) => applyEffect(aff, this.state));
        }
        this.ctx.awardCounts.set(key, takenCount + 1);
        if (limit != null) this.ctx.groupPicks.set(group, groupCount + 1);
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // A replace= award (see renderItemAward): transform the matching possession into
  // this reward in place. targetName is the named replace="X", or — for empty
  // replace="" — the reward's own name (the same-named item is upgraded). The old
  // possession is removed and the new one added (or, for a "N Shards" reward, its
  // value banked), so the slot count does not rise and the carry cap never refuses
  // the conversion. Disabled while the source is absent. (task 95)
  renderReplaceAward(container, node, path, { kind, name, alts, bonus, ability, currency, display, key }) {
    const targetName = node.getAttribute('replace') || name;
    const source = this.state.findItems(targetName)[0] || null;
    const done = this.ctx.applied.has(key);
    const btn = document.createElement('button');
    btn.className = 'btn-mini take-item' + (done ? ' done' : '');
    if (done) {
      btn.disabled = true;
      btn.textContent = '☑ ' + display;
    } else if (!source) {
      btn.disabled = true;
      btn.textContent = display;
      btn.title = `You have no ${titleCase(targetName)} to transform`;
    } else {
      btn.textContent = 'Take ' + display;
      const tags = [...parseTags(node.getAttribute('tags')), ...alts];
      const effects = readItemEffects(node);
      const afflictions = Array.from(node.querySelectorAll(':scope > curse, :scope > disease, :scope > poison'));
      // Keep the transformed item's provenance: the reward's own group=, else the
      // source item's, so a group-scoped count (§5.118) stays stable across the swap.
      const grp = node.getAttribute('group') || source.group || null;
      btn.addEventListener('click', () => {
        this.state.removeItemById(source.id); // net-zero: drop the old, add/bank the new
        if (currency != null) this.state.adjustMoney(currency);
        else {
          this.state.addItem(makeItem(kind, name, bonus, ability, tags, effects, grp));
          afflictions.forEach((aff) => applyEffect(aff, this.state));
        }
        this.ctx.applied.add(key);
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // ---- choices -------------------------------------------------------------
  renderChoices(container, choicesNode, path, only = null, explicitKids = null) {
    const wrap = document.createElement('div');
    wrap.className = 'choices';
    // A <choices> table can also hold the roll-branch elements the books place
    // beside the buttons (<success>/<failure>/<outcome>) — the resolution of a
    // <difficulty>/<random> rolled in the prose above (e.g. book1/123 swim). Route
    // those through renderBranch so they reveal their goto once the roll resolves.
    const kids = explicitKids || (only ? [only] : Array.from(choicesNode.children));
    kids.forEach((node, i) => {
      const tag = node.tagName.toLowerCase();
      if (tag === 'choice') wrap.appendChild(this.renderChoice(node, path + '.c' + i));
      else if (tag === 'success' || tag === 'failure' || tag === 'outcome' || tag === 'outcomes') {
        this.renderBranch(wrap, node, path + '.b' + i, this.activeRoll);
      }
    });
    container.appendChild(wrap);
    return wrap;
  }

  renderChoice(node, path) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    const label = document.createElement('span');
    label.className = 'choice-label';
    // strip {box} token
    const raw = Array.from(node.childNodes);
    const tmp = document.createElement('span');
    this.appendChildrenList(tmp, raw, path);
    label.innerHTML = tmp.innerHTML.replace('{box}', '');
    btn.appendChild(label);

    const section = node.getAttribute('section');
    const targetBook = node.getAttribute('book') ? Number(node.getAttribute('book')) : this.book;
    const shards = node.getAttribute('shards');
    // A currency="Mithral" cost is paid in that foreign coin, not Shards (book2/545).
    const currency = node.getAttribute('currency');
    const foreignCoin = !isShardsCurrency(currency);
    const coinLabel = foreignCoin ? currency : 'Shards';
    const wallet = foreignCoin ? this.state.currencyBalance(currency) : this.state.data.shards;
    const itemReq = node.getAttribute('item');
    const itemTags = node.getAttribute('tags'); // e.g. <choice item="?" tags="light"> (task 47)
    // pay= governs whether the choice *consumes* its requirement on click. An
    // explicit pay="t" consumes both a shards= cost and an item= requirement
    // (book2/400 green gem, book6/740 rope — previously ignored for item-only
    // choices); pay="f" never consumes; and with no pay= a shards= cost still
    // deducts by default while a bare item= gate is kept (a mere requirement). (task 55)
    const payAttr = node.getAttribute('pay');
    const payExplicit = payAttr != null ? boolAttr(payAttr) : null;
    const pay = payExplicit === true || (payExplicit == null && node.getAttribute('shards') != null);
    const boxWord = node.getAttribute('box');
    const profession = node.getAttribute('profession');
    const god = node.getAttribute('god');
    const emptyvar = node.getAttribute('emptyvar');
    const bookNum = node.getAttribute('book');
    const isFlee = boolAttr(node.getAttribute('flee')); // "flee at any time" option
    // A sail="t" choice is a sail action exactly like a sail goto (task 89): it needs
    // a ship at THIS dock and, on click, sets the chosen vessel at large (prompting
    // when several are here) before navigating — so the voyage tracks a real ship.
    const isSail = boolAttr(node.getAttribute('sail'));

    // gating
    const reasons = [];
    if (isSail && this.state.shipsHere().length === 0) reasons.push('you need a ship here');
    const cost = shards != null ? resolveValue(this.state, shards) : 0;
    if (shards != null && wallet < cost) reasons.push(`needs ${cost} ${coinLabel}`);
    // item= gate: "?" (+ optional tags=) means "any possession carrying these tags"
    // (a light source, etc.) — the same matcher as <if item="?" tags=…>, so a
    // light-gated choice is no longer permanently locked (task 47).
    if (itemReq && !this.state.hasItemMatch(itemReq, itemTags)) reasons.push(itemReq === '?' ? `needs ${itemTags || 'an item'}` : `needs ${itemReq}`);
    if (boxWord && !this.state.hasCodeword(boxWord)) reasons.push('box not ticked');
    if (profession && normalize(profession) !== normalize(this.state.data.profession)) reasons.push(profession + ' only');
    if (god && !this.state.hasGod(god)) reasons.push('requires ' + god);
    if (emptyvar && this.state.hasVar(emptyvar)) reasons.push('unavailable');
    if (bookNum && !availableBooks().includes(Number(bookNum))) reasons.push('book not in edition');
    // dead="t" choices are only for a dead player (and dead="f" only while alive) — task 28.
    const deadAttr = node.getAttribute('dead');
    if (deadAttr != null && boolAttr(deadAttr) !== this.state.isDead()) reasons.push(boolAttr(deadAttr) ? 'only if you are dead' : 'only while you live');
    const fg = this.flagGate(node); // price/flag "pay to spin" gate (task 30)
    if (fg) reasons.push(fg);
    // A source choice the player took before a <return> is spent unless revisit="t" (task 110).
    if (this.isSpentSource(node)) reasons.push('already taken');

    if (cost) {
      const tag = document.createElement('span');
      tag.className = 'choice-cost';
      tag.textContent = `${cost} ${coinLabel}`;
      btn.appendChild(tag);
    }
    if (boxWord) {
      const cb = document.createElement('span');
      cb.className = 'choice-box' + (this.state.hasCodeword(boxWord) ? ' ticked' : '');
      cb.textContent = this.state.hasCodeword(boxWord) ? '☑' : '☐';
      btn.insertBefore(cb, label);
    }

    if (reasons.length) {
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.title = reasons.join('; ');
    } else {
      btn.addEventListener('click', () => {
        // A flee="t" choice IS the flee action: apply the <flee> consequence
        // (parting wound / codeword) before leaving, and mark the fight fled.
        if (isFlee) {
          const fleeNode = this.sectionEl && this.sectionEl.querySelector('flee');
          if (fleeNode) applyEffectBody(fleeNode, this.state);
          if (this.sectionFight) this.sectionFight.outcome = 'fled';
          if (this.state.isDead()) { this.rerender(); return; }
        }
        // The cost is re-validated against the live sheet (task 133): if the required
        // possession was dropped (or funds spent) since this button rendered, refuse and
        // refresh so the now-ineligible choice greys out instead of crossing for free.
        const paid = payChoiceCost(this.state, { pay, cost, currency, foreignCoin, item: itemReq, itemTags }); // transaction lives in market.js (task 34)
        if (!paid.ok) { this.rerender(); return; }
        if (section == null) return; // a cost-only choice: pays and stays, not a source action
        this._pendingSourceNode = node; // record the source action for a possible <return> (task 110)
        // Sail exit: same chooser/action as a sail goto (task 89).
        if (isSail) { this.sailThenGo(btn.parentElement || this.root, btn, targetBook, section); return; }
        this.navigate(targetBook, section);
      });
    }
    this.tagFightNav(node, btn);
    this.tagRollNav(node, btn);
    this.tagTransferNav(node, btn);
    return btn;
  }

  appendChildrenList(container, nodeList, basePath) {
    nodeList.forEach((node, idx) => {
      const path = basePath + '.' + idx;
      if (node.nodeType === Node.TEXT_NODE) this.appendText(container, node.nodeValue);
      else if (node.nodeType === Node.ELEMENT_NODE) this.renderElement(container, node, path);
    });
  }

  // ---- rolls: difficulty ---------------------------------------------------
  renderDifficulty(container, node, path) {
    const spec = (node.getAttribute('ability') || '').trim();
    const multi = spec.includes('|');
    const level = resolveValue(this.state, node.getAttribute('level'));
    // modifier= is either a keyword selecting how the ability score resolves
    // (natural/noweapon/affected — book3/235/271/290, book5/516 unarmed COMBAT) or a
    // numeric/var addend. Keywords route into the ability lookup (mode); anything
    // else keeps the historical numeric-modifier behaviour. (task 53)
    const modRaw = (node.getAttribute('modifier') || '').trim().toLowerCase();
    const mode = ['natural', 'noweapon', 'notool', 'affected'].includes(modRaw) ? modRaw : null;
    const modifier = (node.getAttribute('modifier') != null && !mode) ? resolveValue(this.state, node.getAttribute('modifier')) : 0;

    // its own descriptive text
    const desc = document.createElement('span');
    this.appendChildren(desc, node, path);
    if (desc.textContent.trim()) container.appendChild(desc);

    const key = 'roll@' + path;
    const widget = document.createElement('div');
    widget.className = 'roll';
    container.appendChild(widget);

    // Pay-to-roll gate (task 51): a flag= roll paired with a [price=] cost is
    // disabled until the payment sets the flag; rolling consumes it, and a fresh
    // payment re-arms (dropping any stale result). Extends task 30's <random> gate
    // to <difficulty> — book6/731 CHARISMA boon, book2/122/book6/630 "MAGIC or …".
    const { flag, gated, armed } = this.rollGateState(node, key);
    let stored = this.ctx.rolls.get(key);
    if (gated && armed && stored) { this.ctx.rolls.delete(key); stored = null; }
    // An unresolved roll inside a <while> pass holds the loop until the player rolls
    // it (§5.218's per-pass COMBAT re-attempt to wriggle free). (task 100)
    if (this.inWhileIter && !this.inactive && !stored) this.whileIterPending = true;
    if (stored) {
      const abLabel = (stored.ability || spec.split('|')[0] || '').toUpperCase();
      this.showDiceResult(widget, stored.dice, `${abLabel} ${stored.abilityScore >= 0 ? '+' : ''}${stored.abilityScore} = ${stored.total} vs ${level}`, stored.success ? 'Success' : 'Failure', stored.success);
      this.appendBlessingReroll(widget, { ability: stored.ability, success: stored.success, kind: 'check' }, () => {
        const res = rollDifficulty(this.state, stored.ability, level, modifier + childAdjustment(node, this.state), mode);
        if (node.getAttribute('var')) { this.state.setVar(node.getAttribute('var'), res.margin); this.ctx.wroteVars.add(node.getAttribute('var')); this.ctx.rolledVars.add(node.getAttribute('var')); }
        this.ctx.rolls.set(key, res);
      });
      return widget;
    }
    // Under the Three Fortunes' difficultyCurse an ability roll uses one die (task 36).
    const diceLabel = diceWord(this.state.data.oneDieRolls ? 1 : 2);
    if (gated && !armed) {
      const btn = this.rollButton(`Roll ${diceLabel} + ${spec.split('|')[0].toUpperCase()}`, widget, () => {});
      btn.disabled = true; btn.title = 'Pay first to make this roll.';
      widget.appendChild(btn);
      return widget;
    }
    // "combat|magic": let the player pick which ability to roll before rolling.
    const pickKey = 'pick@' + path;
    const ability = multi ? this.ctx.rolls.get(pickKey) : spec;
    if (multi && !ability) {
      this.appendAbilityPicker(widget, abilityChoiceOptions(spec, this.state, false), (ab) => { this.ctx.rolls.set(pickKey, ab); this.rerender(); });
      return widget;
    }
    const abLabel = (ability || '').split('|')[0].toUpperCase();
    const btn = this.rollButton(`Roll ${diceLabel} + ${abLabel}`, widget, () => {
      if (gated) this.state.setFlag(flag, false); // consume the payment — re-pay to re-attempt
      const res = rollDifficulty(this.state, ability, level, modifier + childAdjustment(node, this.state), mode);
      if (node.getAttribute('var')) { this.state.setVar(node.getAttribute('var'), res.margin); this.ctx.wroteVars.add(node.getAttribute('var')); this.ctx.rolledVars.add(node.getAttribute('var')); }
      this.ctx.rolls.set(key, res);
      this.rerender();
    });
    widget.appendChild(btn);
    return widget;
  }

  // Pay-to-roll gate state shared by the roll renderers (tasks 30, 51): a flag= roll
  // paired with a [price="k"] cost is armed only while flag k is set. Returns the
  // flag name and whether the roll is gated / currently armed.
  rollGateState(node, key) {
    const flag = node.getAttribute('flag');
    const gated = flag != null && this.isRollGate(flag);
    const armed = gated ? this.state.getFlag(flag) : true;
    return { flag, gated, armed };
  }

  // Infer die count from the outcome table this random feeds: if every range
  // fits within 1-6, it's a single die (some `type="travel"` rolls), otherwise 2.
  inferDice(node, def) {
    if (!this.sectionEl) return def;
    const outs = Array.from(this.sectionEl.querySelectorAll('outcomes'));
    const target = outs.find((o) => node.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!target) return def;
    let max = 0, hasRange = false;
    target.querySelectorAll('outcome[range]').forEach((oc) => {
      hasRange = true;
      oc.getAttribute('range').replace('+', '').split(/[-,]/).forEach((n) => {
        const v = parseInt(n, 10); if (!isNaN(v)) max = Math.max(max, v);
      });
    });
    return hasRange && max <= 6 ? 1 : def;
  }

  // ---- rolls: random -------------------------------------------------------
  renderRandom(container, node, path) {
    // Remember where the travel/encounter gate's roll lives, so applyRollGate can read
    // its result (whether the leg has been rolled yet) after the walk. (task 104)
    if (this.rollGate && node === this.rollGate.rollNode) this.rollGate.rollPath = path;
    const dice = node.hasAttribute('dice') ? parseInt(node.getAttribute('dice'), 10) : this.inferDice(node, 2);
    const varName = node.getAttribute('var');
    const desc = document.createElement('span');
    this.appendChildren(desc, node, path);
    if (desc.textContent.trim()) container.appendChild(desc);

    const key = 'roll@' + path;
    const widget = document.createElement('div');
    widget.className = 'roll';
    container.appendChild(widget);

    // Pay-gated roll (book2/157 etc.): the roll enables only once its payment sets
    // the flag; rolling consumes the flag, and a fresh payment re-arms it. (task 30)
    const flag = node.getAttribute('flag');
    const gated = flag != null && this.isRollGate(flag);
    const armed = gated ? this.state.getFlag(flag) : true;
    let stored = this.ctx.rolls.get(key);
    // Re-arm: a new payment (flag set again) after a prior spin drops the old result
    // so the player can roll afresh — the per-visit "spin again" cycle.
    if (gated && armed && stored) { this.ctx.rolls.delete(key); stored = null; }
    // A <while> pass that has not yet rolled blocks the loop and marks its var stale
    // (so its downstream `<lose stamina="x">` waits for THIS six, not the last). (task 100)
    if (this.inWhileIter && !this.inactive && !stored) {
      this.whileIterPending = true;
      if (varName && this.whileIterPendingVars) this.whileIterPendingVars.add(varName);
    }

    if (stored) {
      // Re-assert this roll's value into its var on every render so a var re-rolled
      // by a later <while> pass still reads correctly here in document order — the
      // authoritative value is already saved, so replay it without a fresh save. (task 100)
      if (varName && this.state.getVar(varName) !== stored.total) this.state.restoreVar(varName, stored.total);
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total}`, '', true);
      // Luck rerolls any dice result; Safe Travel rerolls a type="travel" encounter.
      const travel = (node.getAttribute('type') || '').toLowerCase() === 'travel';
      this.appendBlessingReroll(widget, { kind: 'random', travel }, () => {
        const r = rollDice(dice);
        const total = r.total + childAdjustment(node, this.state);
        const res = { kind: 'random', dice: r.dice, total };
        if (varName) { this.state.setVar(varName, total); this.ctx.wroteVars.add(varName); this.ctx.rolledVars.add(varName); }
        this.ctx.rolls.set(key, res);
      });
    } else if (gated && !armed) {
      const btn = this.rollButton(`Roll ${diceWord(dice)}`, widget, () => {});
      btn.disabled = true; btn.title = 'Pay first to make this roll.';
      widget.appendChild(btn);
    } else {
      widget.appendChild(this.rollButton(`Roll ${diceWord(dice)}`, widget, () => {
        if (gated) this.state.setFlag(flag, false); // consume the payment — re-pay to spin again
        const r = rollDice(dice);
        const total = r.total + childAdjustment(node, this.state);
        const res = { kind: 'random', dice: r.dice, total };
        if (varName) { this.state.setVar(varName, total); this.ctx.wroteVars.add(varName); this.ctx.rolledVars.add(varName); }
        this.ctx.rolls.set(key, res);
        this.rerender();
      }));
    }
    return widget;
  }

  renderRankcheck(container, node, path) {
    const dice = parseInt(node.getAttribute('dice') || '1', 10);
    const add = parseInt(node.getAttribute('add') || '0', 10);
    const key = 'roll@' + path;
    const widget = document.createElement('div');
    widget.className = 'roll';
    container.appendChild(widget);
    // Pay-to-roll gate (task 51), as for <difficulty>/<random>.
    const { flag, gated, armed } = this.rollGateState(node, key);
    let stored = this.ctx.rolls.get(key);
    if (gated && armed && stored) { this.ctx.rolls.delete(key); stored = null; }
    if (this.inWhileIter && !this.inactive && !stored) this.whileIterPending = true; // hold a <while> pass (task 100)
    if (stored) {
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs Rank ${this.state.rankValue()}`, stored.success ? 'Success' : 'Failure', stored.success);
      this.appendBlessingReroll(widget, { success: stored.success, kind: 'check' }, () => {
        const res = rollRankCheck(this.state, dice, add, childAdjustment(node, this.state));
        if (node.getAttribute('var')) { this.state.setVar(node.getAttribute('var'), res.margin); this.ctx.wroteVars.add(node.getAttribute('var')); this.ctx.rolledVars.add(node.getAttribute('var')); }
        this.ctx.rolls.set(key, res);
      });
    } else if (gated && !armed) {
      const btn = this.rollButton(`Rank check (roll ${diceWord(dice)})`, widget, () => {});
      btn.disabled = true; btn.title = 'Pay first to make this roll.';
      widget.appendChild(btn);
    } else {
      widget.appendChild(this.rollButton(`Rank check (roll ${diceWord(dice)})`, widget, () => {
        if (gated) this.state.setFlag(flag, false); // consume the payment
        const res = rollRankCheck(this.state, dice, add, childAdjustment(node, this.state));
        if (node.getAttribute('var')) { this.state.setVar(node.getAttribute('var'), res.margin); this.ctx.wroteVars.add(node.getAttribute('var')); this.ctx.rolledVars.add(node.getAttribute('var')); }
        this.ctx.rolls.set(key, res);
        this.rerender();
      }));
    }
    return widget;
  }

  renderTraining(container, node, path) {
    const spec = (node.getAttribute('ability') || '').trim();
    // Bare <training> (book5/59) or "?"/"a|b" means "train the ability of your
    // choice" — offer a picker rather than training a phantom '' ability.
    const multi = spec === '' || spec === '?' || spec.includes('|');
    const dice = parseInt(node.getAttribute('dice') || '2', 10);
    const add = parseInt(node.getAttribute('add') || '0', 10);
    const key = 'roll@' + path;
    const widget = document.createElement('div');
    widget.className = 'roll';
    container.appendChild(widget);
    const stored = this.ctx.rolls.get(key);
    if (this.inWhileIter && !this.inactive && !stored) this.whileIterPending = true; // hold a <while> pass (task 100)
    if (stored) {
      const ab = stored.ability;
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs ${ab.toUpperCase()} ${stored.natural}`, stored.success ? `+1 ${ab.toUpperCase()}` : 'No gain', stored.success);
      // Only Luck rerolls a training roll (self-improvement, not an ability *test*).
      this.appendBlessingReroll(widget, { success: stored.success, kind: 'check' }, () => {
        this.ctx.rolls.set(key, rollTraining(this.state, ab, dice, add));
      });
      return widget;
    }
    const pickKey = 'pick@' + path;
    const ability = multi ? this.ctx.rolls.get(pickKey) : spec.toLowerCase();
    if (multi && !ability) {
      this.appendAbilityPicker(widget, abilityChoiceOptions(spec, this.state, false), (ab) => { this.ctx.rolls.set(pickKey, ab); this.rerender(); });
      return widget;
    }
    widget.appendChild(this.rollButton(`Train ${ability.toUpperCase()} (roll ${diceWord(dice)})`, widget, () => {
      this.ctx.rolls.set(key, rollTraining(this.state, ability, dice, add));
      this.rerender();
    }));
    return widget;
  }

  rollButton(label, widget, onRoll) {
    const btn = document.createElement('button');
    btn.className = 'btn-roll';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await animateDice(widget);
      onRoll();
    });
    return btn;
  }

  showDiceResult(widget, dice, detail, outcome, ok) {
    widget.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'dice-row';
    (dice || []).forEach((d) => {
      const die = document.createElement('span');
      die.className = 'die';
      die.textContent = d;
      row.appendChild(die);
    });
    widget.appendChild(row);
    const info = document.createElement('span');
    info.className = 'roll-detail';
    info.textContent = detail;
    widget.appendChild(info);
    if (outcome) {
      const badge = document.createElement('span');
      badge.className = 'roll-outcome ' + (ok ? 'ok' : 'bad');
      badge.textContent = outcome;
      widget.appendChild(badge);
    }
  }

  // ---- branches (success/failure/outcomes) ---------------------------------
  // A branch "succeeds" either from the roll's success flag, or — when it
  // carries its own `var` — from that variable's sign (>0 = success), which is
  // how the books express computed outcomes (e.g. rank checks via a `<set>`).
  branchSuccess(node, roll) {
    if (node.hasAttribute('var')) return this.state.getVar(node.getAttribute('var')) > 0;
    return roll ? !!roll.success : false;
  }

  // Is a branch ready to activate? A var-keyed branch waits until that var has been
  // WRITTEN this visit — by a roll or an active <set> (ctx.wroteVars) — never on a
  // stale/unset global (task 50). A plain (roll-fed) branch waits for its roll. This
  // stops a `<failure var="s">` firing on entry with s=0 (or a leftover s>0).
  branchResolved(node, roll) {
    if (node.hasAttribute('var')) return this.ctx.wroteVars.has(node.getAttribute('var'));
    return !!roll;
  }

  // Does a success/failure branch's ability= match the feeding roll's chosen
  // ability? (task 109) §2.37 offers "SANCTITY or MAGIC (your choice)" then routes a
  // SANCTITY success →60 and a MAGIC success →129, so the success boolean alone is
  // ambiguous. A node with no ability= is unconstrained (single-ability rolls and
  // var-keyed branches are unaffected); when the feeding roll carries no chosen
  // ability, don't over-filter.
  branchAbilityMatches(node, roll) {
    const ab = node.getAttribute('ability');
    if (ab == null || ab === '') return true;
    if (!roll || !roll.ability) return true;
    const want = String(roll.ability).toLowerCase();
    return ab.split('|').map((a) => a.trim().toLowerCase()).includes(want);
  }

  renderBranch(container, node, path, activeRoll) {
    const tag = node.tagName.toLowerCase();
    const roll = activeRoll ? this.ctx.rolls.get('roll@' + activeRoll.path) : null;

    if (tag === 'success' || tag === 'failure') {
      if (!this.branchResolved(node, roll)) return; // wait until the feeding roll / var write
      const want = tag === 'success';
      if (this.branchSuccess(node, roll) === want && this.branchAbilityMatches(node, roll)) this.revealBranch(container, node, path);
      return;
    }

    // A lone <outcome> (e.g. inside a <choices> table): reveal it when its
    // flag/range/var/codeword condition matches. flag= needs no roll (it's set by
    // a paid offering — book4/456); range/var need the roll (or var write) first.
    if (tag === 'outcome') {
      const flag = node.getAttribute('flag');
      let match;
      if (flag != null) match = this.state.getFlag(flag);
      // A codeword= outcome is a roll-less dispatch — "which codeword do you have?"
      // (§4.457's Initiate row) — so match it against live codewords before the roll
      // gate, like flag= (task 122). A same-visit hidden tick has already applied
      // (it renders above the table), so an initiate ticked this visit counts.
      else if (node.getAttribute('codeword') != null) match = node.getAttribute('codeword').split(/[|,]/).some((w) => this.state.hasCodeword(w.trim()));
      else if (!this.branchResolved(node, roll)) return; // wait for the roll / var write
      else if (node.getAttribute('range') != null) match = matchRange(node.getAttribute('range'), node.getAttribute('var') ? this.state.getVar(node.getAttribute('var')) : roll.total);
      else if (node.hasAttribute('var')) match = this.branchSuccess(node, roll);
      else match = true;
      // A held blessing vetoes a blessing-guarded outcome (task 108): the range
      // matched, but Safety from Storms carries the traveller past the storm, so the
      // dangerous redirect is not offered. The blessing is spent on the section's
      // sibling branch, not here, so nothing is consumed.
      if (match && blessingVeto(this.state, node)) return;
      if (match) this.revealBranch(container, node, path);
      return;
    }

    if (tag === 'outcomes') {
      const kids = Array.from(node.children);
      const branches = kids.filter((c) => /^(outcome|success|failure)$/.test(c.tagName.toLowerCase()));
      const choiceKids = kids.filter((c) => c.tagName.toLowerCase() === 'choice');

      // A roll-less codeword-dispatch table — "which of these codewords do you
      // have?" (§4.2/§4.184/§2.301) — carries no <random>, so activeRoll stays null
      // and the branches must resolve against live state instead of waiting forever
      // (task 122). It qualifies when every keyed (non-default) branch is codeword=.
      // A bare default row then resolves too, as the catch-all; any range/success/
      // failure/var branch marks the table roll-fed, so its default keeps waiting.
      const isDefaultOutcome = (c) => c.tagName.toLowerCase() === 'outcome'
        && c.getAttribute('codeword') == null && c.getAttribute('range') == null
        && c.getAttribute('flag') == null && !c.hasAttribute('var');
      const keyed = branches.filter((c) => !isDefaultOutcome(c));
      const codewordDispatch = keyed.length > 0 && keyed.every((c) => c.getAttribute('codeword') != null);

      // Reveal the single matching branch once it is resolved — a roll for plain/
      // range branches, or a written var (roll OR active <set>) for var-keyed ones,
      // so a set-sentinel outcome (book3/43 Chill → success) resolves with no roll
      // while an unwritten var stays pending (task 50). Codeword branches (and a
      // default in a codeword-dispatch table) resolve with no roll (task 122).
      for (let i = 0; i < branches.length; i++) {
        const c = branches[i];
        const resolved = c.getAttribute('codeword') != null
          || (isDefaultOutcome(c) && codewordDispatch)
          || this.branchResolved(c, roll);
        if (!resolved) continue;
        const ctag = c.tagName.toLowerCase();
        let match = false;
        if (ctag === 'success') match = this.branchSuccess(c, roll) === true && this.branchAbilityMatches(c, roll);
        else if (ctag === 'failure') match = this.branchSuccess(c, roll) === false && this.branchAbilityMatches(c, roll);
        else {
          const range = c.getAttribute('range');
          const cw = c.getAttribute('codeword');
          const val = c.getAttribute('var') ? this.state.getVar(c.getAttribute('var')) : (roll ? roll.total : 0);
          if (range != null) match = matchRange(range, val);
          else if (cw) match = cw.split(/[|,]/).some((w) => this.state.hasCodeword(w.trim()));
          else match = true; // default
        }
        // A held blessing vetoes this branch (task 108): skip it so neither the
        // dangerous redirect is revealed nor the roll gate's matchedOutcome is set —
        // the section's sibling <lose blessing>/reroll path then resolves. Ranges are
        // exclusive, so no other branch fills in (the traveller is protected).
        if (match && blessingVeto(this.state, c)) continue;
        if (match) {
          // Record the matched outcome for the roll gate: if it carries its own
          // redirect (a "get lost" <goto>), applyRollGate keeps the onward choices
          // suppressed so only that redirect is offered (§1.278 → 82). (task 104)
          if (this.rollGate && node === this.rollGate.outcomesNode) this.rollGate.matchedOutcome = c;
          this.revealBranch(container, c, path + '.o' + i);
          break;
        }
      }
      // Always-available alternatives inside the table (e.g. "or don't try").
      if (choiceKids.length) this.renderChoices(container, node, path, null, choiceKids);
      return;
    }

    if (!roll) this.appendChildren(container, node, path);
  }

  revealBranch(container, node, path) {
    const box = document.createElement('span');
    box.className = 'branch';
    // apply effects + render inner content
    this.appendChildren(box, node, path);
    // if it declares a section (goto target), add a continue link
    const section = node.getAttribute('section');
    if (section != null) {
      const targetBook = node.getAttribute('book') ? Number(node.getAttribute('book')) : this.book;
      const btn = document.createElement('button');
      btn.className = 'goto goto-primary';
      btn.textContent = 'Continue → ' + section;
      btn.addEventListener('click', () => this.navigate(targetBook, section));
      box.appendChild(btn);
    }
    container.appendChild(box);
  }

  // ---- fight gating --------------------------------------------------------
  // computeFightGate / computeEscapeCodewords / isDeferredEscapeClear /
  // isDeferredTagCleanup / isDeferredDeadChain / aggregateFightOutcome moved to
  // render-gates.js (task 119); the tag*/apply* view helpers below consume their output.

  // Tag a rendered nav button with its fight role, for applyFightGate to act on.
  tagFightNav(node, btn) {
    if (this.fightGate && this.fightGate.navNodes.has(node)) {
      btn.dataset.fightnav = '1';
      if (this.fightGate.loseNodes.has(node)) btn.dataset.loserole = '1';
    }
  }

  // Disable/enable post-fight navigation from the section's fight state.
  applyFightGate(flow) {
    const fight = this.sectionFight;
    if (!fight) return;
    const navs = Array.from(flow.querySelectorAll('[data-fightnav]'));
    const nonLoseEnabled = navs.filter((b) => b.dataset.loserole !== '1' && !b.disabled);
    navs.forEach((btn) => {
      let disable;
      if (!fight.outcome) disable = true;                         // unresolved: nothing yet
      else if (fight.outcome === 'lose') disable = btn.dataset.loserole !== '1'; // only the lose-branch
      else if (fight.outcome === 'fled') disable = true;          // fled: only the (ungated) escape choice remains — never a win/lose exit (task 54)
      else disable = btn.dataset.loserole === '1';                // won: hide the lose-branch
      // Safety: never strand a win — if disabling lose-branches would leave no
      // enabled way forward, leave them all as-is.
      if (disable && fight.outcome === 'win' && btn.dataset.loserole === '1' && !nonLoseEnabled.length) return;
      if (disable) {
        btn.disabled = true;
        btn.classList.add('gated');
        if (!fight.outcome) btn.title = `Defeat the ${fight.name} first.`;
      }
    });
  }

  // ---- travel / encounter roll gating (task 104) ---------------------------
  // computeRollGate and hasAncestorTag moved to render-gates.js (task 119); the
  // tag*/apply* view helpers below consume computeRollGate's output.

  // Tag a rendered nav button as roll-gated, for applyRollGate to act on.
  tagRollNav(node, btn) {
    if (this.rollGate && this.rollGate.navNodes.has(node)) btn.dataset.rollnav = '1';
  }

  // Disable the onward navigation until the mandatory roll resolves, and keep it
  // suppressed if the matched outcome redirects the player elsewhere. Only ever
  // ADDS a disable, so it composes with applyFightGate (a fight-in-outcome section
  // like §1.299 stays gated on both the roll AND the fight).
  applyRollGate(flow) {
    const gate = this.rollGate;
    if (!gate) return;
    const navs = Array.from(flow.querySelectorAll('[data-rollnav]'));
    if (!navs.length) return;
    const roll = gate.rollPath != null ? this.ctx.rolls.get('roll@' + gate.rollPath) : null;
    let disable, title;
    if (!roll) {
      disable = true; title = 'Resolve the roll above first.';
    } else {
      const oc = gate.matchedOutcome;
      const redirect = !!oc && (!!oc.querySelector('goto') || oc.getAttribute('section') != null);
      disable = redirect; title = 'Your route is decided — follow it.';
    }
    if (!disable) return;
    navs.forEach((btn) => {
      if (btn.disabled) return; // already gated (fight, cost, edition…) — keep its own reason
      btn.disabled = true;
      btn.classList.add('gated');
      btn.title = title;
    });
  }

  // ---- forced-transfer gating (task 107) -----------------------------------
  // computeTransferGate moved to render-gates.js (task 119); the tag*/apply* view
  // helpers below consume its output.

  // Tag a rendered nav button as forced-transfer-gated, for applyTransferGate.
  tagTransferNav(node, btn) {
    if (this.transferGate && this.transferGate.navNodes.has(node)) btn.dataset.xfernav = '1';
  }

  // Disable the tagged onward navigation while a forced transfer is still pending
  // this pass (renderTransfer set pendingTransfer). Only ADDS a disable, so it
  // composes with the fight/roll gates.
  applyTransferGate(flow) {
    if (!this.transferGate || !this.pendingTransfer) return;
    flow.querySelectorAll('[data-xfernav]').forEach((btn) => {
      if (btn.disabled) return; // already gated for another reason — keep it
      btn.disabled = true;
      btn.classList.add('gated');
      btn.title = 'Resolve the transfer above first.';
    });
  }

  // ---- fight ---------------------------------------------------------------
  // The fight view (renderFight/renderGroupFight/drawFight/drawGroupFight/findInSection)
  // moved to render-combat.js (task 119); it is mixed onto Story.prototype below.

  // ---- market / economy ----------------------------------------------------
  // The economy view (renderMarket/renderShopRow/runSoldHooks/soldMatches/renderInlineBuy/
  // renderInlineSell/applyLinkedCargoBuys/renderRest/renderMoneyCache/renderItemCache/
  // renderTransfer/renderResurrection) moved to render-market.js (task 119); it is mixed
  // onto Story.prototype below.

  // ---- tables --------------------------------------------------------------
  renderTable(container, node, path) {
    // Some <table>s are actually choice containers or headers; render generically.
    const rows = Array.from(node.children).filter((c) => c.tagName.toLowerCase() === 'tr');
    if (!rows.length) { this.appendChildren(container, node, path); return null; }
    const table = document.createElement('table');
    table.className = 'book-table';
    rows.forEach((tr, ri) => {
      const rowEl = document.createElement('tr');
      Array.from(tr.children).forEach((cell, ci) => {
        const t = cell.tagName.toLowerCase();
        const isHead = /h[1-6]/.test(t);
        const cellEl = document.createElement(isHead ? 'th' : 'td');
        this.appendChildren(cellEl, cell, path + '.' + ri + '.' + ci);
        rowEl.appendChild(cellEl);
      });
      // rows may contain bare text
      if (!tr.children.length) { const td = document.createElement('td'); this.appendChildren(td, tr, path + '.' + ri); rowEl.appendChild(td); }
      table.appendChild(rowEl);
    });
    container.appendChild(table);
    return table;
  }
}

// Mix the responsibility-split view modules onto Story.prototype (task 119). Each module
// exports a plain object of DOM-construction methods that use `this` (the Story instance);
// they compose with the rest of the renderer exactly as if defined in the class body, and
// keep the `Story` API unchanged. Rules live in the DOM-free modules these call.
Object.assign(Story.prototype, combatView, marketView);

// MARKET_TITLES / titleCase / diceWord / escapeHtml / itemLabel moved to render-util.js
// (task 119) so the responsibility-split view modules can share them without importing
// render.js (which would be a cycle).
