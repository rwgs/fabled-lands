// market.js — headless economy rules: buying/selling goods, ships, cargo, crew.
//
// Pure game logic operating on a GameState. Each transaction mutates state and
// returns { ok, note? } so the renderer can decide whether to redraw and what
// (if anything) to toast. No DOM — unit-testable headlessly.

import { makeItem, parseTags } from './state.js';
import { SHIP_TYPES, CREW_LEVELS, canonShipType } from './rules.js';

const shipCap = (type) => SHIP_TYPES[canonShipType(type)]?.capacity || 1;
// Normalise an initialCrew= value from the books to a real crew grade.
const canonCrew = (c) => {
  const k = String(c || '').trim().toLowerCase();
  if (CREW_LEVELS.includes(k)) return k;
  if (k === 'none') return 'poor';
  return 'average'; // "oldcrew" and blanks: a serviceable default
};

/** Classify a shop-row element into a goods kind. */
export function shopKind(node) {
  const tag = node.tagName.toLowerCase();
  if (tag !== 'trade') return tag; // armour | weapon | tool | item | cargo
  if (node.hasAttribute('ship')) return 'ship';
  if (node.hasAttribute('cargo')) return 'cargo';
  if (node.hasAttribute('weapon')) return 'weapon';
  if (node.hasAttribute('armour')) return 'armour';
  if (node.hasAttribute('tool')) return 'tool';
  return 'item';
}

/**
 * A plain descriptor of a shop row, so the transaction functions never touch
 * the DOM. `kind` is one of ship|cargo|weapon|armour|tool|item.
 */
export function goodsFrom(node, kind, name, bonus) {
  return {
    kind,
    name,
    bonus: bonus || 0,
    named: node.getAttribute('name') != null, // false => generic goods sold by COMBAT/Defence bonus
    ability: node.getAttribute('ability') || null,
    tags: parseTags(node.getAttribute('buytags') || node.getAttribute('tags')),
    shipType: node.getAttribute('ship') || null,
    cargoName: node.getAttribute('cargo') || null,
    initialCrew: node.getAttribute('initialCrew') || null,
  };
}

/** Does the player own an item matching this goods descriptor (for selling)? */
export function ownsGoods(state, goods) {
  const { kind, name, bonus, named, shipType, cargoName } = goods;
  if (kind === 'ship') return state.ships.some((s) => canonShipType(s.type) === canonShipType(shipType));
  if (kind === 'cargo') return state.ships.some((s) => (s.cargo || []).includes(cargoName || name));
  // Armour is valued purely by its Defence bonus (its tier), so any owned armour of
  // that bonus can be sold at a named row's price — the starting "leather jerkin", a
  // "leather armour", and an armourer's "leather" are all the same bonus-1 leather.
  // A generic (unnamed) weapon is likewise sold by bonus, so you must own one of that
  // bonus — not merely any weapon (else a +0 weapon could be sold at the +3 price).
  if (kind === 'armour' || (kind === 'weapon' && !named)) {
    return state.data.items.some((it) => it.kind === kind && (it.bonus || 0) === bonus);
  }
  return state.hasItem(name);
}

/** Buy `goods` for `price`. Mutates state. Returns { ok, note? }. */
export function buyTrade(state, goods, price) {
  if (state.data.shards < price) return { ok: false };
  const { kind, name, bonus, ability, tags, shipType, cargoName, initialCrew } = goods;
  if (kind === 'ship') {
    state.adjustMoney(-price);
    state.addShip({ type: canonShipType(shipType), name: 'Ship', crew: canonCrew(initialCrew), cargo: [], docked: null });
  } else if (kind === 'cargo') {
    const ship = state.ships.find((s) => (s.cargo || []).length < shipCap(s.type));
    if (!ship) return { ok: false, note: 'No cargo space.' };
    state.adjustMoney(-price);
    (ship.cargo ||= []).push(cargoName);
    state.changed();
  } else {
    if (state.freeSlots() <= 0) return { ok: false, note: 'You can carry only 12 items.' };
    state.adjustMoney(-price);
    state.addItem(makeItem(kind, name, bonus, ability, tags));
  }
  return { ok: true };
}

/** Sell `goods` for `price`. Mutates state. Returns { ok }. */
export function sellTrade(state, goods, price) {
  const { kind, name, bonus, named, shipType, cargoName } = goods;
  if (kind === 'ship') {
    const i = state.ships.findIndex((s) => canonShipType(s.type) === canonShipType(shipType));
    if (i < 0) return { ok: false };
    state.ships.splice(i, 1); state.adjustMoney(price); state.changed();
  } else if (kind === 'cargo') {
    const ship = state.ships.find((s) => (s.cargo || []).includes(cargoName));
    if (!ship) return { ok: false };
    ship.cargo.splice(ship.cargo.indexOf(cargoName), 1); state.adjustMoney(price); state.changed();
  } else if (kind === 'armour' || (kind === 'weapon' && !named)) {
    // Armour (any name) and generic weapons are valued by bonus: sell one of that tier.
    const it = state.data.items.find((x) => x.kind === kind && (x.bonus || 0) === bonus);
    if (!it) return { ok: false };
    state.removeItemById(it.id); state.adjustMoney(price);
  } else {
    const it = state.findItems(name)[0];
    if (!it) return { ok: false };
    state.removeItemById(it.id); state.adjustMoney(price);
  }
  return { ok: true };
}

/**
 * Apply an inline <buy> in prose: a crew upgrade, a ship, a tool, a carried
 * item, or a cargo unit. Charges `price`, grants one unit, and returns
 * { ok, note? } so the view can toast a refusal (no money / no room / no ship).
 * The view enforces the quantity= cap (max buys per visit).
 */
export function applyInlineBuy(state, opts = {}) {
  const { price = 0, crew, item, tool, ship: shipType, shipName, initialCrew,
    cargo, bonus = 0, ability = null, tags = [] } = opts;
  if (price > 0 && state.data.shards < price) return { ok: false, note: 'Not enough Shards.' };

  if (crew) {
    const ship = state.ships[0];
    if (!ship) return { ok: false, note: 'You have no ship.' };
    if (price) state.adjustMoney(-price);
    ship.crew = crew;
    state.changed();
    return { ok: true };
  }
  if (shipType) {
    if (price) state.adjustMoney(-price);
    state.addShip({ type: canonShipType(shipType), name: shipName || 'Ship', crew: canonCrew(initialCrew), cargo: [], docked: null });
    return { ok: true };
  }
  if (cargo != null) {
    return buyTrade(state, { kind: 'cargo', cargoName: cargo, name: cargo }, price); // capacity checked there
  }
  // a carried possession: a tool (with its ability/bonus) or a plain item
  if (state.freeSlots() <= 0) return { ok: false, note: 'You can carry only 12 items.' };
  if (price) state.adjustMoney(-price);
  state.addItem(makeItem(tool ? 'tool' : 'item', tool || item, bonus || 0, ability || null, tags || []));
  return { ok: true };
}

/** Sell one carried item by name for `gain` Shards. Returns { ok }. */
export function sellInlineItem(state, name, gain) {
  const it = state.findItems(name)[0];
  if (!it) return { ok: false };
  state.removeItemById(it.id);
  if (gain) state.adjustMoney(gain);
  return { ok: true };
}

/** Give up one Cargo Unit of `cargoType` (from any ship carrying it), optionally
 *  for `gain` Shards. The barter-reward side stays in the view. Returns { ok }. */
export function sellCargo(state, cargoType, gain) {
  const ship = state.ships.find((s) => (s.cargo || []).includes(cargoType));
  if (!ship) return { ok: false };
  ship.cargo.splice(ship.cargo.indexOf(cargoType), 1);
  if (gain) state.adjustMoney(gain);
  state.changed();
  return { ok: true };
}
