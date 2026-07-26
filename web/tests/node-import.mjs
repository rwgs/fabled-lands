// node-import.mjs — the DOM-free seam, checked where it actually matters (task 195).
//
// AGENTS.md promises the rule modules are importable and unit-checkable straight from Node.
// They were not: engine.js and render-rules.js imported availableBooks() from data.js, whose
// module top level runs `new DOMParser()`, so a bare `import('./engine.js')` threw
// `ReferenceError: DOMParser is not defined` — and via engine.js the same browser dependency
// reached combat, market, render-gates and visit-state. The book list now lives in the
// DOM-free edition.js registry that data.js publishes into.
//
// Two checks, because either alone can pass while the invariant rots:
//   1. STATIC — walk each rule module's import graph and fail if it reaches a module that
//      touches the DOM. Catches the coupling on the day it is written, even if the offending
//      module happens to defer its browser global to call time.
//   2. DYNAMIC — actually import each module in Node (no DOM, no shims) and use one of its
//      exports, so the graph is proved loadable and not merely tidy on paper.
//
// Run: node web/tests/node-import.mjs    (exit 0 = pass). No dependencies, no shims: adding a
// Node DOM package here would mask exactly what this is meant to detect.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const JS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../js');

// The modules AGENTS.md calls DOM-free: the core rules plus the extracted planners.
const RULE_MODULES = [
  'engine.js', 'combat.js', 'market.js', 'state.js',
  'render-rules.js', 'render-gates.js', 'visit-state.js',
];

// Modules that legitimately touch the browser. A rule module may not reach any of them.
const DOM_MODULES = new Set(['data.js', 'ui.js', 'render.js', 'render-choices.js', 'render-combat.js',
  'render-market.js', 'render-rewards.js', 'render-rolls.js', 'app.js', 'tts.js', 'sw-cache.js']);

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('PASS ' + label); }
  else { fail++; console.log(`FAIL ${label}${detail ? ' — ' + detail : ''}`); }
};

// ---- 1. static import graph -------------------------------------------------
const importsOf = (file) => {
  const src = readFileSync(resolve(JS_DIR, file), 'utf8');
  return [...src.matchAll(/from\s+'\.\/([\w.-]+\.js)'/g)].map((m) => m[1]);
};

/** Every module reachable from `entry`, plus the first path that reaches a DOM module. */
function reach(entry) {
  const seen = new Set();
  const stack = [[entry, [entry]]];
  let offender = null;
  while (stack.length) {
    const [file, path] = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (file !== entry && DOM_MODULES.has(file)) { offender = offender || path.join(' -> '); continue; }
    for (const dep of importsOf(file)) stack.push([dep, [...path, dep]]);
  }
  return { seen, offender };
}

for (const mod of RULE_MODULES) {
  const { offender } = reach(mod);
  ok(`${mod} imports nothing that touches the DOM`, !offender, offender);
}

// A guard on the guard: the check only means something while data.js really is DOM-bound and
// really is where the book list is published from.
ok('data.js still constructs a DOMParser at module level (the trap being avoided)',
   /^const _parser = new DOMParser\(\);$/m.test(readFileSync(resolve(JS_DIR, 'data.js'), 'utf8')));
ok('data.js publishes the book list into the DOM-free registry',
   /setAvailableBooks\(/.test(readFileSync(resolve(JS_DIR, 'data.js'), 'utf8')));

// ---- 2. real Node imports ---------------------------------------------------
// (`navigator` is deliberately absent from this list: Node 21+ defines its own minimal one,
// so its presence says nothing about a DOM shim.)
for (const g of ['document', 'window', 'DOMParser', 'localStorage', 'Node']) {
  ok(`this Node run has no ${g} (the check is not passing on a shim)`, typeof globalThis[g] === 'undefined');
}

const load = async (mod) => {
  try { return { m: await import(`../js/${mod}`) }; }
  catch (e) { return { err: String((e && e.message) || e) }; }
};

const loaded = {};
for (const mod of RULE_MODULES) {
  const r = await load(mod);
  loaded[mod] = r.m || null;
  ok(`${mod} imports cleanly in Node`, !!r.m, r.err);
}

// Each module's exports are live, not just parseable.
if (loaded['engine.js']) {
  const eng = loaded['engine.js'];
  const d6 = eng.rollD6();
  ok('engine: rollD6 returns a die face', Number.isInteger(d6) && d6 >= 1 && d6 <= 6, String(d6));
  ok('engine: boolAttr reads the corpus truth values', eng.boolAttr('t') === true && eng.boolAttr('f') === false);
}
if (loaded['state.js']) {
  const st = loaded['state.js'];
  ok('state: makeItem builds a possession', st.makeItem('weapon', 'sword', 2).name === 'sword');
  ok('state: normalize folds case/space', st.normalize('  Green Gem ') === 'green gem');
}
if (loaded['combat.js']) ok('combat: fightRound is exported', typeof loaded['combat.js'].fightRound === 'function');
if (loaded['market.js']) ok('market: buyOptions is exported', typeof loaded['market.js'].buyOptions === 'function');
if (loaded['render-rules.js']) ok('render-rules: conditionPending is exported', typeof loaded['render-rules.js'].conditionPending === 'function');
if (loaded['render-gates.js']) ok('render-gates: computeFightGate is exported', typeof loaded['render-gates.js'].computeFightGate === 'function');
if (loaded['visit-state.js']) {
  const ctx = loaded['visit-state.js'].newCtx();
  ok('visit-state: newCtx builds an empty visit memo', ctx.rolls.size === 0 && ctx.applied.size === 0);
}

// The registry itself: the book gate is answerable in Node, which is the whole point.
{
  const ed = await import('../js/edition.js');
  ok('edition: no books before meta.json has loaded', ed.availableBooks().length === 0 && ed.bookAvailable(1) === false);
  ed.setAvailableBooks([1, 2, 3, 4, 5, 6]);
  ok('edition: a published book is available', ed.bookAvailable(3) === true && ed.bookAvailable('3') === true);
  ok('edition: an unpublished book is not', ed.bookAvailable(999) === false && ed.bookAvailable(null) === false && ed.bookAvailable('') === false);
  ok('edition: availableBooks hands out a copy', (ed.availableBooks().push(99), ed.availableBooks().length === 6));
  ed.setAvailableBooks(null);
  ok('edition: a missing list resets to empty', ed.availableBooks().length === 0);
}

console.log(`\nRESULT ${fail ? 'FAILURES' : 'ALL PASS'} pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
