// data.js — loads the bundled book data and parses section XML into DOM trees.

const DATA_BASE = 'data/';

let _meta = null;
const _rawBooks = {};   // book number -> { "section": "<xml>" }
const _sectionCache = {}; // "book.section" -> Element
const _parser = new DOMParser();

export async function loadMeta() {
  if (_meta) return _meta;
  const res = await fetch(DATA_BASE + 'meta.json');
  if (!res.ok) throw new Error('Could not load meta.json');
  _meta = await res.json();
  return _meta;
}

export function getMeta() { return _meta; }

/** Which books actually have section data bundled. */
export function availableBooks() {
  return (_meta?.books || []).map((b) => b.number);
}

export function bookTitle(n) {
  return _meta?.titles?.[String(n)] || `Book ${n}`;
}

export function bookInfo(n) {
  return (_meta?.books || []).find((b) => b.number === Number(n)) || null;
}

export async function loadBook(n) {
  n = Number(n);
  if (_rawBooks[n]) return _rawBooks[n];
  const res = await fetch(`${DATA_BASE}book${n}.json`);
  if (!res.ok) throw new Error(`Book ${n} is not available in this edition.`);
  _rawBooks[n] = await res.json();
  return _rawBooks[n];
}

/** Parse an XML string into its root element. Falls back to HTML parsing on error. */
export function parseXml(xml) {
  const doc = _parser.parseFromString(xml, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) {
    console.warn('XML parse error; retrying as HTML fragment.', err.textContent?.slice(0, 200));
    const hdoc = _parser.parseFromString(xml, 'text/html');
    return hdoc.body.firstElementChild;
  }
  return doc.documentElement;
}

/** Returns the <section> element for the given book/section, or null if missing. */
export async function getSection(book, section) {
  const key = `${book}.${section}`;
  if (_sectionCache[key]) return _sectionCache[key];
  const raw = await loadBook(book);
  const xml = raw[String(section)];
  if (xml == null) return null;
  const el = parseXml(xml);
  _sectionCache[key] = el;
  return el;
}

export async function hasSection(book, section) {
  try {
    const raw = await loadBook(book);
    return raw[String(section)] != null;
  } catch {
    return false;
  }
}

/**
 * Parse a book's Adventurers.xml into structured starting data.
 * Returns { abilityOrder, professions:{Name:{ability:score}}, stamina, rank, gold,
 *           items:[...], pregens:[{name,profession,gender}] }
 */
export function parseAdventurers(xml) {
  if (!xml) return null;
  const root = parseXml(xml);
  const abilitiesEl = root.querySelector('abilities');
  const header = abilitiesEl?.querySelector('header')?.textContent.trim().toLowerCase().split(/\s+/) || [];
  const professions = {};
  abilitiesEl?.querySelectorAll('profession').forEach((p) => {
    const name = p.getAttribute('name');
    const scores = p.textContent.trim().split(/\s+/).map(Number);
    const map = {};
    header.forEach((ab, i) => { map[ab] = scores[i]; });
    professions[name] = map;
  });

  const num = (sel, attr, def) => {
    const el = root.querySelector(sel);
    if (!el) return def;
    const v = parseInt(el.getAttribute(attr), 10);
    return isNaN(v) ? def : v;
  };

  const items = [];
  root.querySelectorAll('items > *').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const prof = el.getAttribute('profession');
    items.push({
      kind: tag, // item | weapon | armour | tool
      name: el.getAttribute('name'),
      bonus: el.getAttribute('bonus') ? parseInt(el.getAttribute('bonus'), 10) : 0,
      ability: el.getAttribute('ability') || null,
      profession: prof || null,
    });
  });

  const pregens = [];
  root.querySelectorAll('starting > adventurer').forEach((a) => {
    pregens.push({
      name: a.getAttribute('name'),
      profession: a.getAttribute('profession'),
      gender: (a.getAttribute('gender') || 'm').toLowerCase().startsWith('m') ? 'm' : 'f',
    });
  });

  return {
    abilityOrder: header,
    professions,
    stamina: num('stamina', 'amount', 20),
    rank: num('rank', 'amount', 1),
    gold: num('gold', 'amount', 0),
    items,
    pregens,
  };
}
