// render-gates.js — DOM-free navigation-gate computation for section rendering (task 119).
//
// Pure planners that scan a parsed <section> and decide which onward navigations must be
// held (behind an unresolved fight, a mandatory roll, or a forced transfer) and which
// post-fight effects to defer until the fight resolves. The renderer tags and disables
// the actual buttons (the tag*/apply* methods stay in the view); these functions only
// DECIDE. No DOM construction, no browser UI globals.

import { boolAttr, evaluateCondition } from './engine.js';

// True when a die roll in this section is gated behind the payment keyed `k`: a
// <random|rankcheck|difficulty flag="k"> paired with a [price="k"] cost — the "pay to
// spin" idiom (book2/157, book3/314, book5/674, book6/171/587/50/628). (task 30)
// Defined here (not render-rules.js, which re-exports it) so the dependency between the
// two rule modules stays one-way: render-rules composes these gate deferrals in
// classifyPassive, so it imports from this module — never the reverse.
export function isRollGate(sectionEl, k) {
  return !!(k != null && sectionEl &&
    sectionEl.querySelector(`random[flag="${k}"], rankcheck[flag="${k}"], difficulty[flag="${k}"]`));
}

// DOM node type / position constants, spelled as literals so this module never reaches for
// the browser `Node` global (matching render-rules.js).
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_POSITION_FOLLOWING = 0x04;

// The item-family effect tags (a possession award). Defined here rather than in
// render-rules.js — which re-exports it for its own callers — because computeFightGate
// below needs it and the dependency between the two rule modules stays one-way.
export const ITEM_FAMILY_TAGS = new Set(['item', 'weapon', 'armour', 'tool']);

// The effects a fight gate holds: a value/possession change written after the fight.
const FIGHT_EFFECT_TAGS = new Set(['lose', 'gain', ...ITEM_FAMILY_TAGS]);

// Wrapper tag sets used only by these gate computations.
const ROLLGATE_OPTIONAL_WRAP = new Set(['if', 'elseif', 'else', 'success', 'failure', 'outcome', 'group']);
const ROLLGATE_OUTCOME_WRAP = new Set(['outcomes', 'outcome']);
const TRANSFER_GROUP_WRAP = new Set(['group']);
const BUY_GROUP_WRAP = new Set(['group']);
// A navigation inside one of these is the player's to pick, not a step the section
// executes: a <choice> row, and a <group>'s bundled "click to do this" action.
const REDIRECT_OPTIONAL_WRAP = new Set(['choice', 'choices', 'group']);
// What may precede a section's head redirect and still leave it the FIRST thing the
// section executes: the printed words and their inline styling. Anything else — an
// effect, a roll, another condition — closes the head window (see computeRedirectGate).
const HEAD_PROSE_TAGS = new Set(['p', 'b', 'i', 'u', 'caps', 'text', 'desc', 'br']);

// Does an ancestor of `node` carry one of these (lowercased) tag names? Walks up to the
// section root. A manual sibling of DOM `closest`, kept explicit for the parsed section tree.
export function hasAncestorTag(node, tagSet) {
  for (let p = node.parentNode; p && p.nodeType === ELEMENT_NODE; p = p.parentNode) {
    if (tagSet.has(p.tagName.toLowerCase())) return true;
  }
  return false;
}

// The aggregate outcome of a section's sequential fights (task 45): won only once EVERY
// fight is won; a loss on any fight makes the whole section a loss; a flee ends it;
// otherwise still unresolved (null — the gate stays shut).
export function aggregateFightOutcome(fights) {
  if (!fights.length) return null;
  if (fights.some((f) => f.outcome === 'lose')) return 'lose';
  if (fights.some((f) => f.outcome === 'fled')) return 'fled';
  if (fights.every((f) => f.outcome === 'win')) return 'win';
  return null;
}

// Mid-fight escape codewords (task 54): a codeword BOTH ticked somewhere in this fight
// section AND used as a box= gate on a choice. That box= choice is the surrender/flee
// route, valid only while the fight is live. Empty unless the section has a fight.
export function computeEscapeCodewords(sectionEl) {
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

// The fight gate (tasks 21/45/54/69/213): the navigation nodes that follow a <fight>
// (which must not be clickable until it resolves), which of them are the lose-branch, and
// each BARE post-fight <lose>/<gain> or item-family award classified 'win'/'lose'/'uncond'
// so the renderer can hold it until the fight resolves — the loot on the body is the
// fight's reward, not a free pickup before it (book1/55, book5/162). `escapeCodewords`
// leaves mid-fight surrender/flee choices ungated.
// Returns { navNodes:Set, loseNodes:Set, effectNodes:Map, hasLosePath } or null.
export function computeFightGate(sectionEl, escapeCodewords) {
  if (!sectionEl || !sectionEl.querySelector('fight')) return null;
  const navNodes = new Set(), loseNodes = new Set(), effectNodes = new Map();
  const LOSE = /(you lose|if you lose|are beaten|are defeated|reduced to \d|pass out|knocked (out|unconscious)|battered into|lose the (fight|combat|battle)|you are killed|you are slain)/i;
  const WIN = /(you win|if you win|defeat|reduce the|kill the|slay|victor|survive|beat the|overcome the|are victorious)/i;
  const WRAP = new Set(['if', 'elseif', 'else', 'success', 'failure', 'outcomes', 'group', 'choice']);
  let seenFight = false, recent = '';
  const walk = (n, skip, gated) => {
    for (const ch of Array.from(n.childNodes)) {
      if (ch.nodeType === TEXT_NODE) { if (seenFight) recent = (recent + ' ' + (ch.nodeValue || '')).slice(-220); continue; }
      if (ch.nodeType !== ELEMENT_NODE) continue;
      const tag = ch.tagName.toLowerCase();
      if (tag === 'fight') { seenFight = true; recent = ''; walk(ch, true, gated); continue; }
      const childSkip = skip || tag === 'flee' || tag === 'fightdamage'; // Flee/fightdamage own gotos aren't gated
      const childGated = gated || WRAP.has(tag);
      const isFleeChoice = tag === 'choice' && boolAttr(ch.getAttribute('flee'));
      const isEscapeChoice = ch.getAttribute('box') != null && escapeCodewords.has(ch.getAttribute('box'));
      if (seenFight && !skip && !isFleeChoice && !isEscapeChoice && (tag === 'goto' || tag === 'choice' || tag === 'return')) {
        navNodes.add(ch);
        if (boolAttr(ch.getAttribute('dead')) || (LOSE.test(recent) && !WIN.test(recent))) loseNodes.add(ch);
        recent = '';
      }
      if (seenFight && !skip && !gated && FIGHT_EFFECT_TAGS.has(tag) && !boolAttr(ch.getAttribute('hidden'))) {
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

// A fight-escape bracket's closing <lose codeword="X"> (after the fight) must not fire
// while the fight is unresolved / being fled — that would revoke the surrender/flee choice
// before it can be taken. Defer it until the fight is WON. An entry-clear before the fight
// is left alone. (task 54)
export function isDeferredEscapeClear(node, escapeCodewords, sectionFights) {
  if (node.tagName.toLowerCase() !== 'lose') return false;
  const cw = node.getAttribute('codeword');
  if (!cw || !escapeCodewords.size) return false;
  if (!cw.split(/[|,]/).some((c) => escapeCodewords.has(c.trim()))) return false;
  if (!sectionFights.length) return false; // before the fight → an entry clear, apply now
  return aggregateFightOutcome(sectionFights) !== 'win';
}

// A hidden <tick removetag="X"> — an end-of-section selection-tag cleanup that must not run
// until the tag has done its job (§5.386). Deferred to the section exit. (task 88)
export function isDeferredTagCleanup(node) {
  return node.tagName.toLowerCase() === 'tick'
    && boolAttr(node.getAttribute('hidden'))
    && node.getAttribute('removetag') != null;
}

// A dead=-gated <if> chain positioned AFTER a fight is that fight's win/lose outcome
// (book2/462 confiscate-return, book6/348 "if you win" reward). Defer the whole chain until
// the fight is decided: while unresolved the player is still alive, which would wrongly
// activate the "if you win" branch before a blow is struck. (task 39)
export function isDeferredDeadChain(node, sectionFights) {
  if (node.getAttribute('dead') == null) return false;   // only fight-outcome gates
  if (!sectionFights.length) return false;               // no fight before this node
  const outcome = aggregateFightOutcome(sectionFights);
  return outcome !== 'win' && outcome !== 'lose';        // still unresolved (or fled) → hold
}

// The roll gate (task 104): a mandatory <random> feeding an <outcomes> table must be rolled
// before the section's onward <choices> unlock, and a "get lost" outcome carrying its own
// <goto> suppresses those choices. Scoped to a mandatory roll — a pay-gated or conditionally
// present roll is optional (the choices beside it stay live). Returns
// { rollNode, outcomesNode, navNodes:Set, rollPath, matchedOutcome } or null.
export function computeRollGate(sectionEl) {
  if (!sectionEl) return null;
  const outcomesNode = sectionEl.querySelector('outcomes');
  if (!outcomesNode) return null;
  const rollNode = Array.from(sectionEl.querySelectorAll('random')).find((r) => {
    if (!(r.compareDocumentPosition(outcomesNode) & DOCUMENT_POSITION_FOLLOWING)) return false;
    if (r.getAttribute('price') != null) return false;
    const fl = r.getAttribute('flag');
    if (fl != null && isRollGate(sectionEl, fl)) return false;
    return !hasAncestorTag(r, ROLLGATE_OPTIONAL_WRAP);
  });
  if (!rollNode) return null;
  const navNodes = new Set();
  sectionEl.querySelectorAll('choice, goto, return').forEach((n) => {
    if (!(rollNode.compareDocumentPosition(n) & DOCUMENT_POSITION_FOLLOWING)) return;
    if (hasAncestorTag(n, ROLLGATE_OUTCOME_WRAP)) return;
    if (boolAttr(n.getAttribute('flee'))) return;
    navNodes.add(n);
  });
  if (!navNodes.size) return null; // pure roll-to-goto travel — nothing to gate
  return { rollNode, outcomesNode, navNodes, rollPath: null, matchedOutcome: null };
}

// The forced-transfer gate (task 107): a visible, forced (default force="t"), unpriced
// <transfer> is a mandatory action — the onward navigation after it stays locked until it
// runs. Collect that navigation (choice/goto/return after the first such transfer, outside
// it and any <group> that owns it). Returns { navNodes:Set } or null.
export function computeTransferGate(sectionEl) {
  if (!sectionEl) return null;
  const forced = Array.from(sectionEl.querySelectorAll('transfer')).filter((t) =>
    !boolAttr(t.getAttribute('hidden'))
    && t.getAttribute('price') == null
    && (t.getAttribute('force') == null || boolAttr(t.getAttribute('force'), true))
    && !hasAncestorTag(t, TRANSFER_GROUP_WRAP));
  if (!forced.length) return null;
  const first = forced[0];
  const navNodes = new Set();
  sectionEl.querySelectorAll('choice, goto, return').forEach((n) => {
    if (!(first.compareDocumentPosition(n) & DOCUMENT_POSITION_FOLLOWING)) return;
    if (forced.some((t) => t.contains(n))) return; // navigation inside the transfer's own words
    if (boolAttr(n.getAttribute('flee'))) return;
    navNodes.add(n);
  });
  if (!navNodes.size) return null;
  return { navNodes };
}

// Is this nav node an ABANDON-the-encounter exit rather than a way onward? Two shapes, the
// same two every gate above already skips: a <choice flee="t">, and the mid-fight surrender
// choice gated by an escape codeword (see computeEscapeCodewords). computeFightGate leaves
// both ungated and computeRollGate/computeTransferGate/computeBuyGate each skip flee="t",
// because giving up must never be locked behind the thing you are giving up on. The
// provisional-result gate (applyPendingRerollGate) works on rendered buttons rather than
// nodes, so it needs this predicate to recognise the same exits. (task 205)
export function isEscapeNav(node, escapeCodewords) {
  if (!node || node.nodeType !== ELEMENT_NODE) return false;
  if (boolAttr(node.getAttribute('flee'))) return true;
  const box = node.getAttribute('box');
  return box != null && !!escapeCodewords && escapeCodewords.has(box);
}

// The forced-buy gate (task 136.5): a <buy force="t"> is a mandatory "note it on your
// Adventure Sheet" action — §4.658's free barque, the section's only ship — so the onward
// navigation after it stays locked until it runs. Unlike <transfer>, force defaults to
// FALSE for a buy, so only an explicit force="t" gates; a buy inside a <group> (§4.622's
// optional "take whatever cargo you can fit" pickups) is excluded — those are opt-in and
// gating them would softlock a shipless player. Returns { navNodes:Set } or null.
export function computeBuyGate(sectionEl) {
  if (!sectionEl) return null;
  const forced = Array.from(sectionEl.querySelectorAll('buy')).filter((b) =>
    boolAttr(b.getAttribute('force')) && !hasAncestorTag(b, BUY_GROUP_WRAP));
  if (!forced.length) return null;
  const first = forced[0];
  const navNodes = new Set();
  sectionEl.querySelectorAll('choice, goto, return').forEach((n) => {
    if (!(first.compareDocumentPosition(n) & DOCUMENT_POSITION_FOLLOWING)) return;
    if (forced.some((b) => b.contains(n))) return; // navigation inside the buy's own words
    if (boolAttr(n.getAttribute('flee'))) return;
    navNodes.add(n);
  });
  if (!navNodes.size) return null;
  return { navNodes };
}

// Is this <goto>/<return> one the player MUST follow? JaFL's GotoNode defaults force=true
// and its execute() then returns false — "user must follow this goto - block further
// execution" — so a reached forced goto ends the section. An explicit force="f" is the
// optional "or you may turn back" link, flee/sail are abandon/travel actions, and a
// navigation inside a <choice>/<choices>/<group> is an opt-in the player selects: none of
// those halt anything. A price=/flag= exit is only conditionally usable (flagGate), so it
// is not a guaranteed halt either.
function isMandatoryRedirect(node) {
  const force = node.getAttribute('force');
  if (force != null && !boolAttr(force, true)) return false;
  if (boolAttr(node.getAttribute('flee')) || boolAttr(node.getAttribute('sail'))) return false;
  if (node.getAttribute('price') != null || node.getAttribute('flag') != null) return false;
  return !hasAncestorTag(node, REDIRECT_OPTIONAL_WRAP);
}

// The visit-box redirect gate (task 214). The corpus's once-only idiom writes the redirect
// and the thing it protects as SIBLINGS at the head of a boxes= section:
//
//   <if ticks="1">If there is a tick in the box, <goto section="251"/> immediately.</if>
//   If not, <tick/> and read on.
//   …the reward / the roll / the encounter…
//
// In JaFL that body never executed on the ticked visit: the matched <if> runs its <goto>,
// which blocks the rest of the section (see isMandatoryRedirect). This port renders the
// whole section, so a revisit re-offered book1/16's eight treasures and book1/160's MAGIC
// roll alongside the redirect. Once the redirect matches, everything AFTER the <if> is
// held — the same treatment the untaken branch it really is would get, and exactly what
// the sections already written with an explicit <else> (book5/592) produce today.
//
// Scoped to the section HEAD: only prose and hidden book-keeping (which JaFL runs before it
// reaches the goto) may precede the <if>. That keeps this the "leave now" redirect and
// never a mid-section option — book1/10's ticks="4" redirect sits under two codeword guards
// after a live <tick>, and holding its body would strip the StillInYellowport book-keeping
// that stops Yellowport re-redirecting to §273 forever.
// Returns { ifNode } — everything after it renders held — or null.
export function computeRedirectGate(sectionEl, state) {
  if (!sectionEl || !state) return null;
  let hiddenRoot = null; // the hidden subtree currently being skipped over
  for (const el of sectionEl.querySelectorAll('*')) {
    if (hiddenRoot && hiddenRoot.contains(el)) continue;
    hiddenRoot = null;
    const tag = el.tagName.toLowerCase();
    if (HEAD_PROSE_TAGS.has(tag)) continue;
    if (boolAttr(el.getAttribute('hidden'))) { hiddenRoot = el; continue; }
    // The first executable element decides: a visit-box <if> is the candidate, anything
    // else closes the head window.
    if (tag !== 'if' || el.getAttribute('ticks') == null) return null;
    if (!evaluateCondition(el, state)) return null; // the read-on branch — nothing to hold
    return Array.from(el.querySelectorAll('goto, return')).some(isMandatoryRedirect)
      ? { ifNode: el } : null;
  }
  return null;
}
