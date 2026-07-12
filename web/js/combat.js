// combat.js — headless combat rules for the <fight> mechanic.
//
// Pure game logic: builds an enemy fight-state and resolves attack rounds
// against a GameState. No DOM. The renderer (render.js) owns the fight widget
// and merely calls fightRound() when the player clicks Attack, then redraws
// from the mutated `fight` object.

import { rollDice, applyEffectBody, boolAttr, resolveValue } from './engine.js';

/** Build a fresh fight-state from a <fight> element's attributes. When `state`
 *  is supplied the pre-fight steps (preDamage / staminaLost reset / useCache
 *  loadout) run immediately — makeFight is memoised per section visit, so these
 *  fire exactly once, matching FightNode.execute(). */
export function makeFight(node, state = null) {
  const stamina = parseInt(node.getAttribute('stamina') || '1', 10);
  // The `flee="N"` ATTRIBUTE is a win threshold: you win by reducing the enemy to
  // N Stamina or fewer (e.g. §570 "reduce the tree to 5 or less"), not to 0. It is
  // distinct from a `<flee>` CHILD element, which is the player's Flee button.
  const flee = node.getAttribute('flee');
  const modifiers = (node.getAttribute('modifiers') || '').toLowerCase();
  const fight = {
    name: node.getAttribute('name') || 'Enemy',
    combat: parseInt(node.getAttribute('combat') || '0', 10),
    defence: parseInt(node.getAttribute('defence') || '0', 10),
    stamina,
    maxStamina: stamina,
    winThreshold: flee != null ? (parseInt(flee, 10) || 0) : 0,
    playerFirst: !(node.getAttribute('playerFirst') != null && !boolAttr(node.getAttribute('playerFirst'), true)),
    // --- task 26 attributes ---
    attackDice: parseInt(node.getAttribute('attackDice') || '2', 10) || 2, // dice the player rolls to attack (default 2)
    attacks: parseInt(node.getAttribute('attacks') || '1', 10) || 1,       // enemy attacks per round (Tripling = 3)
    noArmour: modifiers.includes('noarmour'),                              // the player's armour does not count
    playerDefence: node.getAttribute('playerDefence'),                    // a value/var replacing the player's Defence
    abilityDamaged: node.getAttribute('abilityDamaged') || null,          // wound this ability/stamina instead of Stamina
    staminaLost: node.getAttribute('staminaLost') || null,                // codeword that accumulates damage dealt
    group: node.getAttribute('group') || null,                           // simultaneous multi-enemy group id
    fleeTo: null,
    outcome: null, // 'win' | 'lose' | 'fled'
    log: [],
  };
  if (state) startFight(fight, node, state);
  return fight;
}

/** Pre-fight setup that needs the GameState: reset the staminaLost accumulator,
 *  add the useCache loadout to the enemy, and apply preDamage (which may fell the
 *  enemy before the first blow). Mirrors FightNode.execute()'s opening. */
function startFight(fight, node, state) {
  if (fight.staminaLost) state.setCodewordValue(fight.staminaLost, 0);

  // useCache: the enemy wields the weapons/armour stashed in the named cache
  // (§6.635 — the Warrior Maid fights you with the gear she confiscated).
  const cache = node.getAttribute('useCache');
  if (cache && state.cacheItems) {
    const items = state.cacheItems(cache) || [];
    const best = (kind) => items.filter((it) => it.kind === kind).reduce((m, it) => Math.max(m, it.bonus || 0), 0);
    // A weapon's bonus raises the enemy's COMBAT *and* Defence (like a player's
    // weapon does — JaFL FightNode adds combatRaise to both); armour adds to
    // Defence only. §6.635 Warrior Maid with a +2 sword ⇒ Combat 10 / Defence 18
    // (previously 10 / 16 because the weapon bonus never reached Defence). (task 36)
    const weaponBonus = best('weapon');
    fight.combat += weaponBonus;
    fight.defence += weaponBonus + best('armour');
  }

  // preDamage: damage inflicted on the enemy up front, carried from an earlier
  // encounter (the paired Dawatsu Morituri fights — §6 preDamage="MorDamage"
  // reads what §7 stored via staminaLost). A codeword wins over a like-named var.
  const pd = node.getAttribute('preDamage');
  if (pd) {
    let dmg = state.codewordValue(pd);
    if (!dmg && state.hasVar && state.hasVar(pd)) dmg = state.getVar(pd);
    if (dmg > 0) {
      dmg = Math.min(dmg, fight.stamina);
      fight.stamina -= dmg;
      fight.log.push(`Carried-over damage: −${dmg} enemy Stamina`);
      if (fight.staminaLost) state.adjustCodewordValue(fight.staminaLost, dmg);
      if (fight.stamina <= fight.winThreshold) fight.outcome = 'win';
    }
  }
}

/** The player's effective Defence for this fight: a playerDefence= override (a
 *  value/variable — §Chimerical Beast "s", §Talanexor "d") wins; otherwise the
 *  sheet Defence, minus the armour bonus when modifiers="noarmour" (Water Drake). */
function playerDefenceFor(state, fight) {
  // A <tick special="defence"> blessing raises Defence for this fight only (§4.434
  // ring of defence, §6.183 Thunder Beast). It applies even over a playerDefence=
  // override so a granted Defence boon isn't lost to a fixed-Defence fight.
  const defBonus = state.fightDefenceBonus ? state.fightDefenceBonus() : 0;
  if (fight.playerDefence != null && fight.playerDefence !== '') return resolveValue(state, fight.playerDefence) + defBonus;
  let def = state.defence();
  if (fight.noArmour) def = Math.max(0, def - state.armourBonus());
  return def + defBonus;
}

/** Route an enemy hit to the player: normally lost Stamina, but abilityDamaged=
 *  sends it to that ability instead — "stamina" is a *permanent* max+current loss
 *  (§Big Boy/§Giant), a core ability name reduces that ability (both fatal). */
function applyEnemyDamage(state, fight, dmg) {
  const ab = (fight.abilityDamaged || '').toLowerCase();
  if (ab === 'stamina') state.adjustAbilityStamina(-dmg, true);
  else if (ab) state.adjustAbility(ab, -dmg, true);
  else state.damageStamina(dmg);
}

/** The player strikes one enemy once (attackDice dice + Combat vs its Defence),
 *  accumulating damage into staminaLost and flagging a win at the threshold. */
function playerStrike(state, fight) {
  const r = rollDice(fight.attackDice || 2); // default 2 dice (also guards a bare fight literal)
  // A <tick special="attack"> bonus/penalty modifies the player's attack rolls
  // for this fight only (§1.42 rat poison +3, §6.624 dark −2). It hits COMBAT here,
  // NOT via state.ability('combat') — so it never leaks into the player's Defence.
  const combat = state.ability('combat') + (state.fightAttackBonus ? state.fightAttackBonus() : 0);
  const total = r.total + combat;
  let dmg = Math.max(0, total - fight.defence);
  if (dmg > 0) {
    if (dmg > fight.stamina) dmg = fight.stamina; // don't over-count an overkill in staminaLost
    fight.stamina -= dmg;
    if (fight.staminaLost) state.adjustCodewordValue(fight.staminaLost, dmg);
  }
  fight.log.push(`You roll ${r.total}+${combat}=${total} vs Def ${fight.defence} → ${dmg ? '−' + dmg + ' enemy Stamina' : 'miss'}`);
  if (fight.stamina <= fight.winThreshold) fight.outcome = 'win';
}

/** One enemy strike against the player (2 dice + Combat vs the player's Defence),
 *  honouring <fightdamage type="replace"|"add"> and abilityDamaged=. */
function enemyStrike(state, fight, dmgNode) {
  const r = rollDice(2);
  const total = r.total + fight.combat;
  const def = playerDefenceFor(state, fight);
  const dmg = Math.max(0, total - def);
  // <fightdamage type="replace"> substitutes its own effect for the Stamina loss
  // (§5.356: lose an ability instead); type="add"/none applies it ON TOP (§1.105).
  const replace = dmg > 0 && dmgNode && (dmgNode.getAttribute('type') || '').toLowerCase() === 'replace';
  if (dmg > 0 && !replace) applyEnemyDamage(state, fight, dmg);
  fight.log.push(`${fight.name} rolls ${r.total}+${fight.combat}=${total} vs your Def ${def} → ${dmg ? (replace ? 'a telling blow' : '−' + dmg + ' your Stamina') : 'miss'}`);
  // Apply the whole <fightdamage> body (all children, rolls + branches) when the
  // blow lands — never on render. A <goto> inside redirects the fight ("If you
  // get wounded, →184" — §4.238): record it for the view to navigate. (task 99)
  if (dmg > 0 && dmgNode) {
    const res = applyEffectBody(dmgNode, state, fight.log);
    if (res.goto) fight.roundGoto = res.goto;
  }
}

/** Execute a <fightround> body (task 99): its rolls/branches/effects run in this
 *  round's context, once, with any outcome lines joining the fight log. A <goto>
 *  (§5.689 "dragged you under") is recorded on the fight for the view to follow. */
function runRoundNode(state, fight, roundNode) {
  const res = applyEffectBody(roundNode, state, fight.log);
  if (res.goto) fight.roundGoto = res.goto;
}

/**
 * Resolve one attack exchange against a single enemy, respecting initiative.
 * Mutates `fight` (stamina, outcome, log) and `state` (player stamina + any
 * <fightdamage> effect). The enemy strikes `attacks` times per round (Tripling).
 * A section's <fightround> body (task 99, JaFL RoundNode) executes exactly once
 * per round: pre="t" before the exchange (§5.24 "Before each combat round…"),
 * else after it, and only while the fight is still undecided. Its body may kill
 * the player (Stamina damage) or record a fight.roundGoto redirect (§5.689).
 */
export function fightRound(state, fight, dmgNode, roundNode = null) {
  const pre = roundNode != null && boolAttr(roundNode.getAttribute('pre'));
  if (roundNode && pre) {
    runRoundNode(state, fight, roundNode);
    if (fight.outcome || fight.roundGoto || state.isDead()) return; // choked out before the exchange
  }
  const order = fight.playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];
  for (const who of order) {
    if (fight.outcome || fight.roundGoto || state.isDead()) break;
    if (who === 'player') playerStrike(state, fight);
    else { const n = fight.attacks || 1; for (let k = 0; k < n && !state.isDead() && !fight.outcome && !fight.roundGoto; k++) enemyStrike(state, fight, dmgNode); }
  }
  if (roundNode && !pre && !fight.outcome && !fight.roundGoto && !state.isDead()) {
    runRoundNode(state, fight, roundNode);
  }
}

/** True when an enemy in a group has been beaten (Stamina at/under its threshold). */
export function isDefeated(fight) { return fight.stamina <= fight.winThreshold; }

/** Divine Wrath blessing (book6/94): inflict 1d damage on the enemy once, before or
 *  during the fight. Reduces the enemy's Stamina (and any staminaLost tally), may fell
 *  it, marks the fight so it can't be reused, and consumes the blessing unless
 *  permanent. Returns the damage dealt (0 if unavailable). Headless. (task 80) */
export function useWrathBlessing(state, fight) {
  if (!fight || fight.wrathUsed || !state.hasBlessing('wrath')) return 0;
  const dmg = Math.min(rollDice(1).total, fight.stamina);
  fight.stamina -= dmg;
  if (fight.staminaLost) state.adjustCodewordValue(fight.staminaLost, dmg);
  if (fight.stamina <= fight.winThreshold) fight.outcome = 'win';
  fight.wrathUsed = true;
  state.useBlessing('wrath');
  return dmg;
}

/** Defence through Faith blessing (book5/248/692/89): +bonus (default 3) to Defence for
 *  THIS fight only. Adds a transient per-fight Defence bonus (cleared on leaving the
 *  section), marks the fight, and consumes the blessing unless permanent. Returns the
 *  bonus applied (0 if unavailable). Headless. (task 80) */
export function useDefenceBlessing(state, fight, bonus = 3) {
  if (!fight || fight.defenceUsed || !state.hasBlessing('defence')) return 0;
  state.addFightBonus('defence', bonus);
  fight.defenceUsed = true;
  state.useBlessing('defence');
  return bonus;
}

/**
 * One round of a simultaneous group fight (group="…"): the player strikes ONE
 * still-standing enemy (the one they choose — §6.618 "against whichever opponent
 * you choose"; falls back to the first undefeated when no valid target is given),
 * then EVERY still-standing enemy strikes back — "each time you strike at one,
 * they all get to strike back" (§6.192/273/291/618). Mutates each fight and the
 * shared `state`. (task 48)
 */
export function groupFightRound(state, fights, dmgNode, target = null) {
  const chosen = (target && !isDefeated(target)) ? target : fights.find((f) => !isDefeated(f));
  if (chosen) playerStrike(state, chosen);
  for (const f of fights) {
    if (state.isDead()) break;
    if (isDefeated(f)) continue;
    const n = f.attacks || 1;
    for (let k = 0; k < n && !state.isDead(); k++) enemyStrike(state, f, dmgNode);
  }
}
