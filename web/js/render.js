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
  applyRest, buyResurrectionDeal, abilityChoiceOptions, readItemEffects,
} from './engine.js';
import { makeFight, fightRound, groupFightRound, isDefeated } from './combat.js';
import { shopKind, goodsFrom, ownsGoods, buyTrade, sellTrade, applyInlineBuy, sellInlineItem, sellCargo } from './market.js';
import { normalize, makeItem, parseTags, currencyAward, splitItemName, isShardsCurrency } from './state.js';
import { ABILITY_LABEL, CREW_LEVELS } from './rules.js';
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

export class Story {
  constructor(rootEl, state, opts) {
    this.root = rootEl;
    this.state = state;
    this.navigate = opts.navigate;         // (book, section) => void
    this.onDeath = opts.onDeath || (() => {});
    this.notify = opts.notify || (() => {});
    this.onRender = opts.onRender || (() => {}); // called after each (re)render
    this.ctx = null;
    this.sectionEl = null;
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
    this.ctx = { applied: new Set(), rolls: new Map(), fights: new Map(), buys: new Map(), groupLimits: new Map(), groupPicks: new Map(), wroteVars: new Set(), rolledVars: new Set() };
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
    // the books). Filled ones reflect how many times the box has been ticked.
    const nBoxes = parseInt(el.getAttribute('boxes') || '0', 10);
    this.state.setSectionBoxes(nBoxes); // cap this section's box ticks (task 27)
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
    let chainActive = false, chainDone = false; // if/elseif/else chain state

    nodes.forEach((node, idx) => {
      // A forced economic payment (see renderPayment) blocks the rest of the
      // section — nothing after it renders until the player resolves it. This
      // mirrors JaFL's forced-action model so an optional exit shown *before*
      // the payment (e.g. "turn back to 142") costs nothing.
      if (this.blocked) return;
      const path = basePath + '.' + idx;
      if (node.nodeType === Node.TEXT_NODE) {
        this.appendText(container, node.nodeValue);
        if (/\S/.test(node.nodeValue || '')) { chainActive = false; chainDone = false; }
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
          active = tag === 'else' ? true : evaluateCondition(node, this.state);
          chainDone = active;
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
      chainActive = false; chainDone = false;

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

    switch (tag) {
      case 'p': {
        const p = document.createElement('p');
        this.appendChildren(p, node, path);
        container.appendChild(p);
        return p;
      }
      case 'group':
        return this.renderGroup(container, node, path);
      case 'text':
      case 'desc': {
        // inline grouping wrapper
        const span = document.createElement('span');
        this.appendChildren(span, node, path);
        container.appendChild(span);
        return span;
      }
      case 'if':
      case 'elseif':
      case 'else':
        return this.renderIfChain(container, node, path);

      case 'goto':
        return this.renderGoto(container, node, path);
      case 'return':
        return this.renderReturn(container, node, path);
      case 'items':
        return this.renderItemsController(container, node, path);
      case 'item':
      case 'weapon':
      case 'armour':
      case 'tool':
        return this.renderItemAward(container, node, path);
      case 'choices':
        return this.renderChoices(container, node, path);
      case 'choice':
        return this.renderChoices(container, node.parentNode, path, node);
      case 'difficulty':
        return this.renderDifficulty(container, node, path);
      case 'random':
        return this.renderRandom(container, node, path);
      case 'rankcheck':
        return this.renderRankcheck(container, node, path);
      case 'training':
        return this.renderTraining(container, node, path);
      case 'fight':
        return this.renderFight(container, node, path);
      // <flee>/<fightdamage> describe a consequence that fires on an EVENT (the
      // player fleeing, or the enemy landing a blow), never on render. Show their
      // prose but render them inert — combat.js/the Flee button apply the effects.
      case 'flee':
      case 'fightdamage':
        return this.renderInert(container, node, path);
      case 'market':
        return this.renderMarket(container, node, path);
      case 'buy':
        return this.renderInlineBuy(container, node, path);
      case 'sell':
        return this.renderInlineSell(container, node, path);
      case 'rest':
        return this.renderRest(container, node, path);
      case 'moneycache':
        return this.renderMoneyCache(container, node, path);
      case 'itemcache':
        return this.renderItemCache(container, node, path);
      case 'transfer':
        return this.renderTransfer(container, node, path);
      case 'resurrection':
        return this.renderResurrection(container, node, path);
      case 'reroll': {
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
      case 'image':
        return this.renderImage(container, node, path);
      case 'table':
      case 'choices-table':
        return this.renderTable(container, node, path);

      default:
        if (PASSIVE_TAGS.has(tag)) return this.renderPassive(container, node, path);
        // Unknown element: render children so we don't lose prose.
        this.appendChildren(container, node, path);
        return null;
    }
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
    // A <rest> child heals on the group click (book6/628 "regain 1 Stamina point"):
    // applyRest headlessly, since the group renders as one button, not a rest widget.
    // Without this the daily inn group cleared its flag but never healed. (task 61)
    const restNodes = Array.from(node.querySelectorAll('rest'));
    // A group may also carry navigation (e.g. "cross off 30 Shards and turn to 99
    // in that book"): apply the effects and then follow the goto/return on click.
    const gotoNode = node.querySelector('goto');
    const returnNode = node.querySelector('return');
    if (!label || (!effects.length && !restNodes.length && !gotoNode && !returnNode)) {
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
        restNodes.forEach((r) => {
          const perUse = r.hasAttribute('stamina') ? r.getAttribute('stamina') : null;
          const cost = r.getAttribute('shards') ? resolveValue(this.state, r.getAttribute('shards')) : 0;
          applyRest(this.state, perUse, cost);
        });
        this.ctx.applied.add(key);
        if (gotoNode) {
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
        if (boolAttr(k.getAttribute('hidden'))) {
          this.renderElement(span, k, kp); // hidden book-keeping arms on entry (renderPassive)
        } else {
          deferred.push(k); // visible cost/consequence — apply on the roll
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
      if (span.textContent.trim()) container.appendChild(span);
    }
    return null;
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
    const QTY = ['multiple', 'shards', 'stamina', 'staminato', 'amount', 'count'];
    for (const a of QTY) {
      const v = node.getAttribute(a);
      if (v == null) continue;
      const s = String(v).trim();
      if (/^-?\d/.test(s) || isDiceExpr(s)) continue; // numeric literal or dice expr
      const bare = s.replace(/^[+-]/, '');            // a signed var ref ("-hang") → "hang" (task 50)
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
      if (currency != null) {
        this.state.adjustMoney(currency);
      } else {
        const { name, alts } = splitItemName(rawName);
        const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
        const ability = node.getAttribute('ability') || null;
        const tags = [...parseTags(node.getAttribute('tags')), ...alts];
        this.state.addItem(makeItem(tag, name, bonus, ability, tags, readItemEffects(node)));
      }
      this.state.setFlag(key, false);
      return '';
    }
    if (tag === 'resurrection') {
      buyResurrectionDeal(this.state, {
        book: node.getAttribute('book') ? Number(node.getAttribute('book')) : this.book,
        section: node.getAttribute('section'), text: node.getAttribute('text') || (node.textContent || '').trim(),
        god: node.getAttribute('god'), cost: 0,
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
    const primary = force == null || boolAttr(force, true); // default forced => primary continue

    // Disable a sail goto if the player has no ship here.
    const canSail = !isSail || this.state.ships.length > 0;
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
      this.navigate(targetBook, section);
    });
    this.tagFightNav(node, link);
    container.appendChild(link);
    return link;
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
    const taken = this.ctx.applied.has(key);
    // Grouped "choose up to N" award: consult the shared group tally so the extra
    // rows lock once the player has taken their allotment (book1/16, book4/218…).
    const group = node.getAttribute('group');
    const limit = group ? this.ctx.groupLimits.get(group) : null;
    const groupCount = group ? (this.ctx.groupPicks.get(group) || 0) : 0;
    const groupFull = limit != null && !taken && groupCount >= limit;
    const btn = document.createElement('button');
    btn.className = 'btn-mini take-item' + (taken ? ' done' : '');
    if (taken) {
      btn.disabled = true;
      btn.textContent = '☑ ' + display;
    } else if (groupFull) {
      btn.disabled = true;
      btn.textContent = display;
      btn.title = `You may choose only ${limit}`;
    } else if (currency == null && this.state.freeSlots() <= 0) {
      btn.disabled = true;
      btn.textContent = display;
      btn.title = 'No room (12-item carry limit)';
    } else {
      btn.textContent = 'Take ' + display;
      const tags = [...parseTags(node.getAttribute('tags')), ...alts];
      const effects = readItemEffects(node); // <effect> use/aura/wielded children (task 41)
      // A trapped treasure carries a <curse>/<disease>/<poison> child that only
      // bites once the item is taken (book5/238 stone bracelet → half MAGIC). (task 60)
      const afflictions = Array.from(node.querySelectorAll(':scope > curse, :scope > disease, :scope > poison'));
      btn.addEventListener('click', () => {
        if (currency != null) this.state.adjustMoney(currency); // stackable "N Shards" treasure
        else {
          this.state.addItem(makeItem(kind, name, bonus, ability, tags, effects));
          afflictions.forEach((aff) => applyEffect(aff, this.state));
        }
        this.ctx.applied.add(key);
        if (limit != null) this.ctx.groupPicks.set(group, groupCount + 1);
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

    // gating
    const reasons = [];
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
        if (pay && cost) { if (foreignCoin) this.state.adjustCurrency(currency, -cost); else this.state.adjustMoney(-cost); }
        if (pay && itemReq) { const it = this.state.findItems(itemReq)[0]; if (it) this.state.removeItemById(it.id); }
        if (section == null) return;
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
    if (stored) {
      const abLabel = (stored.ability || spec.split('|')[0] || '').toUpperCase();
      this.showDiceResult(widget, stored.dice, `${abLabel} ${stored.abilityScore >= 0 ? '+' : ''}${stored.abilityScore} = ${stored.total} vs ${level}`, stored.success ? 'Success' : 'Failure', stored.success);
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

    if (stored) {
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total}`, '', true);
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
    if (stored) {
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs Rank ${this.state.rankValue()}`, stored.success ? 'Success' : 'Failure', stored.success);
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
    if (stored) {
      const ab = stored.ability;
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs ${ab.toUpperCase()} ${stored.natural}`, stored.success ? `+1 ${ab.toUpperCase()}` : 'No gain', stored.success);
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
  // Returns { navNodes:Set, loseNodes:Set, hasLosePath } or null when no fight.
  computeFightGate(sectionEl) {
    if (!sectionEl || !sectionEl.querySelector('fight')) return null;
    const navNodes = new Set(), loseNodes = new Set();
    // Conservative: only clear "you lose / are beaten / reduced to 0" cues mark a
    // lose-branch. WIN cues merely veto a lose-mark (so "…dead. If you win…" stays
    // a win). Under-marking just falls back to normal death — never strands a win.
    const LOSE = /(you lose|if you lose|are beaten|are defeated|reduced to \d|pass out|knocked (out|unconscious)|battered into|lose the (fight|combat|battle)|you are killed|you are slain)/i;
    const WIN = /(you win|if you win|defeat|reduce the|kill the|slay|victor|survive|beat the|overcome the|are victorious)/i;
    let seenFight = false, recent = '';
    const walk = (n, skip) => {
      for (const ch of Array.from(n.childNodes)) {
        if (ch.nodeType === Node.TEXT_NODE) { if (seenFight) recent = (recent + ' ' + (ch.nodeValue || '')).slice(-220); continue; }
        if (ch.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = ch.tagName.toLowerCase();
        if (tag === 'fight') { seenFight = true; recent = ''; walk(ch, true); continue; }
        const childSkip = skip || tag === 'flee' || tag === 'fightdamage'; // Flee/fightdamage own gotos aren't gated
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
        walk(ch, childSkip);
      }
    };
    walk(sectionEl, false);
    if (!navNodes.size) return null;
    return { navNodes, loseNodes, hasLosePath: loseNodes.size > 0 };
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

    // Find the section's <fightdamage>/<flee> ANYWHERE (they may sit inside a <p>,
    // or even before the <fight> — book2/152/207/297/313 etc.), not just as a
    // forward same-level sibling.
    const dmgNode = this.findInSection('fightdamage');
    const fleeNode = this.findInSection('flee');

    const box = document.createElement('div');
    box.className = 'fight';
    container.appendChild(box);
    this.drawFight(box, fight, node, dmgNode, fleeNode, key, locked);
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
    you.innerHTML = `<span>Your Combat ${this.state.ability('combat')}</span><span>Your Defence ${this.state.defence()}</span><span>Your Stamina ${this.state.data.stamina}/${this.state.effectiveStaminaMax()}</span>`;
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
    box.appendChild(controls);
  }

  // The first element with `tag` anywhere in the current section (sections carry
  // at most one <flee>/<fightdamage>), regardless of nesting or order vs <fight>.
  findInSection(tag) {
    return this.sectionEl ? this.sectionEl.querySelector(tag) : null;
  }

  drawFight(box, fight, node, dmgNode, fleeNode, key, locked = false) {
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
    you.innerHTML = `<span>Your Combat ${this.state.ability('combat')}</span><span>Your Defence ${this.state.defence()}</span><span>Your Stamina ${this.state.data.stamina}/${this.state.effectiveStaminaMax()}</span>`;
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
      fightRound(this.state, fight, dmgNode);
      // Reduced to 0 Stamina: if the section has an "if you lose…" branch, that's
      // a (non-death) loss — route to it; otherwise it's death.
      if (this.state.isDead() && this.fightGate && this.fightGate.hasLosePath) fight.outcome = 'lose';
      // On any resolution (win/lose/fled) or death, re-render the whole section so
      // the fight gate re-evaluates which onward links are enabled.
      if (fight.outcome || this.state.isDead()) { this.rerender(); return; }
      this.drawFight(box, fight, node, dmgNode, fleeNode, key, false); // fight continues (never locked mid-fight)
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

    const actions = document.createElement('span');
    actions.className = 'trade-actions';
    if (buy != null) {
      const price = resolveValue(this.state, buy);
      const b = document.createElement('button');
      b.className = 'btn-mini';
      b.textContent = `Buy ${price}${coin}`;
      const noSlot = carryable && this.state.freeSlots() <= 0;
      b.disabled = balance < price || noSlot;
      b.title = balance < price ? `Not enough ${foreign ? currency : 'Shards'}` : (noSlot ? 'No room (12-item limit)' : '');
      b.addEventListener('click', () => {
        const res = buyTrade(this.state, goods, price, currency);
        if (!res.ok) { if (res.note) this.notify(res.note, 'warn'); return; }
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

    // Crew upgrade: one grade at a time (poor→average→good→excellent), so the
    // offer is usable only when your crew is exactly the grade below the target.
    if (crew) {
      const crewRank = (c) => CREW_LEVELS.indexOf(c);
      const ship = this.state.ships[0];
      const usable = !!ship && crewRank(ship.crew) === crewRank(crew) - 1;
      const btn = document.createElement('button');
      btn.className = 'btn-mini';
      const inner = document.createElement('span');
      this.appendChildren(inner, node, path);
      btn.textContent = inner.textContent.trim() || (price ? `Hire ${titleCase(crew)} crew (${price} Shards)` : `${titleCase(crew)} crew`);
      btn.disabled = (price > 0 && this.state.data.shards < price) || !usable;
      if (!usable) btn.title = ship ? `Your crew must be ${CREW_LEVELS[crewRank(crew) - 1] || '—'} first.` : 'You have no ship.';
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
    else if (kind === 'cargo' && this.state.ships.length === 0) reason = 'You need a ship to carry cargo.';
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
    const shipWithCargo = this.state.ships.find((s) => (s.cargo || []).length > 0);
    btn.disabled = !shipWithCargo;
    btn.title = shipWithCargo ? '' : 'You have no cargo to give.';
    btn.addEventListener('click', async () => {
      const ship = this.state.ships.find((s) => (s.cargo || []).length > 0);
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
    const span = document.createElement('span');
    this.appendChildren(span, node, path);
    const section = node.getAttribute('section');
    const shards = node.getAttribute('shards');
    if (section) {
      // an offer to buy a resurrection deal
      const cost = shards ? resolveValue(this.state, shards) : 0;
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.textContent = cost ? `Buy resurrection deal (${cost} Shards)` : 'Arrange resurrection';
      btn.disabled = cost > 0 && this.state.data.shards < cost;
      btn.addEventListener('click', () => {
        buyResurrectionDeal(this.state, {
          book: node.getAttribute('book') ? Number(node.getAttribute('book')) : this.book,
          section, text: node.getAttribute('text') || span.textContent.trim(), god: node.getAttribute('god'), cost,
        });
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
