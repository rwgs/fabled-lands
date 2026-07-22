// render-combat.js — the combat view (task 119).
//
// Plain functions taking the story as first argument (no prototype mixin): single and
// simultaneous-group battles, the per-round Attack/Flee/blessing controls, and the live
// fight widget. render.js's TAG_RENDERERS dispatches renderFight; the rest are internal
// helpers. The combat RULES live in combat.js; this only builds the widget and wires the
// clicks.

import { makeFight, fightRound, groupFightRound, isDefeated, useWrathBlessing, useDefenceBlessing, rerollAttack } from './combat.js';
import { applyEffectBody } from './engine.js';
import { aggregateFightOutcome } from './render-gates.js';
import { animateDice, freezeButtons } from './ui.js';

export function renderFight(story, container, node, path) {
  // group="G": all <fight> in the section sharing the id are one simultaneous
  // battle (task 26). Draw the whole group once, at its first member, and skip
  // the rest of the members this pass.
  const group = node.getAttribute('group');
  if (group) return renderGroupFight(story, container, node, group);

  const key = 'fight@' + path;
  let fight = story.ctx.fights.get(key);
  if (!fight) {
    fight = makeFight(node, story.state);
    story.ctx.fights.set(key, fight);
  }

  // Sequential multi-fight sections ("fight them one at a time" — book1/121
  // and ~17 others) resolve their fights in document order. This widget stays
  // LOCKED until every earlier fight is won, and all of the section's fights
  // feed one aggregate outcome (task 45). A fight drawn inside an untaken
  // branch (story.inactive) is display-only — never tracked, and never allowed
  // to hold the gate closed.
  let locked = false;
  if (!story.inactive) {
    locked = story.sectionFights.some((f) => f.outcome !== 'win');
    story.sectionFights.push(fight);
    // A settable proxy: applyFightGate / the death guard read `outcome`, and a
    // flee="t" choice may assign it (render-choices renderChoice) — an override wins
    // over the computed aggregate so that assignment doesn't throw on a getter.
    story.sectionFight = {
      _override: null,
      get name() {
        const pending = story.sectionFights.find((f) => f.outcome !== 'win');
        return (pending || fight).name;
      },
      get outcome() { return this._override || aggregateFightOutcome(story.sectionFights); },
      set outcome(v) { this._override = v; },
    };
  }

  // Find the section's <fightdamage>/<flee>/<fightround> ANYWHERE (they may sit
  // inside a <p>, or even before the <fight> — book2/152/207/297/313 etc.), not
  // just as a forward same-level sibling.
  const dmgNode = findInSection(story, 'fightdamage');
  const fleeNode = findInSection(story, 'flee');
  const roundNode = findInSection(story, 'fightround'); // between-round rules (task 99)

  const box = document.createElement('div');
  box.className = 'fight';
  container.appendChild(box);
  drawFight(story, box, fight, node, dmgNode, fleeNode, key, locked, roundNode);
  return box;
}

// A simultaneous group fight: the player strikes one enemy, then every living
// enemy strikes back (§6.192/273/291/618). Rendered as a single combined widget.
function renderGroupFight(story, container, node, group) {
  if (story.renderedGroups.has(group)) return null; // already drawn at the first member
  story.renderedGroups.add(group);
  const members = Array.from(story.sectionEl.querySelectorAll('fight')).filter((f) => f.getAttribute('group') === group);
  const fights = members.map((m, i) => {
    const key = 'fightgrp@' + group + '.' + i;
    let f = story.ctx.fights.get(key);
    if (!f) { f = makeFight(m, story.state); story.ctx.fights.set(key, f); }
    return f;
  });
  const dmgNode = findInSection(story, 'fightdamage');
  const fleeNode = findInSection(story, 'flee');
  // A shared proxy drives the fight gate + death guard for the whole group: a
  // win once every foe is down; a (non-death) "lose" when the player is slain
  // and the section has an "if you lose…" branch; otherwise unresolved/death.
  // `outcome` is settable so a flee/surrender ('fled') can be recorded without
  // throwing on a getter — the override wins over the computed state (task 48).
  story.sectionFight = {
    _override: null,
    name: fights.map((f) => f.name).join(', '),
    get outcome() {
      if (this._override) return this._override;
      if (fights.every((f) => isDefeated(f))) return 'win';
      if (story.state.isDead()) return (story.fightGate && story.fightGate.hasLosePath) ? 'lose' : null;
      return null;
    },
    set outcome(v) { this._override = v; },
  };
  const box = document.createElement('div');
  box.className = 'fight';
  container.appendChild(box);
  drawGroupFight(story, box, fights, dmgNode, group, fleeNode);
  return box;
}

// ---- shared control-shell helpers (task 171) --------------------------------
// drawFight (single) and drawGroupFight (group) use DIFFERENT headless rules — fightRound vs
// groupFightRound, per-fight outcome vs the group proxy, one foe vs a target picker — and those
// stay visibly separate below. But their VIEW shells are identical: the player stats row, the
// live log, the animated-strike guard, flee-target routing, and the "resolve-or-continue"
// commit tail. These small local helpers hold that shared shell once so a persistence/blessing/
// flee change lands in both widgets (the parity that drifted across tasks 83/87/91/162/166).

// The player's stats line. defenceBonus is the per-fight Defence-through-Faith raise (stored on
// the single fight, or shared on every group member — task 91), folded in with the transient
// special="attack"/"defence" bonuses so the shown values match what resolution uses. (tasks 49, 87)
function playerStatsRow(story, defenceBonus = 0) {
  const you = document.createElement('div');
  you.className = 'fight-stats you';
  const shownCombat = story.state.ability('combat') + story.state.fightAttackBonus();
  const shownDef = story.state.defence() + story.state.fightDefenceBonus() + (defenceBonus || 0);
  you.innerHTML = `<span>Your Combat ${shownCombat}</span><span>Your Defence ${shownDef}</span><span>Your Stamina ${story.state.data.stamina}/${story.state.effectiveStaminaMax()}</span>`;
  return you;
}

// The last six lines of the fight log (aria-live so screen readers hear each round, task 153).
function logRow(lines) {
  const logEl = document.createElement('div');
  logEl.className = 'fight-log';
  logEl.setAttribute('aria-live', 'polite');
  lines.slice(-6).forEach((l) => { const p = document.createElement('div'); p.textContent = l; logEl.appendChild(p); });
  return logEl;
}

// The animated-strike guard (task 146): freeze the pane, roll the dice, and report whether the
// visit is still current. Returns false if the player navigated away mid-animation, so the
// caller drops the strike rather than landing it on the next visit's ctx.
async function animatedStrike(story, box) {
  const ctxAtClick = story.ctx;
  freezeButtons(story.root);
  await animateDice(box, true);
  return story.ctx === ctxAtClick;
}

// Route a resolved flee to its escape section (tasks 21, 169): the <flee>'s own <goto>, else a
// section-level <choice flee="t">, else a plain rerender (the flee only unlocks a box-gated
// choice, e.g. §207 → §22). The parting wound is durable, so the move is marked durable — a
// failed target arms a retry rather than leaving a fled fight with no way out.
function fleeNavigate(story, fleeNode) {
  const fgoto = fleeNode.querySelector('goto');
  const fchoice = story.sectionEl && story.sectionEl.querySelector('choice[flee="t"][section]');
  if (fgoto && fgoto.getAttribute('section') != null) {
    story.navigate(fgoto.getAttribute('book') ? Number(fgoto.getAttribute('book')) : story.book, fgoto.getAttribute('section'), { durable: true });
  } else if (fchoice) {
    story.navigate(fchoice.getAttribute('book') ? Number(fchoice.getAttribute('book')) : story.book, fchoice.getAttribute('section'), { durable: true });
  } else {
    story.rerender();
  }
}

// The Flee button: apply the <flee> body NOW (the parting wound / "ran away" codeword — it
// fires on the flee, never on render), mark the fight fled via the caller's proxy (a single
// fight's own outcome, or the group's shared sectionFight), then route to the escape section.
function makeFleeButton(story, fleeNode, markFled) {
  const flee = document.createElement('button');
  flee.className = 'btn-secondary';
  flee.textContent = 'Flee';
  flee.addEventListener('click', () => {
    applyEffectBody(fleeNode, story.state);
    markFled();
    if (story.state.isDead()) { story.rerender(); return; } // a fatal parting wound
    fleeNavigate(story, fleeNode);
  });
  return flee;
}

// The shared tail after a combat action that didn't navigate away: on a resolved fight (or
// death) rerender the whole section so the fight gate + death/lose guard re-evaluate; otherwise
// redraw the widget in place and persist the round, so a reload resumes it rather than rewinding
// to the pre-round state (task 162). `resolved` and `redraw` are supplied per widget.
function afterAction(story, resolved, redraw) {
  if (resolved || story.state.isDead()) { story.rerender(); return; }
  redraw();
  story.state.commitVisit();
}

function drawGroupFight(story, box, fights, dmgNode, group, fleeNode = null) {
  box.innerHTML = '';
  const redraw = () => drawGroupFight(story, box, fights, dmgNode, group, fleeNode);
  const groupResolved = () => fights.every((f) => isDefeated(f)); // group-specific resolution rule
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

  box.appendChild(playerStatsRow(story, fights[0] ? fights[0].defenceBonus : 0)); // shared group Defence mark
  box.appendChild(logRow(fights.flatMap((f) => f.log)));

  if (groupResolved()) {
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
      if (!(await animatedStrike(story, box))) return; // navigated away mid-animation — drop the strike
      groupFightRound(story.state, fights, dmgNode, target);
      // A <fightdamage> body's <goto> (a wound redirect) ends the combat by
      // navigation, exactly as in a single fight. (tasks 99, 169)
      const redirected = fights.find((f) => f.roundGoto);
      if (redirected && !story.state.isDead()) {
        const g = redirected.roundGoto; fights.forEach((f) => { f.roundGoto = null; });
        story.navigate(g.book != null ? g.book : story.book, g.section, { durable: true });
        return;
      }
      afterAction(story, groupResolved(), redraw);
    });
    controls.appendChild(attack);
  });

  // A <flee> escape (e.g. §6.291 "flee back to your ship, →745"): the group records its fled
  // state on the shared proxy so the gate/death guard see it (task 48).
  if (fleeNode) controls.appendChild(makeFleeButton(story, fleeNode, () => { story.sectionFight.outcome = 'fled'; }));

  // COMBAT blessing (§4.324, task 91): retry the missed strike against the same
  // target — the foe struck last round carries the missed flag.
  const missed = fights.find((f) => f.lastStrikeMissed && !f.attackRerolled && !isDefeated(f));
  if (missed && story.state.hasBlessing('combat')) {
    const rr = document.createElement('button');
    rr.className = 'btn-secondary blessing-combat';
    rr.textContent = `Use COMBAT blessing (retry your attack${living.length > 1 ? ` on ${missed.name}` : ''})`;
    rr.addEventListener('click', () => {
      if (!rerollAttack(story.state, missed)) return;
      afterAction(story, groupResolved(), redraw);
    });
    controls.appendChild(rr);
  }

  // Combat blessings in a group fight (task 83): usable once per COMBAT (the whole
  // group), only while unresolved and only when held. Divine Wrath needs a target,
  // so render one button per living foe; Defence through Faith is target-agnostic.
  // The once-per-combat guard lives on the group proxy (story.sectionFight), not
  // per-foe, and useWrathBlessing/useDefenceBlessing consume the blessing (task 80).
  if (story.state.hasBlessing('wrath') && !story.sectionFight.wrathUsed) {
    living.forEach((target) => {
      const w = document.createElement('button');
      w.className = 'btn-secondary blessing-combat';
      w.textContent = living.length > 1 ? `Divine Wrath on ${target.name} (1d)` : 'Use Divine Wrath (1d damage)';
      w.addEventListener('click', () => {
        const dmg = useWrathBlessing(story.state, target);
        story.sectionFight.wrathUsed = true; // once per combat, across every foe
        story.notify(`Divine Wrath strikes the ${target.name} for ${dmg}!`);
        afterAction(story, groupResolved(), redraw);
      });
      controls.appendChild(w);
    });
  }
  // The proxy is rebuilt on a full rerender, so also gate on the members' stored
  // bonus — the durable once-per-combat mark. (task 91)
  if (story.state.hasBlessing('defence') && !story.sectionFight.defenceUsed && !fights.some((f) => f.defenceBonus)) {
    const d = document.createElement('button');
    d.className = 'btn-secondary blessing-combat';
    d.textContent = 'Use Defence through Faith (+3 Defence)';
    d.addEventListener('click', () => {
      // One encounter: the mark lives on the group proxy, the +3 on every member. (task 91)
      useDefenceBlessing(story.state, story.sectionFight, 3, fights);
      afterAction(story, false, redraw); // Defence never resolves the fight
    });
    controls.appendChild(d);
  }
  box.appendChild(controls);
}

// The first element with `tag` anywhere in the current section (sections carry
// at most one <flee>/<fightdamage>), regardless of nesting or order vs <fight>.
function findInSection(story, tag) {
  return story.sectionEl ? story.sectionEl.querySelector(tag) : null;
}

function drawFight(story, box, fight, node, dmgNode, fleeNode, key, locked = false, roundNode = null) {
  box.innerHTML = '';
  const redraw = () => drawFight(story, box, fight, node, dmgNode, fleeNode, key, false, roundNode); // never locked mid-fight
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

  box.appendChild(playerStatsRow(story, fight.defenceBonus)); // fight.defenceBonus = this fight's Defence-through-Faith raise
  box.appendChild(logRow(fight.log));

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
    if (!(await animatedStrike(story, box))) return; // navigated away mid-animation — drop the strike
    fightRound(story.state, fight, dmgNode, roundNode);
    // A <fightround>/<fightdamage> body can end the fight by navigation — §5.689
    // "dragged you under" (→7), §4.238 "if you get wounded" (→184). The round is durable, so a
    // failed target arms a retry rather than dropping the redirect and re-showing Attack. (tasks 99, 169)
    if (fight.roundGoto && !story.state.isDead()) {
      const g = fight.roundGoto; fight.roundGoto = null;
      story.navigate(g.book != null ? g.book : story.book, g.section, { durable: true });
      return;
    }
    // Reduced to 0 Stamina: if the section has an "if you lose…" branch, that's
    // a (non-death) loss — route to it; otherwise it's death.
    if (story.state.isDead() && story.fightGate && story.fightGate.hasLosePath) fight.outcome = 'lose';
    afterAction(story, fight.outcome, redraw);
  });
  controls.appendChild(attack);

  if (fleeNode) controls.appendChild(makeFleeButton(story, fleeNode, () => { fight.outcome = 'fled'; }));

  // COMBAT blessing (§4.324, task 91): a MISSED strike may be retried once per
  // round — the player alone strikes again; the enemy's reply is never repeated.
  if (fight.lastStrikeMissed && !fight.attackRerolled && story.state.hasBlessing('combat')) {
    const rr = document.createElement('button');
    rr.className = 'btn-secondary blessing-combat';
    rr.textContent = 'Use COMBAT blessing (retry your attack)';
    rr.addEventListener('click', () => {
      if (!rerollAttack(story.state, fight)) return;
      afterAction(story, fight.outcome, redraw);
    });
    controls.appendChild(rr);
  }

  // Combat blessings (task 80): usable once per fight while it is unresolved, and only
  // shown when the player actually holds the blessing (so a blessing-less character —
  // e.g. the every-section scan — never sees them). Divine Wrath deals 1d to the enemy
  // (and can fell it); Defence through Faith adds +3 to Defence for this fight. The
  // rules live in combat.js; the view only renders the button and the outcome.
  if (story.state.hasBlessing('wrath') && !fight.wrathUsed) {
    const w = document.createElement('button');
    w.className = 'btn-secondary blessing-combat';
    w.textContent = 'Use Divine Wrath (1d damage)';
    w.addEventListener('click', () => {
      const dmg = useWrathBlessing(story.state, fight);
      story.notify(`Divine Wrath strikes the ${fight.name} for ${dmg}!`);
      afterAction(story, fight.outcome, redraw);
    });
    controls.appendChild(w);
  }
  if (story.state.hasBlessing('defence') && !fight.defenceUsed) {
    const d = document.createElement('button');
    d.className = 'btn-secondary blessing-combat';
    d.textContent = 'Use Defence through Faith (+3 Defence)';
    d.addEventListener('click', () => {
      useDefenceBlessing(story.state, fight);
      afterAction(story, fight.outcome, redraw); // Defence never resolves the fight (outcome stays null)
    });
    controls.appendChild(d);
  }
  box.appendChild(controls);
}
