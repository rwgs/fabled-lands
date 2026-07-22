// ui.js — reusable UI: dice animation, Adventure Sheet, modals, toasts.

import { ABILITIES, ABILITY_LABEL, rankTitle, ordinal, SHIP_TYPES, canonShipType } from './rules.js';
import { parseXml } from './data.js';
// The canonical string/label helpers live in the dependency-free render-util (task 170), so the
// sheet/shell and the view modules share one titleCase/escapeHtml/bonus-text implementation
// instead of drifting copies. escapeHtml is re-exported for app.js, which imports it from here.
import { titleCase, escapeHtml, bonusSuffix } from './render-util.js';
export { escapeHtml };

// ---- dice animation --------------------------------------------------------
export function animateDice(container, small = false) {
  if (typeof window !== 'undefined') {
    if (window.__FL_INSTANT_DICE__) return Promise.resolve();
    // Test seam (task 146): a hook returning a promise the test controls, so it can
    // hold the animation open, swap the visit out, then release — proving a pending
    // roll/attack result is dropped rather than landing on the new section.
    if (typeof window.__FL_DICE_GATE__ === 'function') return window.__FL_DICE_GATE__();
  }
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

// Disable every button under `container` for the duration of a dice animation (task 146).
// A roll/attack awaits the ~0.5s animation before it runs; without this a still-live
// nav/choice elsewhere in the pane could be clicked in that window, swapping the visit
// out from under the pending result. The next render rebuilds the pane, re-enabling
// whatever should be live, so this needs no explicit undo.
export function freezeButtons(container) {
  if (!container) return;
  container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
}

// ---- toasts ----------------------------------------------------------------
let _toastHost = null;
function toastHost() {
  if (!_toastHost) {
    _toastHost = document.createElement('div');
    _toastHost.className = 'toast-host';
    _toastHost.setAttribute('aria-live', 'polite'); // announce toasts (codeword gained, save failed…) to screen readers (task 153)
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
// The one focusable-selector both the trap and every caller share.
const DIALOG_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared dialog shell (task 177): mount an already-built `box` in a full-screen overlay and
// give EVERY dialog one contract — a labelled role="dialog", focus moved in and later
// RESTORED to the element that opened it, sequential focus trapped inside the dialog
// (Tab/Shift+Tab wrap), and the rest of the page frozen from pointer + assistive tech
// (inert + aria-hidden) while it is up. Returns { overlay, box, close }. `close()` runs
// exactly once: it drops the key listener, un-freezes the background it froze, removes the
// overlay, restores focus, then fires the optional onClose. When dismissable, Escape and a
// backdrop click both call close(); the caller owns what its buttons do (a control that must
// stay open — the oracle's "Reveal another" — simply never calls close). ui.js stays a small
// helper, not a framework: this is the whole contract.
export function mountDialog(box, { label = null, dismissable = true, initialFocus = null, onClose = null } = {}) {
  // Remember who to hand focus back to; ignore <body> (nothing was really focused).
  const opener = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  if (label) box.setAttribute('aria-label', label);
  if (!box.hasAttribute('tabindex')) box.setAttribute('tabindex', '-1'); // focus fallback when the box has no controls
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Freeze + hide everything behind the dialog. Skip anything already inert (a dialog opened
  // underneath) so close() only ever clears what THIS mount set.
  const frozen = [];
  for (const sib of Array.from(document.body.children)) {
    if (sib === overlay || sib.hasAttribute('inert')) continue;
    sib.setAttribute('inert', '');
    sib.setAttribute('aria-hidden', 'true');
    frozen.push(sib);
  }

  let closed = false;
  function close() {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    for (const sib of frozen) { sib.removeAttribute('inert'); sib.removeAttribute('aria-hidden'); }
    if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
    if (onClose) onClose();
  }
  // Capture phase so we intercept Tab/Escape before any background/global handler; inert on
  // the background stops pointer/AT reach, but document-level key listeners still fire, so the
  // trap is what actually keeps sequential focus inside the topmost dialog.
  function onKey(e) {
    if (e.key === 'Escape') { if (dismissable) { e.preventDefault(); close(); } return; }
    if (e.key !== 'Tab') return;
    const items = Array.from(box.querySelectorAll(DIALOG_FOCUSABLE));
    if (!items.length) { e.preventDefault(); box.focus(); return; }
    const first = items[0], last = items[items.length - 1], active = document.activeElement;
    if (e.shiftKey) { if (active === first || !box.contains(active)) { e.preventDefault(); last.focus(); } }
    else if (active === last || !box.contains(active)) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey, true);
  if (dismissable) overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  (initialFocus || box).focus();
  return { overlay, box, close };
}

export function modal({ title, body, buttons = [{ label: 'OK', value: true }], dismissable = true }) {
  let settle = () => {};
  const p = new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'modal';
    if (title) { const h = document.createElement('h2'); h.textContent = title; box.appendChild(h); }
    const content = document.createElement('div');
    content.className = 'modal-body';
    if (typeof body === 'string') content.innerHTML = body; else if (body) content.appendChild(body);
    box.appendChild(content);
    const bar = document.createElement('div');
    bar.className = 'modal-buttons';
    box.appendChild(bar);
    // The action that closes the dialog decides the resolved value; dismissal (Escape/backdrop)
    // leaves it null. mountDialog runs the shared teardown + focus restore, then onClose settles
    // the promise exactly once.
    let result = null;
    let close = () => {};
    let primaryBtn = null;
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' btn-primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => { result = b.value; close(); });
      if (b.primary && !primaryBtn) primaryBtn = btn;
      bar.appendChild(btn);
    });
    const shell = mountDialog(box, {
      label: title || null,
      dismissable,
      initialFocus: primaryBtn || bar.querySelector('button'),
      onClose: () => resolve(result),
    });
    close = shell.close;
    // Programmatic close: settle with a value AND tear down (tasks 152, 153).
    settle = (value = null) => { result = value; shell.close(); };
  });
  p.close = (value = null) => settle(value);
  return p;
}

// ---- Adventure Sheet -------------------------------------------------------
export function renderSheet(state, container, opts = {}) {
  const d = state.data;
  const onUse = opts.onUse || null; // (item, effect) => void — fires a usable item effect (task 41)
  // Fired after a sheet-initiated mutation (drop/move/lift) so the caller can rerender the
  // story pane — otherwise an item-/curse-gated choice stays live after its gate is gone
  // (state.onChange only refreshes THIS sheet, never the story). (task 133)
  const onSheetChange = typeof opts.onSheetChange === 'function' ? opts.onSheetChange : () => {};
  container.innerHTML = '';

  const head = el('div', 'sheet-head');
  head.appendChild(el('div', 'sheet-name', d.name));
  const rankVal = state.rankValue(); // effective Rank, incl. the ring of ultimate power's +2 (task 44)
  head.appendChild(el('div', 'sheet-sub', `${d.profession} · ${ordinal(rankVal)} Rank ${rankTitle(rankVal, d.gender === 'm')}`));
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
  // Foreign-currency purses (Mithral etc. — task 40) surface beside Shards, else
  // coin won in an alternate-currency market is invisible until the player happens
  // into the next same-currency widget (task 139). Only non-zero balances show.
  for (const [name, amount] of Object.entries(d.currencies || {})) {
    if (amount > 0) line.appendChild(kv(name, amount));
  }
  container.appendChild(line);

  // Items
  container.appendChild(sectionTitle(`Possessions (${state.itemCount()}/12)`));
  const items = el('ul', 'item-list');
  if (!d.items.length) items.appendChild(el('li', 'empty', 'Nothing carried.'));
  d.items.forEach((it, idx) => {
    const li = el('li', 'item');
    const nm = el('span', 'item-txt', it.name + bonusSuffix(it.kind, it.bonus, it.ability));
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
    up.addEventListener('click', () => { state.moveItem(it.id, -1); onSheetChange(); });
    const down = el('button', 'item-move', '▼');
    down.title = 'Move down';
    down.disabled = idx === d.items.length - 1;
    down.addEventListener('click', () => { state.moveItem(it.id, 1); onSheetChange(); });
    const drop = el('button', 'item-drop', '✕');
    drop.title = 'Drop';
    drop.addEventListener('click', async () => {
      const ok = await modal({ title: 'Drop item?', body: `Drop <b>${escapeHtml(it.name)}</b>?`, buttons: [{ label: 'Cancel', value: false }, { label: 'Drop', value: true, primary: true }] });
      if (ok) { state.removeItemById(it.id); onSheetChange(); }
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

  if (d.blessings.length) {
    // Mark a permanent blessing (book6/159 Safety from Storms) so it reads distinctly
    // from an ordinary, single-use one. (task 76)
    const canonB = (b) => { const k = String(b).trim().toLowerCase(); return k === 'storms' ? 'storm' : k; };
    const perm = new Set((d.permanentBlessings || []).map(canonB));
    container.appendChild(sectionTitle('Blessings'));
    container.appendChild(chipList(d.blessings.map((b) => perm.has(canonB(b)) ? `${b} (permanent)` : b)));
  }
  // Afflictions chip by their own name (fall back to the type), and diseases/poisons
  // get their own sections — a hidden penalty must be visible on the sheet (task 57).
  const afflictionNames = (list) => list.map((a) => (a && (a.name || a.type)) || '').filter(Boolean);
  if (d.curses.length) { container.appendChild(sectionTitle('Curses')); container.appendChild(curseChips(d.curses, state, onSheetChange)); }
  if (d.diseases.length) { container.appendChild(sectionTitle('Diseases')); container.appendChild(chipList(afflictionNames(d.diseases))); }
  if (d.poisons.length) { container.appendChild(sectionTitle('Poisons')); container.appendChild(chipList(afflictionNames(d.poisons))); }
  if (d.gods.length) { container.appendChild(sectionTitle('Gods')); container.appendChild(chipList(d.gods)); }
  if (d.titles.length) {
    // A patterned title renders its format with {0}=value ("Circle 2 Master of bokh");
    // a plain title shows its name and any count. (task 75)
    const titleLabel = (t) => t.pattern ? t.pattern.replace('{0}', t.value) : t.name + (t.value ? ` (${t.value})` : '');
    container.appendChild(sectionTitle('Titles'));
    container.appendChild(chipList(d.titles.map(titleLabel)));
  }

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
      const where = s.docked ? `docked at ${titleCase(s.docked)}` : 'at large'; // (task 73)
      li.appendChild(el('span', 'item-txt', `${titleCase(s.name || type)} — ${label}, ${titleCase(s.crew)} crew · ${where} · ${cargoTxt}`));
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  if (d.resurrections.length) {
    container.appendChild(sectionTitle('Resurrection'));
    container.appendChild(chipList(d.resurrections.map((r) => r.god ? `${r.god}` : `Book ${r.book} §${r.section}`)));
  }
}

// Minimal read-only renderer for the rules section XML — used by the rules modal (app.js)
// and exercised directly by the headless tests. Lives here (an import-safe UI module) rather
// than in app.js, so no caller needs the side-effectful app entry module for it. (tasks 65, 164)
export function renderStatic(xml) {
  const wrap = el('div');
  if (!xml) { wrap.textContent = 'Rules unavailable.'; return wrap; }
  const root = parseXml(xml);
  const walk = (node, parent) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) { const t = n.nodeValue.replace(/\s+/g, ' '); if (t.trim()) parent.appendChild(document.createTextNode(t)); return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const tag = n.tagName.toLowerCase();
      if (tag === 'p') { const p = el('p'); walk(n, p); parent.appendChild(p); }
      else if (/^h[1-6]$/.test(tag)) {
        // A heading that is a direct child of a <tr> is a spanning header cell —
        // rendering it as <hN> would nest a heading illegally in the row
        // (rules/QuickRules.xml: <tr><h3>Quick Rules</h3></tr>). Emit a <th> that
        // spans the table's widest row; outside a table it stays a real heading. (task 65)
        if (parent.tagName === 'TR') {
          const th = el('th');
          let cols = 1;
          const srcTable = n.closest && n.closest('table');
          if (srcTable) srcTable.querySelectorAll('tr').forEach((tr) => { const c = tr.querySelectorAll('td, th').length; if (c > cols) cols = c; });
          if (cols > 1) th.colSpan = cols;
          walk(n, th); parent.appendChild(th);
        } else { const h = el(tag); walk(n, h); parent.appendChild(h); }
      }
      else if (tag === 'b') { const b = el('strong'); walk(n, b); parent.appendChild(b); }
      else if (tag === 'i') { const i = el('em'); walk(n, i); parent.appendChild(i); }
      else if (tag === 'table') { const t = el('table', 'book-table'); walk(n, t); parent.appendChild(t); }
      else if (tag === 'tr') { const r = el('tr'); walk(n, r); parent.appendChild(r); }
      else if (tag === 'td') { const d = el('td'); walk(n, d); parent.appendChild(d); }
      else walk(n, parent);
    });
  };
  walk(root, wrap);
  return wrap;
}

// ---- helpers ---------------------------------------------------------------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function kv(k, v) { const c = el('div', 'kv'); c.appendChild(el('span', 'kv-k', k)); c.appendChild(el('span', 'kv-v', String(v))); return c; }
function sectionTitle(t) { return el('div', 'sheet-section-title', t); }
function chipList(arr) { const w = el('div', 'chips'); arr.forEach((x) => w.appendChild(el('span', 'chip', x))); return w; }
// Curses chip like other afflictions, but a curse carrying a lift= question (its
// self-cure condition — §5.505 Skunk-juice's "Are you at a river, village, town or
// city?") also gets a keyboard/touch-accessible "Lift…" action: it shows the exact
// stored question, and an honest "Yes" removes that one curse (its ability effect
// falls away, restoring the score). A curse without lift= stays inert text. (task 112)
function curseChips(curses, state, onSheetChange = () => {}) {
  const w = el('div', 'chips');
  curses.forEach((c) => {
    const name = (c && (c.name || c.type)) || '';
    if (!name) return;
    const chip = el('span', 'chip', name);
    if (c.lift) {
      chip.classList.add('chip-liftable');
      const btn = el('button', 'chip-action', 'Lift…');
      btn.type = 'button';
      btn.title = c.lift;
      btn.setAttribute('aria-label', `Lift the curse ${name}`);
      btn.addEventListener('click', () => {
        modal({
          title: `Lift ${name}?`,
          body: `<p>${escapeHtml(c.lift)}</p>`,
          buttons: [{ label: 'Yes', value: true, primary: true }, { label: 'No', value: null }],
        }).then((yes) => { if (yes) { state.removeCurse(c.name || c.type); onSheetChange(); } });
      });
      chip.appendChild(btn);
    }
    w.appendChild(chip);
  });
  return w;
}
