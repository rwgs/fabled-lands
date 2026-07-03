// render.js — renders a parsed <section> tree into interactive DOM.
//
// Model: the whole section is re-rendered on every state change. Passive
// effects and roll results are memoized per-visit by a stable node path, so:
//   * passive effects apply exactly once per visit,
//   * conditionals re-evaluate against live state after each roll,
//   * revealed branches only appear (and only apply their effects) once resolved.

import {
  evaluateCondition, applyEffect, boolAttr, resolveValue, isDiceExpr,
  rollDifficulty, rollRankCheck, rollTraining, rollDice, matchRange, childAdjustment,
  applyRest, buyResurrectionDeal,
} from './engine.js';
import { makeFight, fightRound } from './combat.js';
import { shopKind, goodsFrom, ownsGoods, buyTrade, sellTrade, applyInlineBuy } from './market.js';
import { normalize, makeItem } from './state.js';
import { bookTitle, availableBooks } from './data.js';
import { animateDice, modal } from './ui.js';

const INLINE_STYLE = { b: 'strong', i: 'em', u: 'u', caps: 'span' };
const BRANCH_TAGS = new Set(['success', 'failure', 'outcomes']);
const ROLL_TAGS = new Set(['difficulty', 'random', 'rankcheck', 'training']);
// Note: <adjust> is deliberately NOT here. In this corpus it is always a die-roll
// MODIFIER (a child of <difficulty>/<random>/<rankcheck>, consumed by
// childAdjustment) — never a passive effect. Auto-applying it on view would
// silently upgrade the crew ("<adjust crew='good'>") or bump codeword counters.
const PASSIVE_TAGS = new Set(['lose', 'tick', 'gain', 'set', 'curse']);

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
    this.ctx = { applied: new Set(), rolls: new Map(), fights: new Map() };
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
    this.appendChildren(flow, el, 'r');
    this.root.appendChild(flow);

    // Dead-end fallback: a fully-resolved section offering no way forward is a
    // narrative death (the original game exposed an "Extra Choice: Death" for this).
    // Controls inside an untaken (grayed) branch don't count — they're disabled.
    const controls = Array.from(flow.querySelectorAll('.goto, .choice, .btn-roll, .btn-secondary, .btn-mini, .fight, .group-action, .pay-action'))
      .filter((c) => !c.closest('.cond-inactive'));
    if (!controls.length && !this.state.isDead()) {
      const end = document.createElement('button');
      end.className = 'goto goto-primary end-fate';
      end.textContent = 'Your tale ends here — accept your fate ▸';
      end.addEventListener('click', () => this.onDeath());
      flow.appendChild(end);
    }

    this.onRender();
    if (this.state.isDead()) this.onDeath();
  }

  makeIllustration(name) {
    const fig = document.createElement('figure');
    fig.className = 'illus';
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = 'assets/illus/' + name;
    img.onerror = () => fig.remove();
    fig.appendChild(img);
    return fig;
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
      // An inactive branch's roll must not become the section's active roll.
      if (ROLL_TAGS.has(tag) && !this.inactive) this.activeRoll = { node, path };
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
      case 'market':
        return this.renderMarket(container, node, path);
      case 'buy':
        return this.renderInlineBuy(container, node, path);
      case 'sell':
        return this.renderInlineSell(container, node, path);
      case 'rest':
        return this.renderRest(container, node, path);
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
        container.appendChild(this.makeIllustration(node.getAttribute('src') || node.getAttribute('name') || ''));
        return null;
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
    const label = (node.textContent || '').replace(/\s+/g, ' ').trim();
    // <adjust> is excluded: inside a group it is a modifier for a nested roll
    // (e.g. "Difficulty 15 if you have climbing gear"), not a group effect.
    const effects = Array.from(node.querySelectorAll('lose, tick, gain, set, curse'));
    // A group may also carry navigation (e.g. "cross off 30 Shards and turn to 99
    // in that book"): apply the effects and then follow the goto/return on click.
    const gotoNode = node.querySelector('goto');
    const returnNode = node.querySelector('return');
    if (!label || (!effects.length && !gotoNode && !returnNode)) {
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

    const price = node.getAttribute('price');
    const flag = node.getAttribute('flag');

    // JaFL "price/flag" optional purchase: a node with price="k" is a click-to-pay
    // cost; nodes with flag="k" are its linked rewards. These must NOT auto-apply —
    // the player opts in by clicking the cost, which also applies the linked rewards.
    if (price != null) return this.renderOptionalPay(container, node, path, price);
    if (flag != null && this.sectionEl && this.sectionEl.querySelector(`[price="${flag}"]`)) {
      if (!hidden) { // dependent reward: show its words; effect applies with the linked cost
        const span = document.createElement('span');
        span.className = 'fx';
        this.appendChildren(span, node, path);
        if (span.textContent.trim()) container.appendChild(span);
      }
      return null;
    }

    // Economic payment (Shards/item/cargo/ship) in a section with an escape route:
    // follows JaFL's forced-action model — click-to-apply, and blocks the rest of
    // the section until resolved, so the optional exit shown before it (e.g. "turn
    // back to 142") costs nothing. Narrative losses (Stamina, codewords, blessings…)
    // and unavoidable payments fall through and auto-apply.
    if (tag === 'lose' && !hidden && this.hasDecline && this.isEconomicPayment(node)) {
      return this.renderPayment(container, node, path);
    }

    const key = 'fx@' + path;
    // An absolute <set value="…"> is a pure function of current state, so it is
    // re-evaluated on every render — this keeps variables derived from a roll
    // result correct after that roll resolves (rather than frozen at first render).
    const rerunnable = tag === 'set' && node.hasAttribute('value') && !node.hasAttribute('modifier');
    if (rerunnable || !this.ctx.applied.has(key)) {
      if (!rerunnable) this.ctx.applied.add(key);
      const note = applyEffect(node, this.state, { chooser: null });
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
      if (this.state.hasVar(s)) continue;             // already set (e.g. by an earlier <set>)
      if (this.sectionEl && this.sectionEl.querySelector(`random[var="${s}"], rankcheck[var="${s}"], difficulty[var="${s}"]`)) return s;
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
  // button; clicking applies it plus every linked reward (flag == this price key), once.
  renderOptionalPay(container, node, path, key) {
    const memo = 'pay@' + path;
    const done = this.ctx.applied.has(memo);
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
        this.sectionEl.querySelectorAll(`[flag="${key}"]`).forEach((r) => applyEffect(r, this.state, {}));
        this.ctx.applied.add(memo);
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

    link.addEventListener('click', () => {
      if (!bookAvailable) { this.notify(`“${bookTitle(targetBook)}” (Book ${targetBook}) isn’t included in this edition.`, 'warn'); return; }
      this.navigate(targetBook, section);
    });
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
    container.appendChild(link);
    return link;
  }

  // A standalone item/weapon/armour/tool award in prose (e.g. "Catch a smoulder
  // fish. Note it on your Adventure Sheet."). Shows the item and lets you take it
  // once, respecting the 12-item carry limit.
  renderItemAward(container, node, path) {
    const kind = node.tagName.toLowerCase();
    const name = node.getAttribute('name') || (kind === 'weapon' ? 'weapon' : kind);
    const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
    const ability = node.getAttribute('ability') || null;
    let tag = '';
    if (kind === 'weapon') tag = ` (Combat +${bonus})`;
    else if (kind === 'armour') tag = ` (Defence +${bonus})`;
    else if (kind === 'tool' && ability) tag = ` (${titleCase(ability)} +${bonus})`;
    else if (bonus) tag = ` (+${bonus})`;
    const display = titleCase(name) + tag;
    const key = 'take@' + path;
    const taken = this.ctx.applied.has(key);
    const btn = document.createElement('button');
    btn.className = 'btn-mini take-item' + (taken ? ' done' : '');
    if (taken) {
      btn.disabled = true;
      btn.textContent = '☑ ' + display;
    } else if (this.state.freeSlots() <= 0) {
      btn.disabled = true;
      btn.textContent = display;
      btn.title = 'No room (12-item carry limit)';
    } else {
      btn.textContent = 'Take ' + display;
      btn.addEventListener('click', () => {
        this.state.addItem(makeItem(kind, name, bonus, ability));
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
    const kids = explicitKids || (only ? [only] : Array.from(choicesNode.children).filter((c) => c.tagName.toLowerCase() === 'choice'));
    kids.forEach((choice, i) => {
      wrap.appendChild(this.renderChoice(choice, path + '.c' + i));
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
    const pay = node.getAttribute('shards') != null && !(node.getAttribute('pay') != null && !boolAttr(node.getAttribute('pay')));
    const itemReq = node.getAttribute('item');
    const boxWord = node.getAttribute('box');
    const profession = node.getAttribute('profession');
    const god = node.getAttribute('god');
    const emptyvar = node.getAttribute('emptyvar');
    const bookNum = node.getAttribute('book');

    // gating
    const reasons = [];
    const cost = shards != null ? resolveValue(this.state, shards) : 0;
    if (shards != null && this.state.data.shards < cost) reasons.push(`needs ${cost} Shards`);
    if (itemReq && !this.state.hasItem(itemReq)) reasons.push(`needs ${itemReq}`);
    if (boxWord && !this.state.hasCodeword(boxWord)) reasons.push('box not ticked');
    if (profession && normalize(profession) !== normalize(this.state.data.profession)) reasons.push(profession + ' only');
    if (god && !this.state.hasGod(god)) reasons.push('requires ' + god);
    if (emptyvar && this.state.hasVar(emptyvar)) reasons.push('unavailable');
    if (bookNum && !availableBooks().includes(Number(bookNum))) reasons.push('book not in edition');

    if (cost) {
      const tag = document.createElement('span');
      tag.className = 'choice-cost';
      tag.textContent = `${cost} Shards`;
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
        if (pay && cost) this.state.adjustMoney(-cost);
        if (pay && itemReq) { const it = this.state.findItems(itemReq)[0]; if (it) this.state.removeItemById(it.id); }
        if (section == null) return;
        this.navigate(targetBook, section);
      });
    }
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
    const ability = node.getAttribute('ability');
    const level = resolveValue(this.state, node.getAttribute('level'));
    const modifier = node.getAttribute('modifier') ? resolveValue(this.state, node.getAttribute('modifier')) : 0;

    // its own descriptive text
    const desc = document.createElement('span');
    this.appendChildren(desc, node, path);
    if (desc.textContent.trim()) container.appendChild(desc);

    const key = 'roll@' + path;
    const widget = document.createElement('div');
    widget.className = 'roll';
    container.appendChild(widget);

    const stored = this.ctx.rolls.get(key);
    const abLabel = (ability || '').split('|')[0];
    if (stored) {
      this.showDiceResult(widget, stored.dice, `${abLabel.toUpperCase()} ${stored.abilityScore >= 0 ? '+' : ''}${stored.abilityScore} = ${stored.total} vs ${level}`, stored.success ? 'Success' : 'Failure', stored.success);
    } else {
      const btn = this.rollButton(`Roll 2 dice + ${abLabel.toUpperCase()}`, widget, () => {
        const res = rollDifficulty(this.state, ability, level, modifier + childAdjustment(node, this.state));
        if (node.getAttribute('var')) this.state.setVar(node.getAttribute('var'), res.margin);
        this.ctx.rolls.set(key, res);
        this.rerender();
      });
      widget.appendChild(btn);
    }
    return widget;
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

    const stored = this.ctx.rolls.get(key);
    if (stored) {
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total}`, '', true);
    } else {
      widget.appendChild(this.rollButton(`Roll ${diceWord(dice)}`, widget, () => {
        const r = rollDice(dice);
        const total = r.total + childAdjustment(node, this.state);
        const res = { kind: 'random', dice: r.dice, total };
        if (varName) this.state.setVar(varName, total);
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
    const stored = this.ctx.rolls.get(key);
    if (stored) {
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs Rank ${this.state.data.rank}`, stored.success ? 'Success' : 'Failure', stored.success);
    } else {
      widget.appendChild(this.rollButton(`Rank check (roll ${diceWord(dice)})`, widget, () => {
        const res = rollRankCheck(this.state, dice, add, childAdjustment(node, this.state));
        if (node.getAttribute('var')) this.state.setVar(node.getAttribute('var'), res.margin);
        this.ctx.rolls.set(key, res);
        this.rerender();
      }));
    }
    return widget;
  }

  renderTraining(container, node, path) {
    const ability = (node.getAttribute('ability') || '').split('|')[0].toLowerCase();
    const dice = parseInt(node.getAttribute('dice') || '2', 10);
    const add = parseInt(node.getAttribute('add') || '0', 10);
    const key = 'roll@' + path;
    const widget = document.createElement('div');
    widget.className = 'roll';
    container.appendChild(widget);
    const stored = this.ctx.rolls.get(key);
    if (stored) {
      this.showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs ${ability.toUpperCase()} ${stored.natural}`, stored.success ? `+1 ${ability.toUpperCase()}` : 'No gain', stored.success);
    } else {
      widget.appendChild(this.rollButton(`Train ${ability.toUpperCase()} (roll ${diceWord(dice)})`, widget, () => {
        this.ctx.rolls.set(key, rollTraining(this.state, ability, dice, add));
        this.rerender();
      }));
    }
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

  renderBranch(container, node, path, activeRoll) {
    const tag = node.tagName.toLowerCase();
    const roll = activeRoll ? this.ctx.rolls.get('roll@' + activeRoll.path) : null;

    if (tag === 'success' || tag === 'failure') {
      if (!roll && !node.hasAttribute('var')) return; // wait until the roll is made
      const want = tag === 'success';
      if (this.branchSuccess(node, roll) === want) this.revealBranch(container, node, path);
      return;
    }

    if (tag === 'outcomes') {
      const kids = Array.from(node.children);
      const branches = kids.filter((c) => /^(outcome|success|failure)$/.test(c.tagName.toLowerCase()));
      const choiceKids = kids.filter((c) => c.tagName.toLowerCase() === 'choice');

      // Reveal the single matching outcome once the roll is resolved.
      if (roll) {
        for (let i = 0; i < branches.length; i++) {
          const c = branches[i];
          const ctag = c.tagName.toLowerCase();
          let match = false;
          if (ctag === 'success') match = this.branchSuccess(c, roll) === true;
          else if (ctag === 'failure') match = this.branchSuccess(c, roll) === false;
          else {
            const range = c.getAttribute('range');
            const cw = c.getAttribute('codeword');
            const val = c.getAttribute('var') ? this.state.getVar(c.getAttribute('var')) : roll.total;
            if (range != null) match = matchRange(range, val);
            else if (cw) match = cw.split(/[|,]/).some((w) => this.state.hasCodeword(w.trim()));
            else match = true; // default
          }
          if (match) { this.revealBranch(container, c, path + '.o' + i); break; }
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

  // ---- fight ---------------------------------------------------------------
  renderFight(container, node, path) {
    const key = 'fight@' + path;
    let fight = this.ctx.fights.get(key);
    if (!fight) {
      fight = makeFight(node);
      this.ctx.fights.set(key, fight);
    }
    const dmgNode = this.findSibling(node, 'fightdamage');
    const fleeNode = this.findSibling(node, 'flee');

    const box = document.createElement('div');
    box.className = 'fight';
    container.appendChild(box);
    this.drawFight(box, fight, node, dmgNode, fleeNode, key);
    return box;
  }

  findSibling(node, tag) {
    let n = node.nextElementSibling;
    while (n) { if (n.tagName.toLowerCase() === tag) return n; n = n.nextElementSibling; }
    return null;
  }

  drawFight(box, fight, node, dmgNode, fleeNode, key) {
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
    you.innerHTML = `<span>Your Combat ${this.state.ability('combat')}</span><span>Your Defence ${this.state.defence()}</span><span>Your Stamina ${this.state.data.stamina}/${this.state.data.staminaMax}</span>`;
    box.appendChild(you);

    const logEl = document.createElement('div');
    logEl.className = 'fight-log';
    fight.log.slice(-6).forEach((l) => { const p = document.createElement('div'); p.textContent = l; logEl.appendChild(p); });
    box.appendChild(logEl);

    if (fight.outcome === 'win') {
      const b = document.createElement('div'); b.className = 'roll-outcome ok'; b.textContent = `${fight.name} is defeated!`; box.appendChild(b);
      return;
    }
    if (fight.outcome === 'fled') {
      const b = document.createElement('div'); b.className = 'roll-outcome'; b.textContent = 'You fled the fight.'; box.appendChild(b);
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
      if (this.state.isDead()) { this.rerender(); return; }
      this.drawFight(box, fight, node, dmgNode, fleeNode, key);
    });
    controls.appendChild(attack);

    if (fleeNode) {
      const flee = document.createElement('button');
      flee.className = 'btn-secondary';
      flee.textContent = 'Flee';
      flee.addEventListener('click', () => {
        fight.outcome = 'fled';
        const fgoto = fleeNode.querySelector('goto');
        const sec = fgoto?.getAttribute('section');
        if (sec) this.navigate(fgoto.getAttribute('book') ? Number(fgoto.getAttribute('book')) : this.book, sec);
        else this.rerender();
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
    let hasHeader = false;
    Array.from(node.children).forEach((child, i) => {
      const tag = child.tagName.toLowerCase();
      if (tag === 'header') {
        hasHeader = true;
        const type = child.getAttribute('type') || 'other';
        const h = document.createElement('div');
        h.className = 'market-head';
        h.textContent = MARKET_TITLES[type] || 'Market';
        box.appendChild(h);
      } else if (tag === 'trade' || tag === 'armour' || tag === 'weapon' || tag === 'tool' || tag === 'item' || tag === 'cargo') {
        box.appendChild(this.renderShopRow(child, path + '.r' + i));
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

  renderShopRow(node, path) {
    const kind = shopKind(node);
    const name = node.getAttribute('name') || node.getAttribute(kind) || node.getAttribute('item') || (kind === 'weapon' ? 'weapon' : kind);
    const bonus = node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0;
    const ability = node.getAttribute('ability');
    const buy = node.getAttribute('buy');
    const sell = node.getAttribute('sell');
    const carryable = kind === 'weapon' || kind === 'armour' || kind === 'tool' || kind === 'item';
    const goods = goodsFrom(node, kind, name, bonus);

    const row = document.createElement('div');
    row.className = 'trade';
    const label = document.createElement('span');
    label.className = 'trade-name';
    let tag = '';
    if (kind === 'weapon') tag = ` (Combat +${bonus})`;
    else if (kind === 'armour') tag = ` (Defence +${bonus})`;
    else if (kind === 'tool' && ability) tag = ` (${titleCase(ability)} +${bonus})`;
    else if (bonus) tag = ` (+${bonus})`;
    label.textContent = titleCase(name) + tag;
    row.appendChild(label);

    const actions = document.createElement('span');
    actions.className = 'trade-actions';
    if (buy != null) {
      const price = resolveValue(this.state, buy);
      const b = document.createElement('button');
      b.className = 'btn-mini';
      b.textContent = `Buy ${price}`;
      const noSlot = carryable && this.state.freeSlots() <= 0;
      b.disabled = this.state.data.shards < price || noSlot;
      b.title = this.state.data.shards < price ? 'Not enough Shards' : (noSlot ? 'No room (12-item limit)' : '');
      b.addEventListener('click', () => {
        const res = buyTrade(this.state, goods, price);
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
      s.textContent = `Sell ${price}`;
      s.disabled = !owned;
      s.title = owned ? '' : 'You have none to sell';
      s.addEventListener('click', () => { if (sellTrade(this.state, goods, price).ok) this.rerender(); });
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

  // Inline <buy> in prose (e.g. crew upgrades: "…it costs <buy crew=… shards=…/>…").
  renderInlineBuy(container, node, path) {
    const shards = node.getAttribute('shards');
    const price = shards != null ? resolveValue(this.state, shards) : 0;
    const crew = node.getAttribute('crew');
    const item = node.getAttribute('item');
    const cargo = node.getAttribute('cargo');
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

    // Add a Cargo Unit to the ship (many sections grant free cargo, shards="0").
    if (cargo != null) {
      const btn = document.createElement('button');
      btn.className = 'btn-mini';
      const inner = document.createElement('span');
      this.appendChildren(inner, node, path);
      btn.textContent = inner.textContent.trim() || (price ? `Buy ${price} Shards` : `Take a Cargo Unit of ${titleCase(cargo)}`);
      const hasShip = this.state.ships.length > 0;
      btn.disabled = !hasShip || (price > 0 && this.state.data.shards < price);
      btn.title = !hasShip ? 'You need a ship to carry cargo.' : (price > 0 && this.state.data.shards < price ? 'Not enough Shards' : '');
      btn.addEventListener('click', () => {
        const res = buyTrade(this.state, { kind: 'cargo', cargoName: cargo, name: cargo }, price);
        if (!res.ok) { if (res.note) this.notify(res.note, 'warn'); return; }
        this.rerender();
      });
      container.appendChild(btn);
      return btn;
    }
    const btn = document.createElement('button');
    btn.className = 'btn-mini';
    const inner = document.createElement('span');
    this.appendChildren(inner, node, path);
    btn.textContent = inner.textContent.trim() || (price ? `${price} Shards` : 'Buy');

    const crewRank = (c) => ['poor', 'average', 'good', 'excellent'].indexOf(c);
    const ship = this.state.ships[0];
    let usable = true;
    // Crew upgrades are one grade at a time (poor→average→good→excellent), so a
    // "buy crew=X" offer is only usable when your crew is exactly the grade below X.
    if (crew) usable = !!ship && crewRank(ship.crew) === crewRank(crew) - 1;
    btn.disabled = (price > 0 && this.state.data.shards < price) || !usable;
    btn.addEventListener('click', () => {
      applyInlineBuy(this.state, {
        price, crew, item,
        bonus: node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0,
        ability: node.getAttribute('ability'),
      });
      this.rerender();
    });
    container.appendChild(btn);
    return btn;
  }

  // Inline <sell> in prose: sell a Cargo Unit for Shards, or (when price="<flag>"
  // is a name rather than a number) barter it — give up a cargo unit and receive
  // the linked [flag=<name>] <buy> reward atomically (e.g. §538 swap for minerals).
  renderInlineSell(container, node, path) {
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
    if (cargo == null) { // non-cargo sells are unused in this corpus — show as prose
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
      const idx = ship.cargo.indexOf(type);
      if (idx < 0) return;
      ship.cargo.splice(idx, 1);
      if (shardsGain) this.state.adjustMoney(shardsGain);
      if (isFlag) this.applyLinkedCargoBuys(priceAttr); // the barter reward (minerals)
      this.ctx.applied.add(memo);
      this.state.changed();
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
    const perUse = node.getAttribute('stamina') || '1';
    const cost = node.getAttribute('shards') ? resolveValue(this.state, node.getAttribute('shards')) : 0;
    const box = document.createElement('span');
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    const heal = /d/i.test(perUse) ? perUse : parseInt(perUse, 10);
    btn.textContent = cost ? `Rest (+${heal} Stamina, ${cost} Shards)` : `Rest (+${heal} Stamina)`;
    const full = this.state.data.stamina >= this.state.data.staminaMax;
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

  // ---- resurrection --------------------------------------------------------
  renderResurrection(container, node, path) {
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
