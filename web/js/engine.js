// engine.js — the rules engine: dice, condition evaluation, and passive effects.
// Reads attributes off the parsed XML elements and applies them to a GameState.

import { ABILITIES, canonShipType, CREW_LEVELS, SHIP_TYPES, canonCargo } from './rules.js';
import { makeItem, normalize, globMatch, matchItems, matchItemQuery, isShardsCurrency, currencyAward, splitItemName, parseTags } from './state.js';
import { availableBooks } from './data.js';

// ---- dice / RNG ------------------------------------------------------------
// All game-affecting randomness flows through rng() so play can be made
// reproducible. Unseeded, it delegates to Math.random() (uniform and unbiased
// for 1..6 — no modulo bias). seedRng(seed) installs a small deterministic PRNG
// (mulberry32) for replayable runs and deterministic tests; a string seed is
// hashed to 32 bits first. Cosmetic randomness — the dice-spin animation and DOM
// id suffixes — deliberately stays on Math.random so it can't perturb the seeded
// stream that decides outcomes. Unseeded, rng() defers to the *live* Math.random
// (called each time, not captured) so a test that stubs the global still steers
// the dice.
let _rng = () => Math.random();

// xmur3 string-hash → a 32-bit seed generator (public-domain algorithm).
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32 — a compact 32-bit PRNG with a full period, good enough for dice.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Install a deterministic PRNG so dice become reproducible. A string seed is
 *  hashed to a 32-bit integer; a finite numeric seed is used directly. Pass
 *  null/'' to revert to Math.random(). Returns the numeric seed applied (or null). */
export function seedRng(seed) {
  if (seed == null || seed === '') { _rng = () => Math.random(); return null; }
  const n = (typeof seed === 'number' && Number.isFinite(seed))
    ? (seed >>> 0)
    : xmur3(String(seed))();
  _rng = mulberry32(n);
  return n;
}

/** Current RNG float in [0,1). Game randomness only — see the note above. */
export function rng() { return _rng(); }

export function rollD6() { return 1 + Math.floor(rng() * 6); }

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
  for (let i = 0; i < n; i++) dice.push(1 + Math.floor(rng() * faces));
  return { dice, total: dice.reduce((a, b) => a + b, 0) + mod, mod };
}

// A real dice expression: leading digit(s), a 'd', optional faces, optional ±N —
// "1d", "2d", "3d6", "1d6+2". A bare identifier that merely *contains* a 'd'
// ("d", "deduct", "defence", "shards") is a variable name, not dice; the old
// /d/i test misread every one of those as a die roll (task 25).
export function isDiceExpr(str) {
  return /^\d+\s*d\s*\d*\s*([+-]\s*\d+)?$/i.test(String(str || '').trim());
}

// ---- attribute value resolution -------------------------------------------
/** Resolve a numeric value from an attribute string: literal int, or variable name. */
export function resolveValue(state, str, def = 0) {
  if (str == null || str === '') return def;
  str = String(str).trim();
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (isDiceExpr(str)) return rollDiceExpr(str).total;
  // A bare (optionally negated) variable name — mirrors the Java engine's
  // Node.getAttributeValue (int | -var | var; an undefined var reads as 0).
  // Resolution here is *variable-first*, not keyword-first: <adjust
  // amount="armour"/> must read the variable `armour` (sections set it to
  // -armourbonus for damage reduction), never the sheet's armour rating. The
  // keyword-aware form is the <set value=> context — see evalExpression.
  const m = str.match(/^(-?)([A-Za-z_][A-Za-z0-9_]*)$/);
  if (m) return (m[1] ? -1 : 1) * state.getVar(m[2]);
  // Anything richer (parentheses, + - * /): evaluate the whole expression.
  return evalExpression(str, state);
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
  // <adjust> children modify the amount (the spec lists <gain>/<lose> as
  // adjust-modifiable): book2/579 resets the unwounded Stamina score via
  // <adjust ability="stamina" modifier="natural"/>. 0 when there are none.
  const delta = sign * (resolveValue(state, el.getAttribute('amount')) + childAdjustment(el, state));
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
  const tag = el.tagName.toLowerCase();
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

  // cache= redirects money/item/equipment lookups to a named stash (task 20 stocks it).
  const cacheN = get('cache');
  const money = cacheN != null ? state.cacheMoney(cacheN) : state.data.shards;
  const itemPool = cacheN != null ? state.cacheItems(cacheN) : state.data.items;
  const safeAdd = get('safeAddGod');

  add(get('codeword'), () => matchCodewords(state, get('codeword')));
  // Entry snapshot, not the live count: this visit's own <tick/> must not satisfy the
  // guard on a mid-visit rerender (task 105). Falls back to live when unset (headless).
  add(get('ticks'), () => state.entryTickCount() === resolveValue(state, get('ticks')));
  add(get('shards'), () => money >= resolveValue(state, get('shards')));
  add(get('item'), () => {
    // "?" = any possession, optionally tag-filtered (e.g. <if item="?" tags="light">
    // — do you have a light source?); a concrete name/glob defers to matchItems.
    // group= counts only the items awarded under that provenance key — §5.118's
    // "if you took more than one item" means more than one of the §5.238 haul,
    // not of the whole pack (task 93).
    const matches = matchItemQuery(itemPool, get('item'), get('tags'), get('group'));
    const cmp = compare(matches.length);
    return cmp == null ? matches.length > 0 : cmp;
  });
  // god="" means "worships no god"; otherwise a specific god.
  add(get('god'), () => get('god') === '' ? state.data.gods.length === 0 : state.hasGod(get('god')));
  // Can become an initiate only if not godless and not already worshipping a god.
  add(safeAdd, () => !state.data.godless && !state.hasGod(safeAdd) && state.data.gods.length === 0);
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
  // ability= is a standalone stat test ONLY without an equipment selector; with a
  // tool=/weapon=/armour= present, ability=/bonus= describe the ITEM being sought
  // (a MAGIC+6 tool) and fold into matchEquipment's pattern — never a separate OR
  // disjunct. A bare ability= with no comparator then never matches (JaFL IfNode),
  // instead of defaulting v>0 (always true, since abilities floor at 1 — which forced
  // §5.680's branch open with no wand and gave away the ring of ultimate power). (task 128)
  const hasEquipSelector = get('weapon') != null || get('armour') != null || get('tool') != null;
  if (!hasEquipSelector) add(get('ability'), () => {
    // `rank`/`stamina` are stats, not core abilities — firstAbility() ignores them,
    // so route them the way evalExpression/adjustAmount do (else the comparison ran
    // against 0: every `<if ability="rank" greaterthan=N>` gate stayed shut). (task 68)
    const spec = get('ability').split('|')[0].trim().toLowerCase();
    const natural = normalize(get('modifier') || '') === 'natural';
    let v;
    if (spec === 'rank') v = state.rankValue();
    else if (spec === 'stamina') v = get('modifier') ? state.effectiveStaminaMax() : state.data.stamina;
    else { const ab = firstAbility(get('ability')); v = ab ? state.abilityForCheck(ab, natural) : 0; }
    const cmp = compare(v);
    return cmp == null ? false : cmp; // no comparator ⇒ never matches (JaFL)
  });
  add(get('weapon'), () => matchEquipment(itemPool, state, 'weapon', get('weapon'), el));
  add(get('armour'), () => matchEquipment(itemPool, state, 'armour', get('armour'), el));
  add(get('tool'), () => matchEquipment(itemPool, state, 'tool', get('tool'), el));
  add(get('disease'), () => state.hasDisease(get('disease')));
  add(get('poison'), () => state.hasPoison(get('poison')));
  // ship/crew/cargo conditions read the CURRENT vessel (JaFL getSingleShip): the ship
  // berthed at this dock, or the one being sailed — never a vessel left at another
  // port. §1.586's storm follows the ship under you, not the fleet. (task 89)
  add(get('ship'), () => matchShipType(state, get('ship')));
  add(get('crew'), () => { const s = state.currentShip(); return !!s && s.crew === get('crew'); });
  add(get('cargo'), () => matchCargo(state.currentShip(), get('cargo')));
  // docked="<place>" needs a ship berthed there; docked="t" means berthed anywhere.
  add(get('docked'), () => { const d = get('docked'); return boolAttr(d) ? state.ships.some((s) => s.docked != null) : state.shipDockedAt(d); });

  // Refuse to silently pass a genuinely unrecognized condition attribute — warn
  // (once per attr) so a new/mis-spelled attribute surfaces instead of defaulting true.
  let hasUnknown = false;
  for (const at of el.getAttributeNames()) {
    if (!KNOWN_IF_ATTRS.has(at)) {
      hasUnknown = true;
      const k = tag + ':' + at;
      if (!_warnedIfAttrs.has(k)) { _warnedIfAttrs.add(k); console.warn(`evaluateCondition: unrecognized <${tag}> attribute "${at}"`); }
    }
  }

  let final = matched ? result : (hasUnknown ? false : true);
  if (boolAttr(get('not'))) final = !final;
  return final;
}

/** JaFL WhileNode semantics: a `<while var="V">` block loops UNTIL V has been
 *  assigned a value (`isVariableDefined`) — "while no value has been assigned to
 *  this variable, the block will keep looping". Returns true once the loop should
 *  STOP. The interactive driving (per-iteration rolls, effects) lives in the view,
 *  but the terminal test is a pure state read so it can be checked headlessly. A
 *  `<while>` with no var= never loops (nothing could ever un-set it). (task 100) */
export function whileLoopDone(node, state) {
  const v = node.getAttribute('var');
  return !v || state.hasVar(v);
}

// Attributes evaluateCondition understands: condition attributes plus the
// comparators/modifiers/structural attributes that legitimately accompany them.
const KNOWN_IF_ATTRS = new Set([
  'codeword', 'ticks', 'item', 'shards', 'god', 'var', 'blessing', 'title', 'ship',
  'profession', 'safeAddGod', 'book', 'dead', 'ability', 'weapon',
  'crew', 'cargo', 'cache', 'resurrection', 'armour', 'name', 'gender', 'docked', 'curse',
  'poison', 'tool', 'disease',
  'not', 'greaterthan', 'equals', 'lessthan', 'tags', 'bonus', 'using', 'dice',
  'modifier', 'hidden', 'group',
]);
const _warnedIfAttrs = new Set();

/** True if `pool` holds a weapon/armour/tool matching the condition. spec "?"/"*"
 *  (or empty) = any of that kind; a name/glob (pipe-separated) matches by name;
 *  bonus= ("N" or "N+") and tags= narrow; using="t" restricts to the wielded
 *  weapon / worn armour. */
function matchEquipment(pool, state, kind, spec, el) {
  let items = (pool || []).filter((it) => it.kind === kind);
  const bonus = el.getAttribute('bonus');
  if (bonus != null) {
    const m = String(bonus).match(/^(-?\d+)(\+)?$/);
    if (m) { const b = parseInt(m[1], 10); items = m[2] ? items.filter((it) => (it.bonus || 0) >= b) : items.filter((it) => (it.bonus || 0) === b); }
  }
  // ability= is part of the item pattern here (a MAGIC tool), not a separate stat test:
  // §5.680 seeks a "hyperium wand (MAGIC +6)" — a tool named hyperium wand, ability magic,
  // bonus 6 — so narrow to items carrying that ability. (task 128)
  const abil = el.getAttribute('ability');
  if (abil != null) { const want = abil.split('|').map((a) => normalize(a)); items = items.filter((it) => it.ability != null && want.includes(normalize(it.ability))); }
  const tags = el.getAttribute('tags');
  if (tags) { const want = tags.split(/[,|]/).map((t) => normalize(t)); items = items.filter((it) => want.every((t) => (it.tags || []).map(normalize).includes(t))); }
  if (boolAttr(el.getAttribute('using'))) {
    const eq = kind === 'weapon' ? state.wieldedWeapon() : (kind === 'armour' ? state.wornArmour() : null);
    items = (eq && items.includes(eq)) ? [eq] : [];
  }
  const s = String(spec || '').trim();
  if (s === '' || s === '?' || s === '*') return items.length > 0;
  const alts = s.split('|');
  return items.some((it) => alts.some((a) => globMatch(a, it.name)));
}

/** Select the possessions a <tick … addbonus|addtag|removetag> acts on (task 75). The
 *  selector attr (item/weapon/armour/tool) sets the pattern and, for weapon/armour/tool,
 *  the kind; tags= and using= narrow further; the pool is a cache when cache= is set.
 *  "*" = all matches, a name/glob = those named, "?"/blank = one — the chooser's pick
 *  when several qualify, else the first. */
function selectEquipment(el, state, eqAttr, cacheN, opts = {}) {
  const kind = eqAttr === 'item' ? null : eqAttr;
  const pool = cacheN != null ? state.cacheItems(cacheN) : state.data.items;
  let items = kind ? pool.filter((it) => it.kind === kind) : pool.slice();
  if (boolAttr(el.getAttribute('using'))) {
    const eq = kind === 'weapon' ? state.wieldedWeapon() : (kind === 'armour' ? state.wornArmour() : null);
    items = (eq && items.includes(eq)) ? [eq] : [];
  }
  const tags = el.getAttribute('tags');
  if (tags) { const want = tags.split(/[,|]/).map(normalize).filter(Boolean); items = items.filter((it) => want.every((t) => (it.tags || []).map(normalize).includes(t))); }
  const pat = String(el.getAttribute(eqAttr) || '').trim();
  if (pat === '*') return items;
  if (pat === '' || pat === '?') {
    if (items.length <= 1) return items.slice(0, 1);
    const pick = opts.chooser ? opts.chooser(items.slice(), 1, kind || 'item') : null;
    return (pick && pick.length) ? pick : items.slice(0, 1);
  }
  return matchItems(items, pat);
}

/** True if the CURRENT vessel's type matches `spec` (task 89 — the ship at this dock
 *  or under sail, never one berthed elsewhere: §1.586's storm dice follow the ship
 *  being sailed). A ship condition may abbreviate the type (brig/gall) or list
 *  alternatives (brigantine|galleon); both the stored type and each listed value are
 *  canonicalised so a brigantine bought under its full name still matches an
 *  <elseif ship="brig"> (book4/11,161). An empty spec means "any ship here". */
function matchShipType(state, spec) {
  const ship = state.currentShip();
  if (!ship) return false;
  const want = String(spec || '').split(/[|,]/).map((t) => canonShipType(t)).filter(Boolean);
  return !want.length || want.includes(canonShipType(ship.type));
}

/** True if `ship` carries the named cargo — "?"/"*"/blank = any Cargo Unit at all
 *  (book3/268/629), a name = that commodity (JaFL Ship.hasCargo). (task 89) */
function matchCargo(ship, spec) {
  if (!ship) return false;
  const list = ship.cargo || [];
  const c = String(spec ?? '').trim();
  if (c === '' || c === '?' || c === '*') return list.length > 0;
  // Prefix-canonicalise both sides so an abbreviated market unit ("meta") matches a
  // full-name query ("metals") and vice versa (JaFL Ship.getCargo prefix match). (task 127)
  const want = canonCargo(c);
  return list.some((x) => canonCargo(x) === want);
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
// Effect-applier registry: tag → (el, state, opts) => note. This is the rules
// half of the tag-dispatch table (task 9), mirroring the Java Node factory but
// kept in the DOM-free layer — the view layer has its own render registry in
// render.js. Adding a passive-effect tag is a one-line change here.
const EFFECT_APPLIERS = {
  lose:        (el, state, opts) => applyLose(el, state, opts),
  tick:        (el, state, opts) => applyTick(el, state, opts),
  gain:        (el, state, opts) => applyTick(el, state, opts),
  adjust:      (el, state, opts) => applyAdjust(el, state, opts),
  set:         (el, state, opts) => applySet(el, state, opts),
  curse:       (el, state)       => applyAffliction(el, state, 'curse'),
  disease:     (el, state)       => applyAffliction(el, state, 'disease'),
  poison:      (el, state)       => applyAffliction(el, state, 'poison'),
  adjustmoney: (el, state)       => applyAdjustMoney(el, state),
  transfer:    (el, state, opts) => applyTransfer(el, state, opts),
  effect:      (el, state, opts) => applyItemEffect(el, state, opts),
  // Item-family rewards: applying an <item>/<weapon>/<armour>/<tool> node grants it,
  // so a flag-linked reward routed through applyEffect actually lands instead of being
  // a silent no-op (§3.346 medallion, §1.342/§4.111 potion). (task 125)
  item:        (el, state) => applyItemAward(el, state),
  weapon:      (el, state) => applyItemAward(el, state),
  armour:      (el, state) => applyItemAward(el, state),
  tool:        (el, state) => applyItemAward(el, state),
};

export function applyEffect(el, state, opts = {}) {
  const applier = EFFECT_APPLIERS[el.tagName.toLowerCase()];
  return applier ? applier(el, state, opts) : '';
}

// Tags applyEffectBody applies directly; anything else it recurses into.
const PASSIVE_BODY_TAGS = new Set(['lose', 'tick', 'gain', 'set', 'curse', 'disease', 'poison', 'adjustmoney', 'transfer']);
const ROLL_BODY_TAGS = new Set(['random', 'rankcheck', 'difficulty']);

/** Apply an effect *body* headlessly: a <fightdamage>/<flee>/<fightround> subtree
 *  (or any wrapper). Walks children in order — rolling any <random>/<rankcheck>/
 *  <difficulty> (storing its var=), honouring <if>/<elseif>/<else> chains AND
 *  <success>/<failure> branches (matched by their var=, else against the walk's
 *  last roll — so §5.489's per-wound SANCTITY save gates its curse instead of the
 *  branch body firing unconditionally), and applying each passive effect. A <goto>
 *  ends the walk and is returned ({goto: {book, section}}) for the CALLER to
 *  navigate — a fight-round failure can drag the player to a death section
 *  (§5.689), a wound can redirect the fight (§4.238). `log`, when given, collects
 *  human-readable lines (the fight log). Used at wound-time (fightdamage), on
 *  fleeing, and between combat rounds (<fightround> — task 99); never on render. */
export function applyEffectBody(parent, state, log = null) {
  const ctx = { log, goto: null, lastRoll: null };
  walkEffectBody(parent, state, ctx);
  return { goto: ctx.goto };
}

function walkEffectBody(parent, state, ctx) {
  let inChain = false, chainMatched = false;
  for (const node of Array.from(parent.children)) {
    if (ctx.goto) return; // a <goto> ended the walk
    const tag = node.tagName.toLowerCase();
    if (tag === 'if' || tag === 'elseif' || tag === 'else') {
      let active;
      if (tag === 'if') { inChain = true; active = evaluateCondition(node, state); chainMatched = active; }
      else if (!inChain) active = false;
      else if (chainMatched) active = false;
      else if (tag === 'else') { active = true; chainMatched = true; }
      else { active = evaluateCondition(node, state); chainMatched = active; }
      if (active) walkEffectBody(node, state, ctx);
      continue;
    }
    inChain = false; chainMatched = false;
    // <success>/<failure>: the branch fires when it matches — by its var= (>0 =
    // success, the margin an earlier roll stored — §5.24 hang), else by the last
    // roll of this walk (§5.383/489). No roll and no var ⇒ it stays silent.
    if (tag === 'success' || tag === 'failure') {
      const want = tag === 'success';
      const v = node.getAttribute('var');
      let match = false;
      if (v != null) match = state.hasVar(v) && (state.getVar(v) > 0) === want; // an unwritten var fires nothing (task 50's rule)
      else if (ctx.lastRoll && ctx.lastRoll.success != null) match = ctx.lastRoll.success === want;
      if (match) walkEffectBody(node, state, ctx);
      continue;
    }
    // <goto>: record it and end the walk. Headless code never navigates itself.
    if (tag === 'goto') {
      if (node.getAttribute('section') != null) {
        ctx.goto = { book: node.getAttribute('book') != null ? Number(node.getAttribute('book')) : null, section: node.getAttribute('section') };
      }
      continue;
    }
    if (ROLL_BODY_TAGS.has(tag)) {
      const varName = node.getAttribute('var');
      if (tag === 'random') {
        const dice = node.hasAttribute('dice') ? parseInt(node.getAttribute('dice'), 10) : 2;
        const r = rollDice(dice);
        const total = r.total + childAdjustment(node, state);
        if (varName) state.setVar(varName, total);
        ctx.lastRoll = { success: null, total };
        if (ctx.log) ctx.log.push(`Rolled ${total}`);
      } else if (tag === 'rankcheck') {
        const res = rollRankCheck(state, parseInt(node.getAttribute('dice') || '1', 10), parseInt(node.getAttribute('add') || '0', 10), childAdjustment(node, state));
        if (varName) state.setVar(varName, res.margin);
        ctx.lastRoll = res;
        if (ctx.log) ctx.log.push(`Rank check ${res.total} vs ${state.rankValue()} — ${res.success ? 'success' : 'failure'}`);
      } else {
        const res = rollDifficulty(state, node.getAttribute('ability'), resolveValue(state, node.getAttribute('level')), childAdjustment(node, state));
        if (varName) state.setVar(varName, res.margin);
        ctx.lastRoll = res;
        if (ctx.log) ctx.log.push(`${(res.ability || '').toUpperCase()} roll ${res.total} vs ${res.level} — ${res.success ? 'success' : 'failure'}`);
      }
      continue;
    }
    if (PASSIVE_BODY_TAGS.has(tag)) { const note = applyEffect(node, state); if (note && ctx.log) ctx.log.push(note); continue; }
    // A <rest> inside an effect body (potion of restoration heals all Stamina —
    // task 41): a bare/blank stamina= restores to full (task 31), else that amount.
    if (tag === 'rest') { applyRest(state, node.getAttribute('stamina'), node.getAttribute('shards') != null ? resolveValue(state, node.getAttribute('shards')) : 0); continue; }
    walkEffectBody(node, state, ctx); // wrapper (e.g. <p>/<text>): descend
  }
}

function applyLose(el, state, opts) {
  const get = (a) => el.getAttribute(a);
  const notes = [];
  // cache= redirects a shards/item loss to a named stash (a bank/villa/investment)
  // rather than the player's purse/inventory. Without this, <lose item="?"
  // cache="4.468"> destroyed the player's own first possession — see task 20.
  const cacheN = get('cache');

  if (get('codeword') != null) { get('codeword').split(/[|,]/).forEach((c) => state.removeCodeword(c.trim())); notes.push('lost codeword'); }
  if (get('shards') != null) {
    if (cacheN != null) {
      if (get('shards') === '*') { if (state.cacheMoney(cacheN)) { state.setCacheMoney(cacheN, 0); notes.push('emptied stash'); } }
      else { state.adjustCacheMoney(cacheN, -resolveValue(state, get('shards'))); }
    } else if (get('shards') === '*') { if (state.data.shards) { state.data.shards = 0; state.changed(); notes.push('lost all Shards'); } }
    else { const n = resolveValue(state, get('shards')); state.adjustMoney(-n); notes.push(`−${n} Shards`); }
  }
  if (get('stamina') != null || get('staminato') != null) {
    let n;
    const s = get('stamina');
    // staminato="N" is "beaten down TO N Stamina" (§570 "wake up on 1 Stamina") —
    // it carries no stamina= attribute, so it must gate the block on its own (task
    // 71); the damage is however far above N you currently are.
    if (get('staminato') != null) { const target = resolveValue(state, get('staminato')); n = Math.max(0, state.data.stamina - target); }
    // <adjust> children reduce (or raise) the wound: "subtract your armour from
    // the roll" (book4/679, book6/306/527/696/742) or "−1 if you worship the
    // Three Fortunes" (book4/556). childAdjustment is 0 when there are none.
    else n = Math.max(0, resolveValue(state, s) + childAdjustment(el, state));
    state.damageStamina(n); notes.push(`−${n} Stamina`);
  }
  if (get('ability') != null) {
    const note = applyAbilityChange(el, state, -1, opts);
    if (note) notes.push(note);
  }
  if (get('blessing') != null) {
    const b = get('blessing');
    if (b === '*') { if (state.removeAllBlessings()) notes.push('lost all blessings'); }
    else if (b === '?') {
      // Punitive robbery ("lose one of your blessings" — book2/157/394): truly
      // removes the pick, permanent or not, like the punitive "*".
      if (state.data.blessings.length) {
        const pick = opts.chooser ? opts.chooser(state.data.blessings.slice(), 1, 'blessing') : null;
        const chosen = (pick && pick.length) ? pick[0] : state.data.blessings[0];
        if (state.removeBlessing(chosen)) notes.push('lost blessing');
      }
    } else if (state.useBlessing(b)) {
      // Every NAMED <lose blessing="…"> in the corpus (storm/disease/poison, 70
      // nodes) is the blessing being SPENT for its protection — a use, so §6.159's
      // permanent Safety from Storms survives ("never used up") while an ordinary
      // blessing is crossed off. (task 90)
      notes.push(state.isBlessingPermanent(b) ? 'blessing invoked (permanent)' : 'lost blessing');
    }
  }
  if (get('curse') != null) { if (state.removeCurse(get('curse'))) notes.push('curse lifted'); }
  if (get('disease') != null) { if (state.removeDisease(get('disease'))) notes.push('cured disease'); }
  if (get('poison') != null) { if (state.removePoison(get('poison'))) notes.push('cured poison'); }
  if (get('title') != null) { state.removeTitle(get('title')); }
  if (get('god') != null) { state.removeGod(get('god')); }
  // "Lose any resurrection arrangements you had" clears every deal (book2/394,
  // book6/230); the death handler consumes a single one separately.
  if (get('resurrection') != null) { if (state.data.resurrections.length) { state.data.resurrections = []; state.changed(); notes.push('lost resurrection'); } }
  if (get('flag') != null) { state.setFlag(get('flag'), false); }
  // Whether a possession/cargo/ship payment on this lose actually gave something up —
  // gates the price flag / linked reward at the end so an ineligible offering (no such
  // weapon, the wrong cargo, a +0 item passed off as a "+2") can never open its reward
  // for free. `paymentPresent` marks that the lose demands a tangible possession; it is
  // resolved AFTER every possession selector has run, not before. (tasks 113, 117)
  let paymentPresent = false, paymentTaken = false;
  let itemTaken = false;
  if (get('item') != null) {
    paymentPresent = true;
    const pattern = get('item');
    // Remover: the player's inventory, or a named cache (a villa strongroom) when
    // cache= is present — a cache theft must never touch carried possessions.
    const removeById = (id) => (cacheN != null ? state.cacheRemoveItem(cacheN, id) : state.removeItemById(id));
    if (pattern === '*') {
      // "Lose all your possessions." chance="x/y" (rare) makes each item's loss
      // probabilistic; a "keep"-tagged item is never taken.
      const pool = cacheN != null ? state.cacheItems(cacheN) : state.data.items;
      const chance = get('chance');
      const [num, den] = chance && chance.includes('/') ? chance.split('/').map((x) => parseInt(x, 10)) : [1, 1];
      let removed = 0;
      for (const it of pool.slice()) {
        if ((it.tags || []).map(normalize).includes('keep')) continue;
        const lose = !chance || (den > 0 && rng() < num / den);
        if (lose) { removeById(it.id); removed++; }
      }
      if (removed) { itemTaken = true; notes.push(cacheN != null ? 'stash emptied' : 'lost all possessions'); }
    } else {
      // The eligible pool: name/tag pattern ("?" = any possession, else name/tag), an
      // optional tags= narrowing, group= provenance and — new for task 113 — a bonus=
      // filter, so a "+2"/"+3" offering (§4.456 Tambu) only takes a genuinely +2/+3
      // item and a worthless piece can't be passed off as one.
      const matches = loseItemMatches(el, state);
      const count = get('multiple') ? resolveValue(state, get('multiple')) : 1;
      let toLose = matches;
      if (matches.length > count) {
        toLose = opts.chooser ? opts.chooser(matches, count, 'lose') : matches.slice(0, count);
      }
      toLose.slice(0, count).forEach((it) => removeById(it.id));
      if (toLose.length) { itemTaken = true; notes.push('lost item'); }
    }
    paymentTaken = itemTaken;
  }
  // <lose itemAt="x"> takes the item at a rolled 1-based position (§6.63 the loser's
  // forfeit, §6.168 the dream-compass swap). The position indexes the selected pool —
  // a named cache/stash when cache= is present, else the player's carried possessions
  // — and skips currency (money is not an item slot). A roll past the end of the list
  // takes nothing ("you get the compass without losing anything"), and the render layer
  // defers this until x is rolled (task 93). A possession carrying the "keep" tag is
  // left in place, so the royal ring (§1.385) or white sword (§4.103) can never be
  // rolled away — those are explicitly items that cannot be lost. (task 111)
  if (get('itemAt') != null) {
    const idx = resolveValue(state, get('itemAt'));
    const list = cacheN != null ? state.cacheItems(cacheN) : state.data.items;
    const it = Number.isFinite(idx) && idx >= 1 ? list[idx - 1] : null;
    if (it && !(it.tags || []).map(normalize).includes('keep')) {
      if (cacheN != null) state.cacheRemoveItem(cacheN, it.id); else state.removeItemById(it.id);
      notes.push('lost item');
    }
  }
  // Confiscation of equipment: <lose weapon|armour|tool="?"/"*"> — optionally
  // using="t" ("the one you're wielding/wearing"). Each kind is a possession payment,
  // so it counts toward paymentTaken only when a qualifying item was actually removed.
  for (const kind of ['weapon', 'armour', 'tool']) {
    if (get(kind) != null) { paymentPresent = true; const note = loseEquipment(el, state, kind, opts); if (note) { notes.push(note); paymentTaken = true; } }
  }
  // cargo/ship are possession payments (a crew shift is not — it never arms a reward).
  if (get('cargo') != null || get('ship') != null) paymentPresent = true;
  if (get('cargo') != null || get('crew') != null || get('ship') != null) { if (applyShipLose(el, state, opts)) paymentTaken = true; }
  // Arm the price flag only once the demanded payment is actually taken (a lose with no
  // possession selector — money, a god, a blessing — arms unconditionally). (tasks 113, 117)
  if (get('price') != null && (!paymentPresent || paymentTaken)) state.setFlag(get('price'), true);
  return notes.join(', ');
}

/** Grant an <item>/<weapon>/<armour>/<tool> reward node (task 125). The DOM-free twin of
 *  the render layer's award transaction — render.js's grantItemNode delegates here — so a
 *  flag-linked reward routed through applyEffect actually lands. A "N Shards" award banks
 *  its value; a possession is added when a carry slot is free (the 12-item cap), carrying
 *  its |-alt names as tags and its <effect> children; any <curse>/<disease>/<poison> child
 *  bites on pickup. quantity= is handled by the caller (renderChoosableReward). */
function applyItemAward(el, state) {
  const kind = el.tagName.toLowerCase();
  const rawName = el.getAttribute('name') || (kind === 'weapon' ? 'weapon' : kind);
  const currency = kind === 'item' ? currencyAward(rawName) : null;
  if (currency != null) { state.adjustMoney(currency); return `+${currency} Shards`; }
  if (state.freeSlots() <= 0) return ''; // no room, no grant (12-item carry cap)
  const { name, alts } = splitItemName(rawName);
  const bonus = el.getAttribute('bonus') ? parseInt(el.getAttribute('bonus'), 10) : 0;
  const ability = el.getAttribute('ability') || null;
  const tags = [...parseTags(el.getAttribute('tags')), ...alts];
  state.addItem(makeItem(kind, name, bonus, ability, tags, readItemEffects(el), el.getAttribute('group')));
  Array.from(el.querySelectorAll(':scope > curse, :scope > disease, :scope > poison')).forEach((aff) => applyEffect(aff, state));
  return 'gained item';
}

/** Grant ONE picked reward of a "choose one" purchase and consume the payment (clear its
 *  flag `key`) — the chooser-style award transaction behind the view's reward pick
 *  buttons (tasks 43/63; moved from the view in task 119). Effect rewards (tick/lose/
 *  gain) clear their own flag via applyEffect; an item/weapon/armour/tool award or a
 *  resurrection deal is granted here and the flag cleared explicitly. A quantity= option
 *  grants that many of the reward (§4.634's ink-sac barter option is two sacs), currency
 *  stacking freely and possessions limited by the 12-item carry cap (task 94). `book` is
 *  the current book — a resurrection deal's default. Returns the notify note. */
export function grantChosenReward(state, node, key, book) {
  const tag = node.tagName.toLowerCase();
  if (tag === 'item' || tag === 'weapon' || tag === 'armour' || tag === 'tool') {
    const quantity = node.getAttribute('quantity') != null ? Math.max(1, resolveValue(state, node.getAttribute('quantity'))) : 1;
    for (let k = 0; k < quantity; k++) applyItemAward(node, state);
    state.setFlag(key, false);
    return '';
  }
  if (tag === 'resurrection') {
    buyResurrectionDeal(state, {
      book: node.getAttribute('book') ? Number(node.getAttribute('book')) : book,
      section: node.getAttribute('section'), text: node.getAttribute('text') || (node.textContent || '').trim(),
      god: node.getAttribute('god'), cost: 0, supplemental: boolAttr(node.getAttribute('supplemental')),
    });
    state.setFlag(key, false);
    return 'Resurrection deal arranged.';
  }
  return applyEffect(node, state, {});
}

/** Candidate weapon/armour/tool a <lose kind=…> could take, after the bonus=/tags=/using=
 *  narrowing and keep-tag protection. Shared by the eligibility gate (losePaymentPlan),
 *  the forfeit chooser and the commit so the view and the engine agree on exactly what
 *  qualifies. The open "?"/"*" forms never reach a kept item (the white sword §4.103 can't
 *  be confiscated); only an explicit named piece with no ordinary match may. (tasks 117, 118) */
function loseEquipmentCandidates(el, state, kind) {
  let cands = state.data.items.filter((it) => it.kind === kind);
  const bonus = el.getAttribute('bonus');
  if (bonus != null && /^-?\d+$/.test(bonus)) cands = cands.filter((it) => (it.bonus || 0) === parseInt(bonus, 10));
  const tags = el.getAttribute('tags');
  if (tags) { const want = tags.split(/[,|]/).map((t) => normalize(t)); cands = cands.filter((it) => want.every((t) => (it.tags || []).map(normalize).includes(t))); }
  if (boolAttr(el.getAttribute('using'))) {
    const eq = kind === 'weapon' ? state.wieldedWeapon() : (kind === 'armour' ? state.wornArmour() : null);
    cands = eq ? [eq] : cands.slice(0, 1);
  }
  return applyKeepRule(cands, el.getAttribute(kind));
}

/** Lose a weapon/armour/tool. spec "*" = all of that kind; "?"/name = one (via
 *  opts.chooser or the first in inventory order); using="t" targets the currently
 *  wielded weapon / worn armour. Returns a note when something was taken, null when the
 *  player had no qualifying piece (so the caller's price flag stays unarmed). */
function loseEquipment(el, state, kind, opts) {
  const spec = el.getAttribute(kind);
  const cands = loseEquipmentCandidates(el, state, kind);
  if (!cands.length) return null;
  let toLose;
  if (spec === '*') toLose = cands;
  else { const pick = opts.chooser ? opts.chooser(cands, 1, kind) : null; toLose = (pick && pick.length) ? pick : [cands[0]]; }
  toLose.forEach((it) => state.removeItemById(it.id));
  return toLose.length ? `lost ${kind}` : null;
}

/** The cargo Units aboard the current vessel a <lose cargo=…> could take: "*"/"?" = any
 *  aboard, a named cargo = the matching Units. Empty when the ship lacks that cargo, so a
 *  named-cargo offering (§3.569) can't arm its reward without the goods. (task 117) */
function loseCargoCandidates(el, state) {
  const ship = state.currentShip();
  if (!ship) return [];
  const cargo = ship.cargo || [];
  const c = el.getAttribute('cargo');
  if (c === '*' || c === '?') return cargo.slice();
  const want = canonCargo(c);
  return cargo.filter((x) => canonCargo(x) === want);
}

/** The possession/cargo/ship a priced or forced <lose> demands as payment, and whether
 *  the player can currently meet it (task 117). `present` is true when the lose gives up a
 *  tangible possession (so its price flag / linked reward must wait until it is actually
 *  taken); `eligible` is whether a qualifying candidate exists now; `needsChoice` marks an
 *  open "?" equipment/cargo forfeit with more than one candidate, so the view offers a
 *  picker instead of silently taking the first. shards/god/blessing/crew losses are not a
 *  possession payment (present=false) and arm unconditionally, as before. */
export function losePaymentPlan(el, state) {
  const g = (a) => el.getAttribute(a);
  const openForm = (spec) => spec === '?' || spec == null || String(spec).trim() === '';
  const plan = (kind, spec, candidates) => ({
    present: true, kind, candidates,
    eligible: candidates.length > 0,
    needsChoice: openForm(spec) && candidates.length > 1,
  });
  if (g('item') != null) {
    if (g('item') === '*') {
      // "Lose all your possessions" spares keep items — mirror applyLose so the eligibility
      // gate agrees with what is actually takeable. (tasks 117, 118)
      const pool = (g('cache') != null ? state.cacheItems(g('cache')) : state.data.items).filter((it) => !isKeep(it));
      return { present: true, kind: 'item', candidates: pool, eligible: pool.length > 0, needsChoice: false };
    }
    const cands = loseItemMatches(el, state);
    return { present: true, kind: 'item', candidates: cands, eligible: cands.length > 0, needsChoice: false };
  }
  for (const kind of ['weapon', 'armour', 'tool']) {
    if (g(kind) != null) return plan(kind, g(kind), loseEquipmentCandidates(el, state, kind));
  }
  if (g('cargo') != null) return plan('cargo', g('cargo'), loseCargoCandidates(el, state));
  if (g('ship') != null) { const s = state.currentShip(); return { present: true, kind: 'ship', candidates: s ? [s] : [], eligible: !!s, needsChoice: false }; }
  return { present: false, kind: null, candidates: [], eligible: true, needsChoice: false };
}

function applyShipLose(el, state, opts = {}) {
  const ship = state.currentShip(); // the local/current vessel, not just ships[0] (task 73)
  if (!ship) return false;
  let took = false; // whether a cargo Unit or the ship itself was actually given up (task 117)
  if (el.getAttribute('crew') != null) {
    // <lose crew="N"> shifts the crew grade by N along CREW_LEVELS: a positive N
    // demotes, a negative N (the crew *upgrade* idiom, e.g. crew="-1"/"-2") promotes.
    // Clamp BOTH ends — an upgrade past "excellent" used to index off the array and
    // silently reset the crew to "poor" (book1/38 et al.); an unknown crew starts at poor.
    const idx = Math.max(0, CREW_LEVELS.indexOf(ship.crew));
    const d = parseInt(el.getAttribute('crew'), 10) || 1;
    const next = Math.min(CREW_LEVELS.length - 1, Math.max(0, idx - d));
    ship.crew = CREW_LEVELS[next];
  }
  if (el.getAttribute('cargo') != null) {
    const c = el.getAttribute('cargo');
    const cargo = (ship.cargo ||= []);
    if (c === '*') { if (cargo.length) { ship.cargo = []; took = true; } }
    else if (c === '?') {
      if (cargo.length) {
        const pick = opts.chooser ? opts.chooser(cargo.slice(), 1, 'cargo') : null;
        const idx = (pick && pick.length) ? cargo.indexOf(pick[0]) : 0;
        cargo.splice(idx >= 0 ? idx : 0, 1); took = true;
      }
    } else {
      const want = canonCargo(c);
      if (el.getAttribute('price') != null) {
        // A priced one-for-one exchange (§3.569 `price=`) trades a single Unit. (task 117)
        const i = cargo.findIndex((x) => canonCargo(x) === want); if (i >= 0) { cargo.splice(i, 1); took = true; }
      } else {
        // A plain named loss ("they are lost", §5.634) drops EVERY Unit of the
        // commodity, as JaFL's LoseNode does — extras must not survive. (task 136.2)
        const before = cargo.length;
        ship.cargo = cargo.filter((x) => canonCargo(x) !== want);
        if (ship.cargo.length !== before) took = true;
      }
    }
  }
  if (el.getAttribute('ship') != null) { const i = state.data.ships.indexOf(ship); if (i >= 0) { state.data.ships.splice(i, 1); took = true; } }
  state.changed();
  return took;
}

function applyTick(el, state, opts) {
  const get = (a) => el.getAttribute(a);
  const notes = [];
  let did = false;
  const cacheN = get('cache');

  if (get('codeword') != null) {
    let gained = false;
    get('codeword').split(/[|,]/).forEach((c) => { const cw = c.trim(); if (!state.hasCodeword(cw)) gained = true; state.addCodeword(cw); });
    if (gained) notes.push('codeword gained'); // stay silent when the codeword was already held
    did = true;
  }
  if (get('shards') != null) {
    const n = resolveValue(state, get('shards'));
    if (cacheN != null) { state.adjustCacheMoney(cacheN, n); notes.push('stash credited'); }
    else { state.adjustMoney(n); notes.push(`+${n} Shards`); }
    did = true;
  }
  if (get('blessing') != null) { state.addBlessing(get('blessing'), boolAttr(get('permanent'))); notes.push('blessing'); did = true; }
  if (get('curse') != null) { state.addCurse(get('curse')); did = true; }
  if (get('god') != null) { state.setGod(get('god'), readEffects(el)); did = true; }
  if (get('title') != null) {
    // A titlePattern= makes a patterned title (JaFL): a NEW title starts at titleValue
    // (default 1), an existing one advances by titleAdjust (default 1), and the pattern
    // ({0}=value) renders it ("Circle 2 Master of bokh" — book5/119/172/235). (task 75)
    const pattern = get('titlePattern');
    if (pattern != null) {
      const init = get('titleValue') != null ? resolveValue(state, get('titleValue')) : 1;
      const adjust = get('titleAdjust') != null ? resolveValue(state, get('titleAdjust')) : 1;
      state.adjustPatternedTitle(get('title'), pattern, init, adjust);
    } else {
      const val = get('titleValue') ? resolveValue(state, get('titleValue')) : (get('amount') ? resolveValue(state, get('amount')) : 0);
      state.addTitle(get('title'), val);
    }
    did = true;
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
  // crew=/cargo= act on the current vessel; a recognized attribute with no vessel
  // present is inert but still sets `did` (no bare-tick box fallthrough). (task 89)
  if (get('crew') != null) { const s = state.currentShip(); if (s) { s.crew = get('crew'); state.changed(); } did = true; }
  if (get('cargo') != null) {
    // Load quantity= units of cargo onto the current vessel, up to its hold capacity
    // (§3.569 loads 2 Cargo Units of textiles, not 1); default 1 (§3.583). A full
    // hold refuses the overflow rather than exceeding capacity. (task 94)
    const s = state.currentShip();
    if (s) {
      const qty = get('quantity') != null ? resolveValue(state, get('quantity')) : 1;
      const cap = SHIP_TYPES[canonShipType(s.type)]?.capacity || 1;
      s.cargo ||= [];
      let loaded = 0;
      for (let k = 0; k < qty && s.cargo.length < cap; k++) { s.cargo.push(canonCargo(get('cargo'))); loaded++; }
      if (loaded) state.changed();
    }
    did = true;
  }
  // Enchant one or more possessions in place: addbonus= raises the bonus, addtag=
  // stamps a tag, removetag= strips one. The target is selected by item=/weapon=/
  // armour=/tool= (kind-filtered), narrowed by tags= / using= (the wielded weapon or
  // worn armour), and drawn from a cache when cache= is set. "*" = all matches, a name
  // = those named, "?"/blank = one (the chooser's pick, else the first). (tasks 20, 75)
  const eqAttr = ['weapon', 'armour', 'tool', 'item'].find((k) => get(k) != null);
  if (eqAttr != null && (get('addbonus') != null || get('addtag') != null || get('removetag') != null)) {
    const targets = selectEquipment(el, state, eqAttr, cacheN, opts);
    const addb = get('addbonus') != null ? resolveValue(state, get('addbonus')) : 0;
    const addt = get('addtag'), remt = get('removetag');
    targets.forEach((it) => {
      if (addb) it.bonus = (it.bonus || 0) + addb;
      if (addt) { it.tags = it.tags || []; if (!it.tags.map(normalize).includes(normalize(addt))) it.tags.push(addt); }
      if (remt) it.tags = (it.tags || []).filter((t) => normalize(t) !== normalize(remt));
    });
    if (targets.length) { if (cacheN == null) state.reconcileEquipment(); state.changed(); did = true; }
  }
  // Change profession (book6/731 "become a Priest"); a pipe-list ("mage|rogue|…") is a
  // player choice handled by the view's picker (book6/118), so apply only a single one here.
  if (get('profession') != null && !get('profession').includes('|')) { state.setProfession(get('profession')); did = true; }

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
  // bonus may be a variable (§6.183 special="defence" bonus="s"), so resolve it;
  // default to 3 when absent (JaFL's default). resolveValue handles ints and vars.
  const bonusAttr = el.getAttribute('bonus');
  const bonus = bonusAttr != null ? resolveValue(state, bonusAttr) : 3;
  // lock/unlock a named cache: the books bracket a gamble/theft resolution
  // between <tick special="lock"> and <tick special="unlock"> so the stashed
  // sum can't be altered mid-event (cache= names the stash).
  if (kind === 'lock' || kind === 'unlock') {
    const cacheN = el.getAttribute('cache');
    if (cacheN != null) { state.lockCache(cacheN, kind === 'lock'); return; }
  }
  // special="attack" adds bonus to the player's attack rolls for the current fight
  // only; special="defence" adds it to the player's Defence for that fight only.
  // Stored as a transient, per-fight bonus (NOT a permanent data.effects entry) so
  // it applies to the right stat, expires with the section/fight, and never
  // survives a save — book1/42 rat poison, book4/434 ring, book6/183/490/624 (task 49).
  if (kind === 'defence') state.addFightBonus('defence', bonus);
  else if (kind === 'attack') state.addFightBonus('attack', bonus);
  else if (kind === 'godless') {
    // "Cross the Gods Box off … you can never be an initiate of any deity from
    // now on" (book6/118): renounce every current god (stripping its effects) and
    // set the godless flag so <if god=""> reads true and future initiation is barred.
    state.data.gods.slice().forEach((g) => state.removeGod(g));
    state.data.godless = true;
  } else if (kind === 'difficultyCurse') state.data.oneDieRolls = true; // book3/91: one die on ability rolls
  else if (kind === 'difficultyRestore') state.data.oneDieRolls = false; // book2/102: lifted at the temple
  // weaponlock/armourlock (book6/135, book2/290): JaFL locks the broken weapon /
  // melted armour so it can't be swapped to dodge the loss; here the sibling
  // <lose weapon|armour using="t"> takes it and equipment auto-reconciles, so there
  // is nothing extra to enforce — recognised as a no-op rather than an unknown tag.
  state.changed();
}

// <adjustmoney multiply="N"> — scale a money pot by a factor (the investment/
// gambling payout, or "lose half your money"). With name=/cache= it scales that
// named cache; otherwise it scales the player's purse. Losses/profits floor
// (round in the house's favour), keeping Shards integral.
function applyAdjustMoney(el, state) {
  const name = el.getAttribute('name') != null ? el.getAttribute('name') : el.getAttribute('cache');
  // currency="Mithral" (etc.) targets a named-currency pool, not Shards/a cache —
  // lets a section grant or scale a foreign coin used in a currency market (task 40).
  const currency = el.getAttribute('currency');
  const useCur = !isShardsCurrency(currency);
  const mult = el.getAttribute('multiply');
  if (mult != null) {
    const f = parseFloat(mult);
    if (isNaN(f)) return '';
    if (useCur) { state.multiplyCurrency(currency, f); return 'currency adjusted'; }
    if (name != null) { state.multiplyCacheMoney(name, f); return 'stash adjusted'; }
    state.data.shards = Math.max(0, Math.floor(state.data.shards * f)); state.changed();
    return 'money adjusted';
  }
  // add=/amount= (spec-complete; not used in the current corpus)
  const addAttr = el.getAttribute('add') != null ? el.getAttribute('add') : el.getAttribute('amount');
  if (addAttr != null) {
    const n = resolveValue(state, addAttr);
    if (useCur) state.adjustCurrency(currency, n);
    else if (name != null) state.adjustCacheMoney(name, n);
    else state.adjustMoney(n);
  }
  return '';
}

// <transfer …/> — move money/equipment between the Adventure Sheet and a named
// cache. to="X" deposits INTO cache X; from="X" withdraws OUT of it (absent → the
// player's possessions/purse). The item attributes (weapon|armour|tool|item with a
// name/"*"/"?", plus bonus/tags/group) pick what moves; their x-prefixed twins
// (xitem/xbonus/…) spare matches; shards moves money. Used for confiscate-and-
// return scenes (§2.462 vampire), offerings (§4.456) and villa/bank stashing.
//
// The XML contract (JaFL TransferNode): a *visible* transfer is a player ACTION,
// not an on-entry effect — only hidden="t" auto-runs. The view (renderTransfer)
// arms visible transfers as buttons and runs this on the click; when more items
// qualify than the limit it passes the player's pick via opts.chooser. (task 107)

// Build a transfer include/exclude selector for the given attribute prefix
// ('' = items to move, 'x' = items to spare). null when no selector for that
// prefix. `all` marks the plain item="*" form (every possession), the only form
// that skips keep-tagged items when moving from the player.
function transferSelector(el, prefix) {
  const g = (a) => el.getAttribute(prefix + a);
  let kind = null, pattern = null, present = false;
  for (const k of ['weapon', 'armour', 'tool']) {
    if (g(k) != null) { kind = k; pattern = g(k); present = true; break; }
  }
  if (!present && g('item') != null) { pattern = g('item'); present = true; }
  const bonus = g('bonus'), tags = g('tags'), group = g('group');
  if (!present) {
    // Filters with no item attribute (xbonus/xtags/xgroup) still select "any item"
    // narrowed by those filters (JaFL builds the exclude Item from the x-attributes).
    if (bonus == null && tags == null && group == null) return null;
    pattern = '?'; present = true;
  }
  return { kind, pattern, bonus, tags, group, all: !kind && pattern === '*' };
}

// Filter a pool by a bonus= spec: "N" keeps items whose bonus is exactly N, "N+"
// keeps bonus ≥ N (JaFL Item.matchBonus). A null/blank/unparsable spec is a no-op.
// Shared by every item selector — <transfer>, <set> and <lose> — so an offering's
// ability-bonus requirement (§4.456 Tambu's +2/+3, §5.152) is enforced identically. (task 113)
function filterByBonus(pool, bonus) {
  if (bonus == null) return pool;
  const m = String(bonus).match(/^(-?\d+)(\+)?$/);
  if (!m) return pool;
  const b = parseInt(m[1], 10);
  return m[2] ? pool.filter((it) => (it.bonus || 0) >= b) : pool.filter((it) => (it.bonus || 0) === b);
}

// A "keep"-tagged possession is one the books say cannot be lost or stolen — the royal
// ring (§1.385), the white sword (§4.103). Recognised anywhere a forfeit is planned.
function isKeep(it) { return (it.tags || []).map(normalize).includes('keep'); }

// keep-tag protection for a possession forfeit (task 118). A kept item is spared while any
// ordinary item satisfies the selector; only an explicitly NAMED selector (not the open
// ?/blank/* forms) with no ordinary match may deliberately hand that kept item over — a
// scripted "give up the royal ring" still works, a generic theft never reaches it.
function applyKeepRule(matches, spec) {
  const ordinary = matches.filter((it) => !isKeep(it));
  if (ordinary.length) return ordinary;
  const s = spec == null ? '' : String(spec).trim();
  const named = s !== '' && s !== '?' && s !== '*';
  return named ? matches : ordinary; // ordinary is [] here
}

// The possessions (or cache items) a `<lose item=…>` would take: name/tag pattern
// (`?`/blank = any, else pipe-separated names/tags), an optional tags= narrowing,
// group= provenance and a bonus= filter ("N"/"N+"). The `*` "all possessions" form is
// handled separately by applyLose (keep/chance rules). Exported so the render layer's
// offering gate and applyLose share one eligibility test. (task 113) A carried keep item
// is protected unless an explicit named selector has no ordinary alternative (task 118);
// a cache theft targets a deliberately-stocked stash, where the carried-possession keep
// rule does not apply (mirrors transferMovers).
export function loseItemMatches(el, state) {
  const pattern = el.getAttribute('item');
  if (pattern == null || pattern === '*') return [];
  const cacheN = el.getAttribute('cache');
  const pool = cacheN != null ? state.cacheItems(cacheN) : state.data.items;
  const matches = filterByBonus(matchItemQuery(pool, pattern, el.getAttribute('tags'), el.getAttribute('group')), el.getAttribute('bonus'));
  return cacheN != null ? matches : applyKeepRule(matches, pattern);
}

// Items in `pool` matched by a transfer selector: kind, name (bare "*"/"?"/blank =
// any; else pipe-separated globs, also matched against item tags), bonus ("N"/"N+"),
// tags (all listed) and group provenance.
function transferMatch(pool, sel) {
  let items = sel.kind ? pool.filter((it) => it.kind === sel.kind) : pool.slice();
  const pat = String(sel.pattern == null ? '' : sel.pattern).trim();
  if (pat !== '' && pat !== '?' && pat !== '*') {
    const alts = pat.split('|').map((s) => s.trim()).filter(Boolean);
    items = items.filter((it) => alts.some((a) => globMatch(a, it.name) || (it.tags || []).map(normalize).includes(normalize(a))));
  }
  if (sel.tags) {
    const want = sel.tags.split(/[,|]/).map((t) => normalize(t)).filter(Boolean);
    items = items.filter((it) => want.every((t) => (it.tags || []).map(normalize).includes(t)));
  }
  if (sel.group != null && sel.group !== '') items = items.filter((it) => it.group === sel.group);
  return filterByBonus(items, sel.bonus);
}

// The candidate items a transfer would move FROM its source, after the include
// selector, keep protection (plain item="*" from the player only) and the exclude
// selector — the pool the chooser draws from (JaFL TransferNode.getItemIndices).
function transferMovers(el, state) {
  const from = el.getAttribute('from');
  const pool = from != null ? state.cacheItems(from) : state.data.items;
  const include = transferSelector(el, '');
  const exclude = transferSelector(el, 'x');
  let movers;
  if (include && include.all) {
    movers = pool.filter((it) => from != null || !(it.tags || []).map(normalize).includes('keep'));
  } else if (include) {
    movers = transferMatch(pool, include);
  } else if (exclude) {
    movers = pool.slice(); // filters-only exclude: everything not spared
  } else {
    return []; // no item selector (a pure shards transfer)
  }
  if (exclude) {
    const spared = new Set(transferMatch(pool, exclude).map((it) => it.id));
    movers = movers.filter((it) => !spared.has(it.id));
  }
  return movers;
}

// A transfer's effective item limit: an explicit limit=, else 1 for the bare "?"
// "choose one" wildcard, else Infinity (move every match).
function transferItemLimit(el) {
  const lim = el.getAttribute('limit');
  if (lim != null) return parseInt(lim, 10) || 0;
  const include = transferSelector(el, '');
  if (include && String(include.pattern).trim() === '?') return 1;
  return Infinity;
}

// The shards a transfer would move: spec (raw attr), avail (in the source) and amt.
function transferShards(el, state) {
  const spec = el.getAttribute('shards');
  if (spec == null) return { spec: null, avail: 0, amt: 0 };
  const from = el.getAttribute('from');
  const avail = from != null ? state.cacheMoney(from) : state.data.shards;
  let amt;
  if (spec === '*') amt = avail;
  // JaFL has no `tenth` keyword; §6.496 sets its own `<set var="tenth"
  // value="(shards+9)/10"/>` (rounded up). Resolve it as a var so the tithe
  // stops under-paying by 1 on non-multiples of 10 (task 136.1).
  else amt = Math.min(avail, resolveValue(state, spec));
  return { spec, avail, amt };
}

function itemsAllSame(items) {
  if (items.length <= 1) return true;
  const sig = (it) => `${it.kind}|${normalize(it.name)}|${it.bonus || 0}`;
  const first = sig(items[0]);
  return items.every((it) => sig(it) === first);
}

/** Everything the view needs to arm a visible transfer as an action (task 107):
 *  the candidate movers, the effective limit, whether a chooser is required (more
 *  qualify than the limit and they are not interchangeable), whether it does
 *  anything at all, and — for a price= action — whether it can pay in full. */
export function transferPlan(el, state) {
  const movers = transferMovers(el, state);
  const limit = transferItemLimit(el);
  const { amt: shardsAmt, avail: shardsAvail } = transferShards(el, state);
  const doesAnything = movers.length > 0 || shardsAmt > 0;
  const needChoice = limit !== Infinity && movers.length > limit && !itemsAllSame(movers);
  const hasItemSel = transferSelector(el, '') != null || transferSelector(el, 'x') != null;
  const explicitLimit = el.getAttribute('limit');
  const shardsSpec = el.getAttribute('shards');
  const enoughItems = !hasItemSel || explicitLimit == null || movers.length >= (parseInt(explicitLimit, 10) || 0);
  const enoughShards = shardsSpec == null || shardsSpec === '*' || shardsAvail >= resolveValue(state, shardsSpec);
  const canPay = doesAnything && enoughItems && enoughShards;
  return { movers, limit, needChoice, doesAnything, canPay };
}

function applyTransfer(el, state, opts = {}) {
  const from = el.getAttribute('from'), to = el.getAttribute('to');
  if (from == null && to == null) return '';

  // Items: candidate movers narrowed to the effective limit. When more qualify than
  // the limit and they are not interchangeable, the view's chooser (opts.chooser)
  // supplies the pick; otherwise take the first `limit` (or all when unlimited).
  const movers = transferMovers(el, state);
  const limit = transferItemLimit(el);
  let toMove = movers;
  if (limit !== Infinity && movers.length > limit) {
    toMove = itemsAllSame(movers)
      ? movers.slice(0, limit)
      : (opts.chooser ? (opts.chooser(movers.slice(), limit, 'transfer') || []) : movers.slice(0, limit));
    toMove = toMove.slice(0, limit);
  }
  toMove.forEach((it) => {
    const removed = from != null ? state.cacheRemoveItem(from, it.id) : state.removeItemById(it.id);
    if (removed) { if (to != null) state.cacheAddItem(to, removed); else state.addItem(removed); }
  });

  // Shards: move `amt` from source to destination.
  const { amt } = transferShards(el, state);
  if (amt > 0) {
    if (from != null) state.adjustCacheMoney(from, -amt); else state.adjustMoney(-amt);
    if (to != null) state.adjustCacheMoney(to, amt); else state.adjustMoney(amt);
  }

  // price= is a clear-flag gate: set the flag once the transfer has run.
  const price = el.getAttribute('price');
  if (price != null) state.setFlag(price, true);
  return '';
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
  } else if (get('crew') != null && state.currentShip()) {
    const ship = state.currentShip();
    const idx = ['poor', 'average', 'good', 'excellent'].indexOf(ship.crew);
    ship.crew = ['poor', 'average', 'good', 'excellent'][Math.max(0, Math.min(3, idx + amount))] || ship.crew;
    state.changed();
  }
  return '';
}

// A <set modifier="natural|affected"> is NOT an additive amount — it is a
// resolution mode for the ability/stamina identifiers inside value= (JaFL
// SetVarNode). Treating it as an addend (the old bug) discarded the computed
// value: `resolveValue(state,'natural')` looked up a non-existent var → 0, so
// e.g. every book-2 rank ceremony's `<set var="r" value="rank" modifier="natural"/>`
// stored r=0 and the "roll 2d > r to gain a Rank" check auto-succeeded (task 46).
function setValueMode(mod) {
  const m = String(mod || '').trim().toLowerCase();
  return (m === 'natural' || m === 'affected') ? m : null;
}

// A <set item|weapon|armour|tool … tags=… cache=…> node selects a possession (or a
// cache's stored item) so the value= identifiers resolve against *it*, not the global
// sheet (JaFL SetVarNode.resolveIdentifier, task 77): value="matches" counts the
// selection, value="weapon|armour|tool" reads the single selected item's bonus, and an
// expression's `shards` reads the named cache when cache= is set. Returns null when the
// node has neither an item selector nor a cache (ordinary sheet resolution — unchanged).
function setSelector(el) {
  let kind = null, pattern = null, hasItemSel = false;
  for (const k of ['weapon', 'armour', 'tool']) {
    if (el.getAttribute(k) != null) { kind = k; pattern = el.getAttribute(k); hasItemSel = true; break; }
  }
  if (!hasItemSel && el.getAttribute('item') != null) { pattern = el.getAttribute('item'); hasItemSel = true; }
  const cache = el.getAttribute('cache');
  if (!hasItemSel && cache == null) return null;
  return { kind, pattern, tags: el.getAttribute('tags'), bonus: el.getAttribute('bonus'), cache, hasItemSel };
}

// Items in `pool` matched by a parsed selector: kind (weapon/armour/tool), name/tag
// pattern (reusing the shared matchItemQuery) and an optional bonus filter ("N"/"N+").
function matchesSelectorPool(pool, sel) {
  let items = sel.kind ? pool.filter((it) => it.kind === sel.kind) : pool;
  items = matchItemQuery(items, sel.pattern, sel.tags);
  return filterByBonus(items, sel.bonus);
}

// Items matching a set-node selector, drawn from the selected pool (a named cache or the
// sheet), narrowed by the selector's kind, name/tag pattern and optional bonus filter.
function setSelectorMatches(state, sel) {
  if (!sel || !sel.hasItemSel) return [];
  const pool = sel.cache != null ? state.cacheItems(sel.cache) : state.data.items;
  return matchesSelectorPool(pool, sel);
}

/** Items in `pool` matched by an `<include>`/`<exclude>` (or `<set>`) selector
 *  element — its kind (weapon/armour/tool or item="?"), name/tag pattern and optional
 *  bonus ("N"/"N+"). Empty when the element carries no item selector. Shared by the
 *  filtered item-cache eligibility test (§2.617 Molhern's smithy). (task 97) */
export function filterMatches(pool, el) {
  const sel = setSelector(el);
  return (sel && sel.hasItemSel) ? matchesSelectorPool(pool, sel) : [];
}

// The bonus of the single selected weapon/armour/tool for value="weapon|armour|tool".
// JaFL getSingleItem only resolves when exactly one item matches; when the selection is
// missing, ambiguous or the wrong kind, fall back to the wielded weapon / worn armour —
// but ONLY for a sheet lookup. A cache lookup that misses reads 0 (no equipment fallback).
function setSelectorBonus(state, sel, kind) {
  const items = setSelectorMatches(state, sel);
  const it = items.length === 1 ? items[0] : null;
  if (it && it.kind === kind) return it.bonus || 0;
  if (sel.cache != null) return 0;
  if (kind === 'weapon') return state.wieldedWeapon()?.bonus || 0;
  if (kind === 'armour') return state.wornArmour()?.bonus || 0;
  return 0;
}

function applySet(el, state) {
  const get = (a) => el.getAttribute(a);
  const name = get('var');
  // <set dock="X"> moves the ship in the current location (else the sole/first ship) to
  // dock X — JaFL SetVarNode docks the ships here. (task 73)
  if (get('dock') != null) { const s = state.currentShip(); if (s) { s.docked = get('dock'); state.changed(); } return ''; }
  if (!name) return '';
  const mode = setValueMode(get('modifier'));
  let val;
  if (get('value') != null) val = evalExpression(get('value'), state, mode, setSelector(el));
  else if (get('codeword') != null) val = state.codewordValue(get('codeword'));
  else val = 0;
  state.setVar(name, val);
  return '';
}

// Inflict a curse/disease/poison. The <curse>/<disease>/<poison> element carries
// a name= and <effect ability=… bonus=…> children (an inherent ability penalty
// held until the affliction is cured). cumulative="t" lets copies stack.
function applyAffliction(el, state, type) {
  const name = el.getAttribute('name') || type;
  state.addAffliction(type, {
    name,
    effects: readEffects(el),
    cumulative: boolAttr(el.getAttribute('cumulative')),
    lift: el.getAttribute('lift') || null,
  });
  return type;
}

/** Ability key for an affliction/god effect — the six core abilities plus
 *  `stamina` (an affliction may cut the Stamina total, held until cured). */
function afflictionAbility(attr) {
  if (!attr) return null;
  const a = attr.split('|')[0].trim().toLowerCase();
  if (a === 'stamina') return 'stamina';
  return ABILITIES.includes(a) ? a : null;
}

/** Read the <effect ability=… …> children of an affliction/item element. Each is
 *  ONE of: a `bonus` (additive), a `divide` (halve the score, round up — JaFL
 *  AbilityEffect.DIVIDE_ABILITY) or a `target` (pin the score — TARGET_ABILITY).
 *  Afflictions may also hit `ability="stamina"` (a Stamina-total cut held until
 *  cured). A curse may instead carry its single penalty on the element itself. */
function readEffects(el) {
  const out = [];
  const readOne = (src) => {
    const ab = afflictionAbility(src.getAttribute('ability'));
    if (!ab) return;
    if (src.getAttribute('divide') != null) out.push({ ability: ab, divide: parseInt(src.getAttribute('divide'), 10) || 1 });
    else if (src.getAttribute('target') != null) out.push({ ability: ab, target: parseInt(src.getAttribute('target'), 10) || 0 });
    else out.push({ ability: ab, bonus: parseInt(src.getAttribute('bonus') || '0', 10) || 0 });
  };
  el.querySelectorAll(':scope > effect').forEach(readOne);
  if (!out.length && el.getAttribute('ability')) readOne(el);
  return out;
}

function applyItemEffect(el, state) {
  // <effect> as a child of an item is captured at award/buy time (readItemEffects)
  // and lives on the possession; there is nothing to apply when it is merely
  // rendered. A standalone <effect> is not used in the corpus. (task 41)
  return '';
}

/** Read the <effect> children of an <item>/<weapon>/<armour>/<tool> node into
 *  serialisable effect records stored on the possession (task 41). Mirrors JaFL's
 *  Effect.createEffect / UseEffect: type defaults to "aura"; a "use" effect with an
 *  ability but no explicit uses= is a one-shot potion (verb "Drink"); its action
 *  children are serialised into `body` for applyEffectBody at use-time. A <desc>
 *  child is display-only and dropped. */
export function readItemEffects(node) {
  const out = [];
  if (!node || !node.querySelectorAll) return out;
  node.querySelectorAll(':scope > effect').forEach((e) => {
    const type = (e.getAttribute('type') || 'aura').toLowerCase();
    const ability = e.getAttribute('ability');
    const bonus = parseInt(String(e.getAttribute('bonus') || '0').replace(/^\+/, ''), 10) || 0;
    // Serialise the action children (rest/goto/lose/…) as the use body; skip <desc>.
    const bodyParts = [];
    Array.from(e.children).forEach((c) => {
      if (c.tagName.toLowerCase() === 'desc') return;
      try { bodyParts.push(new XMLSerializer().serializeToString(c)); } catch { /* non-DOM env */ }
    });
    const body = bodyParts.join('') || null;
    let uses = e.hasAttribute('uses') ? (parseInt(e.getAttribute('uses'), 10) || 0) : -1;
    if (type === 'use' && ability && !e.hasAttribute('uses')) uses = 1; // ability potion: one shot
    // verb may sit on the effect or (book1/342 potion of restoration) on the item.
    let verb = e.getAttribute('verb') || node.getAttribute('verb');
    if (!verb) verb = (type === 'use' && ability) ? 'Drink' : 'Use';
    // §5.638's potion labels its effect with description= rather than text=; accept it as
    // a text= fallback so the sheet's Use button shows the effect ("+5 Stamina"). (task 136.3)
    out.push({ type, ability: ability || null, bonus, uses, verb, text: e.getAttribute('text') || e.getAttribute('description') || null, body });
  });
  return out;
}

/** Fire an item's `type="use"` effect (task 41). Applies its action body headlessly
 *  (rest/lose/…) via applyEffectBody, grants a temporary ability boost for a bare
 *  potion (+bonus, default +1), decrements uses, and reports an inner <goto> target
 *  so the caller can navigate (the Vade Mecum consult). `bodyNode` is the parsed
 *  <effect> body (pass null when there is none). Returns { removeItem, goto }. */
export function useItemEffect(state, item, effect, bodyNode = null) {
  let goto = null, image = null;
  if (bodyNode) {
    applyEffectBody(bodyNode, state); // rest/lose/tick/… (a <goto> inside is inert here)
    const g = bodyNode.querySelector(':scope > goto') || bodyNode.querySelector('goto');
    if (g) goto = { book: g.getAttribute('book') ? Number(g.getAttribute('book')) : null, section: g.getAttribute('section') };
    // A "use" effect may surface an illustration (the map of Bazalek's Read
    // action — book3/75): return it so the view can open the image. (task 62)
    const im = bodyNode.querySelector('image');
    if (im) image = { file: im.getAttribute('file') || im.getAttribute('src') || im.getAttribute('name') || '', title: im.getAttribute('title') || '' };
  } else if (effect.ability) {
    // A bare potion: +bonus (default +1) to the ability for this section (JaFL potion bonus).
    state.addPotionBonus(effect.ability, effect.bonus || 1);
  }
  let removeItem = false;
  if (effect.uses > 0) {
    effect.uses -= 1;
    if (effect.uses === 0) removeItem = true; // consumed (disposable)
    state.changed();
  }
  return { removeItem, goto, image };
}

/** Evaluate a <set value="..."> expression. A recursive-descent parser over the
 *  grammar the original Java Expression class accepts — identifiers, integers, the
 *  binary operators + - * / (integer division, truncating toward zero) and
 *  parentheses, with a leading unary minus. Identifiers resolve *keyword-first*
 *  (the SetVarNode.Resolver contract): the adventure-sheet quantities armour,
 *  weapon, defence, stamina, shards, rank, crew and the ability names, then any
 *  stored variable (undefined → 0). This is the value= side; the amount=/adjust
 *  side is variable-first — see resolveValue. */
// `mode` reflects a <set modifier="natural|affected">, which selects how ability
// and stamina identifiers resolve (JaFL SetVarNode.resolveIdentifier): natural =
// the WRITTEN score / unwounded max; affected = the item-boosted score / affected
// max. With no mode the historical behaviour holds — abilities read the boosted
// score and a bare `stamina` reads *current* Stamina.
export function evalExpression(expr, state, mode = null, sel = null) {
  const resolve = (word) => {
    const w = word.toLowerCase();
    // Selector-aware identifiers when the <set> node carries an item/cache selector
    // (SetVarNode.resolveIdentifier, task 77). These override the plain sheet reads below:
    // `matches` counts the selection, weapon/armour/tool read the selected item's bonus,
    // and `shards` reads the cache when one is named.
    if (sel) {
      if (w === 'matches') return setSelectorMatches(state, sel).length;
      if (w === 'weapon' || w === 'armour' || w === 'tool') return setSelectorBonus(state, sel, w);
      if (w === 'shards' && sel.cache != null) return state.cacheMoney(sel.cache);
    }
    // stamina: natural/affected → the unwounded max (incl. aura/affliction); no modifier → current.
    if (w === 'stamina') return mode ? state.effectiveStaminaMax() : state.data.stamina;
    if (w === 'shards') return state.data.shards;
    // rank: natural → the WRITTEN Rank; affected/none → rankValue() incl. the ring of
    // ultimate power's +2 aura. §2.270 sets `var rank = rank modifier="natural"` and then
    // compares against it, so a ring-holder must be judged by natural Rank. (task 136.4)
    if (w === 'rank') return mode === 'natural' ? state.data.rank : state.rankValue();
    if (w === 'defence') return state.defence();
    if (w === 'armour') return state.armourBonus();
    if (w === 'weapon') return state.wieldedWeapon()?.bonus || 0;
    if (w === 'crew') return CREW_LEVELS.indexOf(state.currentShip()?.crew) + 1 || 0;
    if (ABILITIES.includes(w)) {
      // abilityForValue honours the modifier but maps a cursed ability to 0, not the
      // -1000 check-sentinel (§6.332 value="12-charisma"). No modifier is unchanged. (task 136.4)
      if (mode === 'natural') return state.abilityForValue(w, true);  // written score
      if (mode === 'affected') return state.abilityForValue(w, false); // item-boosted
      return state.ability(w); // no modifier — unchanged
    }
    return state.getVar(word); // stored variable; 0 when undefined
  };
  const s = String(expr).replace(/\s+/g, '');
  let i = 0;
  // expr := term (('+'|'-') term)*
  const parseExpr = () => {
    let v = parseTerm();
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = parseTerm(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  // term := factor (('*'|'/') factor)*   — '/' is integer division (Java int math)
  const parseTerm = () => {
    let v = parseFactor();
    while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const r = parseFactor(); v = op === '*' ? v * r : (r === 0 ? 0 : Math.trunc(v / r)); }
    return v;
  };
  // factor := '-' factor | '+' factor | '(' expr ')' | number | identifier
  const parseFactor = () => {
    if (s[i] === '-') { i++; return -parseFactor(); }
    if (s[i] === '+') { i++; return parseFactor(); }
    if (s[i] === '(') { i++; const v = parseExpr(); if (s[i] === ')') i++; return v; }
    if (i < s.length && /[0-9]/.test(s[i])) { let j = i; while (j < s.length && /[0-9]/.test(s[j])) j++; const n = parseInt(s.slice(i, j), 10); i = j; return n; }
    if (i < s.length && /[A-Za-z_]/.test(s[i])) { let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++; const word = s.slice(i, j); i = j; return resolve(word); }
    i++; return 0; // skip an unexpected char
  };
  const result = parseExpr();
  return Number.isFinite(result) ? result : 0;
}

// ---- rest ------------------------------------------------------------------
/** Rest action: pay an optional shard cost, then heal Stamina. `perUse` is a plain
 *  number or a dice expression like "1d6"; a null/blank `perUse` (a <rest> with no
 *  stamina= attribute) restores Stamina to full — JaFL RestNode treats a missing
 *  stamina attribute as "heal all your Stamina" (safe houses/temples/healers, 62×
 *  in the corpus). Returns the amount actually healed. (task 31) */
export function applyRest(state, perUse, cost) {
  if (cost) state.adjustMoney(-cost);
  const before = state.data.stamina;
  if (perUse == null || String(perUse).trim() === '') {
    state.healStamina(state.effectiveStaminaMax()); // heal to the EFFECTIVE max (incl. aura headroom) ⇒ truly full (task 158)
  } else {
    state.healStamina(resolveValue(state, String(perUse)));
  }
  return state.data.stamina - before;
}

// ---- resurrection ----------------------------------------------------------
/** Purchase a resurrection deal: pay the (optional) cost and record the deal. */
export function buyResurrectionDeal(state, { book, section, text, god, cost = 0, supplemental = false }) {
  if (cost) state.adjustMoney(-cost);
  // JaFL stamps the god only when the buyer worships it at purchase time; a deal
  // bought as a non-worshipper is stored godless, so renouncing anything leaves it
  // intact (Adventurer.addResurrection). Renounce cancels god-tied deals — task 135.
  const dealGod = god && state.hasGod(god) ? god : null;
  state.addResurrection({ book, section, text, god: dealGod, supplemental: !!supplemental });
}

/** Cash in a resurrection deal on death: consume the chosen deal (default the earliest)
 *  and revive at FULL Stamina. JaFL's Resurrection.activate() "heals the player entirely"
 *  and §1.640 says "your Stamina is back to its normal score", so restore to the EFFECTIVE
 *  max (incl. any aura headroom — task 158), not half. `dealIndex` selects which held deal
 *  to spend when several coexist (a standard deal plus a supplemental boon — tasks 98, 159);
 *  JaFL lets the player choose. Returns the deal's { book, section }, or null if none. The
 *  revive rule lives here, not in the app layer (task 34). */
export function reviveWithResurrection(state, dealIndex = 0) {
  const list = state.data.resurrections;
  if (!list || !list.length) return null;
  const i = Number.isInteger(dealIndex) && dealIndex >= 0 && dealIndex < list.length ? dealIndex : 0;
  const [res] = list.splice(i, 1);
  state.data.stamina = state.effectiveStaminaMax();
  state.changed();
  return { book: res.book, section: res.section };
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
 *  value=/amount= wins; otherwise <adjust titleVal="T" [default="N"]/> adds the
 *  title's value or the default when it isn't held (§5.343/432 bokh circles),
 *  <adjust ability="X" [modifier=…]/> adds X's value under the resolution keyword
 *  (noweapon/notool/natural — §5.79 unarmed COMBAT; for stamina: natural = the
 *  written unwounded score (§2.579), current = the wounded value), and
 *  <adjust name="V"/> adds a stored counter. (tasks 25, 44, 92) */
function adjustAmount(el, state) {
  const v = el.getAttribute('value') ?? el.getAttribute('amount');
  if (v != null) return resolveValue(state, v);
  const tv = el.getAttribute('titleVal');
  if (tv != null) return state.hasTitle(tv) ? state.titleValue(tv) : resolveValue(state, el.getAttribute('default') ?? '0');
  const ab = el.getAttribute('ability');
  if (ab != null) {
    const key = ab.split('|')[0].trim().toLowerCase();
    const mode = String(el.getAttribute('modifier') || '').trim().toLowerCase() || null;
    if (key === 'rank') return state.rankValue(); // ring of ultimate power +2 (task 44)
    if (key === 'stamina') {
      if (mode === 'natural') return state.data.staminaMax; // the written score, no aura/affliction
      if (mode === 'current') return state.data.stamina;
      return state.effectiveStaminaMax(); // unwounded score, incl. aura/affliction
    }
    if (ABILITIES.includes(key)) return state.abilityForMode(key, mode); // mode null ⇒ the full score
  }
  const nm = el.getAttribute('name');
  if (nm != null) return state.codewordValue(nm);
  return 0;
}

/** Does a roll-modifier <adjust> apply in the current state? Modifiers gated on
 *  crew grade / ship type / god / profession / title / item / codeword count only
 *  when the player meets that condition; an unconditional modifier always counts.
 *  greaterthan=/lessthan= turn the ability=/name= VALUE into the condition (the
 *  contribution then comes from value=/amount= — §4.411 "if you are 4th Rank or
 *  higher", §5.527 rank > 5). Crew/ship match is exact (a "good crew" bonus does
 *  not fire for excellent) and reads the CURRENT vessel (task 89). (task 92) */
function adjustApplies(el, state) {
  const get = (a) => el.getAttribute(a);
  const gt = get('greaterthan'), lt = get('lessthan');
  if (gt != null || lt != null) {
    let v = 0;
    const ab = get('ability');
    if (ab != null) {
      const key = ab.split('|')[0].trim().toLowerCase();
      v = key === 'rank' ? state.rankValue()
        : key === 'stamina' ? state.data.stamina
        : state.abilityForCheck(key, normalize(get('modifier') || '') === 'natural');
    } else if (get('name') != null) v = state.codewordValue(get('name'));
    return (gt == null || v > resolveValue(state, gt)) && (lt == null || v < resolveValue(state, lt));
  }
  if (get('god') != null) return state.hasGod(get('god'));
  if (get('profession') != null) return normalize(state.data.profession) === normalize(get('profession'));
  if (get('title') != null) return state.hasTitle(get('title')); // §4.63 Nightstalker
  if (get('item') != null) {
    const it = get('item');
    // item="?" [tags=…] = any possession carrying the tags (§6.736 a light source);
    // a name list keeps the exact-name match.
    if (it === '?' || it === '') return state.hasItemMatch(it, get('tags'));
    return it.split(/[|,]/).some((n) => state.hasItem(n.trim()));
  }
  if (get('codeword') != null) return get('codeword').split(/[|,]/).some((c) => state.hasCodeword(c.trim()));
  if (get('crew') != null) { const s = state.currentShip(); return !!s && s.crew === get('crew'); }
  if (get('ship') != null) return matchShipType(state, get('ship'));
  return true;
}

// difficulty: success iff (2d6 + ability + adjust) > level. `mode` is the
// <difficulty modifier=> keyword (natural/noweapon/affected) selecting how the
// ability score resolves — noweapon drops the wielded weapon's bonus. (task 53)
export function rollDifficulty(state, ability, level, modifier = 0, mode = null) {
  const ab = firstAbility(ability);
  // The Three Fortunes' difficultyCurse (book3/91) restricts ability rolls to a
  // single die until lifted at their temple (book2/102 difficultyRestore). (task 36)
  const r = rollDice(state.data.oneDieRolls ? 1 : 2);
  const abilityScore = ab ? state.abilityForMode(ab, mode) : 0;
  const total = r.total + abilityScore + modifier;
  return { dice: r.dice, rollTotal: r.total, abilityScore, ability: ab, total, level, margin: total - level, success: total > level };
}

// rank check: success iff (dice + add + adjust) <= current Rank. `margin` (>0 on
// success) is what the books store in a <success var> for later branch logic.
export function rollRankCheck(state, dice = 1, add = 0, adjust = 0) {
  const r = rollDice(dice);
  const total = r.total + add + adjust;
  const rank = state.rankValue(); // includes the ring of ultimate power's +2 Rank (task 44)
  const success = total <= rank;
  return { kind: 'rankcheck', dice: r.dice, total, success, margin: 1 + rank - total };
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
