// render-combat.js — the combat view (task 119).
//
// The DOM-construction methods for fights: single and simultaneous-group battles, the
// per-round Attack/Flee/blessing controls, and the live fight widget. Exported as a
// methods object that render.js mixes onto Story.prototype (Object.assign), so `this`
// is the Story instance and these compose with the rest of the renderer unchanged. The
// combat RULES live in combat.js; this only builds the widget and wires the clicks.

import { makeFight, fightRound, groupFightRound, isDefeated, useWrathBlessing, useDefenceBlessing, rerollAttack } from './combat.js';
import { applyEffectBody } from './engine.js';
import { aggregateFightOutcome } from './render-gates.js';
import { animateDice } from './ui.js';

export const combatView = {
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
        get outcome() { return this._override || aggregateFightOutcome(self.sectionFights); },
        set outcome(v) { this._override = v; },
      };
    }

    // Find the section's <fightdamage>/<flee>/<fightround> ANYWHERE (they may sit
    // inside a <p>, or even before the <fight> — book2/152/207/297/313 etc.), not
    // just as a forward same-level sibling.
    const dmgNode = this.findInSection('fightdamage');
    const fleeNode = this.findInSection('flee');
    const roundNode = this.findInSection('fightround'); // between-round rules (task 99)

    const box = document.createElement('div');
    box.className = 'fight';
    container.appendChild(box);
    this.drawFight(box, fight, node, dmgNode, fleeNode, key, locked, roundNode);
    return box;
  },

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
  },

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
    // Show the per-fight attack/Defence bonuses (special="attack"/"defence", Defence
    // through Faith — stored on the members, one encounter, task 91) so the displayed
    // values match what resolution uses (playerCombat / playerDefenceFor). (tasks 49, 83, 87)
    const shownCombat = this.state.ability('combat') + this.state.fightAttackBonus();
    const shownDef = this.state.defence() + this.state.fightDefenceBonus() + (fights[0] ? (fights[0].defenceBonus || 0) : 0);
    you.innerHTML = `<span>Your Combat ${shownCombat}</span><span>Your Defence ${shownDef}</span><span>Your Stamina ${this.state.data.stamina}/${this.state.effectiveStaminaMax()}</span>`;
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
        // A <fightdamage> body's <goto> (a wound redirect) ends the combat by
        // navigation, exactly as in a single fight. (task 99)
        const redirected = fights.find((f) => f.roundGoto);
        if (redirected && !this.state.isDead()) {
          const g = redirected.roundGoto; fights.forEach((f) => { f.roundGoto = null; });
          this.navigate(g.book != null ? g.book : this.book, g.section);
          return;
        }
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

    // COMBAT blessing (§4.324, task 91): retry the missed strike against the same
    // target — the foe struck last round carries the missed flag.
    const missed = fights.find((f) => f.lastStrikeMissed && !f.attackRerolled && !isDefeated(f));
    if (missed && this.state.hasBlessing('combat')) {
      const rr = document.createElement('button');
      rr.className = 'btn-secondary blessing-combat';
      rr.textContent = `Use COMBAT blessing (retry your attack${living.length > 1 ? ` on ${missed.name}` : ''})`;
      rr.addEventListener('click', () => {
        if (!rerollAttack(this.state, missed)) return;
        if (fights.every((f) => isDefeated(f)) || this.state.isDead()) { this.rerender(); return; }
        this.drawGroupFight(box, fights, dmgNode, group, fleeNode);
      });
      controls.appendChild(rr);
    }

    // Combat blessings in a group fight (task 83): usable once per COMBAT (the whole
    // group), only while unresolved and only when held. Divine Wrath needs a target,
    // so render one button per living foe; Defence through Faith is target-agnostic.
    // The once-per-combat guard lives on the group proxy (this.sectionFight), not
    // per-foe, and useWrathBlessing/useDefenceBlessing consume the blessing (task 80).
    if (this.state.hasBlessing('wrath') && !this.sectionFight.wrathUsed) {
      living.forEach((target) => {
        const w = document.createElement('button');
        w.className = 'btn-secondary blessing-combat';
        w.textContent = living.length > 1 ? `Divine Wrath on ${target.name} (1d)` : 'Use Divine Wrath (1d damage)';
        w.addEventListener('click', () => {
          const dmg = useWrathBlessing(this.state, target);
          this.sectionFight.wrathUsed = true; // once per combat, across every foe
          this.notify(`Divine Wrath strikes the ${target.name} for ${dmg}!`);
          if (fights.every((f) => isDefeated(f)) || this.state.isDead()) { this.rerender(); return; }
          this.drawGroupFight(box, fights, dmgNode, group, fleeNode);
        });
        controls.appendChild(w);
      });
    }
    // The proxy is rebuilt on a full rerender, so also gate on the members' stored
    // bonus — the durable once-per-combat mark. (task 91)
    if (this.state.hasBlessing('defence') && !this.sectionFight.defenceUsed && !fights.some((f) => f.defenceBonus)) {
      const d = document.createElement('button');
      d.className = 'btn-secondary blessing-combat';
      d.textContent = 'Use Defence through Faith (+3 Defence)';
      d.addEventListener('click', () => {
        // One encounter: the mark lives on the group proxy, the +3 on every member. (task 91)
        useDefenceBlessing(this.state, this.sectionFight, 3, fights);
        this.drawGroupFight(box, fights, dmgNode, group, fleeNode);
      });
      controls.appendChild(d);
    }
    box.appendChild(controls);
  },

  // The first element with `tag` anywhere in the current section (sections carry
  // at most one <flee>/<fightdamage>), regardless of nesting or order vs <fight>.
  findInSection(tag) {
    return this.sectionEl ? this.sectionEl.querySelector(tag) : null;
  },

  drawFight(box, fight, node, dmgNode, fleeNode, key, locked = false, roundNode = null) {
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
    const shownCombat = this.state.ability('combat') + this.state.fightAttackBonus();
    const shownDef = this.state.defence() + this.state.fightDefenceBonus() + (fight.defenceBonus || 0);
    you.innerHTML = `<span>Your Combat ${shownCombat}</span><span>Your Defence ${shownDef}</span><span>Your Stamina ${this.state.data.stamina}/${this.state.effectiveStaminaMax()}</span>`;
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
      fightRound(this.state, fight, dmgNode, roundNode);
      // A <fightround>/<fightdamage> body can end the fight by navigation — §5.689
      // "dragged you under" (→7), §4.238 "if you get wounded" (→184). (task 99)
      if (fight.roundGoto && !this.state.isDead()) {
        const g = fight.roundGoto; fight.roundGoto = null;
        this.navigate(g.book != null ? g.book : this.book, g.section);
        return;
      }
      // Reduced to 0 Stamina: if the section has an "if you lose…" branch, that's
      // a (non-death) loss — route to it; otherwise it's death.
      if (this.state.isDead() && this.fightGate && this.fightGate.hasLosePath) fight.outcome = 'lose';
      // On any resolution (win/lose/fled) or death, re-render the whole section so
      // the fight gate re-evaluates which onward links are enabled.
      if (fight.outcome || this.state.isDead()) { this.rerender(); return; }
      this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode); // fight continues (never locked mid-fight)
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

    // COMBAT blessing (§4.324, task 91): a MISSED strike may be retried once per
    // round — the player alone strikes again; the enemy's reply is never repeated.
    if (fight.lastStrikeMissed && !fight.attackRerolled && this.state.hasBlessing('combat')) {
      const rr = document.createElement('button');
      rr.className = 'btn-secondary blessing-combat';
      rr.textContent = 'Use COMBAT blessing (retry your attack)';
      rr.addEventListener('click', () => {
        if (!rerollAttack(this.state, fight)) return;
        if (fight.outcome || this.state.isDead()) { this.rerender(); return; }
        this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode);
      });
      controls.appendChild(rr);
    }

    // Combat blessings (task 80): usable once per fight while it is unresolved, and only
    // shown when the player actually holds the blessing (so a blessing-less character —
    // e.g. the every-section scan — never sees them). Divine Wrath deals 1d to the enemy
    // (and can fell it); Defence through Faith adds +3 to Defence for this fight. The
    // rules live in combat.js; the view only renders the button and the outcome.
    if (this.state.hasBlessing('wrath') && !fight.wrathUsed) {
      const w = document.createElement('button');
      w.className = 'btn-secondary blessing-combat';
      w.textContent = 'Use Divine Wrath (1d damage)';
      w.addEventListener('click', () => {
        const dmg = useWrathBlessing(this.state, fight);
        this.notify(`Divine Wrath strikes the ${fight.name} for ${dmg}!`);
        if (fight.outcome || this.state.isDead()) { this.rerender(); return; }
        this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode);
      });
      controls.appendChild(w);
    }
    if (this.state.hasBlessing('defence') && !fight.defenceUsed) {
      const d = document.createElement('button');
      d.className = 'btn-secondary blessing-combat';
      d.textContent = 'Use Defence through Faith (+3 Defence)';
      d.addEventListener('click', () => {
        useDefenceBlessing(this.state, fight);
        this.drawFight(box, fight, node, dmgNode, fleeNode, key, false, roundNode);
      });
      controls.appendChild(d);
    }
    box.appendChild(controls);
  },
};
