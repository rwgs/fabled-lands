// edition.js — which books this build actually bundles (task 195).
//
// A deliberately tiny, dependency-free registry. The list itself comes from meta.json, which
// only data.js can read (fetch + DOMParser), so data.loadMeta() PUBLISHES it here and everyone
// else READS it here. That inversion is the point: `<if book="N">` and a book-gated choice are
// rules, and the rule modules must stay DOM-free. Importing data.js for the answer put a
// module-level `new DOMParser()` on the engine → combat/market/render-rules/render-gates/
// visit-state chain, so a direct Node import of any of them threw
// `ReferenceError: DOMParser is not defined` before a single assertion could run — the exact
// headless seam the architecture invariant promises.
//
// Keep this module free of imports and browser globals. XML parsing and fetching stay in
// data.js; this holds nothing but the answer they produce.

let _books = [];

/** Publish the bundled-book list. data.loadMeta() calls this once meta.json is in. */
export function setAvailableBooks(books) {
  _books = Array.isArray(books) ? books.map(Number).filter((n) => Number.isFinite(n)) : [];
}

/** The books this build bundles, as a copy. Empty until meta.json has loaded. */
export function availableBooks() { return _books.slice(); }

/** Is this book bundled in this edition? A blank/unparseable book number is not. */
export function bookAvailable(n) { return _books.includes(Number(n)); }
