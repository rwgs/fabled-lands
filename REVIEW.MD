# Fabled Lands — Repository Review

Reviewed 2026-07-09. Scope: deployment/build pipeline, offline cache behaviour,
static rules rendering, player-facing flows, and the existing browser test setup.
The working tree was clean at the start of the review. No critical or high-severity
defects were found.

## New Findings

### Medium — asset-only releases remain stale in installed PWAs

`build/stamp-version.ps1:32`–`build/stamp-version.ps1:37` derives the cache
version from JavaScript, CSS, JSON, HTML, and the manifest, but excludes
`web/assets/`. Asset changes are valid build outputs: `build/build-data.ps1:208`,
`build/build-data.ps1:223`, and `build/build-data.ps1:242` copy maps and
illustrations there. The service worker precaches maps (`web/sw.js:42`) and uses
cache-first responses (`web/sw.js:89`), so an icon, map, or illustration changed
without a code/data change is never refreshed for existing installs.

Include deployable assets in the build stamp or publish them with revisioned
filenames. Do not hash the generated `sw.js` itself, as that would make the cache
version circular. Recorded as task 64.

### Low — the rules modal creates invalid table structure

`renderStatic` first renders all `h1`–`h6` elements as headings
(`web/js/app.js:775`), making its later identical condition that creates a
`<th>` unreachable (`web/js/app.js:781`). `rules/QuickRules.xml:3` places an
`<h3>` inside a `<tr>`, so the browser receives a heading element directly in a
table row rather than a header cell. This loses table semantics and can produce
inconsistent layout/accessibility.

Render headings inside table rows as `<th>` cells (with a suitable `colspan`)
and retain regular headings only outside tables. Add a focused DOM test. Recorded
as task 65.

## Confirmed Backlog

- **TTS skips bare story prose.** `web/js/tts.js:56` wraps only paragraphs, but
  sections such as `books/book4/16.xml:3` and `books/book2/745.xml:3` use bare
  text nodes. Narration has no chunks for those sections. Complete task 33.
- **Some game rules still live in the renderer/app layer.** This makes direct
  unit testing harder and breaks the project's stated DOM-free engine boundary.
  Complete task 34.
- **iOS installed icons are unreliable.** `web/index.html:11` references an SVG
  apple-touch icon; supply a PNG icon and precache it as task 35 specifies.
- **Locked caches can still be edited.** The buttons rendered in
  `web/js/render.js:2568` onward do not consult the state lock used by the
  gambling flow in `books/book1/91.xml:7`. Complete task 38.
- **The vampire can be fought armed.** In `books/book2/462.xml:4` equipment is
  confiscated, but the live `dead="f"` condition can return it before the fight
  resolves (`books/book2/462.xml:11`). Complete task 39.

## Recommendations

- Add a CI job that serves `web/` and requires the existing
  `web/_test.html` every-section smoke suite to pass. The suite is comprehensive,
  but the repository has no checked-in workflow to run it on changes.
- Align the illustration documentation with the shipped build. `README.md:226`
  says illustrations are absent, while the build deliberately ships the three
  referenced illustration assets through `build/build-data.ps1:242`.

## Validation

The local server successfully served `/_test.html` with HTTP 200. The full Chrome
headless smoke run could not be collected in this environment: the host returned
Windows `Access is denied` after Chrome launch, including when its output was
redirected to temporary files. No test result is claimed from this review.
