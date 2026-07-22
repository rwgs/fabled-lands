// state.js — the Adventure Sheet: the full mutable character/game state,
// derived stats, and localStorage persistence with multiple save slots.

import { ABILITIES, MAX_ITEMS, clampAbility, rankTitle, canonCargo } from './rules.js';

const SAVE_PREFIX = 'fl_save_';
const META_KEY = 'fl_meta';
const MAX_SLOTS = 20;
const SCHEMA = 3;

// A cursed ability auto-fails any check that uses it (JaFL returns -1000 for
// PURPOSE_TESTING); a fixed ability is pinned at 1. Applied only in check
// contexts (abilityForCheck), never to the displayed/derived score.
const CURSED_ABILITY = -1000;

// Some books spell the sea-safety blessing "storms" (book 1) and others "storm"
// (books 2–6); they are the same blessing. The single "Immunity to Disease and
// Poison" blessing is likewise granted as both blessing="disease" (9 places) and
// blessing="poison" (§2.133), and each spelling is tested/spent under the other
// throughout — JaFL folds any type containing "disease" or "poison" into one
// DISEASE_TYPE. Canonicalise so a grant in one spelling satisfies an
// <if blessing="…"> check (and its paired <lose>) in the other, and the "only one
// blessing at a time" rule holds across the whole campaign. Match is
// case-insensitive. (storm/storms: task 76; disease/poison: task 123)
const BLESSING_ALIASES = { storms: 'storm', poison: 'disease' };
function canonBlessing(b) {
  const k = String(b).trim().toLowerCase();
  return BLESSING_ALIASES[k] || k;
}
// The six ability blessings — each lets the player reroll a FAILED roll of that
// ability (JaFL). Luck ('luck') rerolls any roll; Safe Travel ('travel') rerolls a
// random type="travel" encounter. (task 76)
const ABILITY_BLESSINGS = new Set(['charisma', 'combat', 'magic', 'sanctity', 'scouting', 'thievery']);

// Two ship locations match if both are "at large" (null) or the same dock name
// (case-insensitive) — JaFL ShipList.isHere. (task 73)
function sameDock(a, b) {
  const na = a == null ? null : normalize(a);
  const nb = b == null ? null : normalize(b);
  return na === nb;
}

// Summed passive-effect bonus for an ability across an items array (pure). A
// type="aura" effect counts while carried; type="wielded" only while the item is
// the wielded weapon / worn armour; ability="*" boosts every core ability. Shared
// by GameState.auraBonus and the load-time Stamina reconcile. (task 41/44/124)
function sumAuraBonus(items, key) {
  const k = String(key || '').toLowerCase();
  let sum = 0;
  for (const it of (items || [])) {
    for (const e of (it.effects || [])) {
      const passive = e.type === 'aura' || (e.type === 'wielded' && (it.wielded || it.worn));
      if (!passive) continue;
      const ea = String(e.ability || '').toLowerCase();
      if (ea === k || (ea === '*' && ABILITIES.includes(k))) sum += (e.bonus || 0);
    }
  }
  return sum;
}
// Summed Stamina-total modifier (≤0) from affliction lists (pure). Shared by
// GameState.afflictionStaminaMod and the load-time Stamina reconcile. (task 60/124)
function sumAfflictionStamina(lists) {
  let sum = 0;
  for (const list of lists) for (const a of (list || [])) for (const e of (a.effects || [])) if (e.ability === 'stamina') sum += (e.bonus || 0);
  return sum;
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
    oneDieRolls: false,   // the Three Fortunes' difficultyCurse: 1 die on ability rolls (task 36)
    titles: [],           // {name, value}
    blessings: [],        // string ability names or labels
    permanentBlessings: [], // canonical names of blessings that are never used up (task 76)
    curses: [],           // {type, ...}
    codewords: {},        // name -> true
    codewordValues: {},   // name -> number
    boxes: {},            // "book.section" -> tick count
    flags: {},            // name -> bool
    vars: {},             // name -> number
    ships: [],            // {id, type, name, crew, cargo:[], docked}
    location: null,       // the current dock (section dock=); null = inland / at sea (task 73)
    sailingShipId: null,  // the ship the player is currently sailing (at large); null = none (task 81)
    resurrections: [],    // {book, section, text, god, supplemental}
    effects: [],          // {ability, bonus, type, uses, text}
    abilityFlags: {},     // ability -> {fixed?:true, cursed?:true} (effect="+fixed|+cursed")
    diseases: [],         // {name, type:'disease', effects:[]}  (task 19 populates)
    poisons: [],          // {name, type:'poison', effects:[]}   (task 19 populates)
    caches: {},           // name -> {items:[], money:0}         (task 20 populates)
    currencies: {},       // name -> amount (alternate-currency markets, e.g. Mithral — task 40)
    potionBonus: {},      // ability -> +N temporary boost from a drunk potion (task 41)
    extraChoices: [],     // {key, atBook, atSection, tag, book, section, text} persistent <extrachoice> menu (task 32)
    book: 1,
    section: null,
    startBook: 1,
    history: [],          // [{book, section}] navigation trail
    // The in-progress visit's execution record (task 116): section identity + the
    // renderer's per-visit memo (applied effects, resolved rolls/fights, picks, the
    // one-level return frame). Refreshed on every save() from the Story visit provider
    // so a reload resumes the exact visit instead of re-entering it fresh. null before
    // the first section, or for a legacy save that predates the record.
    visit: null,
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
    // Save-status observers, distinct from _listeners (the change/sheet-refresh channel).
    // Fired after EVERY persistence attempt — both changed()'s full mutations and the
    // direct current-visit commits (commitVisit) — so the warn/export UI (task 7) sees a
    // failure and re-arms on recovery no matter which path wrote or failed. Splitting the
    // channel lets a ctx-only commit publish its save result WITHOUT triggering a sheet
    // rerender (there was no sheet-visible mutation to reflect). (task 166)
    this._saveListeners = new Set();
    // While a navigation transaction is open (task 167), save() refreshes the in-memory
    // visit record but skips the storage write, so a paid move's price is not persisted
    // until its destination is confirmed. See beginTxn/commitTxn/rollbackTxn.
    this._txnSuppress = false;
    // Callback the Story installs (setVisitProvider) that serialises the current
    // visit's execution record; save() calls it so data.visit is always current at
    // persist time — no matter which of the many mid-render mutations triggered the
    // autosave. Null until a game screen is built (and for probe clones). (task 116)
    this._visitProvider = null;
    this._undo = []; // in-memory stack of pre-section-effects state snapshots
    // A <tick special="attack|defence" bonus="N"> grants a per-fight modifier to
    // the player's attack rolls (COMBAT) or Defence, lasting only the current
    // fight (JaFL FightNode.attackBonus / a Defence blessing). Kept OFF data so it
    // never survives a save; cleared on entering a section (Story.begin). (task 49)
    this._fightBonus = { attack: 0, defence: 0 };
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
  // Observe save-status transitions (task 166): fired after every persistence attempt —
  // changed()'s full mutations and commitVisit()'s direct visit commits alike — so the UI
  // can warn on failure and re-arm on recovery whichever path wrote (or failed) last.
  onSaveStatus(fn) { this._saveListeners.add(fn); return () => this._saveListeners.delete(fn); }
  _publishSaveStatus() { for (const fn of this._saveListeners) fn(this); }
  // Install the current-visit serialiser (task 116). save() invokes it to refresh
  // data.visit just before writing, so the persisted record reflects every applied
  // effect / resolved roll up to this instant.
  setVisitProvider(fn) { this._visitProvider = fn || null; }
  changed() {
    this.data.updated = Date.now();
    this.save();
    this._publishSaveStatus();
    for (const fn of this._listeners) fn(this);
  }

  // Commit the current visit's execution progress without a full changed() (task 166).
  // The renderer/combat direct-save sites use this — the transition commit (begin), the
  // resume migration (resumeStale), the interactive rerender tail, and ctx-only combat
  // rounds — where the player's sheet stats may not have changed but the persisted visit
  // record and activity time still must move. It advances `updated` so save-card order
  // reflects the progress, persists via save(), and publishes the save result to the
  // save-status observers (so a direct-commit quota failure warns and a later success
  // re-arms) — but runs NO change observers, so it neither rerenders the sheet nor recurses.
  // Ephemeral previews still no-op the write inside save(). Returns save()'s ok flag.
  commitVisit() {
    this.data.updated = Date.now();
    const ok = this.save();
    this._publishSaveStatus();
    return ok;
  }

  // ---- navigation transaction (task 167) -------------------------------
  // A mutation-bearing move (a paid choice, a blessing/ship passage) defers persisting its
  // price across the async destination fetch: beginTxn() snapshots the data and suppresses
  // the localStorage write inside save() (in-memory mutation and the sheet-refresh listeners
  // still run, so the UI reflects the tentative spend); commitTxn() ends suppression and
  // flushes ONE coherent write; rollbackTxn() restores the snapshot and ends suppression
  // WITHOUT writing — the on-disk record was never touched, so it stays the pre-move source.
  beginTxn() {
    const snap = JSON.stringify(this.data);
    this._txnSuppress = true;
    return snap;
  }
  commitTxn() {
    this._txnSuppress = false;
    this.data.updated = Date.now();
    const ok = this.save();
    this._publishSaveStatus();
    return ok;
  }
  rollbackTxn(snap) {
    this._txnSuppress = false;
    try { this.data = JSON.parse(snap); } catch (e) { /* keep current data on a parse fault */ }
    // No write happened during the suppressed txn, so storage already holds the coherent
    // pre-move source; just refresh the sheet to the restored values and keep the
    // save-status channel consistent (the caller persists the restored source explicitly).
    this._publishSaveStatus();
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

  /** Total additive ability penalty/bonus from active afflictions
   *  (curses/diseases/poisons). Removed automatically when the affliction is
   *  cured, restoring the score. Divide/target/stamina effects are applied
   *  separately (afflictionMod / afflictionStaminaMod). */
  afflictionBonus(ability) {
    let sum = 0;
    for (const list of [this.data.curses, this.data.diseases, this.data.poisons]) {
      for (const a of (list || [])) for (const e of (a.effects || [])) if (e.ability === ability) sum += (e.bonus || 0);
    }
    return sum;
  }

  /** Apply the non-additive affliction transforms to an already-summed score:
   *  a `divide` halves it (round up — JaFL DIVIDE_ABILITY; book5/198 Champion's
   *  Curse "half your COMBAT"), a `target` pins it (TARGET_ABILITY; book5/705
   *  "CHARISMA falls to 1"). Divide applies after the additive bonuses; a target
   *  overrides everything. (task 60) */
  afflictionMod(ability, value) {
    let v = value, target = null;
    for (const list of [this.data.curses, this.data.diseases, this.data.poisons]) {
      for (const a of (list || [])) for (const e of (a.effects || [])) {
        if (e.ability !== ability) continue;
        if (e.divide) v = Math.ceil(v / e.divide);
        if (e.target != null) target = e.target;
      }
    }
    return target != null ? target : v;
  }

  /** Stamina-total change from active afflictions (≤0): book5/306's poison cuts
   *  the total by 6 until cured. Reversible — folded into effectiveStaminaMax(). */
  afflictionStaminaMod() {
    return sumAfflictionStamina([this.data.curses, this.data.diseases, this.data.poisons]);
  }

  /** The Stamina maximum the player currently has, after any affliction cut and any
   *  item aura raise (never below 1). A Stamina-cutting affliction (task 60) or a
   *  Stamina-raising aura like the ring of ultimate power's +10 (task 44) folds in
   *  here, so the sheet/fight display, healing and rest all track it automatically. */
  effectiveStaminaMax() { return Math.max(1, this.data.staminaMax + this.afflictionStaminaMod() + this.auraBonus('stamina')); }

  /** The player's effective Rank, including any item-aura raise (the ring of
   *  ultimate power's +2 Rank — book5/564). Feeds Defence and rank checks. (task 44) */
  rankValue() { return this.data.rank + this.auraBonus('rank'); }

  /** Passive item-effect bonus for an ability key (task 41): a `type="aura"` effect
   *  counts while the item is carried; `type="wielded"` only while it is the
   *  wielded weapon / worn armour. `ability="*"` boosts every core ability. Used for
   *  the elemental swords (+2 to an ability), the rings, and the Jade Defender. */
  auraBonus(key) { return sumAuraBonus(this.data.items, key); }

  /** A drunk potion's temporary +N to an ability (task 41). Section-scoped — cleared
   *  on entering a new section (Story.begin), matching JaFL's "for that one roll or
   *  fight only" in practice (a section usually holds a single relevant roll/fight). */
  potionBonusFor(ability) { return (this.data.potionBonus && this.data.potionBonus[ability]) || 0; }
  addPotionBonus(ability, n = 1) {
    const p = (this.data.potionBonus ||= {});
    p[ability] = (p[ability] || 0) + n;
    this.changed();
  }
  clearPotionBonuses() {
    if (this.data.potionBonus && Object.keys(this.data.potionBonus).length) { this.data.potionBonus = {}; this.changed(); }
  }

  /** Per-fight attack (COMBAT) / Defence modifier from <tick special="attack|defence">.
   *  Transient (never saved) and section-scoped, so it applies to the current
   *  fight only and never leaks between attack and Defence or across a save. (task 49) */
  fightAttackBonus() { return (this._fightBonus && this._fightBonus.attack) || 0; }
  fightDefenceBonus() { return (this._fightBonus && this._fightBonus.defence) || 0; }
  addFightBonus(kind, n = 0) {
    if (!this._fightBonus) this._fightBonus = { attack: 0, defence: 0 };
    if (kind === 'attack') this._fightBonus.attack += n;
    else if (kind === 'defence') this._fightBonus.defence += n;
    else return;
    this.changed();
  }
  clearFightBonuses() {
    if (this._fightBonus && (this._fightBonus.attack || this._fightBonus.defence)) {
      this._fightBonus = { attack: 0, defence: 0 };
      this.changed();
    }
  }
  // The transient per-fight bonus lives off `data`, so a normal save never carries it — but a
  // mid-fight reload (a combat action now persists the visit every round, task 162) would
  // resume with it zeroed while ctx.applied says the granting <tick special="attack|defence">
  // already ran and won't re-fire. The visit record snapshots/restores it so the paid bonus
  // (or the hidden penalty) survives the reload. Null when there is no bonus. (task 156)
  fightBonusSnapshot() {
    const a = this.fightAttackBonus(), d = this.fightDefenceBonus();
    return (a || d) ? { attack: a, defence: d } : null;
  }
  restoreFightBonus(snap) {
    const a = snap && Number.isFinite(snap.attack) ? snap.attack : 0;
    const d = snap && Number.isFinite(snap.defence) ? snap.defence : 0;
    this._fightBonus = { attack: a, defence: d };
  }

  /** Affected ability score, including item/effect/affliction bonuses, clamped
   *  1..12. The fixed/cursed flags are deliberately NOT applied here — like JaFL,
   *  the displayed/derived score is the real one; the flags bite only in checks. */
  ability(ability) {
    const base = this.data.abilities[ability] || 0;
    const sum = base + this.itemBonus(ability) + this.effectBonus(ability) + this.afflictionBonus(ability) + this.auraBonus(ability) + this.potionBonusFor(ability);
    return clampAbility(this.afflictionMod(ability, sum));
  }

  /** Ability score as seen by a check (difficulty/rank/if): a cursed ability
   *  auto-fails, a fixed one counts as 1. A mask hides a blanked/disfigured face,
   *  restoring CHARISMA while worn (JaFL's mask exception). `natural=true` compares
   *  the written score (JaFL MODIFIER_NATURAL); the mode-aware form is below. */
  abilityForCheck(ability, natural = false) {
    return this.abilityForMode(ability, natural ? 'natural' : null);
  }

  /** Ability score for a roll under a `<difficulty|rankcheck modifier=>` keyword:
   *   - natural            → the written score, no item/effect bonuses (MODIFIER_NATURAL)
   *   - noweapon / notool  → the affected score *minus* the weapon/tool bonus (MODIFIER_NOTOOL)
   *   - affected / (none)  → the full affected score, item bonuses included
   *  The cursed/fixed check-flags (and the CHARISMA mask exception) apply first,
   *  exactly as for abilityForCheck. (tasks 46, 53) */
  abilityForMode(ability, mode) {
    const fx = this.data.abilityFlags && this.data.abilityFlags[ability];
    if (fx && (fx.cursed || fx.fixed) && !(ability === 'charisma' && this.hasMask())) {
      return fx.cursed ? CURSED_ABILITY : 1;
    }
    const m = String(mode || '').toLowerCase();
    if (m === 'natural') return this.abilityNatural(ability);
    if (m === 'noweapon' || m === 'notool') return this.abilityNoWeapon(ability);
    return this.ability(ability);
  }

  /** Ability score for a <set value=> arithmetic read (JaFL SetVarNode.resolveIdentifier):
   *  same modifier handling as abilityForCheck, but a cursed ability reads as 0 — the
   *  -1000 check-sentinel forces roll failure and must never enter arithmetic. (task 136.4) */
  abilityForValue(ability, natural = false) {
    const v = this.abilityForCheck(ability, natural);
    return v === CURSED_ABILITY ? 0 : v;
  }

  abilityNatural(ability) { return this.data.abilities[ability] || 0; }

  /** The affected ability score without the weapon/tool (item) bonus — computed
   *  before the 1..12 clamp so a ceiling hit doesn't distort it (JaFL NOTOOL). */
  abilityNoWeapon(ability) {
    const base = this.data.abilities[ability] || 0;
    const sum = base + this.effectBonus(ability) + this.afflictionBonus(ability) + this.auraBonus(ability) + this.potionBonusFor(ability);
    return clampAbility(this.afflictionMod(ability, sum));
  }

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
    // COMBAT (incl. weapon bonus) + Rank + best armour bonus, plus any item aura
    // that boosts Defence directly (sword of stone, ring of guarding, Jade Defender).
    // rankValue() adds the ring of ultimate power's +2 Rank so Defence rises by 2.
    return this.ability('combat') + this.rankValue() + this.armourBonus() + this.auraBonus('defence');
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
    // Dropping a Stamina-raising aura item (the ring of ultimate power's +10)
    // lowers the effective maximum — never leave current Stamina above it. (task 44)
    const cap = this.effectiveStaminaMax();
    if (this.data.stamina > cap) this.data.stamina = cap;
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

  /** True if a possession satisfies an item= requirement, honouring "?" + tags=
   *  (a light-source gate, etc.) — the same matcher the <if item="?" tags=…> path
   *  uses, so a <choice item="?" tags="light"> is no longer permanently locked. (task 47) */
  hasItemMatch(pattern, tags, group) { return matchItemQuery(this.data.items, pattern, tags, group).length > 0; }

  /** The possessions satisfying an item= requirement (same tag/"?"/glob-aware matcher as
   *  hasItemMatch), so a paid choice CONSUMES exactly what it VALIDATED against — a name-only
   *  lookup would validate a `item="?" tags=…` payment then take nothing. (task 145) */
  findItemMatch(pattern, tags, group) { return matchItemQuery(this.data.items, pattern, tags, group); }

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

  // ---- alternate currencies (Mithral etc. — task 40) -------------------
  // A named-currency pool the player spends in a <market currency="Name"> or a
  // <choice currency="Name">, kept separate from the Shards purse. Shards is the
  // default (isShardsCurrency), so only genuinely foreign coin lives here.
  /** Balance of a named currency (0 if the player has none). */
  currencyBalance(name) { return Math.max(0, Math.floor((this.data.currencies && this.data.currencies[name]) || 0)); }
  /** Adjust a named currency by delta (floored at 0, integer). */
  adjustCurrency(name, delta) {
    const cs = (this.data.currencies ||= {});
    cs[name] = Math.max(0, Math.floor((cs[name] || 0) + delta));
    this.changed();
  }
  /** Scale a named currency by factor (floored at 0). */
  multiplyCurrency(name, factor) {
    const cs = (this.data.currencies ||= {});
    cs[name] = Math.max(0, Math.floor((cs[name] || 0) * factor));
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
  // current floors at 1. The upper clamp is the EFFECTIVE max (written + aura), not
  // the written max, so a ring-of-ultimate-power holder above the written max keeps
  // that aura headroom instead of shedding up to 10 Stamina on any move. (task 158)
  adjustAbilityStamina(delta, fatal = false) {
    let d = delta;
    let newMax = this.data.staminaMax + d;
    if (newMax < 1) { d = 1 - this.data.staminaMax; newMax = 1; }
    this.data.staminaMax = newMax;
    this.data.stamina += d;
    if (this.data.stamina <= 0) this.data.stamina = fatal ? 0 : 1;
    else if (this.data.stamina > this.effectiveStaminaMax()) this.data.stamina = this.effectiveStaminaMax();
    this.changed();
  }

  damageStamina(amount) {
    this.data.stamina = Math.max(0, this.data.stamina - amount);
    this.changed();
    return this.data.stamina;
  }
  healStamina(amount) {
    this.data.stamina = Math.min(this.effectiveStaminaMax(), this.data.stamina + amount);
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
  // A codeword and its counter value are one entry in JaFL, so <lose codeword="X">
  // zeroes the counter too — the books use this as a counter-reset idiom (book6/117,
  // book6/731 donation bonuses; book4/93 crew bribe; book6/47 SpiderDamage). Leaving
  // the value behind made every bonus ever bought a permanent, save-persisted roll
  // modifier (and CharismaBonus even leaked between books 4 and 6). (task 52)
  removeCodeword(cw) { delete this.data.codewords[cw]; delete this.data.codewordValues[cw]; this.changed(); }
  codewordValue(name) { return this.data.codewordValues[name] || 0; }
  adjustCodewordValue(name, delta) {
    this.data.codewordValues[name] = (this.data.codewordValues[name] || 0) + delta;
    this.changed();
  }
  setCodewordValue(name, v) { this.data.codewordValues[name] = v; this.changed(); }

  // ---- extra choices (<extrachoice>, task 32) -------------------------
  // A persistent, keyed navigation option the books "note on your Adventure
  // Sheet": available either at a specific book+section (atBook/atSection) or at
  // any section carrying a tag (e.g. tag="temple" — Targdaz's Recall, curse
  // removal), and jumping to book/section when taken. A key lets a later choice
  // replace it or a <extrachoice remove=key> lift it.
  addExtraChoice(choice) {
    if (!choice || !choice.section) return;
    if (choice.key) this.data.extraChoices = this.data.extraChoices.filter((c) => c.key !== choice.key);
    this.data.extraChoices.push(choice);
    this.changed();
  }
  removeExtraChoice(key) {
    if (!key) return;
    const before = this.data.extraChoices.length;
    this.data.extraChoices = this.data.extraChoices.filter((c) => c.key !== key);
    if (this.data.extraChoices.length !== before) this.changed();
  }
  /** The extra choices active at (book, section) — matched by an exact
   *  atBook/atSection target, or by the section's tag= (e.g. "temple"). */
  extraChoicesFor(book, section, sectionTag) {
    return this.data.extraChoices.filter((c) =>
      (c.atSection != null && String(c.atSection) === String(section) && (c.atBook == null || Number(c.atBook) === Number(book)))
      || (c.tag && sectionTag && c.tag === sectionTag));
  }

  // ---- boxes / visit ticks --------------------------------------------
  boxKey(book, section) { return `${book ?? this.data.book}.${section ?? this.data.section}`; }
  tickCount(book, section) { return this.data.boxes[this.boxKey(book, section)] || 0; }
  // The current section's boxes= count, set by the renderer on entry (transient,
  // not persisted). Caps addTick so a repeat visit can't over-tick — see below.
  setSectionBoxes(n) { this._sectionBoxes = n > 0 ? n : 0; }
  // Snapshot of THIS section's box-tick count as it was ENTERED — set by the renderer
  // at begin() (before any in-section <tick/> runs), so an <if ticks="N"> guard can be
  // evaluated against the entry count rather than the live one. JaFL reads the guard
  // once, sequentially before the <tick>; the port re-renders in place (e.g. taking an
  // item), so a tick applied THIS visit would otherwise flip a live-count guard and
  // wrongly re-show an "already ticked → goto" redirect on the same visit (task 105).
  // Uses the same no-args box key as addTick / the guard, so the caller must have the
  // section's position current (navigate()/tests set it before begin). Transient, not
  // persisted; null/undefined ⇒ fall back to the live count (headless/direct use).
  setEntryTicks(n) { this._entryTicks = n; }
  entryTickCount() { return this._entryTicks == null ? this.tickCount() : this._entryTicks; }
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
  // Variables are section-local in JaFL (each SectionNode owns its own map, cleared
  // on entry); the port kept them on the save so they leaked across sections. Clear
  // them when a section begins so a `<while var>` loop (and any roll/computation var)
  // starts undefined — else a value left by an earlier section could skip the loop
  // or fire a `<if var>` gate before its roll. No-op (no save) when already empty. (task 100)
  clearVars() { if (Object.keys(this.data.vars).length) { this.data.vars = {}; this.changed(); } }
  // Replay a roll's already-persisted value into a variable during a re-render
  // without flagging another save — used so each `<while>` iteration's downstream
  // reads see THAT pass's rolled value (the live var may have been overwritten by a
  // later iteration). The authoritative value was saved when the roll happened. (task 100)
  restoreVar(name, v) { this.data.vars[name] = v; }

  // ---- blessings / curses ---------------------------------------------
  // Compared/stored canonically so "storm"/"storms" (and any casing) are one
  // blessing — this also repairs legacy saves that stored the alias spelling.
  hasBlessing(b) {
    const c = canonBlessing(b);
    // "?"/"*" are JaFL's match-any wildcards (§5.365 "if you already have a blessing of
    // any sort, he cannot give you another"): any stored blessing satisfies the test. (task 132)
    if (c === '?' || c === '*') return this.data.blessings.length > 0;
    return this.data.blessings.some((x) => canonBlessing(x) === c);
  }
  // permanent="true" (book6/159 Safety from Storms) marks a blessing that is never
  // used up; re-granting an existing blessing as permanent upgrades it. (task 76)
  addBlessing(b, permanent = false) {
    const c = canonBlessing(b);
    if (!this.hasBlessing(b)) this.data.blessings.push(c);
    if (permanent) { (this.data.permanentBlessings ||= []); if (!this.data.permanentBlessings.includes(c)) this.data.permanentBlessings.push(c); }
    this.changed();
    return c;
  }
  removeBlessing(b) {
    const c = canonBlessing(b);
    const i = this.data.blessings.findIndex((x) => canonBlessing(x) === c);
    const pi = (this.data.permanentBlessings || []).findIndex((x) => canonBlessing(x) === c);
    if (pi >= 0) this.data.permanentBlessings.splice(pi, 1);
    if (i >= 0) { this.data.blessings.splice(i, 1); this.changed(); return true; }
    if (pi >= 0) this.changed();
    return false;
  }
  // A punitive "lose all blessings" (<lose blessing="*">) clears even permanent ones
  // (JaFL: a blessing can be removed even if permanent). (task 76)
  removeAllBlessings() {
    const had = this.data.blessings.length || (this.data.permanentBlessings || []).length;
    this.data.blessings = [];
    this.data.permanentBlessings = [];
    if (had) this.changed();
    return had > 0;
  }
  isBlessingPermanent(b) { const c = canonBlessing(b); return (this.data.permanentBlessings || []).some((x) => canonBlessing(x) === c); }
  // Spend a blessing on its use (a reroll, etc.): consumed unless permanent. Returns
  // true if the blessing was held (so its benefit applies). (task 76)
  useBlessing(b) {
    if (!this.hasBlessing(b)) return false;
    if (this.isBlessingPermanent(b)) return true; // permanent — never used up
    this.removeBlessing(b);
    return true;
  }
  // Which blessings the player may spend to reroll the just-resolved roll (task 76):
  // an ability blessing rerolls a FAILED check of that ability; Luck rerolls any roll;
  // Safe Travel rerolls a random type="travel" encounter. Returns canonical names.
  rerollBlessings({ ability = null, success = false, kind = 'check', travel = false } = {}) {
    const out = [];
    if (kind === 'random') {
      if (travel && this.hasBlessing('travel')) out.push('travel');
      if (this.hasBlessing('luck')) out.push('luck');
      return out;
    }
    if (success) return out; // a passed check needs no reroll
    if (ability && ABILITY_BLESSINGS.has(canonBlessing(ability)) && this.hasBlessing(ability)) out.push(canonBlessing(ability));
    if (this.hasBlessing('luck')) out.push('luck');
    return out;
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
    // A Stamina-cutting affliction (book5/306 poison) lowers the total now; cap
    // current Stamina to the new maximum. Cure restores the max automatically.
    const cap = this.effectiveStaminaMax();
    if (this.data.stamina > cap) this.data.stamina = cap;
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
  // Initiating a god may grant ability effects that last until it is renounced —
  // Sig's "+1 THIEVERY" (book1/437, book2/334). They are tagged `source: "god:<g>"`
  // so removeGod strips them, and never double-added on re-initiation. (task 59)
  setGod(g, effects = null) {
    if (this.hasGod(g)) return;
    this.data.gods.push(g);
    const src = 'god:' + g;
    if (effects && effects.length && !this.data.effects.some((e) => e.source === src)) {
      effects.forEach((e) => this.data.effects.push({ ...e, source: src }));
    }
    this.changed();
  }
  removeGod(g) {
    const i = this.data.gods.indexOf(g);
    const src = 'god:' + g;
    const kept = this.data.effects.filter((e) => e.source !== src);
    const strippedEffects = kept.length !== this.data.effects.length;
    if (i >= 0) this.data.gods.splice(i, 1);
    if (strippedEffects) this.data.effects = kept;
    // Renouncing a god also cancels any resurrection deal tied to it — JaFL's
    // removeAGod forfeits that god's extra life. A godless deal (god:null), bought
    // while not a worshipper, is not tied to any god and survives. (task 135)
    const gk = normalize(g);
    const keptRes = this.data.resurrections.filter((r) => !(r.god && normalize(r.god) === gk));
    const strippedRes = keptRes.length !== this.data.resurrections.length;
    if (strippedRes) this.data.resurrections = keptRes;
    if (i >= 0 || strippedEffects || strippedRes) this.changed();
  }

  hasTitle(name) { return this.data.titles.some((t) => t.name === name); }
  titleValue(name) { const t = this.data.titles.find((t) => t.name === name); return t ? t.value : 0; }
  addTitle(name, value = 0) {
    const t = this.data.titles.find((t) => t.name === name);
    if (t) t.value += value; else this.data.titles.push({ name, value });
    this.changed();
  }
  removeTitle(name) { const i = this.data.titles.findIndex((t) => t.name === name); if (i >= 0) { this.data.titles.splice(i, 1); this.changed(); } }
  // A patterned title (JaFL <tick title titlePattern titleValue titleAdjust>): a NEW
  // title starts at `init` (titleValue); an existing one advances by `adjust`
  // (titleAdjust). `pattern` ({0}=value) renders the formatted title. (task 75)
  adjustPatternedTitle(name, pattern, init = 1, adjust = 1) {
    const t = this.data.titles.find((t) => t.name === name);
    if (t) { t.value += adjust; if (pattern) t.pattern = pattern; }
    else this.data.titles.push({ name, value: init, pattern: pattern || null });
    this.changed();
  }
  // Change the character's profession (book6/118 former Priest, book6/731). Stored
  // capitalised to match the starting professions; checks normalise casing. (task 75)
  setProfession(p) {
    const n = String(p || '').trim();
    if (!n) return;
    this.data.profession = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
    this.changed();
  }

  // ---- resurrections ---------------------------------------------------
  hasResurrection() { return this.data.resurrections.length > 0; }
  // A standard arrangement replaces any existing standard one (JaFL Adventurer
  // .addResurrection: "you can only have one resurrection arranged at a time; a new
  // deal cancels the old"); a supplemental boon (§6.355) is added on top and never
  // displaces a standard deal, so both coexist. (task 98)
  addResurrection(r) {
    if (!r.supplemental) this.data.resurrections = this.data.resurrections.filter((x) => x.supplemental);
    this.data.resurrections.push(r);
    this.changed();
  }

  // ---- ships -----------------------------------------------------------
  addShip(ship) { if (!ship.id) ship.id = nid(); if (ship.docked === undefined) ship.docked = this.data.location ?? null; this.data.ships.push(ship); this.changed(); return ship; }
  get ships() { return this.data.ships; }

  // ---- ship location (task 73) -----------------------------------------
  // A ship's `docked` is its own location: a dock name, or null = "at large" (at sea).
  // `data.location` is where the PLAYER is (a section's dock=), or null (inland/at sea).
  // Arrive at a dock: record it and berth the arriving ship here — the player is
  // presumed to have just sailed it in (JaFL ShipList.setAtDock). While a voyage is
  // active (sailingShipId set), only that ship berths and the voyage ends; otherwise
  // every at-large ship berths (the single-ship common case + loaded saves). A null
  // dock (a land or sea section) clears the location and berths nothing. (tasks 73, 81)
  arriveAtDock(dock) {
    const prev = this.data.location ?? null;
    this.data.location = dock == null || dock === '' ? null : String(dock);
    // The location itself is persistable state (shipsHere()/currentShip() read it): treat a
    // change to it as reason enough to save, even when no ship berths and no voyage ends —
    // otherwise a save-free visit's dock arrival (or clear) is lost on a mid-visit reload,
    // restoring a stale location into the locality rules. (task 154)
    let changed = this.data.location !== prev;
    if (this.data.location == null) { if (changed) this.changed(); return; } // inland / still at sea — nothing docks
    const sid = this.data.sailingShipId;
    // A voyage pointer that no longer names an owned at-large ship (the sailed vessel
    // was wrecked/seized and replaced at sea — book4/658) berths ALL at-large ships,
    // like the no-pointer case, instead of stranding the replacement at sea. (task 89)
    const sailing = sid != null && this.data.ships.some((s) => s.id === sid && s.docked == null) ? sid : null;
    for (const s of this.data.ships) if (s.docked == null && (sailing == null || s.id === sailing)) { s.docked = this.data.location; changed = true; }
    if (sid != null) { this.data.sailingShipId = null; changed = true; } // reached port — voyage over
    if (changed) this.changed();
  }
  // todock="X": on leaving a section, move at-large ships to dock X — except the one the
  // player sails away in (exemptId). Leaving by sail keeps that ship at large (book4/114);
  // going ashore exempts nothing, so every at-large ship docks (book1/176). (task 81)
  applyTodock(dock, exemptId = null) {
    if (!dock) return;
    let changed = false;
    for (const s of this.data.ships) if (s.docked == null && s.id !== exemptId) { s.docked = String(dock); changed = true; }
    if (changed) this.changed();
  }
  // Ships at the player's current location. At a dock (location set): those berthed
  // there. Away from a dock: the at-large ships — the player's flotilla at sea (JaFL
  // isHere matches null==null; book4/114 needs both at-large ships offered). A ship
  // berthed at another port is never "here".
  shipsHere() { const loc = this.data.location ?? null; return this.data.ships.filter((s) => sameDock(s.docked ?? null, loc)); }
  // The one vessel the current section's rules act on (task 89): at a dock, a ship
  // berthed there; during a voyage, the ship being sailed (sailingShipId — so a second
  // at-large prize doesn't hijack §1.586's storm dice); otherwise the first at-large
  // ship (the JaFL at-sea default — covers §4.658's replacement bought after a wreck
  // and pre-pointer saves). NO fallback to a vessel berthed elsewhere: inland with the
  // fleet in port there is no current vessel.
  currentShip() {
    const here = this.shipsHere();
    if (this.data.location != null) return here[0] || null;
    const sid = this.data.sailingShipId;
    return (sid != null && here.find((s) => s.id === sid)) || here[0] || null;
  }
  // True if the player owns a ship berthed at dock X (JaFL <if docked="X">).
  shipDockedAt(dock) { return this.data.ships.some((s) => s.docked != null && sameDock(s.docked, dock)); }
  // Sail a ship out of port: it becomes "at large" (docked = null) and is marked as the
  // ship being sailed (so a later todock/arrival moves only the others). (tasks 73, 81)
  sailShip(id) { const s = (id != null && this.data.ships.find((x) => x.id === id)) || this.currentShip(); if (s) { s.docked = null; this.data.sailingShipId = s.id; this.changed(); } return s; }

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

  // Reverse the last goto for a <return> (task 110): pop the history bounce and restore
  // the previous visit's position, section-local variables and player location from the
  // return frame WITHOUT counting a turn, pushing history or clearing/replaying effects.
  // The renderer re-renders that visit from its preserved memo (ctx); state changed
  // legitimately during the detour (money, items, ticks elsewhere) is left untouched.
  restoreReturn(frame) {
    if (this.data.history.length) this.data.history.pop(); // drop the temporary detour entry
    this.data.book = Number(frame.book);
    this.data.section = String(frame.section);
    this.data.vars = { ...frame.vars };
    this.data.location = frame.location ?? null;
    this.setEntryTicks(frame.entryTicks); // restore the <if ticks=> entry snapshot (task 105)
    this.changed();
  }

  // ---- persistence -----------------------------------------------------
  /** Persist to localStorage. Returns true on success, false on failure (and
   *  sets lastSaveError to a player-facing message so the UI can warn). An
   *  ephemeral preview game reports success without writing. */
  save() {
    if (this.ephemeral) { this.lastSaveError = null; return true; } // preview game: not persisted until kept
    // Refresh the current-visit record so the write captures execution state as of now
    // (task 116). Guarded: a provider fault must never block persisting the game itself.
    // Done even while a navigation txn suppresses the write below, so data.visit stays
    // coherent in memory (a mismatched mid-transition record still resolves to null).
    if (this._visitProvider) { try { this.data.visit = this._visitProvider(); } catch (e) { this.data.visit = null; } }
    // A mutation-bearing move holds a navigation transaction open across the async
    // destination fetch (task 167): the price of the move mutates in memory but must not
    // reach storage until the destination is confirmed, so an interrupted/rejected fetch
    // leaves the on-disk record the coherent pre-move source. commitTxn() flushes; a
    // rollback discards. The in-memory data.visit refresh above still runs.
    if (this._txnSuppress) { this.lastSaveError = null; return true; }
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
   *  Returns the slot number, or throws if all slots are full or the write
   *  fails. Transactional: on a failed write the game stays an ephemeral
   *  preview on its old slot (so the player can retry or export) and the
   *  storage error is raised. */
  keep() {
    const slot = nextFreeSlot();
    if (slot == null) throw new Error('All save slots are full. Delete or export a save first.');
    const prevSlot = this.slot;
    this.slot = slot;
    this.ephemeral = false;
    if (!this.save()) {
      this.slot = prevSlot;
      this.ephemeral = true;
      throw new Error(this.lastSaveError || 'Could not save this adventure.');
    }
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
    effects: asArr(it.effects).map(sanitizeEffect).filter(Boolean),
    group: typeof it.group === 'string' && it.group ? it.group : null,
    wielded: asBool(it.wielded),
    worn: asBool(it.worn),
  };
}

// A stored item <effect> (task 41). Keeps only the known, serialisable shape so a
// hostile save can't smuggle in odd fields; body is the effect's action XML.
function sanitizeEffect(e) {
  const o = asObj(e);
  const type = ['use', 'aura', 'wielded', 'ability', 'tool'].includes(o.type) ? o.type : 'aura';
  return {
    type,
    ability: typeof o.ability === 'string' ? o.ability : null,
    bonus: asNum(o.bonus, 0, { int: true }),
    uses: asNum(o.uses, -1, { int: true }),
    verb: typeof o.verb === 'string' ? o.verb : null,
    text: typeof o.text === 'string' ? o.text : null,
    body: typeof o.body === 'string' ? o.body : null,
  };
}

function sanitizeAffliction(a, type) {
  const o = asObj(a);
  const name = asStr(o.name).trim();
  if (!name) return null;
  const effects = asArr(o.effects)
    .map((e) => {
      const eo = asObj(e);
      const ability = asStr(eo.ability);
      if (!ability) return null;
      // Exactly one of bonus/divide/target (task 60); default to a zero bonus.
      if (eo.divide != null) return { ability, divide: asNum(eo.divide, 1, { min: 1, int: true }) };
      if (eo.target != null) return { ability, target: asNum(eo.target, 0, { int: true }) };
      return { ability, bonus: asNum(eo.bonus, 0, { int: true }) };
    })
    .filter(Boolean);
  return { name, type, effects, cumulative: asBool(o.cumulative), lift: o.lift == null ? null : asStr(o.lift) };
}

function sanitizeShip(s) {
  const o = asObj(s);
  const type = asStr(o.type).trim();
  if (!type) return null;
  return {
    id: asStr(o.id).trim() || nid(),
    type,
    name: asStr(o.name, 'Ship') || 'Ship',
    crew: asStr(o.crew, 'average') || 'average',
    cargo: asArr(o.cargo).filter((c) => typeof c === 'string').map(canonCargo), // fold abbreviated units to canonical (task 127)
    docked: o.docked == null ? null : asStr(o.docked),
  };
}

// Validate a persisted current-visit record (task 116). Only its identity fields are
// coerced/guarded here; the ctx/frame memo is passed through as-is because the renderer
// rebuilds from it and loadCurrent's resume() has a conservative fallback if it is bad.
// Dropped (→ null) unless it is a v:1 record whose section matches the game's current
// section — a mismatched record would resume the wrong visit, so we discard it and let
// the migration re-enter conservatively.
function sanitizeVisit(v, curBook, curSection) {
  const o = asObj(v);
  if (o.v !== 1 || o.section == null || curSection == null) return null;
  if (String(o.section) !== String(curSection) || asNum(o.book, 0, { int: true }) !== curBook) return null;
  if (!o.ctx || typeof o.ctx !== 'object') return null;
  return {
    v: 1,
    book: curBook,
    section: String(o.section),
    entryTicks: asNum(o.entryTicks, 0, { min: 0, int: true }),
    sectionTodock: o.sectionTodock == null ? null : asStr(o.sectionTodock),
    // Per-fight attack/Defence bonus snapshot (task 156); null when there was none.
    fightBonus: o.fightBonus && typeof o.fightBonus === 'object'
      ? { attack: asNum(o.fightBonus.attack, 0, { int: true }), defence: asNum(o.fightBonus.defence, 0, { int: true }) }
      : null,
    ctx: asObj(o.ctx),
    frame: o.frame == null ? null : asObj(o.frame),
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
  // Clamp to the *effective* ceiling (written max + item-aura Stamina − affliction cut),
  // computed from the sanitized items/afflictions below — never the written max alone.
  // The ring of ultimate power (§5.564) raises current Stamina to staminaMax+10; clamping
  // to staminaMax here silently stripped that on every load/import/SW reload. (task 124)
  out.stamina = asNum(d.stamina, out.staminaMax, { min: 0, int: true });
  out.rank = asNum(d.rank, base.rank, { min: 1, int: true });
  out.shards = asNum(d.shards, 0, { min: 0, int: true });

  out.items = asArr(d.items).map(sanitizeItem).filter(Boolean);
  out.gods = asArr(d.gods).filter((g) => typeof g === 'string');
  out.godless = asBool(d.godless);
  out.oneDieRolls = asBool(d.oneDieRolls);
  out.titles = asArr(d.titles).map((t) => {
    const o = asObj(t); const name = asStr(o.name).trim();
    if (!name) return null;
    const rec = { name, value: asNum(o.value, 0, { int: true }) };
    if (o.pattern) rec.pattern = asStr(o.pattern); // patterned title format (task 75)
    return rec;
  }).filter(Boolean);
  // Canonicalise + de-dupe stored blessings so a legacy save that wrote an alias
  // spelling (storms, or a disease/poison grant under the other name) survives as
  // the one canonical blessing rather than two — mirrors permanentBlessings below. (task 123)
  out.blessings = [...new Set(asArr(d.blessings).filter((b) => typeof b === 'string').map((b) => canonBlessing(b)))];
  // Permanent-blessing markers (task 76): keep only string names that name a held
  // blessing, canonicalised and de-duplicated. Absent in legacy string-only saves ⇒ [].
  out.permanentBlessings = [...new Set(asArr(d.permanentBlessings)
    .filter((b) => typeof b === 'string').map((b) => canonBlessing(b))
    .filter((c) => out.blessings.some((x) => canonBlessing(x) === c)))];
  out.curses = asArr(d.curses).map((a) => sanitizeAffliction(a, 'curse')).filter(Boolean);
  out.diseases = asArr(d.diseases).map((a) => sanitizeAffliction(a, 'disease')).filter(Boolean);
  out.poisons = asArr(d.poisons).map((a) => sanitizeAffliction(a, 'poison')).filter(Boolean);

  // Now that items and afflictions are sanitized, clamp current Stamina to the
  // effective ceiling — mirrors GameState.effectiveStaminaMax / reconcileEquipment
  // so an aura-raised save (ring +10) is preserved while a hand-edited over-max
  // value is still floored to what the character could legitimately hold. (task 124)
  const staminaCeiling = Math.max(1, out.staminaMax + sumAfflictionStamina([out.curses, out.diseases, out.poisons]) + sumAuraBonus(out.items, 'stamina'));
  if (out.stamina > staminaCeiling) out.stamina = staminaCeiling;

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
  out.location = d.location == null || d.location === '' ? null : asStr(d.location);
  // Keep the sailing-ship pointer only if it names a ship that is actually at large. (task 81)
  out.sailingShipId = (d.sailingShipId != null && out.ships.some((s) => s.id === asStr(d.sailingShipId) && s.docked == null)) ? asStr(d.sailingShipId) : null;
  out.resurrections = asArr(d.resurrections).map((r) => {
    const o = asObj(r);
    return { book: asNum(o.book, out.book, { min: 1, int: true }), section: o.section == null ? null : asStr(o.section), text: asStr(o.text), god: o.god == null ? null : asStr(o.god), supplemental: asBool(o.supplemental) };
  });
  out.effects = asArr(d.effects).map((e) => {
    const o = asObj(e);
    if (!o.ability && !o.type) return null;
    return { ability: typeof o.ability === 'string' ? o.ability : null, bonus: asNum(o.bonus, 0, { int: true }), type: typeof o.type === 'string' ? o.type : null, uses: o.uses == null ? null : asNum(o.uses, 0, { min: 0, int: true }), text: asStr(o.text), source: typeof o.source === 'string' ? o.source : null };
  }).filter(Boolean);
  out.abilityFlags = {};
  for (const [k, v] of Object.entries(asObj(d.abilityFlags))) { const o = asObj(v); const f = {}; if (o.fixed) f.fixed = true; if (o.cursed) f.cursed = true; if (Object.keys(f).length) out.abilityFlags[k] = f; }

  out.caches = {};
  for (const [k, v] of Object.entries(asObj(d.caches))) {
    const o = asObj(v);
    out.caches[k] = { money: asNum(o.money, 0, { min: 0, int: true }), items: asArr(o.items).map(sanitizeItem).filter(Boolean), locked: asBool(o.locked) };
  }
  out.currencies = {};
  for (const [k, v] of Object.entries(asObj(d.currencies))) { const n = asNum(v, 0, { min: 0, int: true }); if (n > 0) out.currencies[k] = n; }
  out.potionBonus = {};
  for (const [k, v] of Object.entries(asObj(d.potionBonus))) { const n = asNum(v, 0, { int: true }); if (n && ABILITIES.includes(k)) out.potionBonus[k] = n; }
  out.extraChoices = asArr(d.extraChoices).map((c) => {
    const o = asObj(c);
    const section = asStr(o.section).trim();
    if (!section) return null; // a choice with no jump target is meaningless
    return {
      key: asStr(o.key).trim() || null,
      atBook: o.atBook == null ? null : asNum(o.atBook, null, { min: 1, int: true }),
      atSection: o.atSection == null ? null : asStr(o.atSection).trim(),
      tag: asStr(o.tag).trim() || null,
      book: asNum(o.book, out.book, { min: 1, int: true }),
      section,
      text: asStr(o.text).trim(),
    };
  }).filter(Boolean);

  out.book = asNum(d.book, base.book, { min: 1, int: true });
  out.section = d.section == null ? null : asStr(d.section);
  // The current-visit execution record (task 116). Kept only when it names the current
  // section — the renderer re-checks this on load and resume() is wrapped in a fallback,
  // so the deep contents pass through largely verbatim (they are our own serialised memo).
  out.visit = sanitizeVisit(d.visit, out.book, out.section);
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

export function makeItem(kind, name, bonus = 0, ability = null, tags = [], effects = [], group = null) {
  // effects: [{type:'use'|'aura'|'wielded', ability, bonus, uses, verb, text, body}]
  // aura/wielded fold into ability()/defence() while carried/wielded; use = a
  // Drink/Consult/Use action fired from the Adventure Sheet (task 41).
  // group = the award's XML `group=` provenance key (§5.238 tomb haul, §3.94 map,
  // §5.578 mission loot), so later `<if|lose item="?" group=…>` can count/select
  // only the items from that award, not unrelated possessions (task 93).
  return { id: nid(), kind: kind || 'item', name, bonus: bonus || 0, ability: ability || null, tags: tags || [], effects: effects || [], group: group || null, wielded: false, worn: false };
}

/** Parse a comma/pipe-separated tags attribute into a clean string array. */
export function parseTags(s) {
  return (s || '').split(/[,|]/).map((t) => t.trim()).filter(Boolean);
}

export function normalize(s) {
  return (s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** Match a name against a pattern that may use '*' as a wildcard ("*sword*", "*axe",
 *  "* head"). No '*' means an exact (normalized) comparison. Lives here so both the
 *  engine's equipment checks and state.js's item matchers share ONE glob (task 157);
 *  it was previously engine-only, so name-based item patterns never globbed. */
export function globMatch(pattern, name) {
  const p = normalize(pattern), n = normalize(name);
  if (!p.includes('*')) return n === p;
  return new RegExp('^' + p.split('*').map(escapeRegex).join('.*') + '$').test(n);
}

/** A treasure named "N Shards" (a dragon-hoard pick, book1/16 et al.) is stackable
 *  currency, not a carried item — returns N, else null. (task 29) */
export function currencyAward(name) {
  const m = /^\s*(\d+)\s+shards\s*$/i.exec(String(name || ''));
  return m ? parseInt(m[1], 10) : null;
}

/** A market/choice currency= that means the default Shards purse: null, blank, or
 *  "Shards"/"Shard" (case-insensitive). Any other name is a foreign coin held in a
 *  named-currency pool (e.g. Mithral — book2/495/545). (task 40) */
export function isShardsCurrency(name) {
  return !name || /^shards?$/i.test(String(name).trim());
}

/** Split a multi-name goods label ("fur cloak|wolf pelt") into a display name and
 *  the alternative names. The alternatives are carried as extra item tags so the
 *  Sell button and <if item="wolf pelt"> both match under either name — matchItems
 *  already matches a name against tags. (task 29) */
export function splitItemName(name) {
  const parts = String(name || '').split('|').map((s) => s.trim()).filter(Boolean);
  return { name: parts[0] || String(name || ''), alts: parts.slice(1) };
}

/** Match items (in any list) by a pipe-separated name/tag pattern. Shared by the
 *  adventure sheet and cache lookups so both use the same matching rules. */
export function matchItems(items, pattern) {
  if (!pattern) return [];
  const pats = pattern.split('|').map((p) => p.trim()).filter(Boolean);
  return (items || []).filter((it) => {
    const tags = (it.tags || []).map(normalize);
    // Name is glob-matched (so §4.482 "*flute", §6.144 "* head" hit); tags stay exact.
    return pats.some((p) => globMatch(p, it.name) || tags.includes(normalize(p)));
  });
}

/** Match items against a `<choice>`/`<if>` item= requirement, honouring the `"?"`
 *  wildcard + optional tag filter that plain name-based matchItems does not:
 *  `pattern="?"` (or blank) = "any possession", narrowed to those carrying EVERY
 *  listed tag when tags= is given (e.g. item="?" tags="light" — any light source).
 *  A concrete name/glob pattern defers to matchItems. Shared by the `<if>` item
 *  path and the `<choice>` item gate so both matchers agree. (tasks 18, 47) */
export function matchItemQuery(items, pattern, tags, group) {
  let matches;
  if (pattern === '?' || pattern == null || pattern === '') {
    matches = (items || []).slice();
    if (tags) {
      const want = tags.split(/[,|]/).map((t) => normalize(t)).filter(Boolean);
      matches = matches.filter((it) => want.every((t) => (it.tags || []).map(normalize).includes(t)));
    }
  } else {
    matches = matchItems(items, pattern);
  }
  // group= restricts to the items awarded under that XML provenance key (task 93):
  // §5.118 counts only the §5.238 tomb haul, §3.132 crosses off the §3.94 map, and
  // §5.578's donation is drawn from that mission's three rewards, not the whole pack.
  if (group != null && group !== '') matches = matches.filter((it) => it.group === group);
  return matches;
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

/** Meta reconciled against the actual save blobs. save() writes `fl_save_<slot>` and then
 *  `fl_meta`; if the meta write throws (quota reached between the two, or the whole meta
 *  JSON is corrupt), a persisted adventurer has no meta entry — it vanishes from "Your
 *  Adventurers" and the next New Adventure/import claims the slot over it. So for any slot
 *  whose blob is readable but whose meta entry is missing, reconstruct the entry from the
 *  blob's own fields, and best-effort persist the repair. Unreadable blobs are left as-is —
 *  nextFreeSlot still treats them as occupied so they are never overwritten. (task 137) */
export function reconcileSlotMeta() {
  const meta = loadSlotMeta();
  let repaired = false;
  for (let i = 0; i < MAX_SLOTS; i++) {
    if (meta[i]) continue;
    const d = readSlotData(i);
    if (!d) continue;
    meta[i] = { name: d.name, profession: d.profession, rank: d.rank, book: d.book, section: d.section, updated: d.updated };
    repaired = true;
  }
  if (repaired) { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (_) { /* still returned for display */ } }
  return meta;
}

export function deleteSlot(slot) {
  localStorage.removeItem(SAVE_PREFIX + slot);
  const meta = loadSlotMeta();
  delete meta[slot];
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/** Raw saved data for a slot (for export). Returns null for an absent OR unreadable blob
 *  (corrupt JSON), so exporting a corrupt slot fails gracefully with a toast instead of
 *  throwing uncaught from the click handler. (tasks 7, 137) */
export function readSlotData(slot) {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('readSlotData failed', e);
    return null;
  }
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
  if (!gs.save()) {
    // The write failed (storage full/blocked). Don't claim the slot or report
    // success: roll back any partial write and raise the storage error so the
    // UI shows it instead of toasting `Imported "undefined"`.
    try { deleteSlot(slot); } catch (_) {}
    throw new Error(gs.lastSaveError || 'Could not save the imported adventure.');
  }
  const meta = loadSlotMeta()[slot];
  return { slot, meta };
}

/** First unoccupied save slot (0..MAX_SLOTS-1), or null if all are full. Callers must
 *  handle null — previously this returned 0, silently overwriting the first save. A slot
 *  counts as occupied if it has a meta entry OR a raw blob: a blob can outlive its meta
 *  (a quota error between save()'s two writes), and that orphan must never be overwritten
 *  by the next New Adventure/import. (tasks 4, 137) */
export function nextFreeSlot() {
  const meta = loadSlotMeta();
  for (let i = 0; i < MAX_SLOTS; i++) if (!meta[i] && localStorage.getItem(SAVE_PREFIX + i) == null) return i;
  return null;
}
