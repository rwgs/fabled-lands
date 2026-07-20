// render-rules.js — DOM-free rule decisions for section rendering (task 119).
//
// These planners take parsed section/effect nodes plus the live GameState and return a
// decision (boolean / blessing name / set) WITHOUT constructing any DOM or touching a
// browser UI global (document/window). render.js wires the controls; these decide the
// rules — restoring the documented rules/view boundary. Reading a passed node's
// attributes / running querySelectorAll on it is fine (the same thing engine.js does);
// only DOM *construction* belongs in the view. Unit-tested headlessly.

import { boolAttr, isDiceExpr } from './engine.js';
import { normalize, currencyAward } from './state.js';
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
