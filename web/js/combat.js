// combat.js — headless combat rules for the <fight> mechanic.
//
// Pure game logic: builds an enemy fight-state and resolves attack rounds
// against a GameState. No DOM. The renderer (render.js) owns the fight widget
// and merely calls fightRound() when the player clicks Attack, then redraws
// from the mutated `fight` object.

import { rollDice, applyEffectBody, boolAttr } from './engine.js';

/** Build a fresh fight-state from a <fight> element's attributes. */
export function makeFight(node) {
  const stamina = parseInt(node.getAttribute('stamina') || '1', 10);
  // The `flee="N"` ATTRIBUTE is a win threshold: you win by reducing the enemy to
  // N Stamina or fewer (e.g. §570 "reduce the tree to 5 or less"), not to 0. It is
  // distinct from a `<flee>` CHILD element, which is the player's Flee button.
  const flee = node.getAttribute('flee');
  return {
    name: node.getAttribute('name') || 'Enemy',
    combat: parseInt(node.getAttribute('combat') || '0', 10),
    defence: parseInt(node.getAttribute('defence') || '0', 10),
    stamina,
    maxStamina: stamina,
    winThreshold: flee != null ? (parseInt(flee, 10) || 0) : 0,
    playerFirst: !(node.getAttribute('playerFirst') != null && !boolAttr(node.getAttribute('playerFirst'), true)),
    fleeTo: null,
    outcome: null, // 'win' | 'lose' | 'fled'
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
      if (fight.stamina <= fight.winThreshold) { fight.outcome = 'win'; break; }
    } else {
      const r = rollDice(2);
      const total = r.total + fight.combat;
      const def = state.defence();
      const dmg = Math.max(0, total - def);
      // <fightdamage type="replace"> substitutes its own effect for the Stamina
      // loss (e.g. §5.356: lose an ability point instead); type="add" (or none)
      // applies the effect ON TOP of the Stamina loss (e.g. §1.105 ScorpionSting).
      const replace = dmg > 0 && dmgNode && (dmgNode.getAttribute('type') || '').toLowerCase() === 'replace';
      if (dmg > 0 && !replace) state.damageStamina(dmg);
      fight.log.push(`${fight.name} rolls ${r.total}+${fight.combat}=${total} vs your Def ${def} → ${dmg ? (replace ? 'a telling blow' : '−' + dmg + ' your Stamina') : 'miss'}`);
      // Apply the whole <fightdamage> body (all children, rolls + if-chains), not
      // just its first element — only when the blow actually lands.
      if (dmg > 0 && dmgNode) applyEffectBody(dmgNode, state);
      if (state.isDead()) break;
    }
  }
}
