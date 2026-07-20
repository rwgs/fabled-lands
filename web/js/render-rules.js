// render-rules.js — DOM-free rule decisions for section rendering (task 119).
//
// These planners take parsed section/effect nodes plus the live GameState and return a
// decision (boolean / blessing name / set) WITHOUT constructing any DOM or touching a
// browser UI global (document/window). render.js wires the controls; these decide the
// rules — restoring the documented rules/view boundary. Reading a passed node's
// attributes / running querySelectorAll on it is fine (the same thing engine.js does);
// only DOM *construction* belongs in the view. Unit-tested headlessly.

import { boolAttr } from './engine.js';
import { normalize, currencyAward } from './state.js';

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

// True when a die roll in this section is gated behind the payment keyed `k`: a
// <random|rankcheck|difficulty flag="k"> paired with a [price="k"] cost — the "pay to
// spin" idiom (book2/157, book3/314, book5/674, book6/171/587/50/628). (task 30)
export function isRollGate(sectionEl, k) {
  return !!(k != null && sectionEl &&
    sectionEl.querySelector(`random[flag="${k}"], rankcheck[flag="${k}"], difficulty[flag="${k}"]`));
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
