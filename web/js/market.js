// market.js — headless economy rules: buying/selling goods, ships, cargo, crew.
//
// Pure game logic operating on a GameState. Each transaction mutates state and
// returns { ok, note? } so the renderer can decide whether to redraw and what
// (if anything) to toast. No DOM — unit-testable headlessly.

import { makeItem, parseTags, splitItemName, isShardsCurrency, normalize } from './state.js';
import { SHIP_TYPES, CREW_LEVELS, canonShipType, canonCargo } from './rules.js';
import { resolveValue, readItemEffects } from './engine.js';

const shipCap = (type) => SHIP_TYPES[canonShipType(type)]?.capacity || 1;

// A market's currency= (task 40): Shards is the default purse; any other name is a
// foreign-coin pool (e.g. Mithral). These route a trade's payment/receipt to the
// right store so a <market currency="Mithral"> spends Mithral, never Shards.
const walletBalance = (state, currency) => (isShardsCurrency(currency) ? state.data.shards : state.currencyBalance(currency));
const walletSpend = (state, currency, amount) => { if (isShardsCurrency(currency)) state.adjustMoney(-amount); else state.adjustCurrency(currency, -amount); };
const walletEarn = (state, currency, amount) => { if (isShardsCurrency(currency)) state.adjustMoney(amount); else state.adjustCurrency(currency, amount); };
// Normalise an initialCrew= value from the books to a real crew grade. A literal
// grade or "none" maps directly; otherwise (given `state`) resolve it as a variable
// or number first — §4.658 stores the wrecked ship's crew with <set var="oldcrew"
// value="crew"/> (a 1-based CREW_LEVELS index) and buys the barque with
// initialCrew="oldcrew", so the salvaged crew must be carried over, not reset to
// average. A blank or unresolved value falls back to average. (task 103)
const canonCrew = (c, state = null) => {
  const raw = String(c || '').trim();
  const k = raw.toLowerCase();
  if (CREW_LEVELS.includes(k)) return k;
  if (k === 'none') return 'poor';
  if (state && raw) {
    const n = resolveValue(state, raw);
    if (Number.isInteger(n) && n >= 1 && n <= CREW_LEVELS.length) return CREW_LEVELS[n - 1];
  }
  return 'average'; // blanks / unresolved: a serviceable default
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
    // Fold an abbreviated market row (§4.252 "meta", §5.447 "mineral") to the canonical
    // commodity so the manifest, the buy label and cross-port sales all agree. (task 127)
    cargoName: node.getAttribute('cargo') != null ? canonCargo(node.getAttribute('cargo')) : null,
    initialCrew: node.getAttribute('initialCrew') || null,
  };
}

/** Does the player own an item matching this goods descriptor (for selling)?
 *  Ship/cargo sales need the vessel HERE (at this dock / sailing with you) — a ship
 *  or hold berthed at another port cannot be sold remotely (task 89). */
export function ownsGoods(state, goods) {
  const { kind, name, bonus, named, shipType, cargoName } = goods;
  if (kind === 'ship') return state.shipsHere().some((s) => canonShipType(s.type) === canonShipType(shipType));
  if (kind === 'cargo') { const want = canonCargo(cargoName || name); return state.shipsHere().some((s) => (s.cargo || []).some((c) => canonCargo(c) === want)); }
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

/** Buy `goods` for `price` in `currency` (Shards by default). Mutates state.
 *  Returns { ok, note? }. */
export function buyTrade(state, goods, price, currency = null) {
  if (walletBalance(state, currency) < price) return { ok: false };
  const { kind, name, bonus, ability, tags, effects, shipType, cargoName, initialCrew } = goods;
  if (kind === 'ship') {
    walletSpend(state, currency, price);
    // Berth the new ship at the port it is bought in, so <if docked="…"> sees it (task 73).
    state.addShip({ type: canonShipType(shipType), name: 'Ship', crew: canonCrew(initialCrew, state), cargo: [], docked: state.data.location ?? null });
  } else if (kind === 'cargo') {
    // Load onto a ship HERE (berthed at this port / sailing with you) that has cargo
    // space — never onto a vessel left at another dock (task 89).
    const here = state.shipsHere();
    const ship = here.find((s) => (s.cargo || []).length < shipCap(s.type));
    if (!ship) return { ok: false, note: here.length ? 'No cargo space.' : 'You have no ship here.' };
    walletSpend(state, currency, price);
    (ship.cargo ||= []).push(canonCargo(cargoName)); // store the canonical commodity (task 127)
    state.changed();
  } else {
    if (state.freeSlots() <= 0) return { ok: false, note: 'You can carry only 12 items.' };
    walletSpend(state, currency, price);
    // A "fur cloak|wolf pelt" row is one item: store it under its first name, with
    // the alternatives as tags so <if item="wolf pelt"> and re-selling match (task 29).
    const { name: itemName, alts } = splitItemName(name);
    state.addItem(makeItem(kind, itemName, bonus, ability, [...tags, ...alts], effects || []));
  }
  return { ok: true };
}

// --- Selling with several candidates: ask which, don't silently take the first (task 134) ---
// JaFL refuses a sell whose matches are non-identical and asks the player to pick ("You have
// multiple ships of this type. Select one…" / "…which one you want to sell."). Taking the
// wrong one is irreversible — a laden ship is sold with its cargo, a quest weapon is gone —
// so we enumerate the matches safest-default first, let the view surface a picker for the
// ambiguous cases (sellPlan.needsChoice), and let headless callers name the exact one via
// opts.chooser.

const shipLoad = (s) => (s.cargo || []).length;
// A "least likely to matter" weight so the no-prompt default keeps the significant item:
// a plain possession outranks one bearing an ability, an <effect>, tags, or an award group.
const itemWeight = (it) => (it.ability ? 1 : 0) + ((it.effects || []).length ? 1 : 0) + ((it.tags || []).length ? 1 : 0) + (it.group ? 1 : 0);

/** Are two sale candidates interchangeable, so which one leaves makes no difference?
 *  Mirrors JaFL Item.matches (name+bonus+tags+group) for carried goods, and adds cargo
 *  load for ships (an empty and a laden vessel of one type are NOT the same sale). */
function sameCandidate(kind, a, b) {
  if (kind === 'ship') {
    return canonShipType(a.type) === canonShipType(b.type)
      && shipLoad(a) === shipLoad(b)
      && normalize(a.name || '') === normalize(b.name || '');
  }
  const tagSet = (it) => (it.tags || []).map(normalize).sort().join(' ');
  return normalize(a.name) === normalize(b.name)
    && (a.bonus || 0) === (b.bonus || 0)
    && (a.ability || null) === (b.ability || null)
    && (a.group || null) === (b.group || null)
    && tagSet(a) === tagSet(b);
}

/** The possessions a sell of `goods` could take, safest-default first. Ships/cargo need the
 *  vessel HERE (task 89). Bonus-valued armour/generic weapon rows draw from every owned item
 *  of that kind+bonus (plainest first); a named row from its name matches; cargo from the
 *  ships HERE carrying the commodity (emptier holds first). */
export function sellCandidates(state, goods) {
  const { kind, name, bonus, named, shipType, cargoName } = goods;
  if (kind === 'ship') {
    const type = canonShipType(shipType);
    return state.shipsHere().filter((s) => canonShipType(s.type) === type).sort((a, b) => shipLoad(a) - shipLoad(b));
  }
  if (kind === 'cargo') {
    const want = canonCargo(cargoName || name);
    return state.shipsHere().filter((s) => (s.cargo || []).some((c) => canonCargo(c) === want)).sort((a, b) => shipLoad(a) - shipLoad(b));
  }
  if (kind === 'armour' || (kind === 'weapon' && !named)) {
    return state.data.items.filter((it) => it.kind === kind && (it.bonus || 0) === bonus).sort((a, b) => itemWeight(a) - itemWeight(b));
  }
  return state.findItems(name);
}

/** What a sell needs from the view: the `kind`, the ordered `candidates`, and whether the
 *  player must be asked which one — more than one match and they are not all interchangeable
 *  (JaFL's "select which one"), or, for cargo, more than one ship carries it. (task 134) */
export function sellPlan(state, goods) {
  const cands = sellCandidates(state, goods);
  const needsChoice = goods.kind === 'cargo'
    ? cands.length > 1
    : cands.length > 1 && !cands.every((c) => sameCandidate(goods.kind, cands[0], c));
  return { kind: goods.kind, candidates: cands, needsChoice };
}

/** Sell `goods` for `price` in `currency` (Shards by default). Mutates state.
 *  Returns { ok, item? } — `item` is the possession actually removed (for a
 *  carried good), so the caller can fire <sold> hooks against its real tags/name
 *  rather than the shop row's descriptor (task 58). Ship/cargo sells carry no item.
 *  `opts.chooser(candidates, 1, kind)` names the exact possession when several match;
 *  with no chooser the sale takes the safest default (empty ship / plainest item). */
export function sellTrade(state, goods, price, currency = null, opts = {}) {
  const { kind, name, cargoName } = goods;
  const cands = sellCandidates(state, goods);
  if (!cands.length) return { ok: false };
  const pick = (opts.chooser && cands.length > 1) ? (opts.chooser(cands.slice(), 1, kind) || [])[0] : null;
  const target = pick || cands[0];
  if (kind === 'ship') {
    // Sell a vessel that is HERE — one berthed at another port can't change hands (task 89).
    state.ships.splice(state.ships.indexOf(target), 1); walletEarn(state, currency, price); state.changed();
  } else if (kind === 'cargo') {
    const want = canonCargo(cargoName || name);
    target.cargo.splice(target.cargo.findIndex((c) => canonCargo(c) === want), 1); walletEarn(state, currency, price); state.changed();
  } else {
    // Armour (any name) and generic weapons are valued by bonus; a named row by name.
    state.removeItemById(target.id); walletEarn(state, currency, price);
    return { ok: true, item: target };
  }
  return { ok: true };
}

/** Parse a <buy> node into the option bag applyInlineBuy consumes (task 152). The single
 *  home for buy-node parsing, shared by the inline-buy widget (render-market) and a
 *  group's forced buy (runBuyNode) so the two can't drift — both resolve the price against
 *  `state`, canonicalise an abbreviated cargo (task 127) and read |-alt buytags. Reads the
 *  parsed section node; builds no DOM. quantity= is the caller's concern. */
export function buyOptions(node, state) {
  const shards = node.getAttribute('shards');
  const cargo = node.getAttribute('cargo');
  return {
    price: shards != null ? resolveValue(state, shards) : 0,
    crew: node.getAttribute('crew'),
    ship: node.getAttribute('ship'),
    shipName: node.getAttribute('name'),
    initialCrew: node.getAttribute('initialCrew'),
    tool: node.getAttribute('tool'),
    item: node.getAttribute('item'),
    cargo: cargo != null ? canonCargo(cargo) : null,
    bonus: node.getAttribute('bonus') ? parseInt(node.getAttribute('bonus'), 10) : 0,
    ability: node.getAttribute('ability'),
    tags: parseTags(node.getAttribute('buytags') || node.getAttribute('tags')),
    effects: readItemEffects(node),
  };
}

/**
 * Apply an inline <buy> in prose: a crew upgrade, a ship, a tool, a carried
 * item, or a cargo unit. Charges `price`, grants one unit, and returns
 * { ok, note? } so the view can toast a refusal (no money / no room / no ship).
 * The view enforces the quantity= cap (max buys per visit).
 */
export function applyInlineBuy(state, opts = {}) {
  const { price = 0, crew, item, tool, ship: shipType, shipName, initialCrew,
    cargo, bonus = 0, ability = null, tags = [], effects = [] } = opts;
  if (price > 0 && state.data.shards < price) return { ok: false, note: 'Not enough Shards.' };

  if (crew) {
    const up = canUpgradeCrew(state, crew); // one-grade-at-a-time rule (task 34)
    if (!up.ok) return { ok: false, note: up.reason };
    if (price) state.adjustMoney(-price);
    state.currentShip().crew = canonCrew(crew);
    state.changed();
    return { ok: true };
  }
  if (shipType) {
    if (price) state.adjustMoney(-price);
    state.addShip({ type: canonShipType(shipType), name: shipName || 'Ship', crew: canonCrew(initialCrew, state), cargo: [], docked: state.data.location ?? null });
    return { ok: true };
  }
  if (cargo != null) {
    return buyTrade(state, { kind: 'cargo', cargoName: cargo, name: cargo }, price); // capacity checked there
  }
  // a carried possession: a tool (with its ability/bonus) or a plain item
  if (state.freeSlots() <= 0) return { ok: false, note: 'You can carry only 12 items.' };
  if (price) state.adjustMoney(-price);
  state.addItem(makeItem(tool ? 'tool' : 'item', tool || item, bonus || 0, ability || null, tags || [], effects || []));
  return { ok: true };
}

/** Whether a crew upgrade to `crew` is allowed right now: you have a ship and its
 *  crew is exactly one grade below the target (crews improve one grade at a time —
 *  task 24). Returns { ok, reason } so the view can gate/tooltip the offer and
 *  applyInlineBuy can enforce it. */
export function canUpgradeCrew(state, crew) {
  const ship = state.currentShip();
  if (!ship) return { ok: false, reason: 'You have no ship.' };
  const target = CREW_LEVELS.indexOf(canonCrew(crew));
  if (target < 0) return { ok: false, reason: 'Unknown crew grade.' };
  const have = CREW_LEVELS.indexOf(ship.crew);
  if (have === target - 1) return { ok: true };
  const reason = have >= target ? 'Your crew is already at least that good.'
    : `Your crew must be ${CREW_LEVELS[target - 1]} first.`;
  return { ok: false, reason };
}

/** Apply the cost of taking a paid <choice>: deduct its Shards (or foreign
 *  currency) and consume the required item, but only when the choice actually
 *  `pay`s (pay="t", or a bare shards= cost). The view reads the attributes; the
 *  transaction lives here (task 34). Returns { ok }: the cost is re-validated
 *  against the LIVE sheet before anything is taken, so a possession dropped (or
 *  funds spent) after the choice rendered can't cross for free — the caller
 *  blocks navigation and refreshes on { ok:false }. (task 133) */
export function payChoiceCost(state, { pay, cost = 0, currency = null, foreignCoin = false, item = null, itemTags = null }) {
  if (!pay) return { ok: true };
  const have = cost ? (foreignCoin ? state.currencyBalance(currency) : state.data.shards) : 0;
  if (cost && have < cost) return { ok: false };
  if (item != null && !state.hasItemMatch(item, itemTags)) return { ok: false };
  if (cost) { if (foreignCoin) state.adjustCurrency(currency, -cost); else state.adjustMoney(-cost); }
  if (item != null) { const it = state.findItems(item)[0]; if (it) state.removeItemById(it.id); }
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

/** Give up one Cargo Unit of `cargoType` (from a ship HERE carrying it — the hold
 *  must be present to trade from, task 89), optionally for `gain` Shards. The
 *  barter-reward side stays in the view. Returns { ok }. */
export function sellCargo(state, cargoType, gain) {
  const want = canonCargo(cargoType);
  const ship = state.shipsHere().find((s) => (s.cargo || []).some((c) => canonCargo(c) === want));
  if (!ship) return { ok: false };
  ship.cargo.splice(ship.cargo.findIndex((c) => canonCargo(c) === want), 1);
  if (gain) state.adjustMoney(gain);
  state.changed();
  return { ok: true };
}
