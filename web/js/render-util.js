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

// The parenthetical bonus tier shown after an item's name: " (Combat +2)" for a weapon,
// " (Defence +1)" for armour, " (Thievery +1)" for an ability tool, " (+N)" otherwise. Empty
// for a zero/absent bonus (a plain item shows just its name). The single canonical bonus-text
// builder — callers keep their OWN name casing (raw on the sheet, title-cased in shops/awards)
// and only fold in this suffix, so the wording and the omit-zero rule can't drift. (task 170)
export function bonusSuffix(kind, bonus, ability) {
  const b = Number(bonus) || 0;
  if (!b) return '';
  if (kind === 'weapon') return ` (Combat +${b})`;
  if (kind === 'armour') return ` (Defence +${b})`;
  if (kind === 'tool' && ability) return ` (${titleCase(ability)} +${b})`;
  return ` (+${b})`;
}

// A short display label for a stored item (name + its bonus tier, like an award).
export function itemLabel(it) {
  return titleCase(it.name || it.kind || 'item') + bonusSuffix(it.kind, it.bonus, it.ability);
}
