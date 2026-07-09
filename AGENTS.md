# AGENTS.md

## Project Overview

A faithful, offline web port of the *Fabled Lands* gamebooks: it renders the
original section text and automates all the game rules (dice, ability checks,
combat, markets, ships, live adventure sheet). Plain HTML/CSS/ES modules —
**no npm, no build toolchain, no dependencies.** Windows + PowerShell environment.

## Repository map — what is source, what is generated
- **`books/book<N>/*.xml`** — section text + rules markup. **SOURCE OF TRUTH**
  (~4,400 sections). Edit these.
- **`web/data/*.json` and `web/js/version.js`** — **GENERATED** from `books/` +
  `rules/` by the build. **Never hand-edit them;** change the XML and rebuild.
- **`web/js/*.js`** — the app (vanilla ES modules; see the module table in `README.md`).
- **`rules/`** — the original JaFL XML spec, for reference: `JaFL-XML-Tags.html`
  (full tag list), `JaFL-XML-Intro.html`, `Rules.xml`, `QuickRules.xml`.
- **`java-engine/`** — the original Java engine (JaFL). **Reference only — never
  edit it and never copy its code.** The JS rules are a clean-room
  reimplementation (licensing: see `NOTICE`).
- **`build/*.ps1`** — data build + version stamp. **`TASKS.md`** — the backlog
  (see workflow below).

## Architecture invariant — keep the rules out of the view
Game logic lives in DOM-free modules: `engine.js`, `combat.js`, `market.js`,
`state.js`. `render.js` only builds DOM and wires clicks, delegating every rule
to those modules. **Do not put game logic in `render.js`.** This is what keeps
the rules testable headlessly in `web/_test.html`.

## Build + test loop — run after every change
1. If you changed `books/` or `rules/`, rebuild the bundled data (this also
   stamps `version.js`):
   `powershell -ExecutionPolicy Bypass -File build/build-data.ps1`
   If you only touched `web/` (JS/CSS/HTML — no data rebuild needed), still
   refresh the build stamp so the in-game version and the service-worker cache
   key move (otherwise returning players keep the cached old build):
   `powershell -ExecutionPolicy Bypass -File build/stamp-version.ps1`
   The stamp is a content hash of the app source, so it changes on any edit.
2. Run the headless smoke test (serves `web/`, exercises the engine, and renders
   **every section of all six books** to confirm none throw):
   - Serve from the repo root: `python -m http.server 8848`
   - `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=90000 --user-data-dir="$env:TEMP\fl-test-profile" "http://localhost:8848/_test.html"`
3. Healthy when the dumped `#results` starts with **`RESULT ALL PASS`** (the page
   title becomes `TESTS_OK`).

Notes:
- Use a **fresh `--user-data-dir`** so a stale service-worker cache can't serve an
  old bundle and report a false pass.
- Use **Chrome, not Edge** (headless Edge occasionally dumps empty DOM).
- Give it a virtual-time budget **≥ 60s** — the every-section scan is CPU-heavy.
- Pure-logic modules (`engine.js`, `combat.js`, `market.js`, `state.js`) can also
  be imported and unit-checked directly in Node for fast feedback.
- **Never edit `web/data/*.json` to make a test pass — fix the XML or the engine.**

## Command execution (Bitdefender on Windows)
The build and tests **require PowerShell**; running the repo's own vetted scripts
(`build/*.ps1`) and the documented Python/Chrome commands above is expected and
safe. What to avoid is *suspicious* automation, which AV heuristics may block.

**NEVER use encoded or obfuscated commands — Bitdefender flags them every time.**
This is the single most common cause of blocked commands here, so treat it as a
hard rule:
- **Do not** use PowerShell `-EncodedCommand` / `-enc`, base64-encoded payloads,
  `[Convert]::FromBase64String`, compressed/gzipped script blobs, or any
  string-obfuscated command. Always pass plain, human-readable command text.
- **Do not** let any tool or wrapper base64-encode a command on your behalf. If
  an approach would require encoding to get through, choose a different approach
  (a direct file edit, a short readable command, or a small `.ps1` script) —
  never encode it to make it run.
- No long generated one-liners that rewrite files — **prefer direct file edits**
  (Edit/Write) over shell-based search/replace.
- Keep commands short, explicit, and readable; don't chain many together.
- Never touch the registry, startup items, scheduled tasks, or AV/security settings.
- If a command is blocked or likely to trip AV heuristics, stop and propose the
  smallest safe manual alternative.

## Task workflow
The backlog is `TASKS.md`. Open items are `- [ ]`, done items `- [x]` (a summary
checklist is at the top of the file; the detail for each is in the sections below).
1. Read `TASKS.md` and take the **first open (`- [ ]`) task**.
2. Follow its steps exactly — each task is self-contained. Don't skip steps and
   don't combine tasks unless explicitly instructed.
3. Run the build + test loop and confirm `RESULT ALL PASS` **before** marking the
   task `- [x]`. Update `README.md` if the task instructs it.
4. If you identify a model error, missing assumption, or undocumented
   simplification, add it as a new `- [ ]` task at the bottom of `TASKS.md` before
   continuing. Do not leave findings only in conversation.
5. Commit after every completed task.

---

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if
  any.

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial
tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes,
simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it
work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer
rewrites due to overcomplication, and clarifying questions come before
implementation rather than after mistakes.