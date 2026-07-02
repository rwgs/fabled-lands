// app.js — bootstrap, screens, routing, character creation, death handling.

import * as data from './data.js';
import { GameState, loadSlotMeta, deleteSlot, nextFreeSlot, readSlotData, importSave } from './state.js';
import { ABILITIES, ABILITY_LABEL, ABILITY_BLURB, PROFESSIONS, rankTitle, ordinal } from './rules.js';
import { Story } from './render.js';
import { renderSheet, modal, toast, escapeHtml } from './ui.js';
import { VERSION } from './version.js';
import { Narrator } from './tts.js'; // [TTS] optional narration — remove this + the [TTS] hooks below to drop the feature

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let state = null;
let story = null;
let advData = {}; // book number -> parsed adventurers data
const narrator = new Narrator(); // [TTS]
let narrateBtn = null;           // [TTS]
const currentFlow = () => document.querySelector('#story .flow'); // [TTS]

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
  const adv = data.parseAdventurers(info?.adventurers) || {};
  // Prefer the build's structured pregens (they carry each character's bio);
  // fall back to whatever parseAdventurers pulled from the <starting> block.
  if (info?.pregens?.length) adv.pregens = info.pregens;
  advData[book] = adv;
  return advData[book];
}

// Attribution + licence (mirrors the README), shown on the title screen and in
// the in-game menu. Returns inner HTML; the container styles it per context.
function creditsHtml() {
  return (
    'Book text © <strong>Dave Morris &amp; Jamie Thomson</strong>, 1996.<br>' +
    'Illustrations © <strong>Russ Nicholson</strong>.<br>' +
    'Original <em>Java Fabled Lands</em> engine © <strong>Jonathan Mann</strong> (used here as the rules reference).' +
    '<p class="credits-licence">This web port automates the published rules for personal play. ' +
    '<em>Fabled Lands</em> and its text/artwork remain the property of their respective rights holders; ' +
    'please support the official releases.</p>'
  );
}

// ---- Title screen ----------------------------------------------------------
function showTitle() {
  narrator.stop(); // [TTS]
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

  const bImport = el('button', 'btn btn-lg', 'Import save…');
  bImport.addEventListener('click', () => importSaveFile(() => showSaves()));
  menu.appendChild(bImport);

  const bRules = el('button', 'btn btn-lg', 'Rules');
  bRules.addEventListener('click', showRules);
  menu.appendChild(bRules);

  const bMap = el('button', 'btn btn-lg', 'Maps');
  bMap.addEventListener('click', () => showMaps(null));
  menu.appendChild(bMap);

  app.appendChild(menu);

  const credits = el('div', 'title-credits');
  credits.innerHTML = creditsHtml() + '<div class="title-note">Progress is saved in your browser.</div>';
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
  let nameEdited = false;    // true once the player types their own name
  let genderEdited = false;  // true once the player picks a gender by hand

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

  // ready-made character (name + bio) for the chosen profession
  const detail = el('div', 'prof-detail');
  wrap.appendChild(detail);

  const startBtn = el('button', 'btn btn-primary btn-lg', 'Begin Adventure');
  const backBtn = el('button', 'btn', 'Back');
  const btnRow = el('div', 'create-actions');
  btnRow.appendChild(backBtn); btnRow.appendChild(startBtn);
  wrap.appendChild(btnRow);
  app.appendChild(wrap);

  const pregenFor = (p) => (adv.pregens || []).find((x) => x.profession === p) || null;

  function drawProfs() {
    profGrid.innerHTML = '';
    for (const p of PROFESSIONS) {
      const scores = adv.professions[p] || {};
      const card = el('button', 'prof-card' + (p === profession ? ' selected' : ''));
      card.appendChild(el('div', 'prof-name', p));
      const statList = el('div', 'prof-stats');
      for (const ab of ABILITIES) {
        const s = el('span', 'prof-stat');
        s.innerHTML = `<i>${ABILITY_LABEL[ab]}</i>${scores[ab] ?? '-'}`;
        statList.appendChild(s);
      }
      card.appendChild(statList);
      card.addEventListener('click', () => selectProfession(p));
      profGrid.appendChild(card);
    }
    const info = el('div', 'prof-info');
    info.textContent = `Starts at ${ordinal(adv.rank)} Rank · ${adv.stamina} Stamina · ${adv.gold} Shards`;
    profGrid.appendChild(info);
  }

  function renderDetail() {
    const pg = pregenFor(profession);
    detail.innerHTML = '';
    if (!pg) { detail.hidden = true; return; }
    detail.hidden = false;
    detail.appendChild(el('div', 'prof-detail-name', pg.name));
    if (pg.bio) detail.appendChild(el('p', 'prof-detail-bio', pg.bio));
    const typed = nameInput.value.trim();
    detail.appendChild(el('p', 'prof-detail-hint',
      (nameEdited && typed)
        ? `You’ll play as ${typed}, a ${profession.toLowerCase()}.`
        : `Play as ${pg.name}, or type your own name above.`));
  }

  // Fill in the ready-made character's name/gender for the current profession,
  // without clobbering a name or gender the player has already set by hand.
  function applyDefaults() {
    const pg = pregenFor(profession);
    if (!pg) return;
    if (!nameEdited) nameInput.value = pg.name;
    if (!genderEdited) genderSel.value = pg.gender;
  }

  function selectProfession(p) {
    profession = p;
    applyDefaults();
    drawProfs();
    renderDetail();
  }

  nameInput.addEventListener('input', () => {
    nameEdited = nameInput.value.trim().length > 0; // cleared field → defaults resume
    renderDetail();
  });
  genderSel.addEventListener('change', () => { genderEdited = true; });

  selectProfession(profession); // initial cards + defaults + bio

  bookSel.addEventListener('change', async () => {
    book = Number(bookSel.value);
    adv = await getAdvData(book);
    applyDefaults(); // refresh defaults for the new book (respects manual edits)
    drawProfs();
    renderDetail();
  });
  backBtn.addEventListener('click', showTitle);
  startBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim() || pregenFor(profession)?.name || 'Adventurer';
    state = GameState.create({ name, gender: genderSel.value, profession, book, adv });
    state.slot = nextFreeSlot();
    state.save();
    startGame(1); // book start section
  });
}

// ---- Save import / export --------------------------------------------------
function sanitizeFilename(s) { return (s || 'adventurer').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'adventurer'; }

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportSave(slot, meta) {
  const dataObj = slot != null ? readSlotData(slot) : (state && state.data);
  if (!dataObj) { toast('Nothing to export.', 'warn'); return; }
  const name = sanitizeFilename((meta && meta.name) || dataObj.name);
  const d = new Date(dataObj.updated || Date.now());
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  downloadJson(`fabled-lands-${name}-${stamp}.json`, dataObj);
}

function importSaveFile(after) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { meta } = importSave(JSON.parse(String(reader.result)));
        toast(`Imported “${meta.name}”.`);
        after && after();
      } catch (e) {
        modal({ title: 'Import failed', body: escapeHtml(e && e.message ? e.message : String(e)), buttons: [{ label: 'OK', value: null, primary: true }] });
      }
    };
    reader.readAsText(file);
  });
  input.click();
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
    const exp = el('button', 'btn', 'Export');
    exp.title = 'Download this save as a file';
    exp.addEventListener('click', () => exportSave(slot, m));
    const del = el('button', 'btn btn-danger', 'Delete');
    del.addEventListener('click', async () => {
      const ok = await modal({ title: 'Delete save?', body: `Delete <b>${escapeHtml(m.name)}</b>? This cannot be undone.`, buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, primary: true }] });
      if (ok) { deleteSlot(slot); showSaves(); }
    });
    btns.appendChild(play); btns.appendChild(exp); btns.appendChild(del);
    card.appendChild(btns);
    list.appendChild(card);
  });
  wrap.appendChild(list);
  const actions = el('div', 'create-actions');
  const back = el('button', 'btn', 'Back'); back.addEventListener('click', showTitle);
  const imp = el('button', 'btn btn-primary', 'Import save…'); imp.addEventListener('click', () => importSaveFile(showSaves));
  actions.appendChild(back); actions.appendChild(imp);
  wrap.appendChild(actions);
  app.appendChild(wrap);
}

// ---- Game screen -----------------------------------------------------------
function buildGameScreen() {
  const app = $('#app');
  app.className = 'screen-game';
  app.innerHTML = '';

  const header = el('header', 'game-header');
  const menuBtn = iconBtn('☰', 'More…', showGameMenu);
  const title = el('div', 'header-title', 'Fabled Lands');
  const sheetBtn = iconBtn('📜', 'Adventure Sheet', () => toggleSheet());
  sheetBtn.classList.add('sheet-toggle');
  header.appendChild(menuBtn); header.appendChild(title);

  // Quick-access action icons in the top bar (mirrors the menu).
  const actions = el('div', 'header-actions');
  actions.appendChild(iconBtn('↩️', 'Undo last move', () => undo()));
  actions.appendChild(iconBtn('📖', 'Rules', () => showRules(true)));
  actions.appendChild(iconBtn('🗺', 'Maps', () => showMaps(state.data.book)));
  // [TTS] narration play/stop button
  if (narrator.supported) {
    narrateBtn = iconBtn('🔊', 'Read aloud', () => narrator.toggle(currentFlow()));
    narrator.onState = (playing) => {
      narrateBtn.textContent = playing ? '⏹' : '🔊';
      narrateBtn.classList.toggle('active', playing);
      narrateBtn.title = playing ? 'Stop reading' : 'Read aloud';
    };
    actions.appendChild(narrateBtn);
  }
  actions.appendChild(iconBtn('💾', 'Save & quit to title', () => { state.save(); showTitle(); }));
  actions.appendChild(sheetBtn); // sheet drawer toggle (mobile only)
  header.appendChild(actions);
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
    onRender: () => narrator.handleRerender(), // [TTS] stop narration when the DOM changes
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
  narrator.autoplayIfEnabled(currentFlow()); // [TTS]
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
  narrator.autoplayIfEnabled(currentFlow()); // [TTS]
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
    narrator.autoplayIfEnabled(currentFlow()); // [TTS]
  }
}

// ---- Death & resurrection --------------------------------------------------
let deathShown = false;
async function handleDeath() {
  if (deathShown) return;
  deathShown = true;
  narrator.stop(); // [TTS]
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
  const add = (icon, label, fn) => {
    const b = el('button', 'btn btn-block menu-item');
    b.appendChild(el('span', 'menu-icon', icon));
    b.appendChild(el('span', null, label));
    b.addEventListener('click', () => { close(); fn(); });
    body.appendChild(b);
  };
  let close = () => {};
  add('▶️', 'Continue playing', () => {});
  add('↩️', 'Undo last move', () => undo());
  add('📖', 'Rules', () => showRules(true));
  add('🗺', 'Maps', () => showMaps(state.data.book));
  if (narrator.supported) add('⚙️', 'Narration settings', () => showNarrationSettings()); // [TTS]
  add('📤', 'Export this save', () => exportSave(null, null));
  add('📥', 'Import a save', () => importSaveFile());
  add('💾', 'Save & quit to title', () => { state.save(); showTitle(); });
  const menuCredits = el('div', 'menu-credits');
  menuCredits.innerHTML = creditsHtml();
  body.appendChild(menuCredits);
  const ver = el('div', 'menu-version', 'Version ' + VERSION);
  body.appendChild(ver);
  const p = modal({ title: 'Menu', body, buttons: [{ label: 'Close', value: null }] });
  close = () => { const ov = document.querySelector('.modal-overlay'); if (ov) ov.remove(); };
  await p;
}

// ---- Narration settings [TTS] ----------------------------------------------
function showNarrationSettings() {
  const body = el('div', 'tts-settings');

  const auto = el('label', 'tts-row');
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = narrator.settings.autoplay;
  cb.addEventListener('change', () => { narrator.settings.autoplay = cb.checked; narrator.saveSettings(); });
  auto.appendChild(cb); auto.appendChild(document.createTextNode(' Auto-narrate each new section'));
  body.appendChild(auto);

  const vrow = el('div', 'tts-row');
  vrow.appendChild(el('label', null, 'Voice'));
  const sel = document.createElement('select'); sel.className = 'select';
  const voices = narrator.englishVoices();
  if (!voices.length) { const o = el('option', null, 'System default'); o.value = ''; sel.appendChild(o); }
  voices.forEach((v) => { const o = el('option', null, `${v.name} (${v.lang})`); o.value = v.voiceURI; sel.appendChild(o); });
  if (narrator.settings.voiceURI) sel.value = narrator.settings.voiceURI;
  sel.addEventListener('change', () => { narrator.settings.voiceURI = sel.value || null; narrator.saveSettings(); });
  vrow.appendChild(sel); body.appendChild(vrow);

  const rrow = el('div', 'tts-row');
  rrow.appendChild(el('label', null, 'Speed'));
  const rng = document.createElement('input'); rng.type = 'range'; rng.min = '0.6'; rng.max = '1.5'; rng.step = '0.05'; rng.value = String(narrator.settings.rate);
  const rval = el('span', 'tts-rate', Number(narrator.settings.rate).toFixed(2) + '×');
  rng.addEventListener('input', () => { narrator.settings.rate = parseFloat(rng.value); rval.textContent = narrator.settings.rate.toFixed(2) + '×'; narrator.saveSettings(); });
  rrow.appendChild(rng); rrow.appendChild(rval); body.appendChild(rrow);

  const test = el('button', 'btn', 'Test voice');
  test.addEventListener('click', () => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('The Fabled Lands await your command.');
      const v = narrator.voices.find((x) => x.voiceURI === narrator.settings.voiceURI); if (v) u.voice = v;
      u.rate = narrator.settings.rate;
      speechSynthesis.speak(u);
    } catch {}
  });
  body.appendChild(test);

  modal({ title: 'Narration', body, buttons: [{ label: 'Done', value: null, primary: true }] });
}

// ---- Rules & Map -----------------------------------------------------------
function showRules(fromGame) {
  const meta = data.getMeta();
  const body = el('div', 'static-doc');
  body.appendChild(renderStatic(meta.rules || meta.quickRules));
  modal({ title: 'Rules of the Fabled Lands', body, buttons: [{ label: 'Close', value: null }] });
}

// Maps viewer: the world map plus each book's regional map. Regional maps are
// optional drop-in files at web/assets/maps/book<N>.jpg — shown automatically if
// present, with a friendly note where they are missing.
function showMaps(activeBook) {
  const body = el('div', 'maps-box');
  const tabsEl = el('div', 'map-tabs');
  const view = el('div', 'map-view');
  const img = el('img', 'map-img');
  const note = el('div', 'map-note');
  view.appendChild(img); view.appendChild(note);

  const targets = [{ key: 'world', label: 'World', src: 'assets/world-map.jpg', title: 'The Fabled Lands', missing: 'World map not available.' }];
  data.availableBooks().forEach((n) => {
    targets.push({ key: 'b' + n, label: 'Book ' + n, src: `assets/maps/book${n}.jpg`, title: data.bookTitle(n), missing: `Regional map for Book ${n} not installed.\nAdd it as web/assets/maps/book${n}.jpg` });
  });

  let current = null;
  function select(t, btn) {
    current = t;
    tabsEl.querySelectorAll('.map-tab').forEach((b) => b.classList.toggle('active', b === btn));
    note.textContent = t.title;
    note.classList.remove('missing');
    img.style.display = '';
    img.alt = t.title;
    img.onload = () => { note.textContent = t.title; note.classList.remove('missing'); };
    img.onerror = () => { img.style.display = 'none'; note.textContent = t.missing; note.classList.add('missing'); };
    img.src = t.src;
  }

  targets.forEach((t) => {
    const btn = el('button', 'map-tab', t.label);
    btn.addEventListener('click', () => select(t, btn));
    tabsEl.appendChild(btn);
    t._btn = btn;
  });

  body.appendChild(tabsEl); body.appendChild(view);
  // default: the active book's region if given, else the world
  const initial = (activeBook != null && targets.find((t) => t.key === 'b' + activeBook)) || targets[0];
  select(initial, initial._btn);
  modal({ title: 'Maps of Harkuna', body, buttons: [{ label: 'Close', value: null }] });
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
