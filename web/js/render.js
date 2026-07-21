// render.js — renders a parsed <section> tree into interactive DOM.
//
// Model: the whole section is re-rendered on every state change. Passive
// effects and roll results are memoized per-visit by a stable node path, so:
//   * passive effects apply exactly once per visit,
//   * conditionals re-evaluate against live state after each roll,
//   * revealed branches only appear (and only apply their effects) once resolved.

import {
  evaluateCondition, applyEffect, boolAttr, whileLoopDone, useItemEffect,
} from './engine.js';
// The view is split by responsibility (task 119): rolls/branches → render-rolls.js, the
// passive/payment/reward/item-award cluster → render-rewards.js, the fight view →
// render-combat.js, the economy view → render-market.js. render.js keeps the section
// lifecycle, the core walk, conditionals, navigation and the tag registry, importing only
// what its remaining methods use directly.
import { GameState } from './state.js';
import { ABILITY_LABEL } from './rules.js';
import { bookTitle, availableBooks, loadBook, getSection } from './data.js';
import { modal } from './ui.js';
import { computeOutcomeBlessings } from './render-rules.js';
import {
  computeFightGate, computeEscapeCodewords, isDeferredDeadChain,
  computeRollGate, computeTransferGate, computeBuyGate,
} from './render-gates.js';
import {
  newCtx, resolveNodePath, serializeCtx, deserializeCtx, serializeFrame, rebuildVisitScaffold,
} from './visit-state.js';
import {
  renderReroll, renderDifficulty, renderRandom, renderRankcheck, renderTraining,
  renderBranch,
} from './render-rolls.js';
import {
  renderGroup, renderPassive, renderItemsController, renderItemAward,
} from './render-rewards.js';
import {
  renderChoices, renderChoiceElement, renderGoto, renderReturn,
} from './render-choices.js';
import { renderFight } from './render-combat.js';
import {
  renderMarket, renderInlineBuy, renderInlineSell, renderRest,
  renderMoneyCache, renderItemCache, renderTransfer, renderResurrection,
} from './render-market.js';

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

// Tag-dispatch table for renderElement (task 9): tag → view function, called as
// fn(story, container, node, path); tags that share a handler are listed under each
// alias. Split view modules (render-rolls.js, …) contribute plain functions directly;
// handlers still implemented as Story methods are wrapped in an arrow until their
// module is split out (task 119). This is the view half of the tag registry; the
// DOM-free effect half lives in engine.js (EFFECT_APPLIERS). Adding a renderable tag
// is a one-line change here plus its handler — no switch to hunt through. (Kept
// separate from the engine table on purpose: render is DOM, the rules layer is DOM-free.)
const TAG_RENDERERS = {
  p:               (s, c, n, p) => s.renderParagraph(c, n, p),
  group:           renderGroup,
  text:            (s, c, n, p) => s.renderTextWrapper(c, n, p),
  desc:            (s, c, n, p) => s.renderTextWrapper(c, n, p),
  if:              (s, c, n, p) => s.renderIfChain(c, n, p),
  elseif:          (s, c, n, p) => s.renderIfChain(c, n, p),
  else:            (s, c, n, p) => s.renderIfChain(c, n, p),
  goto:            renderGoto,
  return:          renderReturn,
  items:           renderItemsController,
  item:            renderItemAward,
  weapon:          renderItemAward,
  armour:          renderItemAward,
  tool:            renderItemAward,
  choices:         (s, c, n, p) => renderChoices(s, c, n, p),
  choice:          renderChoiceElement,
  difficulty:      renderDifficulty,
  random:          renderRandom,
  rankcheck:       renderRankcheck,
  training:        renderTraining,
  fight:           renderFight,
  // <flee>/<fightdamage> describe a consequence that fires on an EVENT (the player
  // fleeing, or the enemy landing a blow), never on render. Show their prose but
  // render them inert — combat.js / the Flee button apply the effects.
  flee:            (s, c, n, p) => s.renderInert(c, n, p),
  fightdamage:     (s, c, n, p) => s.renderInert(c, n, p),
  market:          renderMarket,
  buy:             renderInlineBuy,
  sell:            renderInlineSell,
  rest:            renderRest,
  moneycache:      renderMoneyCache,
  itemcache:       renderItemCache,
  transfer:        renderTransfer,
  resurrection:    renderResurrection,
  reroll:          renderReroll,
  image:           (s, c, n, p) => s.renderImage(c, n, p),
  table:           (s, c, n, p) => s.renderTable(c, n, p),
  'choices-table': (s, c, n, p) => s.renderTable(c, n, p),
  // task 32: previously unhandled tags. <field>/<extrachoice> are implemented;
  // <while>/<sectionview> render their inner prose (as the default recursion
  // already did — no behaviour change) with the automated mechanic deferred.
  // Explicit entries let the default case become strict later.
  field:           (s, c, n, p) => s.renderField(c, n, p),
  extrachoice:     (s, c, n, p) => s.renderExtraChoice(c, n, p),
  // <while var="V"> repeats its body until V is assigned (task 100): each pass is a
  // fresh iteration with its own roll/effects, and a live unterminated loop blocks
  // the rest of the section (JaFL WhileNode holds execution until the loop ends).
  while:           (s, c, n, p) => s.renderWhile(c, n, p),
  // <fightround> is a combat-round RULE (task 99): its body executes headlessly
  // between rounds (combat.fightRound), so it renders as inert prose — visible
  // words, no live roll widgets the player could work out of sequence.
  fightround:      (s, c, n, p) => s.renderInert(c, n, p),
  // <sectionview> (§5.114's trance oracle) opens a read-only popup showing random
  // sections' prose — no effects, no controls, no visit change (task 101).
  sectionview:     (s, c, n, p) => s.renderSectionview(c, n, p),
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
      // In-flight guard (task 147): rawNavigate (app.navigate) awaits a possibly-slow
      // cross-book section fetch before begin() completes. Without this, a second click
      // in that window would run the leave hooks again (the first pass consumes
      // _sailExempt, so the second re-docks the ship just sailed), double-count the turn
      // in state.goTo, and re-apply the destination's on-entry effects. Ignore re-entrant
      // navigations until begin() (or a failed fetch) releases the flag.
      if (this._navInFlight) return;
      this._navInFlight = true;
      // Snapshot the section being LEFT as the one-level return frame BEFORE the leave
      // hooks / rawNavigate mutate anything — so a <return> in the destination restores
      // this exact visit (position, section-local vars, render memo) rather than
      // re-entering it fresh. (task 110)
      const frame = this._captureReturnFrame();
      this._applyLeaveHooks();
      this._returnFrame = frame;
      // Persistence audit (task 161): the leave hooks apply this section's todock (which
      // autosaves through changed()) while this.section still names the source and _returnFrame
      // still holds the source's OWN return frame — so the on-disk record stays a coherent
      // source visit throughout the slow fetch below. The new destination frame installed just
      // above is in-memory only and is committed atomically by begin() (which now ends in an
      // explicit save) once the router resolves; nothing autosaves during the await, so the
      // transition needs no separate commit here.
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
    // Set by navigate() for the duration of a transition and released by begin() (or a
    // failed fetch); blocks a re-entrant (double-click) navigation. (task 147)
    this._navInFlight = false;
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
    this._navInFlight = false; // the transition has arrived — release the navigate guard (task 147)
    this.sectionEl = sectionEl;
    this.book = book;
    this.section = section;
    // Establish this visit's identity FIRST — the fresh ctx (per-visit memo), this
    // section's todock= and the entry-tick baseline — BEFORE any of the state-clearing
    // calls below. Each of those fires changed() → save() → serializeVisit; if the ctx /
    // entryTicks / todock still belonged to the PREVIOUS section, that autosave would pair
    // the NEW section with a FOREIGN visit record (positional memos aliasing onto the new
    // section's nodes), and a mid-begin reload — a tab close, or the SW controllerchange
    // reload — would resume corrupt. Setting them up front keeps every save fired during
    // begin() atomic with the section it names. groupLimits/rollLockCaches are re-derived
    // on resume (visit-state.js), so populating those further down is harmless. (task 154)
    this.ctx = this._newCtx();
    // Remember this section's todock= so the wrapped navigate applies it on leaving. (task 81)
    this.sectionTodock = sectionEl.getAttribute('todock') || null;
    // Snapshot the box-tick count as this section is ENTERED (before its <tick/> runs), so
    // <if ticks="N"> reads the entry count and a tick applied this visit can't flip the
    // guard on a mid-visit rerender (task 105). Position is already current here (navigate()
    // calls goTo before begin), matching addTick's no-args box key.
    this.state.setEntryTicks(this.state.tickCount());
    this.deferredCleanups = new Map(); // fresh per visit (task 88)
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
    // Record the player's location from the section's dock= attribute and berth any
    // at-large ship here (it was sailed in); a section without dock= is inland/at sea,
    // so the location clears and no ship is "here" unless it is at large. (task 73)
    this.state.arriveAtDock(sectionEl.getAttribute('dock'));
    // Section-scoped scaffolding — "choose up to N" group caps and gambling-bet lock
    // caches (tasks 5 + 38) — is re-derived by the same visit-state helper a resume
    // uses (task 119); passing state marks this a FRESH entry, so each roll-lock cache
    // resets to unlocked and a new visit lets you re-bet.
    rebuildVisitScaffold(this.ctx, sectionEl, this.state);
    // Reset this section's coordination flags (price=/flag= keys). They gate the
    // "pay to spin" roll idiom (task 30) and the paid-offering outcomes (book4/456)
    // within a single visit; a flag left set by a previous incomplete visit must
    // not pre-arm a roll or reveal an outcome for free. Only clear ones actually
    // set, so a fresh visit (all clear) triggers no needless save.
    sectionEl.querySelectorAll('[price], [flag]').forEach((n) => {
      const p = n.getAttribute('price'); if (p && this.state.getFlag(p)) this.state.setFlag(p, false);
      const f = n.getAttribute('flag'); if (f && this.state.getFlag(f)) this.state.setFlag(f, false);
    });
    this.render();
    // Commit the transition (task 161). The position was set by goTo() (or state.undo())
    // BEFORE begin(), but that autosave still named the SOURCE visit; the state-clearing
    // calls above only save incidentally, so a prose-only destination (nothing to clear,
    // no entry effect) would make no coherent save at all — leaving {data: destination,
    // visit: source} on disk, which sanitizeVisit rejects on reload (losing the exact ctx +
    // return frame). Persist once here, now that the destination's identity/ctx/frame are
    // fully established, so every entry path leaves position and visit agreeing on disk.
    this.state.save();
  }

  // Re-draw the current visit after an interactive action, then persist it. An action's own
  // state mutation autosaves, but from INSIDE the mutation — BEFORE the handler records the
  // ctx memo that marks the action done (buy count, roll result, rest memo, consumed flag),
  // and a bare ctx write never autosaves on its own. So the last persisted record said the
  // action never happened while its state effect WAS saved: a reload replayed the rest/buy/
  // roll with its effect already banked (or its penalty shed). rerender() is the shared tail
  // of every interactive handler, so persisting once here — after the memo is in place —
  // keeps the saved visit record in step with the state it guards (the interactive
  // counterpart to the passive path, which already memoises before applying). (task 155)
  rerender() { this.render(); this.state.save(); }

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
    // Atomicity guard (task 161): a save can fire mid-transition — state.goTo() sets the
    // destination position and autosaves BEFORE begin() swaps this Story onto it, and
    // state.undo()/restoreReturn() move the position while the Story still names the old
    // visit. Serialising in that window would pair the new position with the OLD visit — a
    // mismatch sanitizeVisit drops on reload, losing the exact ctx + return frame. Emit no
    // record until the Story identity and the persisted position agree; the transition's own
    // explicit begin()/goBack commit writes the coherent record the instant they do.
    const d = this.state && this.state.data;
    if (!d || String(d.section) !== String(this.section) || Number(d.book) !== Number(this.book)) return null;
    return {
      v: 1,
      book: this.book,
      section: this.section,
      entryTicks: this.state.entryTickCount(),
      sectionTodock: this.sectionTodock,
      // The transient per-fight attack/Defence bonus (task 49) is per-visit state a reload
      // can't re-derive — its granting tick is already memoised — so it rides in the record. (task 156)
      fightBonus: this.state.fightBonusSnapshot(),
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
    // Restore the transient per-fight bonus the record carried: render() won't re-run the
    // granting <tick special=…> (its fx@ memo is in ctx.applied), so without this a mid-fight
    // reload would resume with the paid bonus gone / the hidden penalty shed. (task 156)
    this.state.restoreFightBonus(record && record.fightBonus);
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
    this.state.restoreFightBonus(probeState.fightBonusSnapshot()); // adopt the entry-derived per-fight bonus (task 156)
    this.sectionTodock = probe.sectionTodock;
    this.deferredCleanups = new Map();
    this.state.setEntryTicks(probeState.entryTickCount());
    this._returnFrame = null;
    this.render();
    // Commit the migrated visit (task 161). The blob we loaded from carried a legacy /
    // rejected visit record; adopting the probe's ctx above is a bare field assignment that
    // fires no changed(). Save once here so the coherent {data: section, visit: migrated ctx}
    // is on disk immediately, instead of leaving the stale record until the next action.
    this.state.save();
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
    // Forced-buy gating (task 136.5): a visible, enabled <buy force="t"> (§4.658's free
    // barque) is mandatory — the onward navigation after it stays locked until it runs.
    // renderInlineBuy flags pendingBuy while such a buy is still live this pass;
    // applyBuyGate then disables the tagged navs. Reset per render.
    this.buyGate = computeBuyGate(el);
    this.pendingBuy = false;
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
    this.applyBuyGate(flow); // gate onward nav on an unrun forced buy (task 136.5)
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
    // Controls inside an untaken (grayed) branch don't count — they're disabled — and
    // neither does a DISABLED control: an unaffordable forced payment blocks the rest of
    // the section and renders its Pay button disabled, which must not read as a way
    // forward (else the section softlocks to Undo-only). A live fight/roll/buy/transfer
    // gate always leaves its Attack/Roll/action button ENABLED, so this never mis-fires
    // during one. (task 151)
    const controls = Array.from(flow.querySelectorAll('.goto, .choice, .btn-roll, .btn-secondary, .btn-mini, .fight, .group-action, .pay-action, .reward-pick'))
      .filter((c) => !c.closest('.cond-inactive') && !c.disabled);
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
        renderBranch(this, container, node, path, this.activeRoll);
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

    const fn = TAG_RENDERERS[tag];
    if (fn) return fn(this, container, node, path);

    if (PASSIVE_TAGS.has(tag)) return renderPassive(this, container, node, path);
    // Unknown element: render children so we don't lose prose.
    this.appendChildren(container, node, path);
    return null;
  }

  // Cross-view dispatch (task 163): renderBranch (render-rolls) and renderChoices
  // (render-choices) are mutually recursive — a <choices> table can carry branch children,
  // and a revealed branch can carry choices. The two view modules reach each other through
  // these Story-facade methods instead of importing one another, which breaks the
  // render-rolls <-> render-choices ES-module cycle without moving any rule into a view.
  dispatchBranch(container, node, path, activeRoll) { return renderBranch(this, container, node, path, activeRoll); }
  dispatchChoices(container, node, path, only = null, explicitKids = null) { return renderChoices(this, container, node, path, only, explicitKids); }

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
    // Per-node entry point, reached ONLY when an if/elseif/else is dispatched individually
    // via renderElement — appendChildrenList (choice labels) and renderGroupWithRoll's child
    // loop. There is no cross-sibling chain state here, so a bare <elseif>/<else> cannot know
    // whether a prior branch matched: running it unconditionally would double-run a branch.
    // A standalone <if> is a self-contained conditional and evaluates normally; <elseif>/<else>
    // are inert on this path. The real chain semantics live in appendChildren's walker
    // (renderConditionalBranch); the corpus has no elseif/else inside <choice>/<group>, so this
    // only hardens a latent path. (task 150)
    const tag = node.tagName.toLowerCase();
    if (tag === 'elseif' || tag === 'else') return null;
    const ok = evaluateCondition(node, this.state);
    const chainKey = 'chain@' + path;
    if (ok) {
      this.ctx.applied.add(chainKey); // this branch taken
      this.appendChildren(container, node, path);
    }
    return null;
  }

  // ---- group / passive / rewards / item awards ------------------------------
  // renderGroup, renderGroupWithRoll, grantItemNode, runBuyNode, renderPassive, the
  // ability/equipment/profession choosers, the payment + choose-one + item-award
  // views all moved to render-rewards.js (task 119) — plain functions dispatched from
  // TAG_RENDERERS and from render-rewards' own renderPassive verdict switch.

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

  // ---- navigation ----------------------------------------------------------
  // renderGoto / sailThenGo / renderReturn / the dead=/target-book gates moved to
  // render-choices.js (task 119) — dispatched from TAG_RENDERERS. goBack() stays here:
  // reversing a visit is section lifecycle, not view.

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
    this._applyLeaveHooks();          // leave the temporary detour section (uses ITS todock)
    // Restore the Story's visit identity to the source section BEFORE restoreReturn(), whose
    // changed() autosaves. serializeVisit reads this.section/ctx/_returnFrame, so establishing
    // them first makes that autosave pair the restored source position with the source's own
    // ctx and a null frame — coherent. Doing restoreReturn() first (as before) saved the
    // restored source position paired with the DETOUR's still-live visit, a mismatch
    // sanitizeVisit rejects on reload, dropping the exact return state. (task 161)
    this._returnFrame = null;         // one level only — consume it
    this.book = frame.book;
    this.section = frame.section;
    this.sectionEl = frame.sectionEl;
    this.ctx = frame.ctx;
    this.ctx.usedSource = frame.usedSource; // the source action taken (spent unless revisit="t")
    this.sectionTodock = frame.sectionTodock;
    this.deferredCleanups = new Map(); // rebuilt as the restored section re-renders (task 88)
    this.state.restoreReturn(frame);  // pop history + restore position/vars/location (autosaves — now coherent)
    this.render();
  }

  // renderReturn / the <choices> table / individual <choice> buttons / appendChildrenList
  // moved to render-choices.js (task 119) — dispatched from TAG_RENDERERS and used by the
  // branch reveal (render-rolls.js).

  // ---- rolls + branches -----------------------------------------------------
  // The roll widgets (<difficulty>/<random>/<rankcheck>/<training>/<reroll>) and the
  // branch reveal moved to render-rolls.js (task 119) — plain functions dispatched
  // from TAG_RENDERERS; renderBranch is imported for the walk/choices call sites.

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

  // ---- forced-buy gating (task 136.5) --------------------------------------
  // Tag a rendered nav button as forced-buy-gated, for applyBuyGate.
  tagBuyNav(node, btn) {
    if (this.buyGate && this.buyGate.navNodes.has(node)) btn.dataset.buynav = '1';
  }

  // Disable the tagged onward navigation while a forced buy is still pending this pass
  // (renderInlineBuy set pendingBuy). Only ADDS a disable, so it composes with the other gates.
  applyBuyGate(flow) {
    if (!this.buyGate || !this.pendingBuy) return;
    flow.querySelectorAll('[data-buynav]').forEach((btn) => {
      if (btn.disabled) return; // already gated for another reason — keep it
      btn.disabled = true;
      btn.classList.add('gated');
      btn.title = 'Take the item above first.';
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

// The whole view is now one convention (task 119): every split module (render-rolls,
// render-rewards, render-choices, render-combat, render-market) exports plain functions
// taking the story as first argument, dispatched from TAG_RENDERERS — no prototype
// mixin. render.js keeps the section lifecycle, the core walk, conditionals and the
// fight/roll/transfer nav tagging; the rules live in the DOM-free modules these call.

// MARKET_TITLES / titleCase / diceWord / escapeHtml / itemLabel moved to render-util.js
// (task 119) so the responsibility-split view modules can share them without importing
// render.js (which would be a cycle).
