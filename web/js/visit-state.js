// visit-state.js — DOM-free per-visit execution-context (ctx) and return-frame
// serialization for section rendering (tasks 116/119).
//
// The renderer memoises what a visit has applied/resolved in a `ctx` object (Sets/Maps
// keyed by positional node paths) and keeps a one-level return frame; these functions
// create, flatten (JSON-safe), and rebuild that state so a save can resume the exact
// visit. Pure: they operate on plain records and the parsed section tree, never
// constructing DOM or touching a browser UI global.

// A fresh per-visit execution context: the renderer's memo of what has already been
// applied/resolved this visit, keyed by positional node paths. Shared by begin() and
// deserializeCtx() so the shape has a single definition.
export function newCtx() {
  return { applied: new Set(), rolls: new Map(), fights: new Map(), buys: new Map(), groupLimits: new Map(), groupPicks: new Map(), wroteVars: new Set(), rolledVars: new Set(), pathNodes: new Map(), rollLockCaches: new Set(), forcedChosen: new Map(), awardCounts: new Map(), stock: new Map(), usedSource: null };
}

// Resolve a serialised memo path back to its parsed-section node (task 116). Paths are the
// renderer's positional keys — 'r' then the child-node index at each level (see
// appendChildren). Because the parsed section tree is static across a visit, the same path
// always names the same node, so a saved usedSource path re-binds to the exact choice/goto
// on load. Returns null if the path does not resolve (defensive against a hand-edited save
// / a section that changed between builds).
export function resolveNodePath(path, sectionEl) {
  if (typeof path !== 'string' || !sectionEl) return null;
  const parts = path.split('.');
  if (parts.shift() !== 'r') return null;
  let n = sectionEl;
  for (const p of parts) {
    const i = parseInt(p, 10);
    if (!n || !n.childNodes || !n.childNodes[i]) return null;
    n = n.childNodes[i];
  }
  return n === sectionEl ? null : n;
}

// Flatten a ctx to a plain, JSON-safe object. Maps→entry arrays, Sets→arrays; the roll and
// fight values are already plain data. DOM references are never stored: pathNodes is rebuilt
// lazily on render, and usedSource is recorded as its positional path (looked up in
// pathNodes, which was populated by the render that produced this ctx). groupLimits and
// rollLockCaches are omitted — they are re-derived from the static section on resume.
export function serializeCtx(ctx) {
  let usedSourcePath = null;
  if (ctx.usedSource && ctx.pathNodes) {
    for (const [p, n] of ctx.pathNodes) if (n === ctx.usedSource) { usedSourcePath = p; break; }
  }
  return {
    applied: [...ctx.applied],
    rolls: [...ctx.rolls],
    fights: [...ctx.fights],
    buys: [...ctx.buys],
    groupPicks: [...ctx.groupPicks],
    wroteVars: [...ctx.wroteVars],
    rolledVars: [...ctx.rolledVars],
    forcedChosen: [...ctx.forcedChosen],
    awardCounts: [...ctx.awardCounts],
    stock: [...ctx.stock],
    usedSourcePath,
  };
}

// Re-derive the section-scoped scaffolding a ctx needs that is NOT part of the saved memo:
// the "choose up to N" group caps and the names of gambling-bet lock caches. Unlike begin(),
// this does NOT reset any cache-lock flag on the state — those are persisted, and a resume
// must keep a bet the player already locked. (mirrors begin(), tasks 5 + 38)
export function rebuildVisitScaffold(ctx, sectionEl) {
  Array.from(sectionEl.querySelectorAll('items[group]')).forEach((c) => {
    const g = c.getAttribute('group');
    const lim = parseInt(c.getAttribute('limit') || '0', 10);
    if (g && lim > 0) ctx.groupLimits.set(g, lim);
  });
  Array.from(sectionEl.querySelectorAll('group')).forEach((g) => {
    if (!g.querySelector('random, difficulty, rankcheck, training')) return;
    g.querySelectorAll('tick[special="lock"][cache]').forEach((t) => {
      const name = t.getAttribute('cache');
      if (name) ctx.rollLockCaches.add(name);
    });
  });
}

// Rebuild a ctx from its serialised form against the (re-parsed) section. Unknown/absent
// fields degrade to empty rather than throwing, and every list guard tolerates a hand-edited
// save. groupLimits/rollLockCaches are rebuilt by rebuildVisitScaffold afterwards.
export function deserializeCtx(rec, sectionEl) {
  const ctx = newCtx();
  const r = rec && typeof rec === 'object' ? rec : {};
  const arr = (x) => (Array.isArray(x) ? x : []);
  arr(r.applied).forEach((k) => { if (typeof k === 'string') ctx.applied.add(k); });
  arr(r.wroteVars).forEach((k) => { if (typeof k === 'string') ctx.wroteVars.add(k); });
  arr(r.rolledVars).forEach((k) => { if (typeof k === 'string') ctx.rolledVars.add(k); });
  arr(r.rolls).forEach((e) => { if (Array.isArray(e) && e.length === 2) ctx.rolls.set(e[0], e[1]); });
  arr(r.fights).forEach((e) => { if (Array.isArray(e) && e.length === 2) ctx.fights.set(e[0], e[1]); });
  arr(r.buys).forEach((e) => { if (Array.isArray(e) && e.length === 2) ctx.buys.set(e[0], e[1]); });
  arr(r.groupPicks).forEach((e) => { if (Array.isArray(e) && e.length === 2) ctx.groupPicks.set(e[0], e[1]); });
  arr(r.forcedChosen).forEach((e) => { if (Array.isArray(e) && e.length === 2) ctx.forcedChosen.set(e[0], e[1]); });
  arr(r.awardCounts).forEach((e) => { if (Array.isArray(e) && e.length === 2) ctx.awardCounts.set(e[0], e[1]); });
  arr(r.stock).forEach((e) => { if (Array.isArray(e) && e.length === 2) ctx.stock.set(e[0], e[1]); });
  if (r.usedSourcePath) ctx.usedSource = resolveNodePath(r.usedSourcePath, sectionEl);
  rebuildVisitScaffold(ctx, sectionEl);
  return ctx;
}

// Serialise the one-level return frame (task 110): its section identity, section-local vars,
// location, entry-tick baseline, taken source action (as a path) and its own ctx. The frame's
// sectionEl is NOT stored — it is re-parsed from book/section on resume.
export function serializeFrame(frame) {
  let usedSourcePath = null;
  if (frame.usedSource && frame.ctx && frame.ctx.pathNodes) {
    for (const [p, n] of frame.ctx.pathNodes) if (n === frame.usedSource) { usedSourcePath = p; break; }
  }
  return {
    book: frame.book,
    section: frame.section,
    sectionTodock: frame.sectionTodock,
    vars: { ...frame.vars },
    location: frame.location ?? null,
    entryTicks: frame.entryTicks,
    usedSourcePath,
    ctx: serializeCtx(frame.ctx),
  };
}
