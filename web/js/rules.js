// rules.js — static game constants for Fabled Lands.
// Character starting data is data-driven (parsed from each book's Adventurers.xml);
// this file only holds things that never change.

export const ABILITIES = ['charisma', 'combat', 'magic', 'sanctity', 'scouting', 'thievery'];

export const ABILITY_LABEL = {
  charisma: 'Charisma',
  combat: 'Combat',
  magic: 'Magic',
  sanctity: 'Sanctity',
  scouting: 'Scouting',
  thievery: 'Thievery',
};

export const ABILITY_BLURB = {
  charisma: 'the knack of befriending people',
  combat: 'the skill of fighting',
  magic: 'the art of casting spells',
  sanctity: 'the gift of divine power and wisdom',
  scouting: 'the techniques of tracking and wilderness lore',
  thievery: 'the talent for stealth and lockpicking',
};

export const PROFESSIONS = ['Priest', 'Mage', 'Rogue', 'Troubadour', 'Warrior', 'Wayfarer'];

export const ABILITY_MIN = 1;
export const ABILITY_MAX = 12;

// Rank titles (index 0 => 1st Rank). 11th Rank and above are "Hero/Heroine".
const RANK_TITLES = [
  ['Outcast', 'Outcast'],
  ['Commoner', 'Commoner'],
  ['Guildmember', 'Guildmember'],
  ['Master', 'Mistress'],
  ['Gentleman', 'Lady'],
  ['Baron', 'Baroness'],
  ['Count', 'Countess'],
  ['Earl', 'Viscountess'],
  ['Marquis', 'Marchioness'],
  ['Duke', 'Duchess'],
  ['Hero', 'Heroine'],
];

export function rankTitle(rank, male) {
  const idx = Math.min(Math.max(rank, 1), RANK_TITLES.length) - 1;
  const pair = RANK_TITLES[idx];
  return male ? pair[0] : pair[1];
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Ship types: capacity (cargo slots)
export const SHIP_TYPES = {
  barque: { label: 'Barque', capacity: 1 },
  brigantine: { label: 'Brigantine', capacity: 2 },
  galleon: { label: 'Galleon', capacity: 3 },
};

export const CREW_LEVELS = ['poor', 'average', 'good', 'excellent'];
export const CREW_LABEL = { poor: 'Poor', average: 'Average', good: 'Good', excellent: 'Excellent' };

export const MAX_ITEMS = 12;

export function clampAbility(v) {
  return Math.max(ABILITY_MIN, Math.min(ABILITY_MAX, v));
}
