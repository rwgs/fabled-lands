// ui.js — reusable UI: dice animation, Adventure Sheet, modals, toasts.

import { ABILITIES, ABILITY_LABEL, rankTitle, ordinal, SHIP_TYPES, canonShipType } from './rules.js';

// ---- dice animation --------------------------------------------------------
export function animateDice(container, small = false) {
  if (typeof window !== 'undefined' && window.__FL_INSTANT_DICE__) return Promise.resolve();
  return new Promise((resolve) => {
    const anim = document.createElement('div');
    anim.className = 'dice-anim' + (small ? ' small' : '');
    const d1 = document.createElement('span'); d1.className = 'die rolling';
    const d2 = document.createElement('span'); d2.className = 'die rolling';
    anim.appendChild(d1); anim.appendChild(d2);
    // place it: for rolls the widget is cleared next render, so append temporarily
    const host = small ? container.querySelector('.fight-controls') || container : container;
    host.appendChild(anim);
    let ticks = 0;
    const iv = setInterval(() => {
      d1.textContent = 1 + Math.floor(Math.random() * 6);
      d2.textContent = 1 + Math.floor(Math.random() * 6);
      ticks++;
      if (ticks >= 8) {
        clearInterval(iv);
        anim.remove();
        resolve();
      }
    }, 70);
  });
}

// ---- toasts ----------------------------------------------------------------
let _toastHost = null;
function toastHost() {
  if (!_toastHost) {
    _toastHost = document.createElement('div');
    _toastHost.className = 'toast-host';
    document.body.appendChild(_toastHost);
  }
  return _toastHost;
}
export function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  toastHost().appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

// ---- modal -----------------------------------------------------------------
export function modal({ title, body, buttons = [{ label: 'OK', value: true }], dismissable = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal';
    if (title) { const h = document.createElement('h2'); h.textContent = title; box.appendChild(h); }
    const content = document.createElement('div');
    content.className = 'modal-body';
    if (typeof body === 'string') content.innerHTML = body; else if (body) content.appendChild(body);
    box.appendChild(content);
    const bar = document.createElement('div');
    bar.className = 'modal-buttons';
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' btn-primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => { document.body.removeChild(overlay); resolve(b.value); });
      bar.appendChild(btn);
    });
    box.appendChild(bar);
    overlay.appendChild(box);
    if (dismissable) overlay.addEventListener('click', (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } });
    document.body.appendChild(overlay);
  });
}

// ---- Adventure Sheet -------------------------------------------------------
export function renderSheet(state, container, opts = {}) {
  const d = state.data;
  const onUse = opts.onUse || null; // (item, effect) => void — fires a usable item effect (task 41)
  container.innerHTML = '';

  const head = el('div', 'sheet-head');
  head.appendChild(el('div', 'sheet-name', d.name));
  head.appendChild(el('div', 'sheet-sub', `${d.profession} · ${ordinal(d.rank)} Rank ${rankTitle(d.rank, d.gender === 'm')}`));
  container.appendChild(head);

  // Stamina bar
  const stam = el('div', 'stat-block');
  stam.appendChild(el('div', 'stat-label', 'Stamina'));
  const bar = el('div', 'stamina-bar');
  const maxStam = state.effectiveStaminaMax(); // reduced by a Stamina-cutting affliction (task 60)
  const pct = Math.max(0, Math.min(100, (d.stamina / Math.max(1, maxStam)) * 100));
  const fill = el('div', 'stamina-fill');
  fill.style.width = pct + '%';
  if (pct < 34) fill.classList.add('low');
  bar.appendChild(fill);
  const stamText = el('span', 'stamina-text', `${d.stamina} / ${maxStam}`);
  bar.appendChild(stamText);
  stam.appendChild(bar);
  container.appendChild(stam);

  // Abilities grid
  const grid = el('div', 'abilities');
  for (const ab of ABILITIES) {
    const cell = el('div', 'ability');
    const aff = state.ability(ab);
    const nat = state.abilityNatural(ab);
    cell.appendChild(el('span', 'ability-name', ABILITY_LABEL[ab]));
    const val = el('span', 'ability-val', String(aff));
    if (aff !== nat) { val.classList.add('boosted'); val.title = `base ${nat}`; }
    cell.appendChild(val);
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  // Defence & money
  const line = el('div', 'sheet-line');
  line.appendChild(kv('Defence', state.defence()));
  line.appendChild(kv('Shards', d.shards));
  container.appendChild(line);

  // Items
  container.appendChild(sectionTitle(`Possessions (${state.itemCount()}/12)`));
  const items = el('ul', 'item-list');
  if (!d.items.length) items.appendChild(el('li', 'empty', 'Nothing carried.'));
  d.items.forEach((it, idx) => {
    const li = el('li', 'item');
    let tag = '';
    if (it.kind === 'weapon') tag = ` (Combat +${it.bonus})`;
    else if (it.kind === 'armour') tag = ` (Defence +${it.bonus})`;
    else if (it.kind === 'tool' && it.ability) tag = ` (${ABILITY_LABEL[it.ability] || it.ability} +${it.bonus})`;
    const nm = el('span', 'item-txt', it.name + tag);
    if (it.wielded) nm.classList.add('wielded');
    if (it.worn) nm.classList.add('worn');
    li.appendChild(nm);

    // Use/Drink/Consult a usable item effect (potions, Vade Mecum) — task 41. Shown
    // while the effect has charges left (uses>0) or is reusable (uses=-1).
    if (onUse) {
      (it.effects || []).forEach((eff) => {
        if (eff.type !== 'use' || eff.uses === 0) return;
        const use = el('button', 'item-use', eff.verb || 'Use');
        use.title = eff.text || `${eff.verb || 'Use'} the ${it.name}`;
        use.addEventListener('click', () => onUse(it, eff));
        li.appendChild(use);
      });
    }

    // Reorder controls: the list order decides what a "possessions listed first"
    // theft (§521/§248) takes, so the player can move valuables down out of reach.
    const controls = el('span', 'item-controls');
    const up = el('button', 'item-move', '▲');
    up.title = 'Move up (taken first if robbed)';
    up.disabled = idx === 0;
    up.addEventListener('click', () => state.moveItem(it.id, -1));
    const down = el('button', 'item-move', '▼');
    down.title = 'Move down';
    down.disabled = idx === d.items.length - 1;
    down.addEventListener('click', () => state.moveItem(it.id, 1));
    const drop = el('button', 'item-drop', '✕');
    drop.title = 'Drop';
    drop.addEventListener('click', async () => {
      const ok = await modal({ title: 'Drop item?', body: `Drop <b>${escapeHtml(it.name)}</b>?`, buttons: [{ label: 'Cancel', value: false }, { label: 'Drop', value: true, primary: true }] });
      if (ok) state.removeItemById(it.id);
    });
    controls.appendChild(up);
    controls.appendChild(down);
    controls.appendChild(drop);
    li.appendChild(controls);
    items.appendChild(li);
  });
  container.appendChild(items);

  // Codewords
  const cws = Object.keys(d.codewords).filter((k) => !/^\d+\.\d/.test(k)); // hide internal box-codewords
  if (cws.length) {
    container.appendChild(sectionTitle('Codewords'));
    container.appendChild(chipList(cws.sort()));
  }

  if (d.blessings.length) { container.appendChild(sectionTitle('Blessings')); container.appendChild(chipList(d.blessings)); }
  // Afflictions chip by their own name (fall back to the type), and diseases/poisons
  // get their own sections — a hidden penalty must be visible on the sheet (task 57).
  const afflictionNames = (list) => list.map((a) => (a && (a.name || a.type)) || '').filter(Boolean);
  if (d.curses.length) { container.appendChild(sectionTitle('Curses')); container.appendChild(chipList(afflictionNames(d.curses))); }
  if (d.diseases.length) { container.appendChild(sectionTitle('Diseases')); container.appendChild(chipList(afflictionNames(d.diseases))); }
  if (d.poisons.length) { container.appendChild(sectionTitle('Poisons')); container.appendChild(chipList(afflictionNames(d.poisons))); }
  if (d.gods.length) { container.appendChild(sectionTitle('Gods')); container.appendChild(chipList(d.gods)); }
  if (d.titles.length) { container.appendChild(sectionTitle('Titles')); container.appendChild(chipList(d.titles.map((t) => t.name + (t.value ? ` (${t.value})` : '')))); }

  if (d.ships.length) {
    container.appendChild(sectionTitle('Ships'));
    const ul = el('ul', 'item-list');
    d.ships.forEach((s) => {
      const li = el('li', 'item');
      const type = canonShipType(s.type); // legacy saves may hold abbreviations (brig/gall)
      const cap = SHIP_TYPES[type]?.capacity ?? (s.cargo || []).length;
      const label = SHIP_TYPES[type]?.label || titleCase(type);
      const cargo = (s.cargo || []).map(titleCase).join(', ');
      const cargoTxt = `cargo ${(s.cargo || []).length}/${cap}${cargo ? `: ${cargo}` : ''}`;
      li.appendChild(el('span', 'item-txt', `${titleCase(s.name || type)} — ${label}, ${titleCase(s.crew)} crew · ${cargoTxt}`));
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  if (d.resurrections.length) {
    container.appendChild(sectionTitle('Resurrection'));
    container.appendChild(chipList(d.resurrections.map((r) => r.god ? `${r.god}` : `Book ${r.book} §${r.section}`)));
  }
}

// ---- helpers ---------------------------------------------------------------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function kv(k, v) { const c = el('div', 'kv'); c.appendChild(el('span', 'kv-k', k)); c.appendChild(el('span', 'kv-v', String(v))); return c; }
function sectionTitle(t) { return el('div', 'sheet-section-title', t); }
function chipList(arr) { const w = el('div', 'chips'); arr.forEach((x) => w.appendChild(el('span', 'chip', x))); return w; }
function titleCase(s) { return (s || '').replace(/\b\w/g, (c) => c.toUpperCase()); }
export function escapeHtml(s) { return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
