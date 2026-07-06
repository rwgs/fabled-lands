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

/** The concrete ability keys a chooser should offer for an ability spec:
 *  '?' (or bare) → all six; 'a|b' → the listed core abilities. For a loss, drop
 *  any already at their minimum (1) — JaFL won't let the player pick those. */
export function abilityChoiceOptions(spec, state, forLoss = false) {
  const s = String(spec || '').trim().toLowerCase();
  let cands = (s === '?' || s === '')
    ? ABILITIES.slice()
    : s.split('|').map((a) => a.trim()).filter((a) => ABILITIES.includes(a));
  if (forLoss) { const elig = cands.filter((a) => state.abilityNatural(a) > 1); if (elig.length) cands = elig; }
  return cands;
}

/** Resolve an ability spec to the target key(s) to affect. '*' = all six;
 *  'rank'/'stamina' route to those stats; '?' / 'a|b' ask opts.chooser (a
 *  [key]-returning callback) or default to the first eligible option. */
function abilityTargets(spec, state, forLoss, opts) {
  const s = String(spec || '').trim().toLowerCase();
  if (s === '*') return ABILITIES.slice();
  if (s === 'rank') return ['rank'];
  if (s === 'stamina') return ['stamina'];
  if (ABILITIES.includes(s)) return [s];
  if (s === '?' || s.includes('|')) {
    const cands = abilityChoiceOptions(spec, state, forLoss);
    if (!cands.length) return [];
    const picked = opts.chooser ? opts.chooser(cands, 1, 'ability') : null;
    const chosen = (picked && picked.length) ? picked[0] : cands[0];
    return ABILITIES.includes(chosen) ? [chosen] : [cands[0]];
  }
  return []; // unknown ability token
}

/** Apply an ability effect on a <gain>/<lose>/<tick>. sign is +1 (gain/tick) or
 *  -1 (lose). Handles rank, stamina, all-six, choose-one, fatal="t", and the
 *  effect="+fixed|+cursed|-…" flag forms. */
function applyAbilityChange(el, state, sign, opts) {
  const spec = el.getAttribute('ability');
  const effect = el.getAttribute('effect');
  // effect="+fixed|+cursed|-…": set/clear an ability flag; no numeric change.
  if (effect != null) {
    const e = String(effect).trim();
    const add = !e.startsWith('-');
    const kind = /curse/i.test(e) ? 'cursed' : (/fix/i.test(e) ? 'fixed' : null);
    if (!kind) return '';
    abilityTargets(spec, state, false, opts).forEach((t) => { if (ABILITIES.includes(t)) state.setAbilityFlag(t, kind, add); });
    return `${add ? '' : 'un-'}${kind}`;
  }
  const fatal = boolAttr(el.getAttribute('fatal'));
  const delta = sign * resolveValue(state, el.getAttribute('amount'));
  const notes = [];
  for (const t of abilityTargets(spec, state, sign < 0, opts)) {
    if (t === 'rank') state.adjustRank(delta, fatal);
    else if (t === 'stamina') state.adjustAbilityStamina(delta, fatal);
    else state.adjustAbility(t, delta, fatal);
    notes.push(`${delta >= 0 ? '+' : ''}${delta} ${t}`);
  }
  return notes.join(', ');
}

// ---- <if> / <elseif> condition evaluation ---------------------------------
// Mirrors the Java engine's IfNode.meetsConditions(): every recognized attribute
// on the node is a *disjunct* — the condition is met as soon as ANY one of them
// holds (an OR), and `not="t"` negates that final result. (The books' prose bears
// this out: "if you have the codeword Dove OR the title Arena Champion", "codeword
// Aid OR a ship docked at Smogmaw", etc.) Comma/pipe *within* a codeword or title
// list keep their own AND/OR meaning via matchCodewords / the title split.
// A node with no recognized attribute at all (only `not`, or attrs this engine
// doesn't yet handle) defaults to true — task 17 tightens that to a warning.
export function evaluateCondition(el, state) {
  const get = (a) => el.getAttribute(a);
  let matched = false; // did we recognize any condition attribute?
  let result = false;  // OR accumulator over the recognized attributes
  const add = (present, cond) => { if (present != null) { matched = true; result = result || cond(); } };

  const compare = (val) => {
    const eq = get('equals'), gt = get('greaterthan'), lt = get('lessthan');
    if (eq == null && gt == null && lt == null) return null; // no comparator
    let ok = false;
    if (eq != null) ok = ok || val === resolveValue(state, eq);
    if (gt != null) ok = ok || val > resolveValue(state, gt);
    if (lt != null) ok = ok || val < resolveValue(state, lt);
    return ok;
  };

  add(get('codeword'), () => matchCodewords(state, get('codeword')));
  add(get('ticks'), () => state.tickCount() === resolveValue(state, get('ticks')));
  add(get('shards'), () => state.data.shards >= resolveValue(state, get('shards')));
  add(get('item'), () => { const count = state.findItems(get('item')).length; const cmp = compare(count); return cmp == null ? count > 0 : cmp; });
  add(get('god'), () => state.hasGod(get('god')));
  // Can become an initiate only if not godless and not already worshipping a god.
  add(get('safeAddGod'), () => !state.data.godless && !state.hasGod(get('safeAddGod')) && state.data.gods.length === 0);
  add(get('blessing'), () => state.hasBlessing(get('blessing')));
  add(get('curse'), () => state.hasCurse(get('curse')));
  add(get('title'), () => get('title').split(/[|,]/).some((t) => state.hasTitle(t.trim())));
  add(get('profession'), () => normalize(state.data.profession) === normalize(get('profession')));
  add(get('gender'), () => (state.data.gender === 'm') === get('gender').toLowerCase().startsWith('m'));
  add(get('resurrection'), () => state.hasResurrection());
  add(get('dead'), () => state.isDead() === boolAttr(get('dead')));
  add(get('book'), () => availableBooks().includes(Number(get('book'))));
  add(get('var'), () => { const v = state.getVar(get('var')); const cmp = compare(v); return cmp == null ? v !== 0 : cmp; });
  add(get('name'), () => { const v = state.codewordValue(get('name')); const cmp = compare(v); return cmp == null ? v !== 0 : cmp; });
  add(get('ability'), () => { const ab = firstAbility(get('ability')); const v = ab ? state.abilityForCheck(ab) : 0; const cmp = compare(v); return cmp == null ? v > 0 : cmp; });
  add(get('ship'), () => state.ships.some((s) => s.type === get('ship')));
  add(get('crew'), () => state.ships.some((s) => s.crew === get('crew')));
  add(get('cargo'), () => state.ships.some((s) => (s.cargo || []).length > 0));
  add(get('docked'), () => state.ships.length > 0);

  let final = matched ? result : true; // default true when nothing recognized
  if (boolAttr(get('not'))) final = !final;
  return final;
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
  if (get('ability') != null) {
    const note = applyAbilityChange(el, state, -1, opts);
    if (note) notes.push(note);
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
      // "?" is the books' wildcard for "any possession" (the §521/§248/§373 thefts);
      // a real name matches by name/tag. A tags= filter narrows the wildcard, but
      // awarded items carry no tags in this engine, so a tag-filtered "?" harmlessly
      // matches nothing (e.g. candle-burning), while a bare "?" matches every item.
      let matches = pattern === '?' ? state.data.items.slice() : state.findItems(pattern);
      const tags = get('tags');
      if (pattern === '?' && tags) {
        const want = tags.split(/[,|]/).map((t) => normalize(t));
        matches = matches.filter((it) => want.every((t) => (it.tags || []).map(normalize).includes(t)));
      }
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
  if (get('ability') != null) {
    // An ability attr was present — route it (rank/stamina/*/?/effect=…) and mark
    // `did` so a recognized-but-zero effect never falls through to the box tick.
    const note = applyAbilityChange(el, state, +1, opts);
    if (note) notes.push(note);
    did = true;
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
/** Total die-roll adjustment from the <adjust> children of a roll node.
 *  Each <adjust> is a conditional modifier ("add N if you have a good crew");
 *  only those whose condition the player meets contribute their amount. */
export function childAdjustment(el, state) {
  let sum = 0;
  el.querySelectorAll(':scope > adjust').forEach((a) => {
    if (adjustApplies(a, state)) sum += adjustAmount(a, state);
  });
  return sum;
}

/** The signed amount a roll-modifier <adjust> contributes. An explicit
 *  value=/amount= wins; otherwise <adjust ability="X"/> adds X's current value
 *  (e.g. "Add your Rank to the roll"), and <adjust name="V"/> adds a stored var. */
function adjustAmount(el, state) {
  const v = el.getAttribute('value') ?? el.getAttribute('amount');
  if (v != null) return resolveValue(state, v);
  const ab = el.getAttribute('ability');
  if (ab != null) {
    const key = ab.split('|')[0].trim().toLowerCase();
    if (key === 'rank') return state.data.rank;
    if (ABILITIES.includes(key)) return state.ability(key);
  }
  const nm = el.getAttribute('name');
  if (nm != null) return state.codewordValue(nm);
  return 0;
}

/** Does a roll-modifier <adjust> apply in the current state? Modifiers gated on
 *  crew grade / ship type / god / profession / item / codeword count only when
 *  the player meets that condition; an unconditional modifier always counts.
 *  Crew/ship match is exact (a "good crew" bonus does not fire for excellent). */
function adjustApplies(el, state) {
  const get = (a) => el.getAttribute(a);
  if (get('god') != null) return state.hasGod(get('god'));
  if (get('profession') != null) return normalize(state.data.profession) === normalize(get('profession'));
  if (get('item') != null) return get('item').split(/[|,]/).some((n) => state.hasItem(n.trim()));
  if (get('codeword') != null) return get('codeword').split(/[|,]/).some((c) => state.hasCodeword(c.trim()));
  if (get('crew') != null) return state.ships.some((s) => s.crew === get('crew'));
  if (get('ship') != null) return state.ships.some((s) => s.type === get('ship'));
  return true;
}

// difficulty: success iff (2d6 + ability + adjust) > level
export function rollDifficulty(state, ability, level, modifier = 0) {
  const ab = firstAbility(ability);
  const r = rollDice(2);
  const abilityScore = ab ? state.abilityForCheck(ab) : 0;
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
