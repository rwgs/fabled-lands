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

function drawGroupFight(story, box, fights, dmgNode, group, fleeNode = null) {
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
  const shownCombat = story.state.ability('combat') + story.state.fightAttackBonus();
  const shownDef = story.state.defence() + story.state.fightDefenceBonus() + (fights[0] ? (fights[0].defenceBonus || 0) : 0);
  you.innerHTML = `<span>Your Combat ${shownCombat}</span><span>Your Defence ${shownDef}</span><span>Your Stamina ${story.state.data.stamina}/${story.state.effectiveStaminaMax()}</span>`;
  box.appendChild(you);

  const logEl = document.createElement('div');
  logEl.className = 'fight-log';
  logEl.setAttribute('aria-live', 'polite'); // announce each combat round to screen readers (task 153)
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
      // Freeze the whole pane and remember the visit: a still-live control clicked
      // during the ~0.5s animation must not let groupFightRound mutate state after the
      // player has left this section, nor land it on the next visit's ctx (task 146).
      const ctxAtClick = story.ctx;
      freezeButtons(story.root);
      await animateDice(box, true);
      if (story.ctx !== ctxAtClick) return; // navigated away mid-animation — drop the strike
      groupFightRound(story.state, fights, dmgNode, target);
      // A <fightdamage> body's <goto> (a wound redirect) ends the combat by
      // navigation, exactly as in a single fight. (task 99)
      const redirected = fights.find((f) => f.roundGoto);
      if (redirected && !story.state.isDead()) {
        const g = redirected.roundGoto; fights.forEach((f) => { f.roundGoto = null; });
        story.navigate(g.book != null ? g.book : story.book, g.section);
        return;
      }
      // On any resolution (all foes down) or death, rerender so the gate (and the
      // death/lose guard, via the sectionFight proxy above) re-evaluates.
      if (fights.every((f) => isDefeated(f)) || story.state.isDead()) { story.rerender(); return; }
      drawGroupFight(story, box, fights, dmgNode, group, fleeNode); // fight continues
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
      applyEffectBody(fleeNode, story.state);
      story.sectionFight.outcome = 'fled';
      if (story.state.isDead()) { story.rerender(); return; } // a fatal parting wound
      const fgoto = fleeNode.querySelector('goto');
      const fchoice = story.sectionEl && story.sectionEl.querySelector('choice[flee="t"][section]');
      if (fgoto && fgoto.getAttribute('section') != null) {
        story.navigate(fgoto.getAttribute('book') ? Number(fgoto.getAttribute('book')) : story.book, fgoto.getAttribute('section'));
      } else if (fchoice) {
        story.navigate(fchoice.getAttribute('book') ? Number(fchoice.getAttribute('book')) : story.book, fchoice.getAttribute('section'));
      } else {
        story.rerender();
      }
    });
    controls.appendChild(flee);
  }

  // COMBAT blessing (§4.324, task 91): retry the missed strike against the same
  // target — the foe struck last round carries the missed flag.
  const missed = fights.find((f) => f.lastStrikeMissed && !f.attackRerolled && !isDefeated(f));
  if (missed && story.state.hasBlessing('combat')) {
    const rr = document.createElement('button');
    rr.className = 'btn-secondary blessing-combat';
    rr.textContent = `Use COMBAT blessing (retry your attack${living.length > 1 ? ` on ${missed.name}` : ''})`;
    rr.addEventListener('click', () => {
      if (!rerollAttack(story.state, missed)) return;
      if (fights.every((f) => isDefeated(f)) || story.state.isDead()) { story.rerender(); return; }
      drawGroupFight(story, box, fights, dmgNode, group, fleeNode);
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
        if (fights.every((f) => isDefeated(f)) || story.state.isDead()) { story.rerender(); return; }
        drawGroupFight(story, box, fights, dmgNode, group, fleeNode);
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
      drawGroupFight(story, box, fights, dmgNode, group, fleeNode);
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
  const shownCombat = story.state.ability('combat') + story.state.fightAttackBonus();
  const shownDef = story.state.defence() + story.state.fightDefenceBonus() + (fight.defenceBonus || 0);
  you.innerHTML = `<span>Your Combat ${shownCombat}</span><span>Your Defence ${shownDef}</span><span>Your Stamina ${story.state.data.stamina}/${story.state.effectiveStaminaMax()}</span>`;
  box.appendChild(you);

  const logEl = document.createElement('div');
  logEl.className = 'fight-log';
  logEl.setAttribute('aria-live', 'polite'); // announce each combat round to screen readers (task 153)
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
    // Freeze the whole pane and remember the visit (task 146): a still-live control
    // clicked during the ~0.5s animation must not let fightRound mutate state after the
    // player has left this section, nor land the strike on the next visit's ctx.
    const ctxAtClick = story.ctx;
    freezeButtons(story.root);
    await animateDice(box, true);
    if (story.ctx !== ctxAtClick) return; // navigated away mid-animation — drop the strike
    fightRound(story.state, fight, dmgNode, roundNode);
    // A <fightround>/<fightdamage> body can end the fight by navigation — §5.689
    // "dragged you under" (→7), §4.238 "if you get wounded" (→184). (task 99)
    if (fight.roundGoto && !story.state.isDead()) {
      const g = fight.roundGoto; fight.roundGoto = null;
      story.navigate(g.book != null ? g.book : story.book, g.section);
      return;
    }
    // Reduced to 0 Stamina: if the section has an "if you lose…" branch, that's
    // a (non-death) loss — route to it; otherwise it's death.
    if (story.state.isDead() && story.fightGate && story.fightGate.hasLosePath) fight.outcome = 'lose';
    // On any resolution (win/lose/fled) or death, re-render the whole section so
    // the fight gate re-evaluates which onward links are enabled.
    if (fight.outcome || story.state.isDead()) { story.rerender(); return; }
    drawFight(story, box, fight, node, dmgNode, fleeNode, key, false, roundNode); // fight continues (never locked mid-fight)
  });
  controls.appendChild(attack);

  if (fleeNode) {
    const flee = document.createElement('button');
    flee.className = 'btn-secondary';
    flee.textContent = 'Flee';
    flee.addEventListener('click', () => {
      // Apply the flee consequence NOW (the parting wound / "ran away" codeword)
      // — it lives in <flee> and must fire on the flee, never on render.
      applyEffectBody(fleeNode, story.state);
      fight.outcome = 'fled';
      if (story.state.isDead()) { story.rerender(); return; } // a fatal parting wound
      const fgoto = fleeNode.querySelector('goto');
      const fchoice = story.sectionEl && story.sectionEl.querySelector('choice[flee="t"][section]');
      if (fgoto && fgoto.getAttribute('section') != null) {
        story.navigate(fgoto.getAttribute('book') ? Number(fgoto.getAttribute('book')) : story.book, fgoto.getAttribute('section'));
      } else if (fchoice) {
        story.navigate(fchoice.getAttribute('book') ? Number(fchoice.getAttribute('book')) : story.book, fchoice.getAttribute('section'));
      } else {
        story.rerender(); // no target: the flee unlocks a box-gated choice (e.g. §207 → §22)
      }
    });
    controls.appendChild(flee);
  }

  // COMBAT blessing (§4.324, task 91): a MISSED strike may be retried once per
  // round — the player alone strikes again; the enemy's reply is never repeated.
  if (fight.lastStrikeMissed && !fight.attackRerolled && story.state.hasBlessing('combat')) {
    const rr = document.createElement('button');
    rr.className = 'btn-secondary blessing-combat';
    rr.textContent = 'Use COMBAT blessing (retry your attack)';
    rr.addEventListener('click', () => {
      if (!rerollAttack(story.state, fight)) return;
      if (fight.outcome || story.state.isDead()) { story.rerender(); return; }
      drawFight(story, box, fight, node, dmgNode, fleeNode, key, false, roundNode);
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
      if (fight.outcome || story.state.isDead()) { story.rerender(); return; }
      drawFight(story, box, fight, node, dmgNode, fleeNode, key, false, roundNode);
    });
    controls.appendChild(w);
  }
  if (story.state.hasBlessing('defence') && !fight.defenceUsed) {
    const d = document.createElement('button');
    d.className = 'btn-secondary blessing-combat';
    d.textContent = 'Use Defence through Faith (+3 Defence)';
    d.addEventListener('click', () => {
      useDefenceBlessing(story.state, fight);
      drawFight(story, box, fight, node, dmgNode, fleeNode, key, false, roundNode);
    });
    controls.appendChild(d);
  }
  box.appendChild(controls);
}
