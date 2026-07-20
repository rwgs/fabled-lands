// render-util.js — small, dependency-free display helpers shared by the renderer and
// its responsibility-split view modules (task 119). Kept separate so a view module
// (render-combat/market/actions) can import these without importing render.js, which
// would create a cycle. Pure string/label formatting — no DOM, no state.

// Column titles for a <market>'s <header type="…"> dividers.
export const MARKET_TITLES = {
  ship: 'Ships for sale', shipsale: 'Sell a ship', cargo: 'Cargo', armour: 'Armour',
  weapon: 'Weapons', magic: 'Magical equipment', other: 'Goods for sale',
};

export function titleCase(s) { return (s || '').replace(/\b\w/g, (c) => c.toUpperCase()); }

export function diceWord(n) { return n === 1 ? '1 die' : `${n} dice`; }

export function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// A short display label for a stored item (name + its bonus tier, like an award).
export function itemLabel(it) {
  const name = titleCase(it.name || it.kind || 'item');
  if (it.kind === 'weapon' && it.bonus) return `${name} (Combat +${it.bonus})`;
  if (it.kind === 'armour' && it.bonus) return `${name} (Defence +${it.bonus})`;
  if (it.kind === 'tool' && it.bonus && it.ability) return `${name} (${titleCase(it.ability)} +${it.bonus})`;
  return it.bonus ? `${name} (+${it.bonus})` : name;
}
