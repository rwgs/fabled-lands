// render-rolls.js — the roll + branch view (task 119): dice widgets for
// <difficulty>/<random>/<rankcheck>/<training>, the <reroll> button, and the
// success/failure/outcomes reveal. Plain functions taking the story as first
// argument (no mixins); every rule they act on — pay-to-roll gates, branch
// resolution, blessing spends — is decided by render-rules.js/engine.js, and
// this module only builds the DOM and wires the clicks.

import {
  resolveValue, rollDifficulty, rollRankCheck, rollTraining, rollDice,
  childAdjustment, abilityChoiceOptions,
} from './engine.js';
import { branchPlan, blessingSpendForReroll, isRollGate } from './render-rules.js';
import { renderChoices } from './render-choices.js';
import { animateDice } from './ui.js';
import { diceWord } from './render-util.js';

// ---- shared widgets --------------------------------------------------------

export function rollButton(label, widget, onRoll) {
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

export function showDiceResult(widget, dice, detail, outcome, ok) {
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

// After a resolved roll, offer any blessing the player may spend to reroll it (task 76).
// `opts` = { ability, success, kind:'check'|'random', travel }; eligibility lives in
// state.rerollBlessings. `reroll` re-runs the SAME roll and stores the fresh result (it
// must not itself re-render — this does). A used blessing is consumed unless permanent.
export function appendBlessingReroll(story, widget, opts, reroll) {
  if (story.inactive) return;
  for (const name of story.state.rerollBlessings(opts)) {
    const label = name === 'luck' ? 'Luck' : name === 'travel' ? 'Safe Travel' : name.toUpperCase();
    const btn = document.createElement('button');
    btn.className = 'btn-secondary blessing-reroll';
    btn.textContent = `Use your blessing of ${label} to reroll`;
    btn.addEventListener('click', () => { if (story.state.useBlessing(name)) reroll(); story.rerender(); });
    widget.appendChild(btn);
  }
}

// Pay-to-roll gate state shared by the roll renderers (tasks 30, 51): a flag= roll
// paired with a [price="k"] cost is armed only while flag k is set. Returns the
// flag name and whether the roll is gated / currently armed.
function rollGateState(story, node) {
  const flag = node.getAttribute('flag');
  const gated = flag != null && isRollGate(story.sectionEl, flag);
  const armed = gated ? story.state.getFlag(flag) : true;
  return { flag, gated, armed };
}

// Infer die count from the outcome table this random feeds: if every range
// fits within 1-6, it's a single die (some `type="travel"` rolls), otherwise 2.
function inferDice(story, node, def) {
  if (!story.sectionEl) return def;
  const outs = Array.from(story.sectionEl.querySelectorAll('outcomes'));
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

// ---- reroll ----------------------------------------------------------------

export function renderReroll(story, container, node, path) {
  const btn = document.createElement('button');
  btn.className = 'btn-secondary';
  const inner = document.createElement('span');
  story.appendChildren(inner, node, path);
  btn.textContent = inner.textContent.trim() || 'Roll again';
  const roll = story.activeRoll;
  btn.addEventListener('click', () => {
    // §232/502/716 storm form: the reroll IS the "lose the blessing and roll again"
    // spend. The intended hidden <lose blessing> never fires (its keepblessing guard
    // is reset by a rerunnable entry set every render), so consume the guarded storm
    // blessing here — exactly one reroll's worth of protection. (task 114)
    const spend = blessingSpendForReroll(story.sectionEl, story.state, story.outcomeBlessings);
    if (spend) story.state.useBlessing(spend);
    if (roll) story.ctx.rolls.delete('roll@' + roll.path);
    story.rerender();
  });
  container.appendChild(btn);
  return btn;
}

// ---- rolls: difficulty ------------------------------------------------------

export function renderDifficulty(story, container, node, path) {
  const spec = (node.getAttribute('ability') || '').trim();
  const multi = spec.includes('|');
  const level = resolveValue(story.state, node.getAttribute('level'));
  // modifier= is either a keyword selecting how the ability score resolves
  // (natural/noweapon/affected — book3/235/271/290, book5/516 unarmed COMBAT) or a
  // numeric/var addend. Keywords route into the ability lookup (mode); anything
  // else keeps the historical numeric-modifier behaviour. (task 53)
  const modRaw = (node.getAttribute('modifier') || '').trim().toLowerCase();
  const mode = ['natural', 'noweapon', 'notool', 'affected'].includes(modRaw) ? modRaw : null;
  const modifier = (node.getAttribute('modifier') != null && !mode) ? resolveValue(story.state, node.getAttribute('modifier')) : 0;

  // its own descriptive text
  const desc = document.createElement('span');
  story.appendChildren(desc, node, path);
  if (desc.textContent.trim()) container.appendChild(desc);

  const key = 'roll@' + path;
  const widget = document.createElement('div');
  widget.className = 'roll';
  container.appendChild(widget);

  // Pay-to-roll gate (task 51): a flag= roll paired with a [price=] cost is
  // disabled until the payment sets the flag; rolling consumes it, and a fresh
  // payment re-arms (dropping any stale result). Extends task 30's <random> gate
  // to <difficulty> — book6/731 CHARISMA boon, book2/122/book6/630 "MAGIC or …".
  const { flag, gated, armed } = rollGateState(story, node);
  let stored = story.ctx.rolls.get(key);
  if (gated && armed && stored) { story.ctx.rolls.delete(key); stored = null; }
  // An unresolved roll inside a <while> pass holds the loop until the player rolls
  // it (§5.218's per-pass COMBAT re-attempt to wriggle free). (task 100)
  if (story.inWhileIter && !story.inactive && !stored) story.whileIterPending = true;
  if (stored) {
    const abLabel = (stored.ability || spec.split('|')[0] || '').toUpperCase();
    showDiceResult(widget, stored.dice, `${abLabel} ${stored.abilityScore >= 0 ? '+' : ''}${stored.abilityScore} = ${stored.total} vs ${level}`, stored.success ? 'Success' : 'Failure', stored.success);
    appendBlessingReroll(story, widget, { ability: stored.ability, success: stored.success, kind: 'check' }, () => {
      const res = rollDifficulty(story.state, stored.ability, level, modifier + childAdjustment(node, story.state), mode);
      if (node.getAttribute('var')) { story.state.setVar(node.getAttribute('var'), res.margin); story.ctx.wroteVars.add(node.getAttribute('var')); story.ctx.rolledVars.add(node.getAttribute('var')); }
      story.ctx.rolls.set(key, res);
    });
    return widget;
  }
  // Under the Three Fortunes' difficultyCurse an ability roll uses one die (task 36).
  const diceLabel = diceWord(story.state.data.oneDieRolls ? 1 : 2);
  if (gated && !armed) {
    const btn = rollButton(`Roll ${diceLabel} + ${spec.split('|')[0].toUpperCase()}`, widget, () => {});
    btn.disabled = true; btn.title = 'Pay first to make this roll.';
    widget.appendChild(btn);
    return widget;
  }
  // "combat|magic": let the player pick which ability to roll before rolling.
  const pickKey = 'pick@' + path;
  const ability = multi ? story.ctx.rolls.get(pickKey) : spec;
  if (multi && !ability) {
    story.appendAbilityPicker(widget, abilityChoiceOptions(spec, story.state, false), (ab) => { story.ctx.rolls.set(pickKey, ab); story.rerender(); });
    return widget;
  }
  const abLabel = (ability || '').split('|')[0].toUpperCase();
  const btn = rollButton(`Roll ${diceLabel} + ${abLabel}`, widget, () => {
    if (gated) story.state.setFlag(flag, false); // consume the payment — re-pay to re-attempt
    const res = rollDifficulty(story.state, ability, level, modifier + childAdjustment(node, story.state), mode);
    if (node.getAttribute('var')) { story.state.setVar(node.getAttribute('var'), res.margin); story.ctx.wroteVars.add(node.getAttribute('var')); story.ctx.rolledVars.add(node.getAttribute('var')); }
    story.ctx.rolls.set(key, res);
    story.rerender();
  });
  widget.appendChild(btn);
  return widget;
}

// ---- rolls: random -----------------------------------------------------------

export function renderRandom(story, container, node, path) {
  // Remember where the travel/encounter gate's roll lives, so applyRollGate can read
  // its result (whether the leg has been rolled yet) after the walk. (task 104)
  if (story.rollGate && node === story.rollGate.rollNode) story.rollGate.rollPath = path;
  const dice = node.hasAttribute('dice') ? parseInt(node.getAttribute('dice'), 10) : inferDice(story, node, 2);
  const varName = node.getAttribute('var');
  const desc = document.createElement('span');
  story.appendChildren(desc, node, path);
  if (desc.textContent.trim()) container.appendChild(desc);

  const key = 'roll@' + path;
  const widget = document.createElement('div');
  widget.className = 'roll';
  container.appendChild(widget);

  // Pay-gated roll (book2/157 etc.): the roll enables only once its payment sets
  // the flag; rolling consumes the flag, and a fresh payment re-arms it. (task 30)
  const flag = node.getAttribute('flag');
  const gated = flag != null && isRollGate(story.sectionEl, flag);
  const armed = gated ? story.state.getFlag(flag) : true;
  let stored = story.ctx.rolls.get(key);
  // Re-arm: a new payment (flag set again) after a prior spin drops the old result
  // so the player can roll afresh — the per-visit "spin again" cycle.
  if (gated && armed && stored) { story.ctx.rolls.delete(key); stored = null; }
  // A <while> pass that has not yet rolled blocks the loop and marks its var stale
  // (so its downstream `<lose stamina="x">` waits for THIS six, not the last). (task 100)
  if (story.inWhileIter && !story.inactive && !stored) {
    story.whileIterPending = true;
    if (varName && story.whileIterPendingVars) story.whileIterPendingVars.add(varName);
  }

  if (stored) {
    // Re-assert this roll's value into its var on every render so a var re-rolled
    // by a later <while> pass still reads correctly here in document order — the
    // authoritative value is already saved, so replay it without a fresh save. (task 100)
    if (varName && story.state.getVar(varName) !== stored.total) story.state.restoreVar(varName, stored.total);
    showDiceResult(widget, stored.dice, `Rolled ${stored.total}`, '', true);
    // Luck rerolls any dice result; Safe Travel rerolls a type="travel" encounter.
    const travel = (node.getAttribute('type') || '').toLowerCase() === 'travel';
    appendBlessingReroll(story, widget, { kind: 'random', travel }, () => {
      const r = rollDice(dice);
      const total = r.total + childAdjustment(node, story.state);
      const res = { kind: 'random', dice: r.dice, total };
      if (varName) { story.state.setVar(varName, total); story.ctx.wroteVars.add(varName); story.ctx.rolledVars.add(varName); }
      story.ctx.rolls.set(key, res);
    });
  } else if (gated && !armed) {
    const btn = rollButton(`Roll ${diceWord(dice)}`, widget, () => {});
    btn.disabled = true; btn.title = 'Pay first to make this roll.';
    widget.appendChild(btn);
  } else {
    widget.appendChild(rollButton(`Roll ${diceWord(dice)}`, widget, () => {
      if (gated) story.state.setFlag(flag, false); // consume the payment — re-pay to spin again
      const r = rollDice(dice);
      const total = r.total + childAdjustment(node, story.state);
      const res = { kind: 'random', dice: r.dice, total };
      if (varName) { story.state.setVar(varName, total); story.ctx.wroteVars.add(varName); story.ctx.rolledVars.add(varName); }
      story.ctx.rolls.set(key, res);
      story.rerender();
    }));
  }
  return widget;
}

export function renderRankcheck(story, container, node, path) {
  const dice = parseInt(node.getAttribute('dice') || '1', 10);
  const add = parseInt(node.getAttribute('add') || '0', 10);
  const key = 'roll@' + path;
  const widget = document.createElement('div');
  widget.className = 'roll';
  container.appendChild(widget);
  // Pay-to-roll gate (task 51), as for <difficulty>/<random>.
  const { flag, gated, armed } = rollGateState(story, node);
  let stored = story.ctx.rolls.get(key);
  if (gated && armed && stored) { story.ctx.rolls.delete(key); stored = null; }
  if (story.inWhileIter && !story.inactive && !stored) story.whileIterPending = true; // hold a <while> pass (task 100)
  if (stored) {
    showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs Rank ${story.state.rankValue()}`, stored.success ? 'Success' : 'Failure', stored.success);
    appendBlessingReroll(story, widget, { success: stored.success, kind: 'check' }, () => {
      const res = rollRankCheck(story.state, dice, add, childAdjustment(node, story.state));
      if (node.getAttribute('var')) { story.state.setVar(node.getAttribute('var'), res.margin); story.ctx.wroteVars.add(node.getAttribute('var')); story.ctx.rolledVars.add(node.getAttribute('var')); }
      story.ctx.rolls.set(key, res);
    });
  } else if (gated && !armed) {
    const btn = rollButton(`Rank check (roll ${diceWord(dice)})`, widget, () => {});
    btn.disabled = true; btn.title = 'Pay first to make this roll.';
    widget.appendChild(btn);
  } else {
    widget.appendChild(rollButton(`Rank check (roll ${diceWord(dice)})`, widget, () => {
      if (gated) story.state.setFlag(flag, false); // consume the payment
      const res = rollRankCheck(story.state, dice, add, childAdjustment(node, story.state));
      if (node.getAttribute('var')) { story.state.setVar(node.getAttribute('var'), res.margin); story.ctx.wroteVars.add(node.getAttribute('var')); story.ctx.rolledVars.add(node.getAttribute('var')); }
      story.ctx.rolls.set(key, res);
      story.rerender();
    }));
  }
  return widget;
}

export function renderTraining(story, container, node, path) {
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
  const stored = story.ctx.rolls.get(key);
  if (story.inWhileIter && !story.inactive && !stored) story.whileIterPending = true; // hold a <while> pass (task 100)
  if (stored) {
    const ab = stored.ability;
    showDiceResult(widget, stored.dice, `Rolled ${stored.total} vs ${ab.toUpperCase()} ${stored.natural}`, stored.success ? `+1 ${ab.toUpperCase()}` : 'No gain', stored.success);
    // Only Luck rerolls a training roll (self-improvement, not an ability *test*).
    appendBlessingReroll(story, widget, { success: stored.success, kind: 'check' }, () => {
      story.ctx.rolls.set(key, rollTraining(story.state, ab, dice, add));
    });
    return widget;
  }
  const pickKey = 'pick@' + path;
  const ability = multi ? story.ctx.rolls.get(pickKey) : spec.toLowerCase();
  if (multi && !ability) {
    story.appendAbilityPicker(widget, abilityChoiceOptions(spec, story.state, false), (ab) => { story.ctx.rolls.set(pickKey, ab); story.rerender(); });
    return widget;
  }
  widget.appendChild(rollButton(`Train ${ability.toUpperCase()} (roll ${diceWord(dice)})`, widget, () => {
    story.ctx.rolls.set(key, rollTraining(story.state, ability, dice, add));
    story.rerender();
  }));
  return widget;
}

// ---- branches (success/failure/outcomes) -------------------------------------
// Resolution — which branch is pending, matching, or blessing-vetoed — lives in
// branchPlan (render-rules.js, task 119); the view reveals what the plan says.

export function renderBranch(story, container, node, path, activeRoll) {
  const roll = activeRoll ? story.ctx.rolls.get('roll@' + activeRoll.path) : null;
  const plan = branchPlan(story.state, story.ctx, node, roll);
  switch (plan.kind) {
    case 'skip': return;
    case 'reveal': revealBranch(story, container, node, path); return;
    case 'table': {
      if (plan.reveal) {
        // Record the matched outcome for the roll gate: if it carries its own
        // redirect (a "get lost" <goto>), applyRollGate keeps the onward choices
        // suppressed so only that redirect is offered (§1.278 → 82). (task 104)
        if (story.rollGate && node === story.rollGate.outcomesNode) story.rollGate.matchedOutcome = plan.reveal;
        revealBranch(story, container, plan.reveal, path + '.o' + plan.index);
      }
      // Always-available alternatives inside the table (e.g. "or don't try").
      const choiceKids = Array.from(node.children).filter((c) => c.tagName.toLowerCase() === 'choice');
      if (choiceKids.length) renderChoices(story, container, node, path, null, choiceKids);
      return;
    }
    default: if (!roll) story.appendChildren(container, node, path);
  }
}

function revealBranch(story, container, node, path) {
  const box = document.createElement('span');
  box.className = 'branch';
  // apply effects + render inner content
  story.appendChildren(box, node, path);
  // if it declares a section (goto target), add a continue link
  const section = node.getAttribute('section');
  if (section != null) {
    const targetBook = node.getAttribute('book') ? Number(node.getAttribute('book')) : story.book;
    const btn = document.createElement('button');
    btn.className = 'goto goto-primary';
    btn.textContent = 'Continue → ' + section;
    btn.addEventListener('click', () => story.navigate(targetBook, section));
    box.appendChild(btn);
  }
  container.appendChild(box);
}
