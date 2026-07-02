// combat.js — headless combat rules for the <fight> mechanic.
//
// Pure game logic: builds an enemy fight-state and resolves attack rounds
// against a GameState. No DOM. The renderer (render.js) owns the fight widget
// and merely calls fightRound() when the player clicks Attack, then redraws
// from the mutated `fight` object.

import { rollDice, applyEffect, boolAttr } from './engine.js';

/** Build a fresh fight-state from a <fight> element's attributes. */
export function makeFight(node) {
  const stamina = parseInt(node.getAttribute('stamina') || '1', 10);
  return {
    name: node.getAttribute('name') || 'Enemy',
    combat: parseInt(node.getAttribute('combat') || '0', 10),
    defence: parseInt(node.getAttribute('defence') || '0', 10),
    stamina,
    maxStamina: stamina,
    playerFirst: !(node.getAttribute('playerFirst') != null && !boolAttr(node.getAttribute('playerFirst'), true)),
    fleeTo: null,
    outcome: null, // 'win' | 'fled'
    log: [],
  };
}

/**
 * Resolve one attack exchange, respecting initiative. Mutates `fight` (stamina,
 * outcome, log) and `state` (player stamina, plus any <fightdamage> effect).
 * `dmgNode` is the optional <fightdamage> element applied when the enemy wounds
 * the player. UI-agnostic, so it can be unit-tested headlessly.
 */
export function fightRound(state, fight, dmgNode) {
  const order = fight.playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];
  for (const who of order) {
    if (fight.outcome) break;
    if (who === 'player') {
      const r = rollDice(2);
      const total = r.total + state.ability('combat');
      const dmg = Math.max(0, total - fight.defence);
      fight.stamina = Math.max(0, fight.stamina - dmg);
      fight.log.push(`You roll ${r.total}+${state.ability('combat')}=${total} vs Def ${fight.defence} → ${dmg ? '−' + dmg + ' enemy Stamina' : 'miss'}`);
      if (fight.stamina <= 0) { fight.outcome = 'win'; break; }
    } else {
      const r = rollDice(2);
      const total = r.total + fight.combat;
      const def = state.defence();
      const dmg = Math.max(0, total - def);
      state.damageStamina(dmg);
      fight.log.push(`${fight.name} rolls ${r.total}+${fight.combat}=${total} vs your Def ${def} → ${dmg ? '−' + dmg + ' your Stamina' : 'miss'}`);
      if (dmg > 0 && dmgNode) applyEffect(dmgNode.firstElementChild || dmgNode, state, {});
      if (state.isDead()) break;
    }
  }
}
