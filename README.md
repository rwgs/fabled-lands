# Fabled Lands — Web Edition

A faithful, offline-capable **web port** of the *Fabled Lands* gamebook series. It
renders the original book text and **automates all of the game rules** — dice rolls,
ability checks, combat, markets, ships, and a live Adventure Sheet — the same way the
original Java application ([JaFL](https://flapp.sourceforge.net/)) did, but in
the browser, on any device, with progress saved locally.

> *Fabled Lands* is an open-world gamebook: you roam a fantasy world freely, in any
> order, keeping one character across all the books. There is no single storyline —
> just a huge world of quests, trade, combat and intrigue.

<p align="center"><em>Play it like the printed book — the rules are handled for you.</em></p>

---

## Highlights

- **All six published books** included (~4,400 sections): *The War-Torn Kingdom*,
  *Cities of Gold and Glory*, *Over the Blood-Dark Sea*, *Devils & Howling Darkness*,
  *The Court of Hidden Faces*, and *Lords of the Rising Sun*.
- **Full rules engine** — 2d6 ability checks, difficulty/outcome tables, turn-based
  combat with your live Defence, markets & trading, ships/cargo/crew, blessings, curses,
  codewords, gods, titles, resurrection deals, and the 12-item carry limit.
- **Live Adventure Sheet** that updates itself as you play.
- **Classic-fantasy presentation** — parchment, serif book text, tactile dice.
- **Mobile, tablet & desktop** — responsive; the sheet becomes a slide-in drawer on phones.
- **Installable PWA** — works fully **offline** after first load; add it to your home screen.
- **Read-aloud narration** — optional text-to-speech of the story prose (see below).
- **Saved in your browser** — multiple save slots via `localStorage`; autosaves as you go, with **import/export** of individual saves as files (back up or move a character between devices).
- **Maps** — the world map plus each book's regional map, in an in-game viewer.
- **No backend, no build toolchain, no dependencies** — plain HTML/CSS/ES modules.

---

## Repository layout

```
fabled-lands/
├── books/            Original section XML, one file per section (SOURCE OF TRUTH)
│   ├── book1/…book6/  e.g. book1/20.xml, plus Adventurers.xml (starting characters)
│   └── books.ini      Book titles
├── rules/            Rules.xml, QuickRules.xml
├── images/           world-map.jpg (+ icons). Section illustrations are NOT included.
├── java-engine/      The original Java engine (JaFL) — kept for reference, UNTOUCHED
├── build/            Build scripts (PowerShell)
│   ├── build-data.ps1  Bundles books/ + rules/ + maps → web/data & web/assets
│   └── stamp-version.ps1  Writes the in-game version stamp
└── web/              ← the web app (this is what you deploy)
    ├── index.html
    ├── manifest.webmanifest, sw.js       PWA shell + offline service worker
    ├── css/style.css
    ├── js/            app.js, data.js, state.js, rules.js, engine.js,
    │                  combat.js, market.js, render.js, ui.js, tts.js, version.js
    ├── assets/        icon.svg, world-map.jpg
    └── data/          meta.json, book1.json … book6.json   (generated)
```

The `java-engine/` Java project is the original work of Jonathan Mann and is left exactly
as found — it was used only as the reference specification for the game rules.

---

## Running it

The app uses `fetch` to load the bundled book data, so it must be served over HTTP
(opening `index.html` directly via `file://` will not work in most browsers).

### Locally

Any static file server works. With Python (which ships with most systems), serve
**from the repository root** — the root `index.html` redirects into `web/`:

```bash
python -m http.server 8848
# then open http://localhost:8848/   (redirects to /web/)
```

(You can also serve the `web/` folder directly, or use the VS Code **Live Server** extension.)

### On the web (recommended for mobile/tablet)

`web/` is a self-contained static site. Deploy it to any static host:

- **GitHub Pages** — publish the `web/` folder (or set Pages to serve `/web`).
- **Netlify / Cloudflare Pages / Vercel** — drag-and-drop or point at the `web/` directory.

Once loaded on a phone or tablet, use the browser's **“Add to Home Screen”** to install
it as an app. Thanks to the service worker it then runs entirely offline; your saved
games live in that browser.

### Deep-link / preview

`?demo=<book>.<section>` starts a default Warrior at that section — handy for testing or
sharing a spot, e.g. `…/index.html?demo=1.10`.

---

## Regenerating the data

`web/data/*.json` is compiled from `books/` and `rules/`. If you edit or add section XML,
rebuild it (Windows PowerShell — no Node required):

```powershell
powershell -ExecutionPolicy Bypass -File build/build-data.ps1
```

This reads every numeric `books/book<n>/<section>.xml`, each book's `Adventurers.xml`
(starting stats/items) and the rules, then writes one compact JSON file per book plus
`meta.json`. Non-section files (`*temp.xml`, `*old.xml`, pregen character files) are
skipped. Book text is left untouched; the JSON simply bundles it so the app can load a
whole book in a single request and cache it for offline play.

### Build stamp / version

A build version in the form `yy.MM.dd.HH.<sha>` (hourly date + the HEAD commit's short
SHA) is shown at the bottom of the in-game menu (and on the title screen). It is generated
into `web/js/version.js`. The commit SHA makes it change on **every commit** — so returning
visitors' service workers always see a fresh cache key — while keeping hourly date
granularity. After changing anything in `web/`, refresh it with:

```powershell
powershell -ExecutionPolicy Bypass -File build/stamp-version.ps1
```

(`build-data.ps1` runs this automatically at the end.)

---

## Narration (text-to-speech)

Story prose can be read aloud using the browser's built-in **Web Speech API** — no
backend, no API keys, no cost, and it keeps working offline with the device's own voices.

- A **🔊 button** in the game header plays/stops narration of the current section.
- **Auto-narrate** (on by default) reads each new section as you arrive; toggle it, pick a
  **voice**, and set the **speed** under **Menu → Narration…** (remembered per browser).
- Prose is spoken sentence-by-sentence (so long passages aren't truncated) and the current
  sentence is **highlighted**; button/roll/choice labels are excluded from the reading.

It is a **self-contained, optional module** ([web/js/tts.js](web/js/tts.js)). Every
integration point in `app.js` is tagged with a `[TTS]` comment, so the feature can be
removed entirely by deleting that module and those few lines — the game is unaffected.
If a browser has no speech support, the button simply doesn't appear.

## How it works

The app parses each section's original XML in the browser with `DOMParser` and walks the
tree into interactive DOM. There is no lossy XML→JSON transform — the mixed prose-and-logic
structure of the books is preserved exactly.

| Module | Responsibility |
|---|---|
| `data.js` | Loads the bundled JSON, parses section XML, exposes `getSection(book, n)`. |
| `state.js` | The **Adventure Sheet** model + derived stats (affected abilities, Defence) + `localStorage` save slots. |
| `rules.js` | Static constants: abilities, professions, rank titles, limits. |
| `engine.js` | The headless rules core: dice, `<if>` condition evaluation, passive effects (`lose`/`tick`/`gain`/`set`/`curse`), die-roll modifiers (`<adjust>`, conditional on crew/ship/god/item/codeword/rank), and roll resolution (ability/difficulty, rank check, training), rest, and resurrection deals. No DOM. |
| `combat.js` | Headless combat resolution — building an enemy, attack rounds, initiative, damage, `<fightdamage>`. No DOM. |
| `market.js` | Headless economy — buying/selling goods, weapons, armour, ships, cargo, and crew upgrades. No DOM. |
| `render.js` | Turns a `<section>` tree into interactive DOM and wires all interactions, delegating the actual rules to `engine.js` / `combat.js` / `market.js`. |
| `ui.js` | Adventure-Sheet panel, dice animation, modals, toasts. |
| `app.js` | Bootstrap, screens, routing, character creation, death/resurrection, saves. |

The rules were deliberately split **out of the renderer**: `render.js` builds DOM and
handles clicks, while all game logic lives in DOM-free modules (`engine.js`, `combat.js`,
`market.js`). This keeps the rules unit-testable in isolation — `web/_test.html` exercises
combat, economy, rolls and effects directly, without touching the DOM.

### The rendering model

Each section is **re-rendered on every state change**. Passive effects and completed dice
rolls are memoised per-visit by a stable node path, which guarantees that:

- passive effects (money, codewords, stamina…) apply **exactly once** per visit;
- conditionals re-evaluate against **live** state after each roll;
- a roll's `<success>`/`<failure>`/`<outcome>` branch only appears — and only applies its
  effects — once the roll is actually made.

Two behaviours follow the original Java app rather than a simpler "hide it" approach:

- **Conditionals are shown, not hidden.** An `<if>`/`<elseif>`/`<else>` branch whose
  condition isn't met is **greyed out and disabled** rather than removed — so
  "*If you have the codeword X…*" stays on screen for context and the following "If not…"
  still reads correctly. Its effects don't apply and its links are inert until (a later
  state change makes) the condition hold.
- **Money is spent by choice.** A `<lose>` of Shards/goods in a section that lets the
  player decline (it offers an optional "turn back" link) is **not** deducted on arrival;
  it becomes a **click-to-pay** action that blocks the rest of the section until resolved —
  mirroring the original's forced-action model, so turning back costs nothing. Unavoidable
  payments and narrative losses (Stamina, codewords, blessings…) still apply automatically.

### Rules implemented (from the original engine)

- **Ability check** — `2d6 + affected ability > Difficulty` ⇒ success.
- **Combat** — you attack with `2d6 + Combat` vs the foe's Defence (damage = the excess);
  the foe strikes back vs your **Defence = Combat (incl. weapon) + Rank + best armour**.
  `<fightdamage>` effects fire when the enemy wounds you. Stamina 0 = death.
- **Outcome tables** — roll `N`d6 and map the total onto ranges (`0-4`, `1,2`, `11`, `14+`).
- **Rank check** (`roll ≤ Rank`), **Training** (`2d6 > current ability` ⇒ +1).
- **Economy** — markets buy/sell items, weapons, armour, tools, ships, cargo and crew
  upgrades (one grade at a time); inline `<buy>`/`<sell>` in prose, including cargo grants
  and cargo-for-cargo barter (give any one unit, receive the offered commodity);
  best-bonus-only stacking; 12-item carry limit (money is unlimited).
- **Bookkeeping** — codewords, blessings, curses, gods, titles, flags, variables, visit
  boxes, caches and resurrection deals.

---

## What's included & known limits

- **Books 1–6** are fully playable. Links to **Books 7–12** (never digitised here) are
  detected and shown as a friendly “not included in this edition” message rather than a
  dead end.
- **Regional maps** for all six books are included (each book folder's `<Region>-Map.jpg`,
  copied to `web/assets/maps/book<N>.jpg` by the build) and shown in the in-game **Maps**
  viewer alongside the world map.
- **Section illustrations** are not part of this repository, so inline art is skipped
  gracefully. If you obtain the illustration files, drop them in `web/assets/illus/` named as
  the XML references them (e.g. `142.jpg`) and they will appear automatically.
- The engine covers the full common rule set. A handful of very rare, bespoke section
  mechanics degrade gracefully (text still shows; unknown tags render their prose).
- New games begin at **Book 1, §1** with that book's starting profile (1st Rank, 9 Stamina,
  16 Shards); you can also pick a different starting book in character creation.

---

## Testing

`web/_test.html` is a headless smoke test: it creates a character, exercises the engine 
(conditions, effects, dice, ranges, combat), verifies interactions (rolling, choosing,
fighting), and renders **every section of all six books** to confirm none throw. Serve the
`web/` folder and open `/_test.html`, or run it headlessly:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=60000 `
  --user-data-dir="$env:TEMP\fl-test-profile" `
  "http://localhost:8848/_test.html"
```

The first line of the dumped `#results` reads `RESULT ALL PASS …` when healthy.

> Use a **fresh `--user-data-dir`** (as above) so the service worker can't serve a stale
> cached copy of the app — otherwise an old bundle can mask your changes and report a
> false pass. Chrome is used here because headless Edge occasionally emitted empty dumps.

---

## Credits & licence

This project has two layers of rights — see [`NOTICE`](NOTICE) for the full breakdown.

**Software** — licensed **GPL-2.0** (see [`LICENSE`](LICENSE)). This *Progressive Web App Fabled Lands*
(WebFL) design & implementation are © 2026 **Robert Southgate**. The rules automation is a clean-room
JavaScript reimplementation using *Java Fabled Lands* (JaFL) © 2005 **Jonathan Mann** as the
reference; JaFL is published under GPL-2.0, and the bundled section data was obtained from
that project — hence GPL-2.0 here too (JaFL is v2-only, incompatible with v3).

**Content** — *not* covered by the GPL; copyright of the respective owners:

- Book text © 1996 **Dave Morris & Jamie Thomson** (Books 1–6); rights held by **Fabled Lands LLP**.
- Book 7, *The Serpent King's Domain*, text © 2017 **Paul Gresty** (Megara Entertainment / Fabled Lands LLP).
- Illustrations & Maps © **Russ Nicholson**; Book 7 cover © 2017 **Kevin Jenkins**.

*Fabled Lands* and its text and artwork remain the property of their respective rights
holders. This is an unofficial, non-commercial fan project — please support the official
releases. A GPL licence on the software does **not** grant rights to the book content.
