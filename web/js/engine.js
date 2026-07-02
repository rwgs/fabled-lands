// engine.js — the rules engine: dice, condition evaluation, and passive effects.
// Reads attributes off the parsed XML elements and applies them to a GameState.

import { ABILITIES } from './rules.js';
import { makeItem, normalize } from './state.js';
import { availableBooks } from './data.js';

// ---- dice ------------------------------------------------------------------
export function rollD6() { return 1 + Math.floor(Math.random() * 6); }

export function rollDice(n) {
  const dice = [];
  for (let i = 0; i < n; i++) dice.push(rollD6());
  return { dice, total: dice.reduce((a, b) => a + b, 0) };
}

/** Parse a dice expression like "2d6", "2d", "d6+1", or a plain number "5". */
export function rollDiceExpr(str) {
  str = String(str).trim();
  const m = str.match(/^(\d*)\s*d\s*(\d*)\s*([+-]\s*\d+)?$/i);
  if (!m) {
    const n = parseInt(str, 10);
    return { dice: [], total: isNaN(n) ? 0 : n, fixed: true };
  }
  const n = m[1] ? parseInt(m[1], 10) : 1;
  const faces = m[2] ? parseInt(m[2], 10) : 6;
  const mod = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
  const dice = [];
  for (let i = 0; i < n; i++) dice.push(1 + Math.floor(Math.random() * faces));
  return { dice, total: dice.reduce((a, b) => a + b, 0) + mod, mod };
}

export function isDiceExpr(str) {
  return /d/i.test(String(str || ''));
}

// ---- attribute value resolution -------------------------------------------
/** Resolve a numeric value from an attribute string: literal int, or variable name. */
export function resolveValue(state, str, def = 0) {
  if (str == null || str === '') return def;
  str = String(str).trim();
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (isDiceExpr(str)) return rollDiceExpr(str).total;
  return state.getVar(str);
}

function firstAbility(attr) {
  if (!attr) return null;
  const a = attr.split('|')[0].trim().toLowerCase();
  return ABILITIES.includes(a) ? a : null;
}

// ---- <if> / <elseif> condition evaluation ---------------------------------
export function evaluateCondition(el, state) {
  const get = (a) => el.getAttribute(a);
  let result = true; // default: an <if> with only a 'not' or unknown attrs

  const compare = (val) => {
    const eq = get('equals'), gt = get('greaterthan'), lt = get('lessthan');
    if (eq == null && gt == null && lt == null) return null; // no comparator
    let ok = false;
    if (eq != null) ok = ok || val === resolveValue(state, eq);
    if (gt != null) ok = ok || val > resolveValue(state, gt);
    if (lt != null) ok = ok || val < resolveValue(state, lt);
    return ok;
  };

  if (get('codeword') != null) {
    result = matchCodewords(state, get('codeword'));
  } else if (get('ticks') != null) {
    result = state.tickCount() === resolveValue(state, get('ticks'));
  } else if (get('shards') != null) {
    const need = resolveValue(state, get('shards'));
    result = state.data.shards >= need;
  } else if (get('item') != null) {
    const count = state.findItems(get('item')).length;
    const cmp = compare(count);
    result = cmp == null ? count > 0 : cmp;
  } else if (get('god') != null) {
    result = state.hasGod(get('god'));
  } else if (get('safeAddGod') != null) {
    // Can become an initiate only if not godless and not already worshipping a god.
    result = !state.data.godless && !state.hasGod(get('safeAddGod')) && state.data.gods.length === 0;
  } else if (get('blessing') != null) {
    result = state.hasBlessing(get('blessing'));
  } else if (get('curse') != null) {
    result = state.hasCurse(get('curse'));
  } else if (get('title') != null) {
    result = get('title').split(/[|,]/).some((t) => state.hasTitle(t.trim()));
  } else if (get('profession') != null) {
    result = normalize(state.data.profession) === normalize(get('profession'));
  } else if (get('gender') != null) {
    const wantMale = get('gender').toLowerCase().startsWith('m');
    result = (state.data.gender === 'm') === wantMale;
  } else if (get('resurrection') != null) {
    result = state.hasResurrection();
  } else if (get('dead') != null) {
    result = state.isDead() === boolAttr(get('dead'));
  } else if (get('book') != null) {
    result = availableBooks().includes(Number(get('book')));
  } else if (get('var') != null) {
    const v = state.getVar(get('var'));
    const cmp = compare(v);
    result = cmp == null ? v !== 0 : cmp;
  } else if (get('name') != null) {
    const v = state.codewordValue(get('name'));
    const cmp = compare(v);
    result = cmp == null ? v !== 0 : cmp;
  } else if (get('ability') != null) {
    const ab = firstAbility(get('ability'));
    const v = ab ? state.ability(ab) : 0;
    const cmp = compare(v);
    result = cmp == null ? v > 0 : cmp;
  } else if (get('ship') != null) {
    result = state.ships.some((s) => s.type === get('ship'));
  } else if (get('crew') != null) {
    result = state.ships.some((s) => s.crew === get('crew'));
  } else if (get('cargo') != null) {
    result = state.ships.some((s) => (s.cargo || []).length > 0);
  } else if (get('docked') != null) {
    result = state.ships.length > 0;
  }

  if (boolAttr(get('not'))) result = !result;
  return result;
}

function matchCodewords(state, spec) {
  // comma => AND, pipe => OR, single => has
  if (spec.includes(',')) return spec.split(',').every((c) => state.hasCodeword(c.trim()));
  if (spec.includes('|')) return spec.split('|').some((c) => state.hasCodeword(c.trim()));
  return state.hasCodeword(spec.trim());
}

export function boolAttr(v, def = false) {
  if (v == null) return def;
  v = String(v).toLowerCase();
  return v === 't' || v === 'true' || v === 'yes' || v === '1';
}

// ---- passive effect application -------------------------------------------
// Applies a state-changing node. Returns a short human note (or '') describing
// what changed, for optional UI feedback. `opts.chooser` may be provided to
// resolve item-loss choices; otherwise the first matches are used.
export function applyEffect(el, state, opts = {}) {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'lose': return applyLose(el, state, opts);
    case 'tick':
    case 'gain': return applyTick(el, state, opts);
    case 'adjust': return applyAdjust(el, state, opts);
    case 'set': return applySet(el, state, opts);
    case 'curse': return applyCurse(el, state, opts);
    case 'effect': return applyItemEffect(el, state, opts);
    default: return '';
  }
}

function applyLose(el, state, opts) {
  const get = (a) => el.getAttribute(a);
  const notes = [];

  if (get('codeword') != null) { get('codeword').split(/[|,]/).forEach((c) => state.removeCodeword(c.trim())); notes.push('lost codeword'); }
  if (get('shards') != null) { const n = resolveValue(state, get('shards')); state.adjustMoney(-n); notes.push(`−${n} Shards`); }
  if (get('stamina') != null) {
    let n;
    const s = get('stamina');
    if (get('staminato') != null) { const target = resolveValue(state, get('staminato')); n = Math.max(0, state.data.stamina - target); }
    else n = Math.max(0, resolveValue(state, s));
    state.damageStamina(n); notes.push(`−${n} Stamina`);
  }
  if (get('ability') != null && get('amount') != null) {
    const ab = firstAbility(get('ability')); const n = resolveValue(state, get('amount'));
    if (ab) { state.adjustAbility(ab, -n); notes.push(`−${n} ${ab}`); }
  }
  if (get('blessing') != null) { if (state.removeBlessing(get('blessing'))) notes.push('lost blessing'); }
  if (get('curse') != null) { state.removeCurse(get('curse')); notes.push('curse lifted'); }
  if (get('title') != null) { state.removeTitle(get('title')); }
  if (get('god') != null) { state.removeGod(get('god')); }
  if (get('resurrection') != null) { state.data.resurrections.shift(); state.changed(); }
  if (get('flag') != null) { state.setFlag(get('flag'), false); }
  if (get('price') != null) { state.setFlag(get('price'), true); }
  if (get('item') != null) {
    const pattern = get('item');
    if (pattern === '*') { /* lose all-ish: skip destructive auto-clear */ }
    else {
      const matches = state.findItems(pattern);
      const count = get('multiple') ? resolveValue(state, get('multiple')) : 1;
      let toLose = matches;
      if (matches.length > count) {
        toLose = opts.chooser ? opts.chooser(matches, count, 'lose') : matches.slice(0, count);
      }
      toLose.slice(0, count).forEach((it) => state.removeItemById(it.id));
      if (toLose.length) notes.push('lost item');
    }
  }
  if (get('cargo') != null || get('crew') != null || get('ship') != null) applyShipLose(el, state);
  return notes.join(', ');
}

function applyShipLose(el, state) {
  const ship = state.ships[0];
  if (!ship) return;
  if (el.getAttribute('crew') != null) {
    const idx = ['poor', 'average', 'good', 'excellent'].indexOf(ship.crew);
    const d = parseInt(el.getAttribute('crew'), 10) || 1;
    ship.crew = ['poor', 'average', 'good', 'excellent'][Math.max(0, idx - d)] || 'poor';
  }
  if (el.getAttribute('cargo') != null) {
    const c = el.getAttribute('cargo');
    if (c === '*') ship.cargo = [];
    else { const i = (ship.cargo || []).indexOf(c); if (i >= 0) ship.cargo.splice(i, 1); }
  }
  if (el.getAttribute('ship') != null) { state.data.ships.shift(); }
  state.changed();
}

function applyTick(el, state, opts) {
  const get = (a) => el.getAttribute(a);
  const notes = [];
  let did = false;

  if (get('codeword') != null) { get('codeword').split(/[|,]/).forEach((c) => state.addCodeword(c.trim())); notes.push('codeword gained'); did = true; }
  if (get('shards') != null) { const n = resolveValue(state, get('shards')); state.adjustMoney(n); notes.push(`+${n} Shards`); did = true; }
  if (get('blessing') != null) { state.addBlessing(get('blessing')); notes.push('blessing'); did = true; }
  if (get('curse') != null) { state.addCurse(get('curse')); did = true; }
  if (get('god') != null) { state.setGod(get('god')); did = true; }
  if (get('title') != null) {
    const val = get('titleValue') ? resolveValue(state, get('titleValue')) : (get('amount') ? resolveValue(state, get('amount')) : 0);
    state.addTitle(get('title'), val); did = true;
  }
  if (get('ability') != null && get('amount') != null) {
    const ab = firstAbility(get('ability')); const n = resolveValue(state, get('amount'));
    if (ab) { state.adjustAbility(ab, n); notes.push(`+${n} ${ab}`); did = true; }
  }
  if (get('name') != null) { const n = get('amount') ? resolveValue(state, get('amount')) : (get('count') ? resolveValue(state, get('count')) : 1); state.adjustCodewordValue(get('name'), n); did = true; }
  if (get('flag') != null) { state.setFlag(get('flag'), false); did = true; }
  if (get('price') != null) { state.setFlag(get('price'), true); did = true; }
  if (get('special') != null) { applySpecial(el, state); did = true; }
  if (get('crew') != null && state.ships[0]) { state.ships[0].crew = get('crew'); state.changed(); did = true; }
  if (get('cargo') != null && state.ships[0]) { (state.ships[0].cargo ||= []).push(get('cargo')); state.changed(); did = true; }
  if (get('addbonus') != null && get('item') != null) {
    const it = state.findItems(get('item'))[0];
    if (it) { it.bonus = (it.bonus || 0) + resolveValue(state, get('addbonus')); state.reconcileEquipment(); state.changed(); did = true; }
  }

  // Bare <tick> (no meaningful attrs): tick the visit box(es) for this section.
  if (!did) {
    const count = get('count') ? resolveValue(state, get('count')) : 1;
    state.addTick(null, null, count);
    notes.push('box ticked');
  }
  return notes.join(', ');
}

function applySpecial(el, state) {
  const kind = el.getAttribute('special');
  const bonus = el.getAttribute('bonus') ? parseInt(el.getAttribute('bonus'), 10) : 3;
  if (kind === 'defence') state.data.effects.push({ ability: 'combat', bonus, type: 'blessing', text: 'Defence blessing', uses: 1 });
  else if (kind === 'attack') state.data.effects.push({ ability: 'combat', bonus, type: 'blessing', text: 'Attack blessing', uses: 1 });
  else if (kind === 'godless') state.data.godless = true;
  state.changed();
}

function applyAdjust(el, state) {
  const get = (a) => el.getAttribute(a);
  const amount = get('value') != null ? resolveValue(state, get('value')) : (get('amount') != null ? resolveValue(state, get('amount')) : 0);
  if (get('ability') != null && (get('value') != null || get('amount') != null)) {
    const ab = firstAbility(get('ability')); if (ab) state.adjustAbility(ab, amount);
  } else if (get('codeword') != null) {
    state.adjustCodewordValue(get('codeword'), amount);
  } else if (get('name') != null) {
    state.adjustCodewordValue(get('name'), amount);
  } else if (get('title') != null || get('titleVal') != null) {
    state.addTitle(get('title') || get('titleVal'), amount);
  } else if (get('crew') != null && state.ships[0]) {
    const idx = ['poor', 'average', 'good', 'excellent'].indexOf(state.ships[0].crew);
    state.ships[0].crew = ['poor', 'average', 'good', 'excellent'][Math.max(0, Math.min(3, idx + amount))] || state.ships[0].crew;
    state.changed();
  }
  return '';
}

function applySet(el, state) {
  const get = (a) => el.getAttribute(a);
  const name = get('var');
  if (get('dock') != null) { state.ships.forEach((s) => { s.docked = get('dock'); }); state.changed(); return ''; }
  if (!name) return '';
  let val;
  if (get('value') != null) val = evalExpression(get('value'), state);
  else if (get('codeword') != null) val = state.codewordValue(get('codeword'));
  else val = 0;
  if (get('modifier') != null) val = state.getVar(name) + resolveValue(state, get('modifier'));
  state.setVar(name, val);
  return '';
}

function applyCurse(el, state) {
  const type = el.getAttribute('type') || el.getAttribute('ability') || 'curse';
  state.addCurse({ type, ability: el.getAttribute('ability') || null, bonus: parseInt(el.getAttribute('bonus') || '0', 10) });
  return 'cursed';
}

function applyItemEffect(el, state) {
  // <effect> as a child of an item — handled at item creation; standalone rare.
  return '';
}

/** Evaluate a simple <set value="..."> expression. Supports identifiers and +,-,*. */
export function evalExpression(expr, state) {
  expr = String(expr).trim();
  if (/^-?\d+$/.test(expr)) return parseInt(expr, 10);
  const ident = (word) => {
    const w = word.toLowerCase();
    if (w === 'stamina') return state.data.stamina;
    if (w === 'shards') return state.data.shards;
    if (w === 'rank') return state.data.rank;
    if (w === 'defence') return state.defence();
    if (w === 'armour') return state.armourBonus();
    if (w === 'weapon') return state.wieldedWeapon()?.bonus || 0;
    if (w === 'crew') return ['poor', 'average', 'good', 'excellent'].indexOf(state.ships[0]?.crew) + 1 || 0;
    if (ABILITIES.includes(w)) return state.ability(w);
    if (state.hasVar(word)) return state.getVar(word);
    const n = parseInt(word, 10);
    return isNaN(n) ? 0 : n;
  };
  // simple tokenizer for + - * with identifiers/numbers
  const tokens = expr.match(/[A-Za-z_]+|\d+|[+\-*]/g);
  if (!tokens) return 0;
  let acc = ident(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]; const rhs = ident(tokens[i + 1] ?? '0');
    if (op === '+') acc += rhs; else if (op === '-') acc -= rhs; else if (op === '*') acc *= rhs;
  }
  return acc;
}

// ---- rest ------------------------------------------------------------------
/** Rest action: pay an optional shard cost, then heal `perUse` Stamina (a plain
 *  number or a dice expression like "1d6"). Returns the amount healed. */
export function applyRest(state, perUse, cost) {
  if (cost) state.adjustMoney(-cost);
  const amt = resolveValue(state, String(perUse));
  state.healStamina(amt);
  return amt;
}

// ---- resurrection ----------------------------------------------------------
/** Purchase a resurrection deal: pay the (optional) cost and record the deal. */
export function buyResurrectionDeal(state, { book, section, text, god, cost = 0 }) {
  if (cost) state.adjustMoney(-cost);
  state.addResurrection({ book, section, text, god: god || null });
}

// ---- roll resolution helpers ----------------------------------------------
/** Total adjustment from <adjust> children of a roll node. */
export function childAdjustment(el, state) {
  let sum = 0;
  el.querySelectorAll(':scope > adjust').forEach((a) => {
    // Only meets-conditions adjustments count.
    if (adjustApplies(a, state)) sum += resolveValue(state, a.getAttribute('value') ?? a.getAttribute('amount') ?? '0');
  });
  return sum;
}

function adjustApplies(el, state) {
  const get = (a) => el.getAttribute(a);
  if (get('god') != null) return state.hasGod(get('god'));
  if (get('profession') != null) return normalize(state.data.profession) === normalize(get('profession'));
  if (get('item') != null) return state.hasItem(get('item'));
  if (get('codeword') != null) return state.hasCodeword(get('codeword'));
  return true;
}

// difficulty: success iff (2d6 + ability + adjust) > level
export function rollDifficulty(state, ability, level, modifier = 0) {
  const ab = firstAbility(ability);
  const r = rollDice(2);
  const abilityScore = ab ? state.ability(ab) : 0;
  const total = r.total + abilityScore + modifier;
  return { dice: r.dice, rollTotal: r.total, abilityScore, ability: ab, total, level, margin: total - level, success: total > level };
}

// rank check: success iff (dice + add + adjust) <= current Rank. `margin` (>0 on
// success) is what the books store in a <success var> for later branch logic.
export function rollRankCheck(state, dice = 1, add = 0, adjust = 0) {
  const r = rollDice(dice);
  const total = r.total + add + adjust;
  const success = total <= state.data.rank;
  return { kind: 'rankcheck', dice: r.dice, total, success, margin: 1 + state.data.rank - total };
}

// training: roll to raise an ability. Success iff the roll beats your *natural*
// (unmodified) score; on success the ability permanently gains +1. Mutates state.
// `ability` is the resolved ability key (e.g. 'combat'); '?' means player-chosen.
export function rollTraining(state, ability, dice = 2, add = 0) {
  const natural = state.abilityNatural(ability);
  const r = rollDice(dice);
  const total = r.total + add;
  const success = total > natural;
  if (success) state.adjustAbility(ability, 1);
  return { kind: 'training', dice: r.dice, total, success, natural, ability };
}

// outcome range matching against a value
export function matchRange(rangeStr, val) {
  rangeStr = String(rangeStr).trim();
  if (rangeStr.includes(',')) return rangeStr.split(',').map((n) => parseInt(n, 10)).includes(val);
  if (rangeStr.endsWith('+')) return val >= parseInt(rangeStr, 10);
  if (rangeStr.includes('-')) {
    const [a, b] = rangeStr.split('-').map((n) => parseInt(n, 10));
    return val >= a && val <= b;
  }
  return val === parseInt(rangeStr, 10);
}
