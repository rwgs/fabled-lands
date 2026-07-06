// state.js — the Adventure Sheet: the full mutable character/game state,
// derived stats, and localStorage persistence with multiple save slots.

import { ABILITIES, MAX_ITEMS, clampAbility, rankTitle } from './rules.js';

const SAVE_PREFIX = 'fl_save_';
const META_KEY = 'fl_meta';
const SCHEMA = 3;

// A cursed ability auto-fails any check that uses it (JaFL returns -1000 for
// PURPOSE_TESTING); a fixed ability is pinned at 1. Applied only in check
// contexts (abilityForCheck), never to the displayed/derived score.
const CURSED_ABILITY = -1000;

// Some books spell the sea-safety blessing "storms" (book 1) and others "storm"
// (books 2–6); they are the same blessing. Canonicalise so a grant in one book
// satisfies an <if blessing="…"> check in another and the "only one at a time"
// rule holds across the whole campaign. Match is case-insensitive.
const BLESSING_ALIASES = { storms: 'storm' };
function canonBlessing(b) {
  const k = String(b).trim().toLowerCase();
  return BLESSING_ALIASES[k] || k;
}

function freshData() {
  return {
    schema: SCHEMA,
    name: 'Adventurer',
    gender: 'm',
    profession: 'Warrior',
    abilities: { charisma: 0, combat: 0, magic: 0, sanctity: 0, scouting: 0, thievery: 0 },
    stamina: 20,
    staminaMax: 20,
    rank: 1,
    shards: 0,
    items: [],            // {id, kind, name, bonus, ability, wielded, worn, tags:[]}
    gods: [],
    godless: false,
    titles: [],           // {name, value}
    blessings: [],        // string ability names or labels
    curses: [],           // {type, ...}
    codewords: {},        // name -> true
    codewordValues: {},   // name -> number
    boxes: {},            // "book.section" -> tick count
    flags: {},            // name -> bool
    vars: {},             // name -> number
    ships: [],            // {type, name, crew, cargo:[], docked}
    resurrections: [],    // {book, section, text, god}
    effects: [],          // {ability, bonus, type, uses, text}
    abilityFlags: {},     // ability -> {fixed?:true, cursed?:true} (effect="+fixed|+cursed")
    caches: {},           // name -> {items:[], money:0}
    book: 1,
    section: null,
    startBook: 1,
    history: [],          // [{book, section}] navigation trail
    turns: 0,
    created: Date.now(),
    updated: Date.now(),
  };
}

let _idc = 1;
function nid() { return 'i' + (_idc++) + '_' + Math.floor(Math.random() * 1e6); }

export class GameState {
  constructor(data, slot) {
    this.data = data;
    this.slot = slot ?? 0;
    // Ephemeral games (the ?demo= preview link) never touch persistent storage
    // until the player explicitly keeps them — see save()/keep(). This stops a
    // throwaway preview from occupying a slot (and, when slots are full, from
    // clobbering slot 0 via the old nextFreeSlot()===0 fallback).
    this.ephemeral = false;
    this._listeners = new Set();
    this._undo = []; // in-memory stack of pre-section-effects state snapshots
  }

  // ---- undo (session-only) --------------------------------------------
  /** Capture the state as it is on entering a section, before its effects run. */
  snapshot() {
    try { this._undo.push(JSON.stringify(this.data)); } catch { /* ignore */ }
    if (this._undo.length > 30) this._undo.shift();
  }
  canUndo() { return this._undo.length >= 2; }
  /** Restore the previous section's entry state; returns its {book, section}. */
  undo() {
    if (this._undo.length < 2) return null;
    this._undo.pop();                              // discard current section
    this.data = JSON.parse(this._undo[this._undo.length - 1]); // previous section's entry state
    this.changed();
    return { book: this.data.book, section: this.data.section };
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  changed() {
    this.data.updated = Date.now();
    this.save();
    for (const fn of this._listeners) fn(this);
  }

  // ---- creation --------------------------------------------------------
  static create({ name, gender, profession, book, adv }) {
    const d = freshData();
    d.name = name || 'Adventurer';
    d.gender = gender === 'f' ? 'f' : 'm';
    d.profession = profession;
    d.book = book;
    d.startBook = book;
    const scores = adv.professions[profession] || {};
    for (const ab of ABILITIES) d.abilities[ab] = scores[ab] ?? 4;
    d.stamina = adv.stamina;
    d.staminaMax = adv.stamina;
    d.rank = adv.rank;
    d.shards = adv.gold;
    // starting items
    for (const it of adv.items) {
      if (it.profession && it.profession !== profession) continue;
      d.items.push(makeItem(it.kind, it.name, it.bonus, it.ability));
    }
    const gs = new GameState(d);
    gs.reconcileEquipment();
    return gs;
  }

  // ---- derived stats ---------------------------------------------------
  /** Best bonus among owned items that boost a given ability (tools; weapon for combat). */
  itemBonus(ability) {
    let best = 0;
    for (const it of this.data.items) {
      if (it.kind === 'tool' && it.ability === ability) best = Math.max(best, it.bonus || 0);
      if (it.kind === 'weapon' && ability === 'combat') best = Math.max(best, it.bonus || 0);
    }
    return best;
  }

  armourBonus() {
    let best = 0;
    for (const it of this.data.items) if (it.kind === 'armour') best = Math.max(best, it.bonus || 0);
    return best;
  }

  effectBonus(ability) {
    let sum = 0;
    for (const e of this.data.effects) if (e.ability === ability && e.type !== 'target') sum += (e.bonus || 0);
    return sum;
  }

  /** Affected ability score, including item/effect bonuses, clamped 1..12.
   *  The fixed/cursed flags are deliberately NOT applied here — like JaFL, the
   *  displayed/derived score is the real one; the flags bite only in checks. */
  ability(ability) {
    const base = this.data.abilities[ability] || 0;
    return clampAbility(base + this.itemBonus(ability) + this.effectBonus(ability));
  }

  /** Ability score as seen by a check (difficulty/rank/if): a cursed ability
   *  auto-fails, a fixed one counts as 1. A mask hides a blanked/disfigured face,
   *  restoring CHARISMA while worn (JaFL's mask exception). */
  abilityForCheck(ability) {
    const fx = this.data.abilityFlags && this.data.abilityFlags[ability];
    if (fx && (fx.cursed || fx.fixed) && !(ability === 'charisma' && this.hasMask())) {
      return fx.cursed ? CURSED_ABILITY : 1;
    }
    return this.ability(ability);
  }

  abilityNatural(ability) { return this.data.abilities[ability] || 0; }

  hasMask() { return this.data.items.some((it) => normalize(it.name).includes('mask')); }
  hasAbilityFlag(ability, flag) { return !!(this.data.abilityFlags && this.data.abilityFlags[ability] && this.data.abilityFlags[ability][flag]); }
  setAbilityFlag(ability, flag, on) {
    const all = (this.data.abilityFlags ||= {});
    const fx = (all[ability] ||= {});
    if (on) fx[flag] = true; else delete fx[flag];
    if (!Object.keys(fx).length) delete all[ability];
    this.changed();
  }

  defence() {
    // COMBAT (incl. weapon bonus) + Rank + best armour bonus
    return this.ability('combat') + this.data.rank + this.armourBonus();
  }

  wieldedWeapon() {
    let best = null;
    for (const it of this.data.items) if (it.kind === 'weapon') if (!best || (it.bonus || 0) > (best.bonus || 0)) best = it;
    return best;
  }
  wornArmour() {
    let best = null;
    for (const it of this.data.items) if (it.kind === 'armour') if (!best || (it.bonus || 0) > (best.bonus || 0)) best = it;
    return best;
  }

  /** Mark the best weapon/armour as wielded/worn for display. */
  reconcileEquipment() {
    const w = this.wieldedWeapon();
    const a = this.wornArmour();
    for (const it of this.data.items) {
      it.wielded = (it.kind === 'weapon' && it === w);
      it.worn = (it.kind === 'armour' && it === a);
    }
  }

  // ---- items -----------------------------------------------------------
  itemCount() { return this.data.items.length; }
  freeSlots() { return MAX_ITEMS - this.itemCount(); }

  addItem(item) {
    if (!item.id) item.id = nid();
    this.data.items.push(item);
    this.reconcileEquipment();
    this.changed();
    return item;
  }

  removeItemById(id) {
    const i = this.data.items.findIndex((x) => x.id === id);
    if (i >= 0) {
      const [it] = this.data.items.splice(i, 1);
      this.reconcileEquipment();
      this.changed();
      return it;
    }
    return null;
  }

  // Reorder a possession by swapping it with its neighbour (delta -1 up / +1 down).
  // The list order is meaningful — thefts that take "the possessions listed first"
  // (§521/§248) remove from the top — so letting the player reorder mirrors being
  // able to choose the order items are written down on a paper Adventure Sheet.
  moveItem(id, delta) {
    const i = this.data.items.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.data.items.length) return false;
    const [it] = this.data.items.splice(i, 1);
    this.data.items.splice(j, 0, it);
    this.changed();
    return true;
  }

  findItems(pattern) {
    if (!pattern) return [];
    const pats = pattern.split('|').map((p) => normalize(p));
    return this.data.items.filter((it) => {
      const n = normalize(it.name);
      return pats.some((p) => n === p || (it.tags || []).map(normalize).includes(p));
    });
  }

  hasItem(pattern) { return this.findItems(pattern).length > 0; }

  // ---- money -----------------------------------------------------------
  adjustMoney(delta) {
    this.data.shards = Math.max(0, this.data.shards + delta);
    this.changed();
  }

  // ---- abilities & stamina ---------------------------------------------
  // fatal="t": if the loss would take the ability below 1, the adventurer dies
  // (JaFL clamps the ability at 1 and drops Stamina to 0).
  adjustAbility(ability, delta, fatal = false) {
    const cur = this.data.abilities[ability] || 0;
    if (fatal && cur + delta < 1) this.data.stamina = 0;
    this.data.abilities[ability] = clampAbility(cur + delta);
    this.changed();
    return this.data.abilities[ability];
  }

  // Permanent Stamina change (an <gain/lose ability="stamina">): moves the
  // maximum AND the current score together, mirroring JaFL's adjustAbility for
  // ABILITY_STAMINA. fatal="t" ⇒ death if current drops to 0 or below; otherwise
  // current floors at 1.
  adjustAbilityStamina(delta, fatal = false) {
    let d = delta;
    let newMax = this.data.staminaMax + d;
    if (newMax < 1) { d = 1 - this.data.staminaMax; newMax = 1; }
    this.data.staminaMax = newMax;
    this.data.stamina += d;
    if (this.data.stamina <= 0) this.data.stamina = fatal ? 0 : 1;
    else if (this.data.stamina > this.data.staminaMax) this.data.stamina = this.data.staminaMax;
    this.changed();
  }

  damageStamina(amount) {
    this.data.stamina = Math.max(0, this.data.stamina - amount);
    this.changed();
    return this.data.stamina;
  }
  healStamina(amount) {
    this.data.stamina = Math.min(this.data.staminaMax, this.data.stamina + amount);
    this.changed();
  }
  adjustStaminaMax(delta) {
    this.data.staminaMax = Math.max(1, this.data.staminaMax + delta);
    this.data.stamina = Math.min(this.data.stamina + Math.max(0, delta), this.data.staminaMax);
    this.changed();
  }
  isDead() { return this.data.stamina <= 0; }

  adjustRank(delta, fatal = false) {
    if (fatal && this.data.rank + delta <= 0) this.data.stamina = 0; // reduced to 0 Rank ⇒ death
    this.data.rank = Math.max(1, this.data.rank + delta);
    this.changed();
  }

  // ---- codewords -------------------------------------------------------
  hasCodeword(cw) { return !!this.data.codewords[cw]; }
  addCodeword(cw) { this.data.codewords[cw] = true; this.changed(); }
  removeCodeword(cw) { delete this.data.codewords[cw]; this.changed(); }
  codewordValue(name) { return this.data.codewordValues[name] || 0; }
  adjustCodewordValue(name, delta) {
    this.data.codewordValues[name] = (this.data.codewordValues[name] || 0) + delta;
    this.changed();
  }
  setCodewordValue(name, v) { this.data.codewordValues[name] = v; this.changed(); }

  // ---- boxes / visit ticks --------------------------------------------
  boxKey(book, section) { return `${book ?? this.data.book}.${section ?? this.data.section}`; }
  tickCount(book, section) { return this.data.boxes[this.boxKey(book, section)] || 0; }
  addTick(book, section, n = 1) {
    const k = this.boxKey(book, section);
    this.data.boxes[k] = (this.data.boxes[k] || 0) + n;
    this.changed();
  }

  // ---- flags / vars ----------------------------------------------------
  getFlag(name) { return !!this.data.flags[name]; }
  setFlag(name, v) { this.data.flags[name] = !!v; this.changed(); }
  getVar(name) { return this.data.vars[name] || 0; }
  setVar(name, v) { this.data.vars[name] = v; this.changed(); }
  hasVar(name) { return Object.prototype.hasOwnProperty.call(this.data.vars, name); }

  // ---- blessings / curses ---------------------------------------------
  // Compared/stored canonically so "storm"/"storms" (and any casing) are one
  // blessing — this also repairs legacy saves that stored the alias spelling.
  hasBlessing(b) { const c = canonBlessing(b); return this.data.blessings.some((x) => canonBlessing(x) === c); }
  addBlessing(b) { if (!this.hasBlessing(b)) { this.data.blessings.push(canonBlessing(b)); this.changed(); } }
  removeBlessing(b) {
    const c = canonBlessing(b);
    const i = this.data.blessings.findIndex((x) => canonBlessing(x) === c);
    if (i >= 0) { this.data.blessings.splice(i, 1); this.changed(); return true; }
    return false;
  }
  hasCurse(type) { return this.data.curses.some((c) => c.type === type); }
  addCurse(c) { this.data.curses.push(typeof c === 'string' ? { type: c } : c); this.changed(); }
  removeCurse(type) {
    const i = this.data.curses.findIndex((c) => c.type === type || type === '*');
    if (i >= 0) { this.data.curses.splice(i, 1); this.changed(); return true; }
    return false;
  }

  // ---- gods / titles ---------------------------------------------------
  hasGod(g) { return this.data.gods.includes(g); }
  setGod(g) { if (!this.hasGod(g)) { this.data.gods.push(g); this.changed(); } }
  removeGod(g) { const i = this.data.gods.indexOf(g); if (i >= 0) { this.data.gods.splice(i, 1); this.changed(); } }

  hasTitle(name) { return this.data.titles.some((t) => t.name === name); }
  titleValue(name) { const t = this.data.titles.find((t) => t.name === name); return t ? t.value : 0; }
  addTitle(name, value = 0) {
    const t = this.data.titles.find((t) => t.name === name);
    if (t) t.value += value; else this.data.titles.push({ name, value });
    this.changed();
  }
  removeTitle(name) { const i = this.data.titles.findIndex((t) => t.name === name); if (i >= 0) { this.data.titles.splice(i, 1); this.changed(); } }

  // ---- resurrections ---------------------------------------------------
  hasResurrection() { return this.data.resurrections.length > 0; }
  addResurrection(r) { this.data.resurrections.push(r); this.changed(); }

  // ---- ships -----------------------------------------------------------
  addShip(ship) { this.data.ships.push(ship); this.changed(); }
  get ships() { return this.data.ships; }

  // ---- navigation ------------------------------------------------------
  goTo(book, section) {
    if (this.data.section != null) {
      this.data.history.push({ book: this.data.book, section: this.data.section });
      if (this.data.history.length > 200) this.data.history.shift();
    }
    this.data.book = Number(book);
    this.data.section = String(section);
    this.data.turns++;
    this.changed();
  }

  // ---- persistence -----------------------------------------------------
  save() {
    if (this.ephemeral) return; // preview game: not persisted until kept
    try {
      localStorage.setItem(SAVE_PREFIX + this.slot, JSON.stringify(this.data));
      const meta = loadSlotMeta();
      meta[this.slot] = {
        name: this.data.name,
        profession: this.data.profession,
        rank: this.data.rank,
        book: this.data.book,
        section: this.data.section,
        updated: this.data.updated,
      };
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (e) {
      console.error('save failed', e);
    }
  }

  static load(slot) {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return new GameState(migrate(data), slot);
    } catch (e) {
      console.error('load failed', e);
      return null;
    }
  }

  /** Promote an ephemeral (preview) game to a real, persisted save slot.
   *  Returns the slot number, or throws if all slots are full. */
  keep() {
    const slot = nextFreeSlot();
    if (slot == null) throw new Error('All save slots are full. Delete or export a save first.');
    this.slot = slot;
    this.ephemeral = false;
    this.save();
    return slot;
  }
}

function migrate(data) {
  const base = freshData();
  const merged = { ...base, ...data };
  merged.abilities = { ...base.abilities, ...(data.abilities || {}) };
  return merged;
}

export function makeItem(kind, name, bonus = 0, ability = null, tags = []) {
  return { id: nid(), kind: kind || 'item', name, bonus: bonus || 0, ability: ability || null, tags: tags || [], wielded: false, worn: false };
}

export function normalize(s) {
  return (s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

export function loadSlotMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
}

export function deleteSlot(slot) {
  localStorage.removeItem(SAVE_PREFIX + slot);
  const meta = loadSlotMeta();
  delete meta[slot];
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/** Raw saved data for a slot (for export). */
export function readSlotData(slot) {
  const raw = localStorage.getItem(SAVE_PREFIX + slot);
  return raw ? JSON.parse(raw) : null;
}

/** Import a save-data object into a new free slot. Returns {slot, meta}. Throws if invalid. */
export function importSave(data) {
  if (!data || typeof data !== 'object' || !data.abilities || data.stamina == null) {
    throw new Error('That file is not a valid Fabled Lands save.');
  }
  const slot = nextFreeSlot();
  if (slot == null) throw new Error('All 20 save slots are full. Delete or export a save before importing.');
  const gs = new GameState(migrate(data), slot);
  gs.save();
  return { slot, meta: loadSlotMeta()[slot] };
}

/** First unoccupied save slot (0..19), or null if all 20 are full. Callers must
 *  handle null — previously this returned 0, silently overwriting the first save. */
export function nextFreeSlot() {
  const meta = loadSlotMeta();
  for (let i = 0; i < 20; i++) if (!meta[i]) return i;
  return null;
}
