// render-rules.js — DOM-free rule decisions for section rendering (task 119).
//
// These planners take parsed section/effect nodes plus the live GameState and return a
// decision (boolean / blessing name / set) WITHOUT constructing any DOM or touching a
// browser UI global (document/window). render.js wires the controls; these decide the
// rules — restoring the documented rules/view boundary. Reading a passed node's
// attributes / running querySelectorAll on it is fine (the same thing engine.js does);
// only DOM *construction* belongs in the view. Unit-tested headlessly.

import { boolAttr, isDiceExpr, resolveValue, matchRange } from './engine.js';
import { normalize, currencyAward, isShardsCurrency } from './state.js';
import { availableBooks } from './data.js';
import { isRollGate, isDeferredEscapeClear, isDeferredTagCleanup, aggregateFightOutcome } from './render-gates.js';

// isRollGate moved to render-gates.js (one-way dependency: classifyPassive below composes
// the gate deferrals, so this module imports from render-gates — never the reverse);
// re-exported here so its callers (render.js, tests) keep one import site for pay rules.
export { isRollGate } from './render-gates.js';

// DOM Node.DOCUMENT_POSITION_FOLLOWING (0x04): set in the compareDocumentPosition mask
// when the argument node comes AFTER the reference node in document order. Spelled as a
// literal so this module never reaches for the browser `Node` global.
const DOCUMENT_POSITION_FOLLOWING = 0x04;

// The item-family effect tags (a possession award) and the tags eligible for a
// "choose one" reward menu. Shared by the planners below and the renderer's award/pay
// views, so they live here as the single source of truth.
export const ITEM_FAMILY_TAGS = new Set(['item', 'weapon', 'armour', 'tool']);
export const CHOOSE_ONE_TAGS = new Set(['lose', 'tick', 'gain', 'item', 'weapon', 'armour', 'tool', 'resurrection']);

// ---- blessing rules (tasks 43/56/108/114) ----------------------------------

// The blessings named on a section's <outcome blessing="X"> hazards (task 108): a held
// blessing vetoes that outcome, and a sibling <lose blessing="X"> is the deferred
// "spend to avoid it" step, not an on-entry loss. Excludes the "*"/"?" wildcards.
export function computeOutcomeBlessings(sectionEl) {
  if (!sectionEl) return new Set();
  return new Set(
    Array.from(sectionEl.querySelectorAll('outcome[blessing]'))
      .map((o) => normalize(o.getAttribute('blessing')))
      .filter((b) => b && b !== '*' && b !== '?'),
  );
}

// A held blessing named on this <outcome blessing="X"> vetoes the hazard (task 108).
export function blessingVeto(state, node) {
  const b = node.getAttribute('blessing');
  if (b == null || b === '' || b === '*' || b === '?') return false;
  return state.hasBlessing(b);
}

// A non-hidden <lose blessing="X"> whose blessing guards one of this section's
// <outcome blessing="X"> hazards (task 108). §200/250/60 write it as bare prose
// ("…lose the blessing and turn to N"); it must NOT auto-consume on entry — the spend
// happens when the player takes the safe goto. It renders as inert words. §232/502/716
// instead hide the loss behind a keepblessing var, so those (hidden) forms are excluded
// and keep their normal var-gated behaviour.
export function isGuardedBlessingLoss(node, outcomeBlessings) {
  if (node.tagName.toLowerCase() !== 'lose') return false;
  if (boolAttr(node.getAttribute('hidden'))) return false;
  const b = node.getAttribute('blessing');
  if (b == null || b === '' || b === '*' || b === '?') return false;
  return outcomeBlessings.has(normalize(b));
}

// The blessing a safe-path <goto> should spend on click (task 108): a non-hidden guarded
// <lose blessing="X"> that PRECEDES this goto in the section, when the player still holds
// X. The roll gate only leaves the goto clickable in the protected-hazard (vetoed) state,
// so spending X there matches the source's "lose the blessing and turn to N".
export function blessingSpendForGoto(node, sectionEl, state, outcomeBlessings) {
  if (!outcomeBlessings || !outcomeBlessings.size || !sectionEl) return null;
  for (const l of sectionEl.querySelectorAll('lose[blessing]')) {
    if (boolAttr(l.getAttribute('hidden'))) continue;
    if (!outcomeBlessings.has(normalize(l.getAttribute('blessing')))) continue;
    if (!(l.compareDocumentPosition(node) & DOCUMENT_POSITION_FOLLOWING)) continue;
    const b = l.getAttribute('blessing');
    if (state.hasBlessing(b)) return b;
  }
  return null;
}

// The storm blessing a <reroll> should spend on click in the keepblessing form
// (§232/502/716 — task 114): a hidden <lose blessing="X"> whose X guards one of this
// section's <outcome blessing="X"> hazards, when the player still holds X. Only those
// three reroll sections carry that idiom; a plain reroll finds nothing to spend.
export function blessingSpendForReroll(sectionEl, state, outcomeBlessings) {
  if (!outcomeBlessings || !outcomeBlessings.size || !sectionEl) return null;
  for (const l of sectionEl.querySelectorAll('lose[blessing][hidden]')) {
    const b = l.getAttribute('blessing');
    if (b && outcomeBlessings.has(normalize(b)) && state.hasBlessing(b)) return b;
  }
  return null;
}

// True when the only blessing linked to a choose-one cost `key` (the cost node itself
// plus any [flag="key"] reward siblings) is one the player already holds — used to refuse
// a re-buy that addBlessing would just dedupe away, so no Shards are spent for nothing.
export function ownsSoleLinkedBlessing(node, key, sectionEl, state) {
  const nodes = [node];
  if (sectionEl) nodes.push(...sectionEl.querySelectorAll(`[flag="${key}"]`));
  const blessings = new Set();
  nodes.forEach((el) => { const b = el.getAttribute && el.getAttribute('blessing'); if (b) blessings.add(b); });
  if (blessings.size !== 1) return false;
  return state.hasBlessing([...blessings][0]);
}

// ---- reward / payment eligibility (tasks 30/43/56/74/125) -------------------

// The reward nodes linked to a price/flag key: [flag="key"] elements in the section
// (the cost carries price="key" instead). Empty/roll-gate keys → none.
export function linkedRewards(sectionEl, key) {
  if (!sectionEl || key == null || key === '') return [];
  return Array.from(sectionEl.querySelectorAll(`[flag="${key}"]`));
}

// A repeatable "add one per payment" reward: a counter tick (<tick name="X"
// count|amount=…>). The book idiom "for every 50 Shards you can add one" bumps a named
// bonus counter, so paying again should add again (book4/93, book6/117/731).
export function isCounterReward(node) {
  return node.tagName.toLowerCase() === 'tick'
    && !!node.getAttribute('name')
    && (node.getAttribute('count') != null || node.getAttribute('amount') != null);
}

// A "choose one" purchase: a price="key" cost with two or more linked rewards, so one
// payment must grant only the picked one — never the whole list (book6/171, book5/152,
// book6/690). A *pure* item-family set is left as a barter (book4/634 "give one, take
// one"), so a heterogeneous reward (at least one non-item-family node) is required
// before an item/resurrection award joins the choose-one path.
export function isChooseOne(sectionEl, key) {
  const rewards = linkedRewards(sectionEl, key);
  if (rewards.length < 2) return false;
  if (!rewards.every((n) => CHOOSE_ONE_TAGS.has(n.tagName.toLowerCase()))) return false;
  return rewards.some((n) => !ITEM_FAMILY_TAGS.has(n.tagName.toLowerCase()));
}

// A flag-linked item-family award claimed by arm-then-take: a linked payment ([price=key]
// cost) arms the flag, then the award's own Take button grants it. Covers the cases
// isChooseOne excludes — a single priced item reward and a pure item-family barter —
// which otherwise render a free Take button and grant nothing when paid. Requires a
// [price=key] cost. (task 125)
export function isPricedItemAward(sectionEl, key) {
  if (key == null || key === '' || !sectionEl) return false;
  if (!sectionEl.querySelector(`[price="${key}"]`)) return false;
  const rewards = linkedRewards(sectionEl, key);
  return rewards.length > 0 && rewards.every((n) => ITEM_FAMILY_TAGS.has(n.tagName.toLowerCase()));
}

// Is there a player-facing (non-hidden) cost for this choose-one key? A hidden price arms
// the choice for free (an earned "choose your reward" — book1/597).
export function hasVisiblePay(sectionEl, key) {
  if (!sectionEl || key == null || key === '') return false;
  return Array.from(sectionEl.querySelectorAll(`[price="${key}"]`)).some((n) => !boolAttr(n.getAttribute('hidden')));
}

// Why picking this reward would waste the payment (so the option is disabled): a blessing
// you already hold, a resurrection deal you already have, an item with no free carry slot,
// or a curse/disease/poison "lift" you aren't suffering. Returns the reason or null.
export function rewardWasteReason(state, node) {
  const tag = node.tagName.toLowerCase();
  if (tag === 'resurrection' && state.hasResurrection()) return 'You already have a resurrection deal.';
  if (ITEM_FAMILY_TAGS.has(tag)) {
    const rawName = node.getAttribute('name') || tag;
    const isCurrency = tag === 'item' && currencyAward(rawName) != null;
    if (!isCurrency && state.freeSlots() <= 0) return 'No room (12-item carry limit).';
  }
  const bl = node.getAttribute('blessing');
  if (bl && state.hasBlessing(bl)) return 'You already have this blessing.';
  if (tag === 'lose') {
    const c = node.getAttribute('curse');
    if (c != null && !state.hasCurse(c)) return "You don't have that curse.";
    const d = node.getAttribute('disease');
    if (d != null && !state.hasDisease(d)) return "You don't have that affliction.";
    const p = node.getAttribute('poison');
    if (p != null && !state.hasPoison(p)) return "You don't have that affliction.";
  }
  return null;
}

// force="f" marks an OPTIONAL action (JaFL ActionNode defaults force=true); "f"/false
// means the player may skip it (task 74).
export function isOptionalForce(node) {
  const f = node.getAttribute('force');
  return f != null && !boolAttr(f);
}

// A stable "choose one" token for a force="f" node whose siblings are mutually exclusive,
// else null (an independent optional action). A ship docks at ONE place, so every force="f"
// <set dock=> in a section is one choice (book3/405); a "cross off one of the following"
// is two+ force="f" <lose> under a single parent (book6/160).
export function forcedChoiceGroup(node) {
  const tag = node.tagName.toLowerCase();
  if (tag === 'set' && node.getAttribute('dock') != null) return 'dock';
  if (tag === 'lose' && node.parentElement) {
    const kin = Array.from(node.parentElement.children)
      .filter((c) => c.tagName.toLowerCase() === 'lose' && isOptionalForce(c));
    if (kin.length >= 2) return node.parentElement; // key the group by its shared parent node
  }
  return null;
}

// Is this <lose> a "spend" the player commits to (Shards/item/cargo/ship), as opposed to a
// narrative penalty (Stamina, codeword, blessing…)? Forced only — an explicit force="f"
// loss, or a "*" catastrophe (lose all), is not gated.
export function isEconomicPayment(node) {
  if (node.getAttribute('force') != null && !boolAttr(node.getAttribute('force'), true)) return false;
  const shards = node.getAttribute('shards');
  const item = node.getAttribute('item');
  const hasShards = shards != null && shards !== '*';
  const hasItem = item != null && item !== '*';
  const hasCargo = node.getAttribute('cargo') != null && node.getAttribute('cargo') !== '*';
  const hasShip = boolAttr(node.getAttribute('ship'));
  if (node.getAttribute('stamina') != null || node.getAttribute('ability') != null) return false;
  return hasShards || hasItem || hasCargo || hasShip;
}

// ---- group classification (tasks 42/61/96/98/107/125/126 — task 119 phase 3) --

// Classify a <group> — the books' "optional bundle of effects behind one opt-in" —
// into the ONE way it renders and what its click must apply:
//   { kind:'roll', rollNode } — bundles a die roll: can't collapse to a button, the roll
//     renders as its own widget and drives the section's branches (task 42)
//   { kind:'inline' }         — no label or nothing to apply: a plain inline wrapper
//   { kind:'action', label, effects, itemNodes, buyNodes, linkedAwards, restNodes,
//     gotoNode, returnNode, isRevival } — one click-to-apply button; the view runs the
//     listed transactions on click, then navigates/returns/revives as flagged
export function groupPlan(sectionEl, node) {
  const rollNode = node.querySelector('difficulty, random, rankcheck');
  if (rollNode) return { kind: 'roll', rollNode };

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
  if (sectionEl) {
    effects.forEach((fx) => {
      const k = fx.getAttribute('price');
      if (!k) return;
      sectionEl.querySelectorAll(`[flag="${k}"]`).forEach((r) => {
        if (ITEM_FAMILY_TAGS.has(r.tagName.toLowerCase()) && !node.contains(r)) linkedAwards.push(r);
      });
    });
  }
  // A <rest> child heals on the group click (book6/628 "regain 1 Stamina point"):
  // applied headlessly, since the group renders as one button, not a rest widget. (task 61)
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
    return { kind: 'inline' }; // no visible action (or nothing to apply)
  }
  return { kind: 'action', label, effects, itemNodes, buyNodes, linkedAwards, restNodes, gotoNode, returnNode, isRevival };
}

// Does a passive/rest child of a roll-bundling group DEFER to the roll event (JaFL
// treats the roll as the group's action), rather than arming on entry? Visible costs/
// consequences defer; hidden book-keeping (an armed price flag / cache lock — book3/680,
// book1/91, book2/138) still applies on entry. The exception: a bundled cache lock/unlock
// tick (task 38) means "freeze the bet on the roll", so it defers even when hidden.
export function groupRollDefers(node) {
  const special = (node.getAttribute('special') || '').toLowerCase();
  const cacheLockTick = node.tagName.toLowerCase() === 'tick' && (special === 'lock' || special === 'unlock');
  return !boolAttr(node.getAttribute('hidden')) || cacheLockTick;
}

// ---- choice eligibility (tasks 28/30/47/55/89/110/133 — task 119 phase 3) ----

// price/flag gate on a choice/goto (JaFL GotoNode.canUse): a flag="k" exit is usable
// only once flag k is set; a price="k" exit only while it is clear — the "pay to spin"
// exit (book2/157 → 19, book6/628 → 8, book3/680 → 407): while the payment is armed
// (paid, not yet resolved) the exit is withheld, and once the roll consumes the flag it
// reopens. Returns a reason when gated out, else null. (task 30)
export function flagGate(state, node) {
  const flag = node.getAttribute('flag');
  const price = node.getAttribute('price');
  if (flag != null && !state.getFlag(flag)) return 'not yet available';
  if (price != null && state.getFlag(price)) return 'resolve this first';
  return null;
}

// True for the one choice/goto node the player took before the current <return>
// restored this section: it is spent (crossed off) unless it carries revisit="t",
// which marks a hub action the player may take again. Only ever set right after a
// return, so a normal render leaves every source action enabled. (task 110)
export function isSpentSource(ctx, node) {
  return !!(ctx && ctx.usedSource === node && !boolAttr(node.getAttribute('revisit')));
}

// The full eligibility + payment verdict for a <choice> row (task 119): every gate the
// books put on a choice, plus the pay= consumption default (task 55), decided DOM-free so
// the view merely disables the button and hands `payment` to payChoiceCost on click.
// `view` is the renderer's rule surface — { ctx } is all this planner reads.
// Returns { reasons, isSail, cost, coinLabel, payment }:
//   reasons  — why the choice is disabled (empty = live)
//   payment  — payChoiceCost's opts: { pay, cost, currency, foreignCoin, item, itemTags }
export function choiceGate(state, node, view) {
  const shards = node.getAttribute('shards');
  // A currency="Mithral" cost is paid in that foreign coin, not Shards (book2/545).
  const currency = node.getAttribute('currency');
  const foreignCoin = !isShardsCurrency(currency);
  const coinLabel = foreignCoin ? currency : 'Shards';
  const wallet = foreignCoin ? state.currencyBalance(currency) : state.data.shards;
  const itemReq = node.getAttribute('item');
  const itemTags = node.getAttribute('tags'); // e.g. <choice item="?" tags="light"> (task 47)
  // pay= governs whether the choice *consumes* its requirement on click. An
  // explicit pay="t" consumes both a shards= cost and an item= requirement
  // (book2/400 green gem, book6/740 rope — previously ignored for item-only
  // choices); pay="f" never consumes; and with no pay= a shards= cost still
  // deducts by default while a bare item= gate is kept (a mere requirement). (task 55)
  const payAttr = node.getAttribute('pay');
  const payExplicit = payAttr != null ? boolAttr(payAttr) : null;
  const pay = payExplicit === true || (payExplicit == null && shards != null);
  // A sail="t" choice is a sail action exactly like a sail goto (task 89): it needs
  // a ship at THIS dock.
  const isSail = boolAttr(node.getAttribute('sail'));

  const reasons = [];
  if (isSail && state.shipsHere().length === 0) reasons.push('you need a ship here');
  const cost = shards != null ? resolveValue(state, shards) : 0;
  if (shards != null && wallet < cost) reasons.push(`needs ${cost} ${coinLabel}`);
  // item= gate: "?" (+ optional tags=) means "any possession carrying these tags"
  // (a light source, etc.) — the same matcher as <if item="?" tags=…>, so a
  // light-gated choice is no longer permanently locked (task 47).
  if (itemReq && !state.hasItemMatch(itemReq, itemTags)) reasons.push(itemReq === '?' ? `needs ${itemTags || 'an item'}` : `needs ${itemReq}`);
  const boxWord = node.getAttribute('box');
  if (boxWord && !state.hasCodeword(boxWord)) reasons.push('box not ticked');
  const profession = node.getAttribute('profession');
  if (profession && normalize(profession) !== normalize(state.data.profession)) reasons.push(profession + ' only');
  const god = node.getAttribute('god');
  if (god && !state.hasGod(god)) reasons.push('requires ' + god);
  const emptyvar = node.getAttribute('emptyvar');
  if (emptyvar && state.hasVar(emptyvar)) reasons.push('unavailable');
  const bookNum = node.getAttribute('book');
  if (bookNum && !availableBooks().includes(Number(bookNum))) reasons.push('book not in edition');
  // dead="t" choices are only for a dead player (and dead="f" only while alive) — task 28.
  const deadAttr = node.getAttribute('dead');
  if (deadAttr != null && boolAttr(deadAttr) !== state.isDead()) reasons.push(boolAttr(deadAttr) ? 'only if you are dead' : 'only while you live');
  const fg = flagGate(state, node); // price/flag "pay to spin" gate (task 30)
  if (fg) reasons.push(fg);
  if (isSpentSource(view.ctx, node)) reasons.push('already taken');

  return { reasons, isSail, cost, coinLabel, payment: { pay, cost, currency, foreignCoin, item: itemReq, itemTags } };
}

// ---- branch resolution (success/failure/outcomes — tasks 50/104/108/109/122) --

// A branch "succeeds" either from the roll's success flag, or — when it
// carries its own `var` — from that variable's sign (>0 = success), which is
// how the books express computed outcomes (e.g. rank checks via a `<set>`).
export function branchSuccess(state, node, roll) {
  if (node.hasAttribute('var')) return state.getVar(node.getAttribute('var')) > 0;
  return roll ? !!roll.success : false;
}

// Is a branch ready to activate? A var-keyed branch waits until that var has been
// WRITTEN this visit — by a roll or an active <set> (ctx.wroteVars) — never on a
// stale/unset global (task 50). A plain (roll-fed) branch waits for its roll. This
// stops a `<failure var="s">` firing on entry with s=0 (or a leftover s>0).
export function branchResolved(ctx, node, roll) {
  if (node.hasAttribute('var')) return ctx.wroteVars.has(node.getAttribute('var'));
  return !!roll;
}

// Does a success/failure branch's ability= match the feeding roll's chosen
// ability? (task 109) §2.37 offers "SANCTITY or MAGIC (your choice)" then routes a
// SANCTITY success →60 and a MAGIC success →129, so the success boolean alone is
// ambiguous. A node with no ability= is unconstrained (single-ability rolls and
// var-keyed branches are unaffected); when the feeding roll carries no chosen
// ability, don't over-filter.
export function branchAbilityMatches(node, roll) {
  const ab = node.getAttribute('ability');
  if (ab == null || ab === '') return true;
  if (!roll || !roll.ability) return true;
  const want = String(roll.ability).toLowerCase();
  return ab.split('|').map((a) => a.trim().toLowerCase()).includes(want);
}

// Resolve a branch element against the feeding roll and live state: the ONE thing the
// view should do with it this render. `roll` is the resolved roll record (or null).
//   { kind:'skip' }                 — pending, non-matching, or blessing-vetoed
//   { kind:'reveal' }               — a success/failure/outcome to reveal
//   { kind:'table', reveal, index } — an <outcomes> table; reveal is the single
//                                     matching child (null = none yet), index its position
//   { kind:'prose' }                — not a branch element (the view renders its words)
export function branchPlan(state, ctx, node, roll) {
  const tag = node.tagName.toLowerCase();

  if (tag === 'success' || tag === 'failure') {
    if (!branchResolved(ctx, node, roll)) return { kind: 'skip' }; // wait until the feeding roll / var write
    const want = tag === 'success';
    return branchSuccess(state, node, roll) === want && branchAbilityMatches(node, roll)
      ? { kind: 'reveal' } : { kind: 'skip' };
  }

  // A lone <outcome> (e.g. inside a <choices> table): reveal it when its
  // flag/range/var/codeword condition matches. flag= needs no roll (it's set by
  // a paid offering — book4/456); range/var need the roll (or var write) first.
  if (tag === 'outcome') {
    const flag = node.getAttribute('flag');
    let match;
    if (flag != null) match = state.getFlag(flag);
    // A codeword= outcome is a roll-less dispatch — "which codeword do you have?"
    // (§4.457's Initiate row) — so match it against live codewords before the roll
    // gate, like flag= (task 122). A same-visit hidden tick has already applied
    // (it renders above the table), so an initiate ticked this visit counts.
    else if (node.getAttribute('codeword') != null) match = node.getAttribute('codeword').split(/[|,]/).some((w) => state.hasCodeword(w.trim()));
    else if (!branchResolved(ctx, node, roll)) return { kind: 'skip' }; // wait for the roll / var write
    else if (node.getAttribute('range') != null) match = matchRange(node.getAttribute('range'), node.getAttribute('var') ? state.getVar(node.getAttribute('var')) : roll.total);
    else if (node.hasAttribute('var')) match = branchSuccess(state, node, roll);
    else match = true;
    // A held blessing vetoes a blessing-guarded outcome (task 108): the range
    // matched, but Safety from Storms carries the traveller past the storm, so the
    // dangerous redirect is not offered. The blessing is spent on the section's
    // sibling branch, not here, so nothing is consumed.
    if (match && blessingVeto(state, node)) return { kind: 'skip' };
    return match ? { kind: 'reveal' } : { kind: 'skip' };
  }

  if (tag === 'outcomes') {
    const branches = Array.from(node.children).filter((c) => /^(outcome|success|failure)$/.test(c.tagName.toLowerCase()));

    // A roll-less codeword-dispatch table — "which of these codewords do you
    // have?" (§4.2/§4.184/§2.301) — carries no <random>, so the feeding roll stays
    // null and the branches must resolve against live state instead of waiting forever
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
        || branchResolved(ctx, c, roll);
      if (!resolved) continue;
      const ctag = c.tagName.toLowerCase();
      let match = false;
      if (ctag === 'success') match = branchSuccess(state, c, roll) === true && branchAbilityMatches(c, roll);
      else if (ctag === 'failure') match = branchSuccess(state, c, roll) === false && branchAbilityMatches(c, roll);
      else {
        const range = c.getAttribute('range');
        const cw = c.getAttribute('codeword');
        const val = c.getAttribute('var') ? state.getVar(c.getAttribute('var')) : (roll ? roll.total : 0);
        if (range != null) match = matchRange(range, val);
        else if (cw) match = cw.split(/[|,]/).some((w) => state.hasCodeword(w.trim()));
        else match = true; // default
      }
      // A held blessing vetoes this branch (task 108): skip it so neither the
      // dangerous redirect is revealed nor the roll gate's matchedOutcome is set —
      // the section's sibling <lose blessing>/reroll path then resolves. Ranges are
      // exclusive, so no other branch fills in (the traveller is protected).
      if (match && blessingVeto(state, c)) continue;
      if (match) return { kind: 'table', reveal: c, index: i };
    }
    return { kind: 'table', reveal: null, index: -1 };
  }

  return { kind: 'prose' };
}

// ---- the passive-effect execution model (task 119 phase 3) -------------------
//
// classifyPassive is JaFL's execution model for a passive effect node: the ORDER of these
// checks decides whether an effect applies on entry, defers, or becomes an opt-in control.
// It returns a verdict {mode, …} the view merely switches on. The `view` argument is the
// renderer's per-visit rule surface — any object exposing { state, sectionEl, ctx,
// inactive, outcomeBlessings, escapeCodewords, sectionFights, fightGate, hasDecline,
// whileIterPendingVars } (the Story instance satisfies it; tests pass a plain object).

// The name of a not-yet-set variable that this effect's magnitude depends on and that a
// roll in this section will fill — or null. Only such vars defer (see classifyPassive): a
// literal, a dice expression, or an already-set var applies now, and a var no roll here
// fills is left to apply (harmlessly as 0) rather than hang.
export function pendingRollVar(node, state, sectionEl, whileIterPendingVars = null) {
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
    if (whileIterPendingVars && whileIterPendingVars.has(bare)) return bare;
    if (state.hasVar(bare)) continue;               // already set (e.g. by an earlier <set>/roll)
    if (sectionEl && sectionEl.querySelector(`random[var="${bare}"], rankcheck[var="${bare}"], difficulty[var="${bare}"]`)) return bare;
  }
  return null;
}

// Does this <gain>/<lose>/<tick> ask the player to choose which ability it
// affects (ability="?" or "a|b")? effect= forms target one named ability, so
// they never need a chooser.
export function needsAbilityChoice(node) {
  const tag = node.tagName.toLowerCase();
  if (tag !== 'lose' && tag !== 'gain' && tag !== 'tick') return false;
  if (node.getAttribute('effect') != null) return false;
  const ab = node.getAttribute('ability');
  if (ab == null) return false;
  const s = ab.trim().toLowerCase();
  return s === '?' || s.includes('|');
}

// Does a <tick …="?" addbonus|addtag|removetag> ask the player to choose WHICH
// possession is enchanted? Only when the target is an open "?"/blank of a kind with
// more than one candidate — a name/all, a tags=/using= narrowing, or a cache target
// is deterministic and applies without a picker. (task 75)
export function needsEquipmentChoice(node, state) {
  if (node.tagName.toLowerCase() !== 'tick') return false;
  if (node.getAttribute('addbonus') == null && node.getAttribute('addtag') == null && node.getAttribute('removetag') == null) return false;
  const eqAttr = ['weapon', 'armour', 'tool', 'item'].find((k) => node.getAttribute(k) != null);
  if (eqAttr == null) return false;
  const pat = String(node.getAttribute(eqAttr) || '').trim();
  if (pat !== '?' && pat !== '') return false;
  if (boolAttr(node.getAttribute('using')) || node.getAttribute('tags') || node.getAttribute('cache')) return false;
  const kind = eqAttr === 'item' ? null : eqAttr;
  const candidates = kind ? state.data.items.filter((it) => it.kind === kind) : state.data.items;
  return candidates.length > 1;
}

// A <tick profession="a|b|c"> asks the player to choose a new profession. (task 75)
export function needsProfessionChoice(node) {
  if (node.tagName.toLowerCase() !== 'tick') return false;
  const p = node.getAttribute('profession');
  return p != null && p.includes('|');
}

// The renderPassive decision cascade: classify a passive effect node into the ONE way it
// executes this render. The check order below IS the rule — earlier gates win. Verdicts:
//   { mode:'inert', showWords }            — render words only; no effect, no memo
//   { mode:'defer-cleanup' }               — hold until the section is left (task 88)
//   { mode:'arm-hidden-price', fireReward } — memoised silent arming; fireReward is the
//                                            single linked reward to grant now, or null
//   { mode:'roll-payment'|'optional-pay'|'choose-one-reward', key }
//   { mode:'forced-optional'|'payment'|'ability-choice'|'equipment-choice'|'profession-choice' }
//   { mode:'apply', showWords, setVarName, rollOwned, rerunnable } — the plain effect;
//     rollOwned freezes a <set> whose var a roll owns (task 61), rerunnable re-evaluates
//     an absolute <set value=…> every render.
export function classifyPassive(node, view) {
  const tag = node.tagName.toLowerCase();
  const hidden = boolAttr(node.getAttribute('hidden'));

  // Inside an untaken conditional branch: show the words (the wrapper grays
  // them), but never apply the effect, gate a payment, or memoize — the branch
  // isn't taken, and a later state change re-renders it live if it becomes active.
  if (view.inactive) return { mode: 'inert', showWords: !hidden };

  // A guarded storm-blessing loss (§200/250/60) is the deferred "spend to avoid
  // the storm" step, not an on-entry loss: render its words, but let the safe goto
  // spend the blessing on click (renderGoto/blessingSpendForGoto). (task 108)
  if (tag === 'lose' && isGuardedBlessingLoss(node, view.outcomeBlessings)) {
    return { mode: 'inert', showWords: true }; // never hidden — isGuardedBlessingLoss excludes hidden forms
  }

  // Defer an effect whose magnitude depends on a variable that a roll in this
  // section has not filled yet (e.g. §521 "<lose multiple="x">" sitting above its
  // "<random var="x">"). Applying now would use x=0 and then memoise that no-op;
  // instead show the words and let the post-roll rerender apply the real count.
  if (pendingRollVar(node, view.state, view.sectionEl, view.whileIterPendingVars)) {
    return { mode: 'inert', showWords: !hidden };
  }

  // A fight-escape bracket's closing <lose codeword> (after the fight) is deferred
  // until the fight is won, so the mid-fight surrender/flee box= choice stays live
  // while the fight is unresolved or the player is fleeing (task 54).
  if (isDeferredEscapeClear(node, view.escapeCodewords, view.sectionFights)) {
    return { mode: 'inert', showWords: !hidden };
  }

  // A hidden <tick removetag="X"> is an end-of-section tag cleanup (§5.386's Targdaz
  // enchant): applying it on entry would strip the selection tag before the roll and
  // <outcomes> can target the weapon. Defer it to when the section is left. (task 88)
  if (isDeferredTagCleanup(node)) return { mode: 'defer-cleanup' };

  const price = node.getAttribute('price');
  const flag = node.getAttribute('flag');

  // A hidden price node arms its linked roll / choose-one / reward silently on entry —
  // JaFL runs it once per visit with no widget (task 56). A lone linked reward is granted
  // too, EXCEPT an item-family one — that grants through its own gated Take button
  // (renderChoosableReward), so firing it now would double-grant (task 125). Roll gates
  // and choose-one menus arm only, their rolls/picks doing the granting.
  if (price != null && hidden) {
    const rewards = linkedRewards(view.sectionEl, price);
    const fireReward = !isRollGate(view.sectionEl, price)
      && rewards.length === 1
      && !ITEM_FAMILY_TAGS.has(rewards[0].tagName.toLowerCase()) ? rewards[0] : null;
    return { mode: 'arm-hidden-price', fireReward };
  }

  // JaFL "price/flag" optional purchase: a node with price="k" is a click-to-pay cost.
  // A payment that arms a die roll is the repeatable "pay to spin" idiom (book2/157,
  // book3/314, book5/674…), not a one-shot reward purchase (task 30).
  if (price != null) {
    return { mode: isRollGate(view.sectionEl, price) ? 'roll-payment' : 'optional-pay', key: price };
  }

  // A flag="k" node is a reward linked to a [price="k"] cost: it must NOT auto-apply.
  // A roll-gated reward instead applies when its outcome is revealed by the roll — fall
  // through so it applies as a normal effect (it only renders once its outcome shows).
  if (flag != null && view.sectionEl && view.sectionEl.querySelector(`[price="${flag}"]`)
      && !isRollGate(view.sectionEl, flag)) {
    // A "choose one" reward: a pick button, enabled only once the cost is paid, so a
    // single payment grants exactly the ONE the player clicks (task 43).
    if (isChooseOne(view.sectionEl, flag)) return { mode: 'choose-one-reward', key: flag };
    // Single dependent reward: show its words; the effect applies with the linked cost.
    return { mode: 'inert', showWords: !hidden };
  }

  // A force="f" action is OPTIONAL (JaFL ActionNode defaults force=true): the player
  // opts in by clicking. Specialised gates above (price/flag/hidden) win, so only a
  // plain optional effect reaches here. (task 74)
  if (!hidden && isOptionalForce(node)) return { mode: 'forced-optional' };

  // Economic payment (Shards/item/cargo/ship) in a section with an escape route:
  // click-to-apply, blocking the rest of the section until resolved, so the optional
  // exit shown before it costs nothing. Narrative losses fall through and auto-apply.
  if (tag === 'lose' && !hidden && view.hasDecline && isEconomicPayment(node)) {
    return { mode: 'payment' };
  }

  // Player-choice effects: which ability / possession / profession is affected is the
  // player's pick, not the engine's default (tasks 74/75).
  if (!hidden && needsAbilityChoice(node)) return { mode: 'ability-choice' };
  if (!hidden && needsEquipmentChoice(node, view.state)) return { mode: 'equipment-choice' };
  if (!hidden && needsProfessionChoice(node)) return { mode: 'profession-choice' };

  // A bare <lose>/<gain> written after a <fight> in win/lose prose is a fight-OUTCOME
  // effect (task 69): hold it until the fight resolves, then apply only on the branch
  // actually taken (win / unconditional → on a win; lose → on a loss).
  const fightRole = view.fightGate && view.fightGate.effectNodes.get(node);
  if (fightRole) {
    const outcome = aggregateFightOutcome(view.sectionFights);
    const take = outcome === 'win' ? fightRole !== 'lose'
               : outcome === 'lose' ? fightRole === 'lose'
               : false; // unresolved or fled → hold (show the words, apply nothing)
    if (!take) return { mode: 'inert', showWords: !hidden };
  }

  const setVarName = tag === 'set' ? node.getAttribute('var') : null;
  // A roll this visit has taken ownership of this var: freeze the <set> so it can
  // never clobber the die result (book6/628's "not yet rolled" sentinel). (task 61)
  const rollOwned = setVarName != null && view.ctx.rolledVars.has(setVarName);
  // An absolute <set value="…"> is a pure function of current state, so it is
  // re-evaluated on every render — this keeps variables derived from a roll
  // result correct after that roll resolves (rather than frozen at first render).
  const rerunnable = tag === 'set' && node.hasAttribute('value') && !node.hasAttribute('modifier') && !rollOwned;
  return { mode: 'apply', showWords: !hidden, setVarName, rollOwned, rerunnable };
}
