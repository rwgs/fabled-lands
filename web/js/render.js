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
  whileLoopDone,
} from './engine.js';
import { makeFight, fightRound, groupFightRound, isDefeated, useWrathBlessing, useDefenceBlessing, rerollAttack } from './combat.js';
import { shopKind, goodsFrom, ownsGoods, buyTrade, sellTrade, applyInlineBuy, sellInlineItem, sellCargo, canUpgradeCrew, payChoiceCost } from './market.js';
import { normalize, makeItem, parseTags, currencyAward, splitItemName, isShardsCurrency } from './state.js';
import { ABILITY_LABEL } from './rules.js';
import { bookTitle, availableBooks } from './data.js';
import { animateDice, modal } from './ui.js';

const INLINE_STYLE = { b: 'strong', i: 'em', u: 'u', caps: 'span' };
const BRANCH_TAGS = new Set(['success', 'failure', 'outcomes']);
const ROLL_TAGS = new Set(['difficulty', 'random', 'rankcheck', 'training']);
// Note: <adjust> is deliberately NOT here. In this corpus it is always a die-roll
// MODIFIER (a child of <difficulty>/<random>/<rankcheck>, consumed by
// childAdjustment) — never a passive effect. Auto-applying it on view would
// silently upgrade the crew ("<adjust crew='good'>") or bump codeword counters.
const PASSIVE_TAGS = new Set(['lose', 'tick', 'gain', 'set', 'curse', 'disease', 'poison', 'adjustmoney']);
// Reward nodes a "choose one" purchase can offer (task 43 effect rewards + task 63
// item/resurrection rewards); the item-family subset is what makes a pure barter.
const ITEM_FAMILY_TAGS = new Set(['item', 'weapon', 'armour', 'tool']);
const CHOOSE_ONE_TAGS = new Set(['lose', 'tick', 'gain', 'item', 'weapon', 'armour', 'tool', 'resurrection']);

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
  sectionview:     'renderChildrenOnly',
};

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
      if (this.sectionTodock) {
        this.state.applyTodock(this.sectionTodock, this._sailExempt != null ? this._sailExempt : null);
        if (this._sailExempt == null) this.state.data.sailingShipId = null;
      }
      this._sailExempt = null;
      rawNavigate(book, section);
    };
    this.onDeath = opts.onDeath || (() => {});
    this.notify = opts.notify || (() => {});
    this.onRender = opts.onRender || (() => {}); // called after each (re)render
    this.ctx = null;
    this.sectionEl = null;
    this.sectionTodock = null;  // current section's todock= (task 81)
    this._sailExempt = null;    // ship id exempted from todock on a sail exit (task 81)
    // <while> loop iteration state (task 100), live only while renderWhile is walking
    // an iteration body: whether the current pass is still waiting on an interactive
    // roll, and which roll vars that pass has not yet resolved (so a re-rolled var is
    // treated as stale until this pass rolls it — see pendingRollVar).
    this.inWhileIter = false;
    this.whileIterPending = false;
    this.whileIterPendingVars = null;
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
    // Record the player's location from the section's dock= attribute and berth any
    // at-large ship here (it was sailed in); a section without dock= is inland/at sea,
    // so the location clears and no ship is "here" unless it is at large. (task 73)
    this.state.arriveAtDock(sectionEl.getAttribute('dock'));
    // Remember this section's todock= so the wrapped navigate applies it on leaving. (task 81)
    this.sectionTodock = sectionEl.getAttribute('todock') || null;
    this.ctx = { applied: new Set(), rolls: new Map(), fights: new Map(), buys: new Map(), groupLimits: new Map(), groupPicks: new Map(), wroteVars: new Set(), rolledVars: new Set(), pathNodes: new Map(), rollLockCaches: new Set(), forcedChosen: new Map(), awardCounts: new Map(), stock: new Map() };
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
    this.render();
  }

  rerender() { this.render(); }

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
    this.escapeCodewords = this.computeEscapeCodewords(el);
    // Fight gating: while an unresolved <fight> exists, the navigation that
    // follows it must not be clickable (else the player skips the fight). See
    // computeFightGate / applyFightGate.
    this.fightGate = this.computeFightGate(el);
    this.sectionFight = null; // aggregate proxy for the section's fight(s) (set in renderFight)
    this.sectionFights = []; // every sequential (non-group) fight drawn this pass, in order (task 45)
    this.renderedGroups = new Set(); // group= ids already drawn this pass (task 26)
    this.appendChildren(flow, el, 'r');
    this.applyFightGate(flow);
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
          chainDeferred = tag === 'if' && this.isDeferredDeadChain(node);
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
    btn.addEventListener('click', () => { if (roll) this.ctx.rolls.delete('roll@' + roll.path); this.rerender(); });
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
    // (e.g. "Difficulty 15 if you have climbing gear"), not a group effect.
    const effects = Array.from(node.querySelectorAll('lose, tick, gain, set, curse'));
    // A bundled item/weapon/armour/tool reward (the hidden quest prize in §1.228/509
    // gold chain mail, §4.189 Sun Goddess mirror): the group collapses to one button,
    // so the award can't render its own Take button — grant it headlessly on the
    // click via the normal award transaction (capacity-checked). (task 96)
    const itemNodes = Array.from(node.querySelectorAll('item, weapon, armour, tool'));
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
    if (!label || (!effects.length && !itemNodes.length && !restNodes.length && !gotoNode && !returnNode && !isRevival)) {
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
        itemNodes.forEach((n) => this.grantItemNode(n));
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
  // Goddess mirror). A "N Shards" reward banks its value; a possession is added when a
  // slot is free (the 12-item carry cap), and any <curse>/<disease>/<poison> child
  // bites on pickup. Mirrors renderItemAward's grant, minus the widget. (task 96)
  grantItemNode(node) {
    const kind = node.tagName.toLowerCase();
    const rawName = node.getAttribute('name') || (kind === 'weapon' ? 'weapon' : kind);
    const currency = kind === 'item' ? currencyAward(rawName) : null;
    if (currency != null) { this.state.adjustMoney(currency); return; }
    if (this.state.freeSlots() <= 0) return; // capacity handling: no room, no grant
    const { name, alts } = splitItemName(rawName);
    const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
    const ability = node.getAttribute('ability') || null;
    const tags = [...parseTags(node.getAttribute('tags')), ...alts];
    this.state.addItem(makeItem(kind, name, bonus, ability, tags, readItemEffects(node), node.getAttribute('group')));
    Array.from(node.querySelectorAll(':scope > curse, :scope > disease, :scope > poison')).forEach((aff) => applyEffect(aff, this.state));
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
    if (this.isDeferredEscapeClear(node)) {
      if (!hidden) {
        const span = document.createElement('span');
        span.className = 'fx';
        this.appendChildren(span, node, path);
        if (span.textContent.trim()) container.appendChild(span);
      }
      return null;
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
        if (!this.isRollGate(price) && rewards.length === 1) applyEffect(rewards[0], this.state, {});
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
      const outcome = this.aggregateFightOutcome(this.sectionFights);
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

  // Is this <lose> a "spend" the player commits to (Shards/item/cargo/ship), as
  // opposed to a narrative penalty (Stamina, codeword, blessing…)? Forced only —
  // an explicit force="f" loss, or a "*" catastrophe (lose all), is not gated.
  isEconomicPayment(node) {
    if (node.getAttribute('force') != null && !boolAttr(node.getAttribute('force'), true)) return false;
    const shards = node.getAttribute('shards');
    const item = node.getAttribute('item');
    const hasShards = shards != null && shards !== '*';
    const hasItem = item != null && item !== '*';
    const hasCargo = node.getAttribute('cargo') != null && node.getAttribute('cargo') !== '*';
    const hasShip = boolAttr(node.getAttribute('ship'));
    // Mixed with a narrative penalty (rare) → let it auto-apply, don't gate.
    if (node.getAttribute('stamina') != null || node.getAttribute('ability') != null) return false;
    return hasShards || hasItem || hasCargo || hasShip;
  }

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
    if (cost && this.state.data.shards < cost) {
      btn.disabled = true; btn.title = 'Not enough Shards';
    } else {
      btn.addEventListener('click', () => {
        applyEffect(node, this.state, {});
        this.ctx.applied.add(memo);
        this.rerender();
      });
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
    if (this.isChooseOne(key)) return this.renderChooseOnePay(container, node, path, key);
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
    if (done) {
      btn.disabled = true;
    } else if (this.ownsSoleLinkedBlessing(node, key)) {
      // "You can have only one X blessing at a time" — refuse the re-buy so the
      // Shards aren't spent for a blessing that addBlessing would just dedupe away.
      btn.disabled = true; btn.title = 'You already have this blessing';
    } else if (cost && this.state.data.shards < cost) {
      btn.disabled = true; btn.title = 'Not enough Shards';
    } else {
      btn.addEventListener('click', () => {
        applyEffect(node, this.state, {});
        rewards.forEach((r) => applyEffect(r, this.state, {}));
        if (!repeatable) this.ctx.applied.add(memo);
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // force="f" marks an OPTIONAL action (JaFL ActionNode defaults force=true); "f"/false
  // means the player may skip it (task 74).
  isOptionalForce(node) {
    const f = node.getAttribute('force');
    return f != null && !boolAttr(f);
  }

  // A stable "choose one" token for a force="f" node whose siblings are mutually
  // exclusive, else null (an independent optional action). A ship docks at ONE place,
  // so every force="f" <set dock=> in a section is one choice (book3/405); a "cross off
  // one of the following" is two+ force="f" <lose> under a single parent (book6/160).
  forcedChoiceGroup(node) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'set' && node.getAttribute('dock') != null) return 'dock';
    if (tag === 'lose' && node.parentElement) {
      const kin = Array.from(node.parentElement.children)
        .filter((c) => c.tagName.toLowerCase() === 'lose' && this.isOptionalForce(c));
      if (kin.length >= 2) return node.parentElement; // key the group by its shared parent node
    }
    return null;
  }

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

  // The reward nodes linked to a price/flag key: [flag="key"] elements in the
  // section (the cost carries price="key" instead). Empty/roll-gate keys → none.
  linkedRewards(key) {
    if (!this.sectionEl || key == null || key === '') return [];
    return Array.from(this.sectionEl.querySelectorAll(`[flag="${key}"]`));
  }

  // A repeatable "add one per payment" reward: a counter tick (<tick name="X"
  // count|amount=…>). The book idiom "for every 50 Shards you can add one" bumps a
  // named bonus counter, so paying again should add again (book4/93, book6/117/731).
  isCounterReward(node) {
    return node.tagName.toLowerCase() === 'tick'
      && !!node.getAttribute('name')
      && (node.getAttribute('count') != null || node.getAttribute('amount') != null);
  }

  // A "choose one" purchase: a price="key" cost with two or more linked rewards, so
  // one payment must grant only the picked one — never the whole list (book6/171,
  // book5/152, book6/690). The rewards may be effect nodes (tick/lose/gain) and/or a
  // heterogeneous mix that also includes an item/weapon/armour/tool award or a
  // resurrection deal (book1/597: amber wand | 500 Shards | resurrection). A *pure*
  // item-family set is left as a barter (book4/634 "give one, take one" — task 43
  // deliberately excludes it), so a heterogeneous reward (at least one non-item-family
  // node) is required before an item/resurrection award joins the choose-one path.
  isChooseOne(key) {
    const rewards = this.linkedRewards(key);
    if (rewards.length < 2) return false;
    if (!rewards.every((n) => CHOOSE_ONE_TAGS.has(n.tagName.toLowerCase()))) return false;
    return rewards.some((n) => !ITEM_FAMILY_TAGS.has(n.tagName.toLowerCase()));
  }

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

  // Is there a player-facing (non-hidden) cost for this choose-one key? A hidden
  // price arms the choice for free (an earned "choose your reward" — book1/597).
  hasVisiblePay(key) {
    if (!this.sectionEl || key == null || key === '') return false;
    return Array.from(this.sectionEl.querySelectorAll(`[price="${key}"]`)).some((n) => !boolAttr(n.getAttribute('hidden')));
  }

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

  // Why picking this reward would waste the payment (so the option is disabled): a
  // blessing you already hold, or a curse/disease/poison "lift" you aren't suffering.
  rewardWasteReason(node) {
    const tag = node.tagName.toLowerCase();
    // A resurrection deal is wasted if one is already arranged (book1/597: "if you
    // do not have one already"); an item award needs a free carry slot.
    if (tag === 'resurrection' && this.state.hasResurrection()) return 'You already have a resurrection deal.';
    if (ITEM_FAMILY_TAGS.has(tag)) {
      const rawName = node.getAttribute('name') || tag;
      const isCurrency = tag === 'item' && currencyAward(rawName) != null;
      if (!isCurrency && this.state.freeSlots() <= 0) return 'No room (12-item carry limit).';
    }
    const bl = node.getAttribute('blessing');
    if (bl && this.state.hasBlessing(bl)) return 'You already have this blessing.';
    if (tag === 'lose') {
      const c = node.getAttribute('curse');
      if (c != null && !this.state.hasCurse(c)) return "You don't have that curse.";
      const d = node.getAttribute('disease');
      if (d != null && !this.state.hasDisease(d)) return "You don't have that affliction.";
      const p = node.getAttribute('poison');
      if (p != null && !this.state.hasPoison(p)) return "You don't have that affliction.";
    }
    return null;
  }

  // True when a die roll in this section is gated behind the payment keyed `k`:
  // a <random|rankcheck|difficulty flag="k"> paired with a [price="k"] cost — the
  // "pay to spin" idiom (book2/157 wheel, book3/314 tavern, book5/674 physician,
  // book6/171/587 offerings, book6/50/628). (task 30)
  isRollGate(k) {
    return !!(k != null && this.sectionEl &&
      this.sectionEl.querySelector(`random[flag="${k}"], rankcheck[flag="${k}"], difficulty[flag="${k}"]`));
  }

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

  // The "only one at a time" blessing rule for a price/flag purchase: true when the
  // buy grants exactly one blessing and the player already holds it. Multi-blessing
  // "choose one" temples (e.g. §690: charisma/scouting/combat/magic on one flag) are
  // deliberately excluded — there the player buys a different ability each visit.
  ownsSoleLinkedBlessing(node, key) {
    const nodes = [node];
    if (this.sectionEl) nodes.push(...this.sectionEl.querySelectorAll(`[flag="${key}"]`));
    const blessings = new Set();
    nodes.forEach((el) => { const b = el.getAttribute && el.getAttribute('blessing'); if (b) blessings.add(b); });
    if (blessings.size !== 1) return false;
    return this.state.hasBlessing([...blessings][0]);
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

    link.addEventListener('click', () => {
      if (!bookAvailable) { this.notify(`“${bookTitle(targetBook)}” (Book ${targetBook}) isn’t included in this edition.`, 'warn'); return; }
      // A sail goto puts a ship "at large" before leaving; prompt when more than one
      // ship is at this dock, else sail the single one. (task 73)
      if (isSail) { this.sailThenGo(container, link, targetBook, section); return; }
      this.navigate(targetBook, section);
    });
    this.tagFightNav(node, link);
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

  // Navigate back to the section the player came from (the last history entry).
  goBack() {
    const hist = this.state.data.history || [];
    const prev = hist.length ? hist[hist.length - 1] : null;
    if (prev) this.navigate(Number(prev.book), prev.section);
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
        payChoiceCost(this.state, { pay, cost, currency, foreignCoin, item: itemReq }); // transaction lives in market.js (task 34)
        if (section == null) return;
        // Sail exit: same chooser/action as a sail goto (task 89).
        if (isSail) { this.sailThenGo(btn.parentElement || this.root, btn, targetBook, section); return; }
        this.navigate(targetBook, section);
      });
    }
    this.tagFightNav(node, btn);
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

  renderBranch(container, node, path, activeRoll) {
    const tag = node.tagName.toLowerCase();
    const roll = activeRoll ? this.ctx.rolls.get('roll@' + activeRoll.path) : null;

    if (tag === 'success' || tag === 'failure') {
      if (!this.branchResolved(node, roll)) return; // wait until the feeding roll / var write
      const want = tag === 'success';
      if (this.branchSuccess(node, roll) === want) this.revealBranch(container, node, path);
      return;
    }

    // A lone <outcome> (e.g. inside a <choices> table): reveal it when its
    // flag/range/var/codeword condition matches. flag= needs no roll (it's set by
    // a paid offering — book4/456); range/var need the roll (or var write) first.
    if (tag === 'outcome') {
      const flag = node.getAttribute('flag');
      let match;
      if (flag != null) match = this.state.getFlag(flag);
      else if (!this.branchResolved(node, roll)) return; // wait for the roll / var write
      else if (node.getAttribute('range') != null) match = matchRange(node.getAttribute('range'), node.getAttribute('var') ? this.state.getVar(node.getAttribute('var')) : roll.total);
      else if (node.getAttribute('codeword')) match = node.getAttribute('codeword').split(/[|,]/).some((w) => this.state.hasCodeword(w.trim()));
      else if (node.hasAttribute('var')) match = this.branchSuccess(node, roll);
      else match = true;
      if (match) this.revealBranch(container, node, path);
      return;
    }

    if (tag === 'outcomes') {
      const kids = Array.from(node.children);
      const branches = kids.filter((c) => /^(outcome|success|failure)$/.test(c.tagName.toLowerCase()));
      const choiceKids = kids.filter((c) => c.tagName.toLowerCase() === 'choice');

      // Reveal the single matching branch once it is resolved — a roll for plain/
      // range branches, or a written var (roll OR active <set>) for var-keyed ones,
      // so a set-sentinel outcome (book3/43 Chill → success) resolves with no roll
      // while an unwritten var stays pending (task 50).
      for (let i = 0; i < branches.length; i++) {
        const c = branches[i];
        if (!this.branchResolved(c, roll)) continue;
        const ctag = c.tagName.toLowerCase();
        let match = false;
        if (ctag === 'success') match = this.branchSuccess(c, roll) === true;
        else if (ctag === 'failure') match = this.branchSuccess(c, roll) === false;
        else {
          const range = c.getAttribute('range');
          const cw = c.getAttribute('codeword');
          const val = c.getAttribute('var') ? this.state.getVar(c.getAttribute('var')) : (roll ? roll.total : 0);
          if (range != null) match = matchRange(range, val);
          else if (cw) match = cw.split(/[|,]/).some((w) => this.state.hasCodeword(w.trim()));
          else match = true; // default
        }
        if (match) { this.revealBranch(container, c, path + '.o' + i); break; }
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
  // Identify the navigation that follows a <fight> and which of it is the
  // "if you lose…" branch. While the fight is unresolved these controls are
  // disabled; on a win the lose-branch is disabled; on a loss only it is enabled.
  // Also classifies each BARE post-fight <lose>/<gain> effect (one written in
  // win/lose prose rather than inside an <if dead>/<success>/<failure> wrapper) as
  // 'win'/'lose'/'uncond', so renderPassive can hold it until the fight resolves
  // instead of applying it on entry (task 69).
  // Returns { navNodes:Set, loseNodes:Set, effectNodes:Map, hasLosePath } or null.
  computeFightGate(sectionEl) {
    if (!sectionEl || !sectionEl.querySelector('fight')) return null;
    const navNodes = new Set(), loseNodes = new Set(), effectNodes = new Map();
    // Conservative: only clear "you lose / are beaten / reduced to 0" cues mark a
    // lose-branch. WIN cues merely veto a lose-mark (so "…dead. If you win…" stays
    // a win). Under-marking just falls back to normal death — never strands a win.
    const LOSE = /(you lose|if you lose|are beaten|are defeated|reduced to \d|pass out|knocked (out|unconscious)|battered into|lose the (fight|combat|battle)|you are killed|you are slain)/i;
    const WIN = /(you win|if you win|defeat|reduce the|kill the|slay|victor|survive|beat the|overcome the|are victorious)/i;
    // Wrappers that already gate their contents to a branch/action — an effect
    // inside one is not a "bare" post-fight effect (it applies via that branch).
    const WRAP = new Set(['if', 'elseif', 'else', 'success', 'failure', 'outcomes', 'group', 'choice']);
    let seenFight = false, recent = '';
    const walk = (n, skip, gated) => {
      for (const ch of Array.from(n.childNodes)) {
        if (ch.nodeType === Node.TEXT_NODE) { if (seenFight) recent = (recent + ' ' + (ch.nodeValue || '')).slice(-220); continue; }
        if (ch.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = ch.tagName.toLowerCase();
        if (tag === 'fight') { seenFight = true; recent = ''; walk(ch, true, gated); continue; }
        const childSkip = skip || tag === 'flee' || tag === 'fightdamage'; // Flee/fightdamage own gotos aren't gated
        const childGated = gated || WRAP.has(tag);
        // A <choice flee="t"> is "flee at any time" — never gate it (book3/662),
        // so the player can bail mid-fight. A box= choice keyed to a mid-fight escape
        // codeword (task 54) is likewise ungated: its own box check governs it, so it
        // is live only while the escape codeword is ticked (surrender/flee routes).
        const isFleeChoice = tag === 'choice' && boolAttr(ch.getAttribute('flee'));
        const isEscapeChoice = ch.getAttribute('box') != null && this.escapeCodewords.has(ch.getAttribute('box'));
        if (seenFight && !skip && !isFleeChoice && !isEscapeChoice && (tag === 'goto' || tag === 'choice' || tag === 'return')) {
          navNodes.add(ch);
          // An explicit dead="t" goto/choice IS the "you are killed" branch — prefer
          // that precise marker over the prose heuristic for the lose-branch (task 28).
          if (boolAttr(ch.getAttribute('dead')) || (LOSE.test(recent) && !WIN.test(recent))) loseNodes.add(ch);
          recent = '';
        }
        // A bare, non-hidden <lose>/<gain> after the fight is a fight-outcome effect.
        // (hidden="t" bookkeeping — e.g. task-54 escape clears — is left to its own
        // deferral.) Classify by the surrounding prose, defaulting to unconditional.
        if (seenFight && !skip && !gated && (tag === 'lose' || tag === 'gain') && !boolAttr(ch.getAttribute('hidden'))) {
          const role = LOSE.test(recent) && !WIN.test(recent) ? 'lose'
                     : WIN.test(recent) && !LOSE.test(recent) ? 'win'
                     : 'uncond';
          effectNodes.set(ch, role);
        }
        walk(ch, childSkip, childGated);
      }
    };
    walk(sectionEl, false, false);
    if (!navNodes.size && !effectNodes.size) return null;
    return { navNodes, loseNodes, effectNodes, hasLosePath: loseNodes.size > 0 };
  }

  // Mid-fight escape codewords (task 54): a codeword that is BOTH ticked somewhere in
  // this fight section (at the top as a "fight in progress" marker — book2/582,
  // book3/211 — or inside a flee <group>/<flee> — book2/442, book2/207) AND used as a
  // box= gate on a choice. That box= choice is the surrender/flee route, valid only
  // while the fight is live. Empty unless the section has a fight.
  computeEscapeCodewords(sectionEl) {
    if (!sectionEl || !sectionEl.querySelector('fight')) return new Set();
    const boxes = new Set();
    sectionEl.querySelectorAll('[box]').forEach((c) => { const b = c.getAttribute('box'); if (b) boxes.add(b); });
    if (!boxes.size) return new Set();
    const ticked = new Set();
    sectionEl.querySelectorAll('tick[codeword]').forEach((t) => {
      t.getAttribute('codeword').split(/[|,]/).forEach((c) => ticked.add(c.trim()));
    });
    return new Set([...boxes].filter((b) => ticked.has(b)));
  }

  // A fight-escape bracket's closing <lose codeword="X"> — one that sits AFTER the
  // fight and clears an escape codeword — must not fire while the fight is still
  // unresolved (or the player is fleeing): un-ticking the box now would revoke the
  // surrender/flee choice before it can be taken. Defer it until the fight is WON,
  // at which point the escape correctly closes. An entry-clear <lose codeword> before
  // the fight (book2/207/442) is left alone. (task 54)
  isDeferredEscapeClear(node) {
    if (node.tagName.toLowerCase() !== 'lose') return false;
    const cw = node.getAttribute('codeword');
    if (!cw || !this.escapeCodewords.size) return false;
    if (!cw.split(/[|,]/).some((c) => this.escapeCodewords.has(c.trim()))) return false;
    if (!this.sectionFights.length) return false; // before the fight → an entry clear, apply now
    return this.aggregateFightOutcome(this.sectionFights) !== 'win';
  }

  // A dead=-gated <if> chain positioned AFTER a fight is that fight's win/lose
  // outcome (book2/462 confiscate-return, book6/348's "if you win" reward, …).
  // Defer the whole chain until the fight is decided: while it is unresolved the
  // player is still alive, which would wrongly activate the "if you win" branch and
  // apply its rewards / confiscate-return before a blow is struck. Once the fight
  // resolves (win → alive; lose → dead), the normal dead= test is correct. (task 39)
  isDeferredDeadChain(node) {
    if (node.getAttribute('dead') == null) return false;   // only fight-outcome gates
    if (!this.sectionFights.length) return false;          // no fight before this node
    const outcome = this.aggregateFightOutcome(this.sectionFights);
    return outcome !== 'win' && outcome !== 'lose';        // still unresolved (or fled) → hold
  }

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

  // ---- fight ---------------------------------------------------------------
  // The aggregate outcome of a section's sequential fights (task 45): a section
  // is only WON once every fight is won; a LOSS on any fight (death deferred to
  // an "if you lose…" branch) makes the whole section a loss; a flee ends it;
  // otherwise it is still unresolved (null — the gate stays shut). This is what
  // applyFightGate and the death-deferral guard read, so dying to (or winning)
  // any fight but the last is tracked, not just the document-order last one.
  aggregateFightOutcome(fights) {
    if (!fights.length) return null;
    if (fights.some((f) => f.outcome === 'lose')) return 'lose';
    if (fights.some((f) => f.outcome === 'fled')) return 'fled';
    if (fights.every((f) => f.outcome === 'win')) return 'win';
    return null;
  }

  renderFight(container, node, path) {
    // group="G": all <fight> in the section sharing the id are one simultaneous
    // battle (task 26). Draw the whole group once, at its first member, and skip
    // the rest of the members this pass.
    const group = node.getAttribute('group');
    if (group) return this.renderGroupFight(container, node, group);

    const key = 'fight@' + path;
    let fight = this.ctx.fights.get(key);
    if (!fight) {
      fight = makeFight(node, this.state);
      this.ctx.fights.set(key, fight);
    }

    // Sequential multi-fight sections ("fight them one at a time" — book1/121
    // and ~17 others) resolve their fights in document order. This widget stays
    // LOCKED until every earlier fight is won, and all of the section's fights
    // feed one aggregate outcome (task 45). A fight drawn inside an untaken
    // branch (this.inactive) is display-only — never tracked, and never allowed
    // to hold the gate closed.
    let locked = false;
    if (!this.inactive) {
      locked = this.sectionFights.some((f) => f.outcome !== 'win');
      this.sectionFights.push(fight);
      const self = this;
      // A settable proxy: applyFightGate / the death guard read `outcome`, and a
      // flee="t" choice may assign it (render.js renderChoice) — an override wins
      // over the computed aggregate so that assignment doesn't throw on a getter.
      this.sectionFight = {
        _override: null,
        get name() {
          const pending = self.sectionFights.find((f) => f.outcome !== 'win');
          return (pending || fight).name;
        },
        get outcome() { return this._override || self.aggregateFightOutcome(self.sectionFights); },
        set outcome(v) { this._override = v; },
      };
    }

    // Find the section's <fightdamage>/<flee>/<fightround> ANYWHERE (they may sit
    // inside a <p>, or even before the <fight> — book2/152/207/297/313 etc.), not
    // just as a forward same-level sibling.
    const dmgNode = this.findInSection('fightdamage');
    const fleeNode = this.findInSection('flee');
    const roundNode = this.findInSection('fightround'); // between-round rules (task 99)

    const box = document.createElement('div');
    box.className = 'fight';
    container.appendChild(box);
    this.drawFight(box, fight, node, dmgNode, fleeNode, key, locked, roundNode);
    return box;
  }

  // A simultaneous group fight: the player strikes one enemy, then every living
  // enemy strikes back (§6.192/273/291/618). Rendered as a single combined widget.
  renderGroupFight(container, node, group) {
    if (this.renderedGroups.has(group)) return null; // already drawn at the first member
    this.renderedGroups.add(group);
    const members = Array.from(this.sectionEl.querySelectorAll('fight')).filter((f) => f.getAttribute('group') === group);
    const fights = members.map((m, i) => {
      const key = 'fightgrp@' + group + '.' + i;
      let f = this.ctx.fights.get(key);
      if (!f) { f = makeFight(m, this.state); this.ctx.fights.set(key, f); }
      return f;
    });
    const dmgNode = this.findInSection('fightdamage');
    const fleeNode = this.findInSection('flee');
    // A shared proxy drives the fight gate + death guard for the whole group: a
    // win once every foe is down; a (non-death) "lose" when the player is slain
    // and the section has an "if you lose…" branch; otherwise unresolved/death.
    // `outcome` is settable so a flee/surrender ('fled') can be recorded without
    // throwing on a getter — the override wins over the computed state (task 48).
    const self = this;
    this.sectionFight = {
      _override: null,
      name: fights.map((f) => f.name).join(', '),
      get outcome() {
        if (this._override) return this._override;
        if (fights.every((f) => isDefeated(f))) return 'win';
        if (self.state.isDead()) return (self.fightGate && self.fightGate.hasLosePath) ? 'lose' : null;
        return null;
      },
      set outcome(v) { this._override = v; },
    };
    const box = document.createElement('div');
    box.className = 'fight';
    container.appendChild(box);
    this.drawGroupFight(box, fights, dmgNode, group, fleeNode);
    return box;
  }

  drawGroupFight(box, fights, dmgNode, group, fleeNode = null) {
    box.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'fight-title';
    title.textContent = `⚔ ${fights.length} foes`;
    box.appendChild(title);

    fights.forEach((fight) => {
      const stats = document.createElement('div');
      stats.className = 'fight-stats' + (isDefeated(fight) ? ' defeated' : '');
      stats.innerHTML =
        `<span>${fight.name}</span><span>Combat ${fight.combat}</span><span>Defence ${fight.defence}</span>` +
        `<span class="en-stam">${isDefeated(fight) ? 'defeated' : `Stamina ${fight.stamina}/${fight.maxStamina}`}</span>`;
      box.appendChild(stats);
    });

    const you = document.createElement('div');
    you.className = 'fight-stats you';
    // Show the per-fight attack/Defence bonuses (special="attack"/"defence", Defence
    // through Faith — stored on the members, one encounter, task 91) so the displayed
    // values match what resolution uses (playerCombat / playerDefenceFor). (tasks 49, 83, 87)
    const shownCombat = this.state.ability('combat') + this.state.fightAttackBonus();
    const shownDef = this.state.defence() + this.state.fightDefenceBonus() + (fights[0] ? (fights[0].defenceBonus || 0) : 0);
    you.innerHTML = `<span>Your Combat ${shownCombat}</span><span>Your Defence ${shownDef}</span><span>Your Stamina ${this.state.data.stamina}/${this.state.effectiveStaminaMax()}</span>`;
    box.appendChild(you);

    const logEl = document.createElement('div');
    logEl.className = 'fight-log';
    const merged = fights.flatMap((f) => f.log).slice(-6);
    merged.forEach((l) => { const p = document.createElement('div'); p.textContent = l; logEl.appendChild(p); });
    box.appendChild(logEl);

    if (fights.every((f) => isDefeated(f))) {
      const b = document.createElement('div'); b.className = 'roll-outcome ok'; b.textContent = 'All foes are defeated!'; box.appendChild(b);
      return;
    }

    const controls = document.createElement('div');
    controls.className = 'fight-controls';
    // One Attack button PER still-standing foe: the player chooses their target
    // each round (§6.618 "against whichever opponent you choose"; §6.192 the
    // Combat-12 Third Spider can be saved for last) — task 48.
    const living = fights.filter((f) => !isDefeated(f));
    living.forEach((target) => {
      const attack = document.createElement('button');
      attack.className = 'btn-roll';
      attack.textContent = living.length > 1 ? `Attack ${target.name}` : 'Attack';
      attack.addEventListener('click', async () => {
        controls.querySelectorAll('button').forEach((b) => (b.disabled = true));
        await animateDice(box, true);
        groupFightRound(this.state, fights, dmgNode, target);
        // A <fightdamage> body's <goto> (a wound redirect) ends the combat by
        // navigation, exactly as in a single fight. (task 99)
        const redirected = fights.find((f) => f.roundGoto);
        if (redirected && !this.state.isDead()) {
          const g = redirected.roundGoto; fights.forEach((f) => { f.roundGoto = null; });
          this.navigate(g.book != null ? g.book : this.book, g.section);
          return;
        }
        // On any resolution (all foes down) or death, rerender so the gate (and the
        // death/lose guard, via the sectionFight proxy above) re-evaluates.
        if (fights.every((f) => isDefeated(f)) || this.state.isDead()) { this.rerender(); return; }
        this.drawGroupFight(box, fights, dmgNode, group, fleeNode); // fight continues
      });
      controls.appendChild(attack);
    });

    // A <flee> escape (e.g. §6.291 "flee back to your ship, →745"): apply the
    // flee body on click, mark the group fled, then follow the flee's goto.
    if (fleeNode) {
      const flee = document.createElement('button');
      flee.className = 'btn-secondary';
      flee.textContent = 'Flee';
      flee.addEventListener('click', () => {
        applyEffectBody(fleeNode, this.state);
        this.sectionFight.outcome = 'fled';
        if (this.state.isDead()) { this.rerender(); return; } // a fatal parting wound
        const fgoto = fleeNode.querySelector('goto');
        const fchoice = this.sectionEl && this.sectionEl.querySelector('choice[flee="t"][section]');
        if (fgoto && fgoto.getAttribute('section') != null) {
          this.navigate(fgoto.getAttribute('book') ? Number(fgoto.getAttribute('book')) : this.book, fgoto.getAttribute('section'));
        } else if (fchoice) {
          this.navigate(fchoice.getAttribute('book') ? Number(fchoice.getAttribute('book')) : this.book, fchoice.getAttribute('section'));
        } else {
          this.rerender();
        }
      });
      controls.appendChild(flee);
    }

    // COMBAT blessing (§4.324, task 91): retry the missed strike against the same
    // target — the foe struck last round carries the missed flag.
    const missed = fights.find((f) => f.lastStrikeMissed && !f.attackRerolled && !isDefeated(f));
    if (missed && this.state.hasBlessing('combat')) {
      const rr = document.createElement('button');
      rr.className = 'btn-secondary blessing-combat';
      rr.textContent = `Use COMBAT blessing (retry your attack${living.length > 1 ? ` on ${missed.name}` : ''})`;
      rr.addEventListener('click', () => {
        if (!rerollAttack(this.state, missed)) return;
        if (fights.every((f) => isDefeated(f)) || this.state.isDead()) { this.rerender(); return; }
        this.drawGroupFight(box, fights, dmgNode, group, fleeNode);
      });
      controls.appendChild(rr);
    }

    // Combat blessings in a group fight (task 83): usable once per COMBAT (the whole
    // group), only while unresolved and only when held. Divine Wrath needs a target,
    // so render one button per living foe; Defence through Faith is target-agnostic.
    // The once-per-combat guard lives on the group proxy (this.sectionFight), not
    // per-foe, and useWrathBlessing/useDefenceBlessing consume the blessing (task 80).
    if (this.state.hasBlessing('wrath') && !this.sectionFight.wrathUsed) {
      living.forEach((target) => {
        const w = document.createElement('button');
        w.className = 'btn-secondary blessing-combat';
        w.textContent = living.length > 1 ? `Divine Wrath on ${target.name} (1d)` : 'Use Divine Wrath (1d damage)';
        w.addEventListener('click', () => {
          const dmg = useWrathBlessing(this.state, target);
          this.sectionFight.wrathUsed = true; // once per combat, across every foe
          this.notify(`Divine Wrath strikes the ${target.name} for ${dmg}!`);
          if (fights.every((f) => isDefeated(f)) || this.state.isDead()) { this.rerender(); return; }
          this.drawGroupFight(box, fights, dmgNode, group, fleeNode);
        });
        controls.appendChild(w);
      });
    }
    // The proxy is rebuilt on a full rerender, so also gate on the members' stored
    // bonus — the durable once-per-combat mark. (task 91)
    if (this.state.hasBlessing('defence') && !this.sectionFight.defenceUsed && !fights.some((f) => f.defenceBonus)) {
      const d = document.createElement('button');
      d.className = 'btn-secondary blessing-combat';
      d.textContent = 'Use Defence through Faith (+3 Defence)';
      d.addEventListener('click', () => {
        // One encounter: the mark lives on the group proxy, the +3 on every member. (task 91)
        useDefenceBlessing(this.state, this.sectionFight, 3, fights);
        this.drawGroupFight(box, fights, dmgNode, group, fleeNode);
      });
      controls.appendChild(d);
    }
    box.appendChild(controls);
  }

  // The first element with `tag` anywhere in the current section (sections carry
  // at most one <flee>/<fightdamage>), regardless of nesting or order vs <fight>.
  findInSection(tag) {
    return this.sectionEl ? this.sectionEl.querySelector(tag) : null;
  }

  drawFight(box, fight, node, dmgNode, fleeNode, key, locked = false, roundNode = null) {
    box.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'fight-title';
    title.textContent = `⚔ ${fight.name}`;
    box.appendChild(title);

    const stats = document.createElement('div');
    stats.className = 'fight-stats';
    stats.innerHTML =
      `<span>Combat ${fight.combat}</span><span>Defence ${fight.defence}</span>` +
      `<span class="en-stam">Stamina ${fight.stamina}/${fight.maxStamina}</span>`;
    box.appendChild(stats);

    const you = document.createElement('div');
    you.className = 'fight-stats you';
    // Include any per-fight attack/Defence bonus (special="attack"/"defence", plus
    // Defence through Faith which lives on the fight itself — task 91) so the
    // displayed values match what combat resolution uses. (tasks 49, 80, 87)
    const shownCombat = this.state.ability('combat') + this.state.fightAttackBonus();
    const shownDef = this.state.defence() + this.state.fightDefenceBonus() + (fight.defenceBonus || 0);
    you.innerHTML = `<span>Your Combat ${shownCombat}</span><span>Your Defence ${shownDef}</span><span>Your Stamina ${this.state.data.stamina}/${this.state.effectiveStaminaMax()}</span>`;
    box.appendChild(you);

    const logEl = document.createElement('div');
    logEl.className = 'fight-log';
    fight.log.slice(-6).forEach((l) => { const p = document.createElement('div'); p.textContent = l; logEl.appendChild(p); });
    box.appendChild(logEl);

    if (fight.outcome === 'win') {
      const b = document.createElement('div'); b.className = 'roll-outcome ok'; b.textContent = `${fight.name} is defeated!`; box.appendChild(b);
      return;
    }
    if (fight.outcome === 'lose') {
      const b = document.createElement('div'); b.className = 'roll-outcome bad'; b.textContent = `You are defeated by the ${fight.name}.`; box.appendChild(b);
      return;
    }
    if (fight.outcome === 'fled') {
      const b = document.createElement('div'); b.className = 'roll-outcome'; b.textContent = 'You fled the fight.'; box.appendChild(b);
      return;
    }
    // Sequential lock: an earlier fight in this section is not yet won, so this
    // foe can't be engaged yet (task 45). Show the stats but no controls.
    if (locked) {
      const b = document.createElement('div'); b.className = 'roll-outcome'; b.textContent = 'Defeat the previous foe first.'; box.appendChild(b);
      return;
    }

    const controls = document.createElement('div');
    controls.className = 'fight-controls';
    const attack = document.createElement('button');
    attack.className = 'btn-roll';
    attack.textContent = 'Attack';
    attack.addEventListener('click', async () => {
      controls.querySelectorAll('button').forEach((b) => (b.disabled = true));
      await animateDice(box, true);
      fightRound(this.state, fight, dmgNode, roundNode);
      // A <fightround>/<fightdamage> body can end the fight by navigation — §5.689
      // "dragged you under" (→7), §4.238 "if you get wounded" (→184). (task 99)
      if (fight.roundGoto && !this.state.isDead()) {
        const g = fight.roundGoto; fight.roundGoto = null;
        this.navigate(g.book != null ? g.book : this.book, g.section);
        return;
      }
      // Reduced to 0 Stamina: if the section has an "if you lose…" branch, that's
      // a (non-death) loss — route to it; otherwise it's death.
      if (this.state.isDead() && this.fightGate && this.fightGate.hasLosePath) fight.outcome = 'lose';
      // On any resolution (win/lose/fled) or death, re-render the whole section so
      // the fight gate re-evaluates which onward links are enabled.
      if (fight.outcome || this.state.isDead()) { this.rerender(); return; }
      this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode); // fight continues (never locked mid-fight)
    });
    controls.appendChild(attack);

    if (fleeNode) {
      const flee = document.createElement('button');
      flee.className = 'btn-secondary';
      flee.textContent = 'Flee';
      flee.addEventListener('click', () => {
        // Apply the flee consequence NOW (the parting wound / "ran away" codeword)
        // — it lives in <flee> and must fire on the flee, never on render.
        applyEffectBody(fleeNode, this.state);
        fight.outcome = 'fled';
        if (this.state.isDead()) { this.rerender(); return; } // a fatal parting wound
        const fgoto = fleeNode.querySelector('goto');
        const fchoice = this.sectionEl && this.sectionEl.querySelector('choice[flee="t"][section]');
        if (fgoto && fgoto.getAttribute('section') != null) {
          this.navigate(fgoto.getAttribute('book') ? Number(fgoto.getAttribute('book')) : this.book, fgoto.getAttribute('section'));
        } else if (fchoice) {
          this.navigate(fchoice.getAttribute('book') ? Number(fchoice.getAttribute('book')) : this.book, fchoice.getAttribute('section'));
        } else {
          this.rerender(); // no target: the flee unlocks a box-gated choice (e.g. §207 → §22)
        }
      });
      controls.appendChild(flee);
    }

    // COMBAT blessing (§4.324, task 91): a MISSED strike may be retried once per
    // round — the player alone strikes again; the enemy's reply is never repeated.
    if (fight.lastStrikeMissed && !fight.attackRerolled && this.state.hasBlessing('combat')) {
      const rr = document.createElement('button');
      rr.className = 'btn-secondary blessing-combat';
      rr.textContent = 'Use COMBAT blessing (retry your attack)';
      rr.addEventListener('click', () => {
        if (!rerollAttack(this.state, fight)) return;
        if (fight.outcome || this.state.isDead()) { this.rerender(); return; }
        this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode);
      });
      controls.appendChild(rr);
    }

    // Combat blessings (task 80): usable once per fight while it is unresolved, and only
    // shown when the player actually holds the blessing (so a blessing-less character —
    // e.g. the every-section scan — never sees them). Divine Wrath deals 1d to the enemy
    // (and can fell it); Defence through Faith adds +3 to Defence for this fight. The
    // rules live in combat.js; the view only renders the button and the outcome.
    if (this.state.hasBlessing('wrath') && !fight.wrathUsed) {
      const w = document.createElement('button');
      w.className = 'btn-secondary blessing-combat';
      w.textContent = 'Use Divine Wrath (1d damage)';
      w.addEventListener('click', () => {
        const dmg = useWrathBlessing(this.state, fight);
        this.notify(`Divine Wrath strikes the ${fight.name} for ${dmg}!`);
        if (fight.outcome || this.state.isDead()) { this.rerender(); return; }
        this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode);
      });
      controls.appendChild(w);
    }
    if (this.state.hasBlessing('defence') && !fight.defenceUsed) {
      const d = document.createElement('button');
      d.className = 'btn-secondary blessing-combat';
      d.textContent = 'Use Defence through Faith (+3 Defence)';
      d.addEventListener('click', () => {
        useDefenceBlessing(this.state, fight);
        this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode);
      });
      controls.appendChild(d);
    }
    box.appendChild(controls);
  }

  // ---- market --------------------------------------------------------------
  // A <market> lists goods either as <trade> rows (ships/cargo) or as direct
  // <armour>/<weapon>/<tool>/<item>/<cargo> elements, split into groups by one
  // or more <header type="…"> dividers.
  renderMarket(container, node, path) {
    const box = document.createElement('div');
    box.className = 'market';
    // A currency="Mithral" market trades in a foreign coin, not Shards (book2/495) —
    // prices/buttons and the wallet check use that named pool (task 40).
    const currency = node.getAttribute('currency');
    // Market-level <sold item="?" tags="…"> hooks fire when a matching good is sold
    // (book3/318 marks a codeword when a free item is resold) — task 41.
    const marketSolds = Array.from(node.children).filter((c) => c.tagName.toLowerCase() === 'sold');
    let hasHeader = false;
    Array.from(node.children).forEach((child, i) => {
      const tag = child.tagName.toLowerCase();
      if (tag === 'header') {
        hasHeader = true;
        // Prefer the explicit header1= column title (book4/111 "Potions"/"Artifacts");
        // fall back to the type= keyword's label, then a generic heading (task 29).
        const h1 = child.getAttribute('header1');
        const title = (h1 && h1.trim()) || MARKET_TITLES[child.getAttribute('type')] || 'Goods for sale';
        const h = document.createElement('div');
        h.className = 'market-head';
        h.textContent = title;
        box.appendChild(h);
      } else if (tag === 'trade' || tag === 'armour' || tag === 'weapon' || tag === 'tool' || tag === 'item' || tag === 'cargo') {
        box.appendChild(this.renderShopRow(child, path + '.r' + i, currency, marketSolds));
      }
    });
    if (!hasHeader) {
      const h = document.createElement('div');
      h.className = 'market-head';
      h.textContent = 'Market';
      box.insertBefore(h, box.firstChild);
    }
    container.appendChild(box);
    return box;
  }

  renderShopRow(node, path, currency = null, marketSolds = []) {
    const kind = shopKind(node);
    const name = node.getAttribute('name') || node.getAttribute(kind) || node.getAttribute('item') || (kind === 'weapon' ? 'weapon' : kind);
    const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
    const ability = node.getAttribute('ability');
    const buy = node.getAttribute('buy');
    const sell = node.getAttribute('sell');
    const carryable = kind === 'weapon' || kind === 'armour' || kind === 'tool' || kind === 'item';
    const goods = goodsFrom(node, kind, name, bonus);
    goods.effects = readItemEffects(node); // carry any <effect> onto the bought item (task 41)
    // Foreign-currency market (Mithral): prices/wallet use that pool, not Shards (task 40).
    const foreign = !isShardsCurrency(currency);
    const coin = foreign ? ` ${currency}` : '';
    const balance = foreign ? this.state.currencyBalance(currency) : this.state.data.shards;

    const row = document.createElement('div');
    row.className = 'trade';
    const label = document.createElement('span');
    label.className = 'trade-name';
    let tag = '';
    if (kind === 'weapon') tag = ` (Combat +${bonus})`;
    else if (kind === 'armour') tag = ` (Defence +${bonus})`;
    else if (kind === 'tool' && ability) tag = ` (${titleCase(ability)} +${bonus})`;
    else if (bonus) tag = ` (+${bonus})`;
    label.textContent = titleCase(splitItemName(name).name) + tag; // show the first of a "a|b" label
    row.appendChild(label);

    // quantity= caps how many of this row are in stock this visit — §6.655's lone
    // salvaged barque is a one-off sale, not an unlimited shipyard, so it can be
    // bought only once per visit rather than repeatedly. (task 94) The per-visit
    // tally lives on ctx; a direct renderMarket() with no visit context (some tests)
    // simply has no cap.
    const stockAttr = node.getAttribute('quantity');
    const stockLimit = stockAttr != null ? resolveValue(this.state, stockAttr) : null;
    const bought = (this.ctx && this.ctx.stock.get(path)) || 0;
    const soldOut = stockLimit != null && bought >= stockLimit;

    const actions = document.createElement('span');
    actions.className = 'trade-actions';
    if (buy != null) {
      const price = resolveValue(this.state, buy);
      const b = document.createElement('button');
      b.className = 'btn-mini';
      b.textContent = soldOut ? 'Sold out' : `Buy ${price}${coin}`;
      const noSlot = carryable && this.state.freeSlots() <= 0;
      b.disabled = soldOut || balance < price || noSlot;
      b.title = soldOut ? 'None left' : (balance < price ? `Not enough ${foreign ? currency : 'Shards'}` : (noSlot ? 'No room (12-item limit)' : ''));
      b.addEventListener('click', () => {
        const res = buyTrade(this.state, goods, price, currency);
        if (!res.ok) { if (res.note) this.notify(res.note, 'warn'); return; }
        if (stockLimit != null && this.ctx) this.ctx.stock.set(path, bought + 1);
        this.rerender();
      });
      actions.appendChild(b);
    }
    if (sell != null) {
      const price = resolveValue(this.state, sell);
      const owned = ownsGoods(this.state, goods);
      const s = document.createElement('button');
      s.className = 'btn-mini';
      s.textContent = `Sell ${price}${coin}`;
      s.disabled = !owned;
      s.title = owned ? '' : 'You have none to sell';
      s.addEventListener('click', () => {
        const res = sellTrade(this.state, goods, price, currency);
        if (!res.ok) return;
        this.runSoldHooks(node, res.item, marketSolds); // <sold> side-effects, matched on the sold item (tasks 41, 58)
        this.rerender();
      });
      actions.appendChild(s);
    }
    if (buy == null && sell == null) {
      const na = document.createElement('span');
      na.className = 'trade-na';
      na.textContent = 'not available';
      actions.appendChild(na);
    }
    row.appendChild(actions);
    return row;
  }

  // Fire the <sold> side-effects when a good is sold: the row's own <sold> child
  // always fires (book3/86 pirate captain's head — it is the sale of that row), plus
  // any market-level <sold item="?" tags="…"> whose filter matches the possession
  // ACTUALLY SOLD — its own tags/name, not the shop row's descriptor. So selling a
  // starting leather jerkin at book3/318's generic "leather" row (buytags="318.free")
  // no longer fires 3.318.sold; only an item that carries the 318.free tag does. (tasks 41, 58)
  runSoldHooks(rowNode, soldItem, marketSolds) {
    const own = rowNode.querySelector(':scope > sold');
    if (own) applyEffectBody(own, this.state);
    (marketSolds || []).forEach((s) => { if (this.soldMatches(s, soldItem)) applyEffectBody(s, this.state); });
  }

  // Does a market-level <sold> filter (item="?"/name + tags=) match the sold
  // possession? A ship/cargo sale carries no possession, so it never matches.
  soldMatches(soldNode, soldItem) {
    if (!soldItem) return false;
    const item = soldNode.getAttribute('item');
    if (item && item !== '?' && item !== '*' && normalize(item) !== normalize(soldItem.name)) return false;
    const tags = parseTags(soldNode.getAttribute('tags'));
    const itemTags = soldItem.tags || [];
    return tags.every((t) => itemTags.some((g) => normalize(g) === normalize(t)));
  }

  // Inline <buy> in prose: a crew upgrade, a ship, a tool, a carried item, or a
  // cargo unit. Charges shards= and grants one unit; quantity= caps how many
  // times it can be bought per visit (each buy memoised so it can't repeat
  // forever). Ships/tools/items/cargo route through market.applyInlineBuy.
  renderInlineBuy(container, node, path) {
    const shards = node.getAttribute('shards');
    const price = shards != null ? resolveValue(this.state, shards) : 0;
    const crew = node.getAttribute('crew');
    const flag = node.getAttribute('flag');

    // A flag-linked buy is the *reward* side of a barter whose cost is a matching
    // [price=flag] <sell> elsewhere in the section (e.g. §538 "exchange a cargo
    // unit for minerals"). It's applied when that cost is taken, so here we only
    // show its words — the <sell> click adds the cargo (see applyLinkedCargoBuys).
    if (flag != null && this.sectionEl && this.sectionEl.querySelector(`[price="${flag}"]`)) {
      const span = document.createElement('span');
      span.className = 'fx';
      this.appendChildren(span, node, path);
      if (span.textContent.trim()) container.appendChild(span);
      return null;
    }

    // Crew upgrade: one grade at a time (poor→average→good→excellent). The rule
    // lives in market.canUpgradeCrew (task 34); the view just gates on its verdict.
    if (crew) {
      const up = canUpgradeCrew(this.state, crew);
      const btn = document.createElement('button');
      btn.className = 'btn-mini';
      const inner = document.createElement('span');
      this.appendChildren(inner, node, path);
      btn.textContent = inner.textContent.trim() || (price ? `Hire ${titleCase(crew)} crew (${price} Shards)` : `${titleCase(crew)} crew`);
      btn.disabled = (price > 0 && this.state.data.shards < price) || !up.ok;
      if (!up.ok) btn.title = up.reason;
      btn.addEventListener('click', () => {
        const res = applyInlineBuy(this.state, { price, crew });
        if (!res.ok) { if (res.note) this.notify(res.note, 'warn'); return; }
        this.rerender();
      });
      container.appendChild(btn);
      return btn;
    }

    // ship / tool / item / cargo — capped at quantity= buys per visit.
    const shipType = node.getAttribute('ship');
    const tool = node.getAttribute('tool');
    const item = node.getAttribute('item');
    const cargo = node.getAttribute('cargo');
    const quantity = node.getAttribute('quantity') ? Math.max(1, parseInt(node.getAttribute('quantity'), 10) || 1) : 1;
    const kind = shipType ? 'ship' : (cargo != null ? 'cargo' : (tool ? 'tool' : 'item'));
    const memo = 'buy@' + path;
    const bought = this.ctx.buys.get(memo) || 0;
    const done = bought >= quantity;

    // Label from the buy's own prose (direct text only, ignoring an <effect> child
    // — task 29), else a generated one; show the price and any remaining count.
    const directText = Array.from(node.childNodes).filter((c) => c.nodeType === Node.TEXT_NODE).map((c) => c.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
    const thing = directText || titleCase(tool || item || cargo || shipType || 'it');
    let label = price > 0 ? `Buy ${thing} (${price} Shards)` : `Take ${thing}`;
    if (quantity > 1) label += ` — ${Math.max(0, quantity - bought)} left`;

    const btn = document.createElement('button');
    btn.className = 'btn-mini' + (done ? ' done' : '');
    btn.textContent = (done ? '☑ ' : '') + label;

    let reason = '';
    if (done) reason = 'done';
    else if (price > 0 && this.state.data.shards < price) reason = 'Not enough Shards';
    else if ((kind === 'tool' || kind === 'item') && this.state.freeSlots() <= 0) reason = 'No room (12-item limit)';
    else if (kind === 'cargo' && this.state.shipsHere().length === 0) reason = 'You need a ship here to carry cargo.';
    btn.disabled = !!reason;
    if (reason && reason !== 'done') btn.title = reason;

    if (!reason) {
      btn.addEventListener('click', () => {
        const res = applyInlineBuy(this.state, {
          price, ship: shipType, shipName: node.getAttribute('name'), initialCrew: node.getAttribute('initialCrew'),
          tool, item, cargo,
          bonus: node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0,
          ability: node.getAttribute('ability'),
          tags: parseTags(node.getAttribute('buytags') || node.getAttribute('tags')),
          effects: readItemEffects(node), // <buy item="potion of strength"><effect .../></buy> (task 41)
        });
        if (!res.ok) { if (res.note) this.notify(res.note, 'warn'); return; }
        this.ctx.buys.set(memo, bought + 1);
        this.rerender();
      });
    }
    container.appendChild(btn);
    return btn;
  }

  // Inline <sell> in prose. Two forms:
  //  • item="X" shards="N" — sell a carried possession for Shards (book 5's rime
  //    ice / selenium ore income, the §30 treasure-map buy-back). Repeatable while
  //    you own one.
  //  • cargo="X" — give up a Cargo Unit for Shards, or (price="<flag>") barter it
  //    for the linked [flag] <buy> reward (§538). One-shot per visit.
  renderInlineSell(container, node, path) {
    const item = node.getAttribute('item');
    if (item != null) {
      const gain = node.getAttribute('shards') != null ? resolveValue(this.state, node.getAttribute('shards'))
        : (node.getAttribute('price') != null ? resolveValue(this.state, node.getAttribute('price')) : 0);
      const directText = Array.from(node.childNodes).filter((c) => c.nodeType === Node.TEXT_NODE).map((c) => c.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
      const owned = this.state.hasItem(item);
      const btn = document.createElement('button');
      btn.className = 'btn-mini';
      btn.textContent = gain ? `Sell ${titleCase(item)} (${gain} Shards)` : `Sell ${titleCase(item)}`;
      btn.disabled = !owned;
      btn.title = owned ? '' : `You have no ${item} to sell`;
      btn.addEventListener('click', () => { if (sellInlineItem(this.state, item, gain).ok) this.rerender(); });
      container.appendChild(btn);
      return btn;
    }

    const cargo = node.getAttribute('cargo');
    const priceAttr = node.getAttribute('price');
    const isFlag = priceAttr != null && !/^\d/.test(String(priceAttr).trim());
    const shardsGain = (priceAttr != null && !isFlag) ? resolveValue(this.state, priceAttr) : 0;
    const memo = 'sell@' + path;

    const inner = document.createElement('span');
    this.appendChildren(inner, node, path);
    const label = inner.textContent.trim() || (shardsGain ? `Sell for ${shardsGain} Shards` : 'Give a Cargo Unit');

    if (this.ctx.applied.has(memo)) {
      const span = document.createElement('span');
      span.className = 'fx paid';
      span.textContent = label;
      container.appendChild(span);
      return null;
    }
    if (cargo == null) { // no item= and no cargo= — nothing to transact; show prose
      const span = document.createElement('span');
      this.appendChildren(span, node, path);
      container.appendChild(span);
      return null;
    }

    const btn = document.createElement('button');
    btn.className = 'btn-mini';
    btn.textContent = label;
    // Only a hold that is HERE (with you at sea / berthed at this dock) can trade (task 89).
    const shipWithCargo = this.state.shipsHere().find((s) => (s.cargo || []).length > 0);
    btn.disabled = !shipWithCargo;
    btn.title = shipWithCargo ? '' : 'You have no cargo here to give.';
    btn.addEventListener('click', async () => {
      const ship = this.state.shipsHere().find((s) => (s.cargo || []).length > 0);
      if (!ship) return;
      let type = cargo;
      if (cargo === '?') { // give any one commodity — let the player choose which
        const kinds = [...new Set(ship.cargo)];
        type = kinds.length === 1 ? kinds[0]
          : await modal({ title: 'Give which cargo?', body: 'Choose a Cargo Unit to give up:', buttons: kinds.map((k) => ({ label: titleCase(k), value: k })) });
        if (!type) return; // cancelled
      }
      // The cargo→Shards transaction now lives in market.js (task 34); the barter
      // reward (adding the linked commodity) stays here as it's view-linked.
      if (!sellCargo(this.state, type, shardsGain).ok) return;
      if (isFlag) this.applyLinkedCargoBuys(priceAttr);
      this.ctx.applied.add(memo);
      this.rerender();
    });
    container.appendChild(btn);
    return btn;
  }

  // Apply the reward side of a barter: every [flag=key] <buy cargo> in the section
  // (the commodity received in exchange for the cargo just given up).
  applyLinkedCargoBuys(key) {
    this.sectionEl.querySelectorAll(`[flag="${key}"]`).forEach((b) => {
      if (b.tagName.toLowerCase() === 'buy' && b.getAttribute('cargo') != null) {
        buyTrade(this.state, { kind: 'cargo', cargoName: b.getAttribute('cargo'), name: b.getAttribute('cargo') }, 0);
      }
    });
  }

  // ---- rest ----------------------------------------------------------------
  renderRest(container, node, path) {
    // A <rest> with no stamina= restores Stamina to full ("heal all lost Stamina" —
    // safe houses, temples, healers); with stamina= it heals that fixed/dice amount.
    // Passing null (not a defaulted "1") tells applyRest to restore to full. (task 31)
    const hasAmt = node.hasAttribute('stamina');
    const perUse = hasAmt ? node.getAttribute('stamina') : null;
    const cost = node.getAttribute('shards') ? resolveValue(this.state, node.getAttribute('shards')) : 0;
    const box = document.createElement('span');
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    const healLabel = hasAmt ? `+${/d/i.test(perUse) ? perUse : parseInt(perUse, 10)} Stamina` : 'heal all Stamina';
    btn.textContent = cost ? `Rest (${healLabel}, ${cost} Shards)` : `Rest (${healLabel})`;
    const full = this.state.data.stamina >= this.state.effectiveStaminaMax();
    btn.disabled = full || (cost > 0 && this.state.data.shards < cost);
    if (full) btn.title = 'Already at full Stamina';
    btn.addEventListener('click', () => {
      applyRest(this.state, perUse, cost);
      this.rerender();
    });
    box.appendChild(btn);
    container.appendChild(box);
    return box;
  }

  // ---- caches: banks / investment boxes / villa strongrooms ----------------
  // A <moneycache> is a deposit/withdraw widget for a named money stash: a bank
  // account (MerchantBank), a guild investment box, or a gambling pot. Deposits
  // may be capped (max=) and constrained to multiples= of N; withdrawals may
  // levy a withdrawCharge= fee. The stashed sum persists across sections.
  renderMoneyCache(container, node, path) {
    const name = node.getAttribute('name');
    if (!name) return null;
    const text = node.getAttribute('text') || 'Money stashed';
    const max = node.getAttribute('max') ? parseInt(node.getAttribute('max'), 10) : 0;
    const mult = node.getAttribute('multiples') ? parseInt(node.getAttribute('multiples'), 10) : 1;
    const charge = node.getAttribute('withdrawCharge') ? parseFloat(node.getAttribute('withdrawCharge')) : 0;

    const box = document.createElement('div');
    box.className = 'cache money-cache';
    const bal = document.createElement('div');
    bal.className = 'cache-balance';
    bal.innerHTML = `<span class="cache-label">${escapeHtml(text)}</span><span class="cache-sum">${this.state.cacheMoney(name)} Shards</span>`;
    box.appendChild(bal);

    const controls = document.createElement('div');
    controls.className = 'cache-controls';
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.step = String(mult > 0 ? mult : 1);
    input.value = String(mult > 0 ? mult : 1);
    input.className = 'cache-amount';
    controls.appendChild(input);

    const roundMult = (n) => (mult > 1 ? Math.floor(n / mult) * mult : Math.floor(n));
    const dep = document.createElement('button');
    dep.className = 'btn-mini';
    dep.textContent = 'Deposit';
    dep.addEventListener('click', () => {
      let amt = roundMult(Number(input.value) || 0);
      if (max > 0) amt = Math.min(amt, max - this.state.cacheMoney(name)); // max caps the stash total
      amt = Math.min(amt, this.state.data.shards);
      if (amt > 0) { this.state.depositCacheMoney(name, amt); this.rerender(); }
    });
    const wd = document.createElement('button');
    wd.className = 'btn-mini';
    wd.textContent = charge ? `Withdraw (−${Math.round(charge * 100)}%)` : 'Withdraw';
    wd.addEventListener('click', () => {
      const amt = roundMult(Number(input.value) || 0);
      if (amt > 0 && this.state.cacheMoney(name) > 0) { this.state.withdrawCacheMoney(name, amt, charge); this.rerender(); }
    });
    controls.appendChild(dep); controls.appendChild(wd);
    // A gambling bet locks once rolled (task 38): disable the controls so it can't
    // be changed after the dice. Only caches whose lock is bundled with a roll are
    // gated this way — a stash cache stays freely editable.
    if (this.ctx.rollLockCaches.has(name) && this.state.isCacheLocked(name)) {
      input.disabled = true; dep.disabled = true; wd.disabled = true;
      dep.title = wd.title = 'Your bet is locked in — you can’t change it now.';
      box.classList.add('locked');
    }
    box.appendChild(controls);
    container.appendChild(box);
    return box;
  }

  // An <itemcache> is a strongroom: possessions left here persist across visits.
  // Lists what's stored (with Take-back buttons) and lets the player deposit a
  // carried item (respecting an optional itemlimit= on the stash and the 12-item
  // carry cap on retrieval).
  renderItemCache(container, node, path) {
    const name = node.getAttribute('name');
    if (!name) return null;
    const text = node.getAttribute('text') || 'Stored here';
    const limit = node.getAttribute('itemlimit') ? parseInt(node.getAttribute('itemlimit'), 10) : 0;
    const stored = this.state.cacheItems(name);

    const box = document.createElement('div');
    box.className = 'cache item-cache';
    const head = document.createElement('div');
    head.className = 'cache-label';
    head.textContent = text;
    box.appendChild(head);

    const list = document.createElement('div');
    list.className = 'cache-list';
    if (!stored.length) {
      const e = document.createElement('span');
      e.className = 'cache-empty';
      e.textContent = '(nothing stored)';
      list.appendChild(e);
    }
    stored.slice().forEach((it) => {
      const row = document.createElement('div');
      row.className = 'cache-item';
      row.appendChild(document.createTextNode(itemLabel(it)));
      const take = document.createElement('button');
      take.className = 'btn-mini';
      take.textContent = 'Take';
      const noRoom = this.state.freeSlots() <= 0;
      take.disabled = noRoom;
      if (noRoom) take.title = 'No room (12-item carry limit)';
      take.addEventListener('click', () => {
        const removed = this.state.cacheRemoveItem(name, it.id);
        if (removed) this.state.addItem(removed);
        this.rerender();
      });
      row.appendChild(take);
      list.appendChild(row);
    });
    box.appendChild(list);

    // Deposit a carried possession (unless the stash is at its item limit).
    const atLimit = limit > 0 && stored.length >= limit;
    const carried = this.state.data.items;
    if (carried.length && !atLimit) {
      const dep = document.createElement('div');
      dep.className = 'cache-deposit';
      carried.slice().forEach((it) => {
        const store = document.createElement('button');
        store.className = 'btn-mini';
        store.textContent = 'Store ' + itemLabel(it);
        store.addEventListener('click', () => {
          const removed = this.state.removeItemById(it.id);
          if (removed) this.state.cacheAddItem(name, removed);
          this.rerender();
        });
        dep.appendChild(store);
      });
      box.appendChild(dep);
    }
    container.appendChild(box);
    return box;
  }

  // <transfer> — move money/equipment between the Adventure Sheet and a named
  // cache. A forced transfer (default) applies once on view (confiscate-and-return
  // scenes, hidden="t"); an optional one (force="f") becomes a click-to-apply
  // button so the player opts in to stashing.
  renderTransfer(container, node, path) {
    const hidden = boolAttr(node.getAttribute('hidden'));
    const optional = node.getAttribute('force') != null && !boolAttr(node.getAttribute('force'), true);
    const memo = 'xfer@' + path;

    // Inside an untaken conditional branch: show the words, apply nothing.
    if (this.inactive) {
      if (!hidden) { const s = document.createElement('span'); s.className = 'fx'; this.appendChildren(s, node, path); if (s.textContent.trim()) container.appendChild(s); }
      return null;
    }

    if (optional) {
      const done = this.ctx.applied.has(memo);
      const inner = document.createElement('span');
      this.appendChildren(inner, node, path);
      const btn = document.createElement('button');
      btn.className = 'btn-mini' + (done ? ' done' : '');
      btn.textContent = (done ? '☑ ' : '') + (inner.textContent.trim() || 'Stash it');
      btn.disabled = done;
      if (!done) btn.addEventListener('click', () => { applyEffect(node, this.state, {}); this.ctx.applied.add(memo); this.rerender(); });
      container.appendChild(btn);
      return btn;
    }

    if (!this.ctx.applied.has(memo)) { this.ctx.applied.add(memo); applyEffect(node, this.state, {}); }
    if (!hidden) { const s = document.createElement('span'); s.className = 'fx'; this.appendChildren(s, node, path); if (s.textContent.trim()) container.appendChild(s); }
    return null;
  }

  // ---- resurrection --------------------------------------------------------
  renderResurrection(container, node, path) {
    // A flag-linked resurrection inside a "choose one" reward menu renders as a
    // pick (book1/597: taking it consumes the single choice). (task 63)
    const resFlag = node.getAttribute('flag');
    if (resFlag != null && this.isChooseOne(resFlag)) return this.renderChoosableReward(container, node, path, resFlag);
    const section = node.getAttribute('section');
    const shards = node.getAttribute('shards');
    const supplemental = boolAttr(node.getAttribute('supplemental'));
    const hidden = boolAttr(node.getAttribute('hidden'));
    const arrange = () => buyResurrectionDeal(this.state, {
      book: node.getAttribute('book') ? Number(node.getAttribute('book')) : this.book,
      section, text: node.getAttribute('text') || (node.textContent || '').trim(), god: node.getAttribute('god'),
      cost: shards ? resolveValue(this.state, shards) : 0, supplemental,
    });
    const memo = 'res@' + path;
    // A resurrection with book+section ARRANGES/registers a deal; one with no section
    // is a "use your deal" trigger that lives inside a death-revival <group>
    // (renderGroup) — here it is just narrative prose. (task 98)
    if (section && hidden) {
      // hidden="t" registers the deal automatically on entry, exactly once (§3.351's
      // Island of Rebirth re-arms the deal each visit while its boxes remain) — no
      // manual button, no repeated registration.
      if (!this.inactive && !this.ctx.applied.has(memo)) { this.ctx.applied.add(memo); arrange(); }
      return null;
    }
    const span = document.createElement('span');
    this.appendChildren(span, node, path);
    if (section && !this.inactive) {
      // A visible offer to buy/arrange a deal — armed once per visit so it cannot be
      // clicked repeatedly to stockpile duplicate lives (task 98).
      const cost = shards ? resolveValue(this.state, shards) : 0;
      const done = this.ctx.applied.has(memo);
      const btn = document.createElement('button');
      btn.className = 'btn-secondary' + (done ? ' done' : '');
      btn.textContent = done ? '☑ Resurrection arranged' : (cost ? `Buy resurrection deal (${cost} Shards)` : 'Arrange resurrection');
      btn.disabled = done || (cost > 0 && this.state.data.shards < cost);
      if (!done) btn.addEventListener('click', () => {
        arrange();
        this.ctx.applied.add(memo);
        this.notify('Resurrection deal arranged.');
        this.rerender();
      });
      span.appendChild(document.createTextNode(' '));
      span.appendChild(btn);
    }
    container.appendChild(span);
    return span;
  }

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

const MARKET_TITLES = {
  ship: 'Ships for sale', shipsale: 'Sell a ship', cargo: 'Cargo', armour: 'Armour',
  weapon: 'Weapons', magic: 'Magical equipment', other: 'Goods for sale',
};
function titleCase(s) { return (s || '').replace(/\b\w/g, (c) => c.toUpperCase()); }
function diceWord(n) { return n === 1 ? '1 die' : `${n} dice`; }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// A short display label for a stored item (name + its bonus tier, like an award).
function itemLabel(it) {
  const name = titleCase(it.name || it.kind || 'item');
  if (it.kind === 'weapon' && it.bonus) return `${name} (Combat +${it.bonus})`;
  if (it.kind === 'armour' && it.bonus) return `${name} (Defence +${it.bonus})`;
  if (it.kind === 'tool' && it.bonus && it.ability) return `${name} (${titleCase(it.ability)} +${it.bonus})`;
  return it.bonus ? `${name} (+${it.bonus})` : name;
}
