// render-rules.js — DOM-free rule decisions for section rendering (task 119).
//
// These planners take parsed section/effect nodes plus the live GameState and return a
// decision (boolean / blessing name / set) WITHOUT constructing any DOM or touching a
// browser UI global (document/window). render.js wires the controls; these decide the
// rules — restoring the documented rules/view boundary. Reading a passed node's
// attributes / running querySelectorAll on it is fine (the same thing engine.js does);
// only DOM *construction* belongs in the view. Unit-tested headlessly.

import { boolAttr } from './engine.js';
import { normalize } from './state.js';

// DOM Node.DOCUMENT_POSITION_FOLLOWING (0x04): set in the compareDocumentPosition mask
// when the argument node comes AFTER the reference node in document order. Spelled as a
// literal so this module never reaches for the browser `Node` global.
const DOCUMENT_POSITION_FOLLOWING = 0x04;

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
