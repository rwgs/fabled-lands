// app.js — bootstrap, screens, routing, character creation, death handling.

import * as data from './data.js';
import { GameState, loadSlotMeta, deleteSlot, nextFreeSlot } from './state.js';
import { ABILITIES, ABILITY_LABEL, ABILITY_BLURB, PROFESSIONS, rankTitle, ordinal } from './rules.js';
import { Story } from './render.js';
import { renderSheet, modal, toast, escapeHtml } from './ui.js';
import { VERSION } from './version.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let state = null;
let story = null;
let advData = {}; // book number -> parsed adventurers data

async function boot() {
  try { await data.loadMeta(); }
  catch (e) { $('#app').innerHTML = `<div class="fatal">Could not load game data.<br><small>${escapeHtml(String(e))}</small></div>`; return; }
  registerSW();
  // Deep-link / preview hook: ?demo=<book>.<section> starts a default Warrior at
  // that section (handy for testing and shareable previews).
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo) { startDemo(demo); return; }
  showTitle();
}

async function startDemo(spec) {
  const [b, s] = spec.split('.');
  const book = Number(b) || 1;
  const adv = await getAdvData(book);
  state = GameState.create({ name: 'Wanderer', gender: 'm', profession: 'Warrior', book, adv });
  state.slot = nextFreeSlot();
  buildGameScreen();
  await navigate(book, s || 1);
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

async function getAdvData(book) {
  if (advData[book]) return advData[book];
  const info = data.bookInfo(book);
  advData[book] = data.parseAdventurers(info?.adventurers);
  return advData[book];
}

// ---- Title screen ----------------------------------------------------------
function showTitle() {
  const slots = loadSlotMeta();
  const hasSaves = Object.keys(slots).length > 0;
  const app = $('#app');
  app.className = 'screen-title';
  app.innerHTML = '';

  const hero = el('div', 'title-hero');
  hero.appendChild(el('h1', 'game-title', 'Fabled Lands'));
  hero.appendChild(el('p', 'game-tagline', 'The greatest interactive gamebook series — reborn for the web.'));
  app.appendChild(hero);

  const menu = el('div', 'title-menu');
  const bNew = el('button', 'btn btn-primary btn-lg', 'New Adventure');
  bNew.addEventListener('click', showCreate);
  menu.appendChild(bNew);

  if (hasSaves) {
    const bCont = el('button', 'btn btn-lg', 'Continue');
    bCont.addEventListener('click', () => showSaves());
    menu.appendChild(bCont);
  }

  const bRules = el('button', 'btn btn-lg', 'Rules');
  bRules.addEventListener('click', showRules);
  menu.appendChild(bRules);

  const bMap = el('button', 'btn btn-lg', 'World Map');
  bMap.addEventListener('click', showMap);
  menu.appendChild(bMap);

  app.appendChild(menu);

  const credits = el('div', 'title-credits');
  credits.innerHTML = 'Book text © Dave Morris & Jamie Thomson. Original engine by Jonathan Mann.<br>A faithful web port. Progress is saved in your browser.';
  credits.appendChild(el('div', 'title-version', 'Version ' + VERSION));
  app.appendChild(credits);
}

// ---- Character creation ----------------------------------------------------
async function showCreate() {
  const app = $('#app');
  app.className = 'screen-create';
  app.innerHTML = '';
  const availBooks = data.availableBooks();
  let book = availBooks.includes(1) ? 1 : availBooks[0];
  let adv = await getAdvData(book);
  let profession = 'Warrior';
  let gender = 'm';

  const wrap = el('div', 'create-wrap');
  wrap.appendChild(el('h1', 'create-title', 'Create your Adventurer'));

  // starting book
  const bookRow = el('div', 'field');
  bookRow.appendChild(el('label', null, 'Starting book'));
  const bookSel = el('select', 'select');
  availBooks.forEach((n) => { const o = el('option', null, `Book ${n}: ${data.bookTitle(n)}`); o.value = n; bookSel.appendChild(o); });
  bookSel.value = book;
  bookRow.appendChild(bookSel);
  wrap.appendChild(bookRow);

  // name + gender
  const nameRow = el('div', 'field');
  nameRow.appendChild(el('label', null, 'Name'));
  const nameInput = el('input', 'input');
  nameInput.type = 'text'; nameInput.placeholder = 'Your adventurer’s name'; nameInput.maxLength = 40;
  nameRow.appendChild(nameInput);
  wrap.appendChild(nameRow);

  const genderRow = el('div', 'field');
  genderRow.appendChild(el('label', null, 'Gender'));
  const genderSel = el('select', 'select');
  ['m', 'f'].forEach((g) => { const o = el('option', null, g === 'm' ? 'Male' : 'Female'); o.value = g; genderSel.appendChild(o); });
  genderRow.appendChild(genderSel);
  wrap.appendChild(genderRow);

  // profession cards
  wrap.appendChild(el('div', 'field-label', 'Choose a profession'));
  const profGrid = el('div', 'prof-grid');
  wrap.appendChild(profGrid);

  const startBtn = el('button', 'btn btn-primary btn-lg', 'Begin Adventure');
  const backBtn = el('button', 'btn', 'Back');
  const btnRow = el('div', 'create-actions');
  btnRow.appendChild(backBtn); btnRow.appendChild(startBtn);
  wrap.appendChild(btnRow);
  app.appendChild(wrap);

  function drawProfs() {
    profGrid.innerHTML = '';
    for (const p of PROFESSIONS) {
      const scores = adv.professions[p] || {};
      const card = el('button', 'prof-card' + (p === profession ? ' selected' : ''));
      card.appendChild(el('div', 'prof-name', p));
      const statList = el('div', 'prof-stats');
      for (const ab of ABILITIES) {
        const s = el('span', 'prof-stat');
        s.innerHTML = `<i>${ABILITY_LABEL[ab].slice(0, 3)}</i>${scores[ab] ?? '-'}`;
        statList.appendChild(s);
      }
      card.appendChild(statList);
      card.addEventListener('click', () => { profession = p; drawProfs(); });
      profGrid.appendChild(card);
    }
    const info = el('div', 'prof-info');
    info.textContent = `Starts at ${ordinal(adv.rank)} Rank · ${adv.stamina} Stamina · ${adv.gold} Shards`;
    profGrid.appendChild(info);
  }
  drawProfs();

  bookSel.addEventListener('change', async () => { book = Number(bookSel.value); adv = await getAdvData(book); drawProfs(); });
  backBtn.addEventListener('click', showTitle);
  startBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim() || pickPregenName(adv, profession) || 'Adventurer';
    state = GameState.create({ name, gender: genderSel.value, profession, book, adv });
    state.slot = nextFreeSlot();
    state.save();
    startGame(1); // book start section
  });
}

function pickPregenName(adv, profession) {
  const p = (adv.pregens || []).find((x) => x.profession === profession);
  return p ? p.name : null;
}

// ---- Saves screen ----------------------------------------------------------
function showSaves() {
  const app = $('#app');
  app.className = 'screen-saves';
  app.innerHTML = '';
  const wrap = el('div', 'create-wrap');
  wrap.appendChild(el('h1', 'create-title', 'Your Adventurers'));
  const slots = loadSlotMeta();
  const list = el('div', 'save-list');
  const entries = Object.entries(slots).sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0));
  if (!entries.length) list.appendChild(el('div', 'empty', 'No saved games yet.'));
  entries.forEach(([slot, m]) => {
    const card = el('div', 'save-card');
    const info = el('div', 'save-info');
    info.appendChild(el('div', 'save-name', m.name));
    info.appendChild(el('div', 'save-sub', `${m.profession} · ${ordinal(m.rank)} Rank · ${data.bookTitle(m.book)} §${m.section ?? '—'}`));
    info.appendChild(el('div', 'save-date', new Date(m.updated || 0).toLocaleString()));
    card.appendChild(info);
    const btns = el('div', 'save-btns');
    const play = el('button', 'btn btn-primary', 'Play');
    play.addEventListener('click', () => { state = GameState.load(slot); if (state) { loadCurrent(); } });
    const del = el('button', 'btn btn-danger', 'Delete');
    del.addEventListener('click', async () => {
      const ok = await modal({ title: 'Delete save?', body: `Delete <b>${escapeHtml(m.name)}</b>? This cannot be undone.`, buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, primary: true }] });
      if (ok) { deleteSlot(slot); showSaves(); }
    });
    btns.appendChild(play); btns.appendChild(del);
    card.appendChild(btns);
    list.appendChild(card);
  });
  wrap.appendChild(list);
  const back = el('button', 'btn', 'Back'); back.addEventListener('click', showTitle);
  wrap.appendChild(back);
  app.appendChild(wrap);
}

// ---- Game screen -----------------------------------------------------------
function buildGameScreen() {
  const app = $('#app');
  app.className = 'screen-game';
  app.innerHTML = '';

  const header = el('header', 'game-header');
  const menuBtn = iconBtn('☰', 'Menu', showGameMenu);
  const title = el('div', 'header-title', 'Fabled Lands');
  const sheetBtn = iconBtn('📜', 'Adventure Sheet', () => toggleSheet());
  sheetBtn.classList.add('sheet-toggle');
  header.appendChild(menuBtn); header.appendChild(title); header.appendChild(sheetBtn);
  app.appendChild(header);

  const main = el('div', 'game-main');
  const storyPane = el('main', 'story-pane');
  const storyEl = el('article', 'story'); storyEl.id = 'story';
  storyPane.appendChild(storyEl);
  const sheetPane = el('aside', 'sheet-pane'); sheetPane.id = 'sheet-pane';
  main.appendChild(storyPane);
  main.appendChild(sheetPane);
  app.appendChild(main);

  const backdrop = el('div', 'sheet-backdrop'); backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', () => toggleSheet(false));
  app.appendChild(backdrop);

  story = new Story(storyEl, state, {
    navigate: (book, section) => navigate(book, section),
    onDeath: handleDeath,
    notify: (msg, type) => toast(msg, type),
  });

  state.onChange(() => refreshSheet());
  refreshSheet();
}

function iconBtn(glyph, title, fn) { const b = el('button', 'icon-btn', glyph); b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', fn); return b; }

function refreshSheet() {
  const pane = $('#sheet-pane');
  if (pane && state) renderSheet(state, pane);
}

function toggleSheet(force) {
  const open = force == null ? !document.body.classList.contains('sheet-open') : force;
  document.body.classList.toggle('sheet-open', open);
}

async function navigate(book, section) {
  book = Number(book);
  const sectionEl = await data.getSection(book, section);
  if (!sectionEl) {
    toast(`Section ${section} not found in Book ${book}.`, 'warn');
    return;
  }
  state.goTo(book, section);
  state.snapshot(); // entry state for this section (before its effects run) — enables undo
  story.state = state;
  story.begin(sectionEl, book, section);
  const pane = $('.story-pane'); if (pane) pane.scrollTop = 0;
  window.scrollTo(0, 0);
}

async function undo() {
  const target = state.undo();
  if (!target) { toast('Nothing to undo.', 'warn'); return; }
  deathShown = false;
  const el = await data.getSection(target.book, target.section);
  if (!el) { toast('Could not undo.', 'warn'); return; }
  story.state = state;
  story.begin(el, target.book, target.section); // re-applies that section's effects from restored state
  const pane = $('.story-pane'); if (pane) pane.scrollTop = 0;
  window.scrollTo(0, 0);
}

async function startGame(section) {
  buildGameScreen();
  await navigate(state.data.book, section);
}

async function loadCurrent() {
  buildGameScreen();
  const sec = state.data.section;
  if (sec == null) { await navigate(state.data.book, 1); }
  else {
    const sectionEl = await data.getSection(state.data.book, sec);
    if (!sectionEl) { await navigate(state.data.book, 1); return; }
    state.snapshot(); // baseline entry state for undo after a load
    story.begin(sectionEl, state.data.book, sec);
  }
}

// ---- Death & resurrection --------------------------------------------------
let deathShown = false;
async function handleDeath() {
  if (deathShown) return;
  deathShown = true;
  const res = state.data.resurrections[0];
  const canUndo = state.canUndo();
  const buttons = [];
  if (res) buttons.push({ label: 'Use resurrection', value: 'res', primary: true });
  if (canUndo) buttons.push({ label: 'Undo last move', value: 'undo', primary: !res });
  buttons.push({ label: 'Load a game', value: 'load' });
  buttons.push({ label: 'New adventure', value: 'new' });
  const body = res
    ? `Your Stamina has fallen to zero. But you arranged a resurrection deal${res.god ? ` with ${escapeHtml(res.god)}` : ''}…`
    : 'Your Stamina has fallen to zero.' + (canUndo ? ' You can undo your last move, or your adventure ends here.' : ' Your adventure ends here.');
  const choice = await modal({ title: 'You have died', body, buttons, dismissable: false });
  deathShown = false;
  if (choice === 'res' && res) {
    state.data.resurrections.shift();
    state.data.stamina = Math.max(1, Math.floor(state.data.staminaMax / 2));
    state.changed();
    navigate(res.book, res.section);
  } else if (choice === 'undo') { undo(); }
  else if (choice === 'load') { showSaves(); }
  else { showCreate(); }
}

// ---- Game menu -------------------------------------------------------------
async function showGameMenu() {
  const body = el('div', 'menu-list');
  const add = (label, fn) => { const b = el('button', 'btn btn-block', label); b.addEventListener('click', () => { close(); fn(); }); body.appendChild(b); };
  let close = () => {};
  add('Continue playing', () => {});
  add('Undo last move', () => undo());
  add('Rules', () => showRules(true));
  add('World Map', () => showMap(true));
  add('Save & quit to title', () => { state.save(); showTitle(); });
  const ver = el('div', 'menu-version', 'Version ' + VERSION);
  body.appendChild(ver);
  const p = modal({ title: 'Menu', body, buttons: [{ label: 'Close', value: null }] });
  close = () => { const ov = document.querySelector('.modal-overlay'); if (ov) ov.remove(); };
  await p;
}

// ---- Rules & Map -----------------------------------------------------------
function showRules(fromGame) {
  const meta = data.getMeta();
  const body = el('div', 'static-doc');
  body.appendChild(renderStatic(meta.rules || meta.quickRules));
  modal({ title: 'Rules of the Fabled Lands', body, buttons: [{ label: 'Close', value: null }] });
}

function showMap(fromGame) {
  const body = el('div', 'map-box');
  const img = el('img', 'world-map');
  img.src = 'assets/world-map.jpg';
  img.alt = 'World map of the Fabled Lands';
  img.onerror = () => { body.innerHTML = '<p>Map image not available.</p>'; };
  body.appendChild(img);
  modal({ title: 'The Fabled Lands', body, buttons: [{ label: 'Close', value: null }] });
}

// Minimal read-only renderer for the rules section XML.
function renderStatic(xml) {
  const wrap = el('div');
  if (!xml) { wrap.textContent = 'Rules unavailable.'; return wrap; }
  const root = data.parseXml(xml);
  const walk = (node, parent) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) { const t = n.nodeValue.replace(/\s+/g, ' '); if (t.trim()) parent.appendChild(document.createTextNode(t)); return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const tag = n.tagName.toLowerCase();
      if (tag === 'p') { const p = el('p'); walk(n, p); parent.appendChild(p); }
      else if (/^h[1-6]$/.test(tag)) { const h = el(tag); walk(n, h); parent.appendChild(h); }
      else if (tag === 'b') { const b = el('strong'); walk(n, b); parent.appendChild(b); }
      else if (tag === 'i') { const i = el('em'); walk(n, i); parent.appendChild(i); }
      else if (tag === 'table') { const t = el('table', 'book-table'); walk(n, t); parent.appendChild(t); }
      else if (tag === 'tr') { const r = el('tr'); walk(n, r); parent.appendChild(r); }
      else if (tag === 'td') { const d = el('td'); walk(n, d); parent.appendChild(d); }
      else if (/^h[1-6]$/.test(tag)) { const c = el('th'); walk(n, c); parent.appendChild(c); }
      else walk(n, parent);
    });
  };
  walk(root, wrap);
  return wrap;
}

boot();
