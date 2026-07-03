# Fabled Lands — Web Edition · Agent guide

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
safe. What to avoid is *suspicious* automation, which AV heuristics may block:
- No `-EncodedCommand` / base64 / obfuscated scripts.
- No long generated one-liners that rewrite files — **prefer direct file edits**
  (Edit/Write) over shell-based search/replace.
- Keep commands short, explicit, and readable; don't chain many together.
- Never touch the registry, startup items, scheduled tasks, or AV/security settings.
- If a command is blocked or likely to trip AV heuristics, stop and propose the
  smallest safe manual alternative.
- (There is **no .NET/dotnet** in this project — ignore any dotnet-CLI advice.)

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
