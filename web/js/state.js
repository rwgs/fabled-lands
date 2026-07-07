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
    diseases: [],         // {name, type:'disease', effects:[]}  (task 19 populates)
    poisons: [],          // {name, type:'poison', effects:[]}   (task 19 populates)
    caches: {},           // name -> {items:[], money:0}         (task 20 populates)
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
    // Null while persistence is healthy; a player-facing message string when the
    // last save() failed (storage full, or blocked in private-browsing mode). The
    // UI watches this to warn that progress is no longer being saved (task 7).
    this.lastSaveError = null;
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
      d.items.push(makeItem(it.kind, it.name, it.bonus, it.ability, it.tags || []));
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

  /** Total ability penalty/bonus from active afflictions (curses/diseases/poisons).
   *  Removed automatically when the affliction is cured, restoring the score. */
  afflictionBonus(ability) {
    let sum = 0;
    for (const list of [this.data.curses, this.data.diseases, this.data.poisons]) {
      for (const a of (list || [])) for (const e of (a.effects || [])) if (e.ability === ability) sum += (e.bonus || 0);
    }
    return sum;
  }

  /** Affected ability score, including item/effect/affliction bonuses, clamped
   *  1..12. The fixed/cursed flags are deliberately NOT applied here — like JaFL,
   *  the displayed/derived score is the real one; the flags bite only in checks. */
  ability(ability) {
    const base = this.data.abilities[ability] || 0;
    return clampAbility(base + this.itemBonus(ability) + this.effectBonus(ability) + this.afflictionBonus(ability));
  }

  /** Ability score as seen by a check (difficulty/rank/if): a cursed ability
   *  auto-fails, a fixed one counts as 1. A mask hides a blanked/disfigured face,
   *  restoring CHARISMA while worn (JaFL's mask exception). */
  abilityForCheck(ability, natural = false) {
    const fx = this.data.abilityFlags && this.data.abilityFlags[ability];
    if (fx && (fx.cursed || fx.fixed) && !(ability === 'charisma' && this.hasMask())) {
      return fx.cursed ? CURSED_ABILITY : 1;
    }
    // modifier="natural" compares the written score, ignoring item/effect bonuses.
    return natural ? this.abilityNatural(ability) : this.ability(ability);
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

  findItems(pattern) { return matchItems(this.data.items, pattern); }

  hasItem(pattern) { return this.findItems(pattern).length > 0; }

  // ---- caches: named stashes / banks (money + items, lockable) --------
  // A cache is a stash the books address by name: an investment box, a bank
  // account (e.g. "MerchantBank"), a gambling pot, or a villa strongroom where
  // you leave possessions. Keyed by name → {money, items, locked}. Money and
  // items persist across sections/visits until withdrawn or looted.
  _cache(name) {
    const c = (this.data.caches[name] ||= { money: 0, items: [], locked: false });
    if (c.money == null) c.money = 0;
    if (!Array.isArray(c.items)) c.items = [];
    return c;
  }
  cacheMoney(name) { const c = this.data.caches[name]; return (c && c.money) || 0; }
  cacheItems(name) { const c = this.data.caches[name]; return (c && Array.isArray(c.items)) ? c.items : []; }
  isCacheLocked(name) { const c = this.data.caches[name]; return !!(c && c.locked); }
  lockCache(name, on = true) { this._cache(name).locked = !!on; this.changed(); }

  setCacheMoney(name, v) { this._cache(name).money = Math.max(0, Math.floor(v)); this.changed(); }
  adjustCacheMoney(name, delta) { const c = this._cache(name); c.money = Math.max(0, c.money + Math.floor(delta)); this.changed(); }
  // <adjustmoney multiply="N"> on a cache — losses/profits round in the house's
  // favour (floor), matching JaFL's integer-Shard economy.
  multiplyCacheMoney(name, factor) { const c = this._cache(name); c.money = Math.max(0, Math.floor(c.money * factor)); this.changed(); }

  /** Move Shards from the purse into a cache (a deposit). Returns the amount moved. */
  depositCacheMoney(name, amount) {
    const amt = Math.min(Math.max(0, Math.floor(amount)), this.data.shards);
    if (amt <= 0) return 0;
    this.data.shards -= amt;
    this._cache(name).money += amt;
    this.changed();
    return amt;
  }
  /** Move Shards from a cache back to the purse. `charge` (0..1) is a withdrawal
   *  fee kept by the house, rounded up (in the house's favour). Returns the gross
   *  amount withdrawn (the purse gains gross − fee). */
  withdrawCacheMoney(name, amount, charge = 0) {
    const c = this._cache(name);
    const amt = Math.min(Math.max(0, Math.floor(amount)), c.money);
    if (amt <= 0) return 0;
    c.money -= amt;
    const fee = Math.ceil(amt * (charge || 0));
    this.data.shards += Math.max(0, amt - fee);
    this.changed();
    return amt;
  }

  cacheAddItem(name, item) { if (!item.id) item.id = nid(); this._cache(name).items.push(item); this.changed(); return item; }
  cacheRemoveItem(name, id) {
    const c = this._cache(name);
    const i = c.items.findIndex((x) => x.id === id);
    if (i >= 0) { const [it] = c.items.splice(i, 1); this.changed(); return it; }
    return null;
  }

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
  // The current section's boxes= count, set by the renderer on entry (transient,
  // not persisted). Caps addTick so a repeat visit can't over-tick — see below.
  setSectionBoxes(n) { this._sectionBoxes = n > 0 ? n : 0; }
  addTick(book, section, n = 1) {
    const k = this.boxKey(book, section);
    let next = (this.data.boxes[k] || 0) + n;
    // Cap the CURRENT section's box ticks at its boxes= count. Mirrors JaFL, whose
    // SectionNode.addTicks only fills unselected boxes. Without this, book1/16
    // (boxes="1") over-ticks: on a repeat visit the matched <if ticks="1"> guard
    // shows its goto, but the sibling bare <tick/> still fires and pushes the count
    // to 2, so the guard never matches again and the one-time dragon-hoard loot is
    // re-offered from visit 3 on. A boxless section (cap 0) or a tick aimed at
    // another section is left uncapped.
    if (k === this.boxKey() && this._sectionBoxes > 0) next = Math.min(next, this._sectionBoxes);
    this.data.boxes[k] = next;
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
  // ---- afflictions: curses / diseases / poisons ------------------------
  // Each is {name, type, effects:[{ability,bonus}], cumulative, lift}, matched by
  // name. Their ability effects feed afflictionBonus() until the affliction is
  // cured; a non-cumulative re-infection has "no further effects".
  _afflictionList(type) { return type === 'disease' ? this.data.diseases : (type === 'poison' ? this.data.poisons : this.data.curses); }
  addAffliction(type, obj = {}) {
    const list = this._afflictionList(type);
    const rec = { name: obj.name || type, type, effects: obj.effects || [], cumulative: !!obj.cumulative, lift: obj.lift || null };
    if (!rec.cumulative && list.some((a) => normalize(a.name || a.type || '') === normalize(rec.name))) return; // already afflicted
    list.push(rec);
    this.changed();
  }
  removeAffliction(type, name) {
    const list = this._afflictionList(type);
    if (name === '*') { const had = list.length; if (had) { list.length = 0; this.changed(); } return had > 0; }
    if (name === '?') { if (list.length) { list.shift(); this.changed(); return true; } return false; }
    const i = list.findIndex((a) => normalize(a.name || a.type || '') === normalize(name));
    if (i >= 0) { list.splice(i, 1); this.changed(); return true; }
    return false;
  }

  hasCurse(name) { return matchAffliction(this.data.curses, name); }
  addCurse(c) { this.addAffliction('curse', typeof c === 'string' ? { name: c } : { name: c.name || c.type, effects: c.effects, cumulative: c.cumulative, lift: c.lift }); }
  removeCurse(name) { return this.removeAffliction('curse', name); }

  hasDisease(name) { return matchAffliction(this.data.diseases, name); }
  hasPoison(name) { return matchAffliction(this.data.poisons, name); }
  removeDisease(name) { return this.removeAffliction('disease', name); }
  removePoison(name) { return this.removeAffliction('poison', name); }

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
  /** Persist to localStorage. Returns true on success, false on failure (and
   *  sets lastSaveError to a player-facing message so the UI can warn). An
   *  ephemeral preview game reports success without writing. */
  save() {
    if (this.ephemeral) { this.lastSaveError = null; return true; } // preview game: not persisted until kept
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
      this.lastSaveError = null;
      return true;
    } catch (e) {
      this.lastSaveError = describeSaveError(e);
      console.error('save failed', e);
      return false;
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

// ---- import / load hardening --------------------------------------------
// A loaded or imported save (localStorage or a hand-edited JSON file) is
// untrusted: wrong array/object shapes must never reach rendering or the sheet.
// Each field is coerced to a well-typed value (bad entries dropped) rather than
// merged verbatim. Unknown top-level keys are discarded — the schema is fully
// known (freshData()), so anything else is stale or hostile.
function asNum(v, def, { min = -Infinity, max = Infinity, int = false } = {}) {
  let n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? parseFloat(v) : NaN);
  if (!Number.isFinite(n)) n = def;
  if (int) n = Math.round(n);
  return Math.min(max, Math.max(min, n));
}
function asStr(v, def = '') { return typeof v === 'string' ? v : (v == null ? def : String(v)); }
function asBool(v) { return v === true; }
function asArr(v) { return Array.isArray(v) ? v : []; }
function asObj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }

function sanitizeItem(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  const name = asStr(it.name).trim();
  if (!name) return null; // a nameless possession is meaningless — drop it
  const kind = ['weapon', 'armour', 'tool', 'item'].includes(it.kind) ? it.kind : 'item';
  return {
    id: asStr(it.id) || nid(),
    kind,
    name,
    bonus: asNum(it.bonus, 0, { int: true }),
    ability: typeof it.ability === 'string' ? it.ability : null,
    tags: asArr(it.tags).filter((t) => typeof t === 'string'),
    wielded: asBool(it.wielded),
    worn: asBool(it.worn),
  };
}

function sanitizeAffliction(a, type) {
  const o = asObj(a);
  const name = asStr(o.name).trim();
  if (!name) return null;
  const effects = asArr(o.effects)
    .map((e) => ({ ability: asStr(asObj(e).ability), bonus: asNum(asObj(e).bonus, 0, { int: true }) }))
    .filter((e) => e.ability);
  return { name, type, effects, cumulative: asBool(o.cumulative), lift: o.lift == null ? null : asStr(o.lift) };
}

function sanitizeShip(s) {
  const o = asObj(s);
  const type = asStr(o.type).trim();
  if (!type) return null;
  return {
    type,
    name: asStr(o.name, 'Ship') || 'Ship',
    crew: asStr(o.crew, 'average') || 'average',
    cargo: asArr(o.cargo).filter((c) => typeof c === 'string'),
    docked: o.docked == null ? null : asStr(o.docked),
  };
}

export function sanitizeData(raw) {
  const base = freshData();
  const d = asObj(raw);
  const out = { ...base };
  out.schema = SCHEMA;
  out.name = (asStr(d.name, base.name).slice(0, 80).trim()) || base.name;
  out.gender = d.gender === 'f' ? 'f' : 'm';
  out.profession = asStr(d.profession, base.profession) || base.profession;

  out.abilities = {};
  for (const ab of ABILITIES) out.abilities[ab] = clampAbility(asNum(d.abilities && d.abilities[ab], 4, { int: true }));

  out.staminaMax = asNum(d.staminaMax, base.staminaMax, { min: 1, int: true });
  out.stamina = asNum(d.stamina, out.staminaMax, { min: 0, max: out.staminaMax, int: true });
  out.rank = asNum(d.rank, base.rank, { min: 1, int: true });
  out.shards = asNum(d.shards, 0, { min: 0, int: true });

  out.items = asArr(d.items).map(sanitizeItem).filter(Boolean);
  out.gods = asArr(d.gods).filter((g) => typeof g === 'string');
  out.godless = asBool(d.godless);
  out.titles = asArr(d.titles).map((t) => {
    const o = asObj(t); const name = asStr(o.name).trim();
    return name ? { name, value: asNum(o.value, 0, { int: true }) } : null;
  }).filter(Boolean);
  out.blessings = asArr(d.blessings).filter((b) => typeof b === 'string');
  out.curses = asArr(d.curses).map((a) => sanitizeAffliction(a, 'curse')).filter(Boolean);
  out.diseases = asArr(d.diseases).map((a) => sanitizeAffliction(a, 'disease')).filter(Boolean);
  out.poisons = asArr(d.poisons).map((a) => sanitizeAffliction(a, 'poison')).filter(Boolean);

  out.codewords = {};
  for (const [k, v] of Object.entries(asObj(d.codewords))) if (v) out.codewords[k] = true;
  out.codewordValues = {};
  for (const [k, v] of Object.entries(asObj(d.codewordValues))) { const n = asNum(v, NaN, { int: true }); if (Number.isFinite(n)) out.codewordValues[k] = n; }
  out.boxes = {};
  for (const [k, v] of Object.entries(asObj(d.boxes))) { const n = asNum(v, 0, { min: 0, int: true }); if (n > 0) out.boxes[k] = n; }
  out.flags = {};
  for (const [k, v] of Object.entries(asObj(d.flags))) out.flags[k] = !!v;
  out.vars = {};
  for (const [k, v] of Object.entries(asObj(d.vars))) { const n = asNum(v, NaN); if (Number.isFinite(n)) out.vars[k] = n; }

  out.ships = asArr(d.ships).map(sanitizeShip).filter(Boolean);
  out.resurrections = asArr(d.resurrections).map((r) => {
    const o = asObj(r);
    return { book: asNum(o.book, out.book, { min: 1, int: true }), section: o.section == null ? null : asStr(o.section), text: asStr(o.text), god: o.god == null ? null : asStr(o.god) };
  });
  out.effects = asArr(d.effects).map((e) => {
    const o = asObj(e);
    if (!o.ability && !o.type) return null;
    return { ability: typeof o.ability === 'string' ? o.ability : null, bonus: asNum(o.bonus, 0, { int: true }), type: typeof o.type === 'string' ? o.type : null, uses: o.uses == null ? null : asNum(o.uses, 0, { min: 0, int: true }), text: asStr(o.text) };
  }).filter(Boolean);
  out.abilityFlags = {};
  for (const [k, v] of Object.entries(asObj(d.abilityFlags))) { const o = asObj(v); const f = {}; if (o.fixed) f.fixed = true; if (o.cursed) f.cursed = true; if (Object.keys(f).length) out.abilityFlags[k] = f; }

  out.caches = {};
  for (const [k, v] of Object.entries(asObj(d.caches))) {
    const o = asObj(v);
    out.caches[k] = { money: asNum(o.money, 0, { min: 0, int: true }), items: asArr(o.items).map(sanitizeItem).filter(Boolean), locked: asBool(o.locked) };
  }

  out.book = asNum(d.book, base.book, { min: 1, int: true });
  out.section = d.section == null ? null : asStr(d.section);
  out.startBook = asNum(d.startBook, out.book, { min: 1, int: true });
  out.history = asArr(d.history).map((h) => { const o = asObj(h); return { book: asNum(o.book, 1, { min: 1, int: true }), section: asStr(o.section) }; }).filter((h) => h.section);
  out.turns = asNum(d.turns, 0, { min: 0, int: true });
  out.created = asNum(d.created, base.created, { min: 0 });
  out.updated = asNum(d.updated, base.updated, { min: 0 });
  return out;
}

function migrate(data) {
  return sanitizeData(data);
}

// Turn a thrown localStorage error into a player-facing explanation. A full
// store throws QuotaExceededError (code 22, or Firefox's 1014); other failures
// are almost always private-browsing / disabled storage.
function describeSaveError(e) {
  const quota = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  if (quota) {
    return 'Storage is full — your progress can’t be saved. Export this adventure to a file, then delete an old save to free space.';
  }
  return 'Your browser is blocking storage, so your progress can’t be saved (this often happens in private-browsing mode). Export this adventure to a file to keep it safe.';
}

export function makeItem(kind, name, bonus = 0, ability = null, tags = []) {
  return { id: nid(), kind: kind || 'item', name, bonus: bonus || 0, ability: ability || null, tags: tags || [], wielded: false, worn: false };
}

/** Parse a comma/pipe-separated tags attribute into a clean string array. */
export function parseTags(s) {
  return (s || '').split(/[,|]/).map((t) => t.trim()).filter(Boolean);
}

export function normalize(s) {
  return (s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Match items (in any list) by a pipe-separated name/tag pattern. Shared by the
 *  adventure sheet and cache lookups so both use the same matching rules. */
export function matchItems(items, pattern) {
  if (!pattern) return [];
  const pats = pattern.split('|').map((p) => normalize(p));
  return (items || []).filter((it) => {
    const n = normalize(it.name);
    return pats.some((p) => n === p || (it.tags || []).map(normalize).includes(p));
  });
}

/** True if an affliction list holds `name`; '*'/'?'/'' mean "any affliction". */
export function matchAffliction(list, name) {
  if (!list || !list.length) return false;
  if (name == null || name === '' || name === '*' || name === '?') return true;
  const want = normalize(name);
  return list.some((a) => normalize(typeof a === 'string' ? a : a.name) === want);
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
  // Reject anything that isn't shaped like a save before we bother sanitizing —
  // a plausible FL save is a plain object carrying an `abilities` object and a
  // Stamina value. sanitizeData() then hardens every field (see above).
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || typeof data.abilities !== 'object' || data.abilities === null || Array.isArray(data.abilities)
      || data.stamina == null) {
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
