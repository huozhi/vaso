# Validation

Scripts for checking vaso in real browsers: what renders, whether it matches across browsers, and how fast it runs.
They drive the homepage demos with [Playwright](https://playwright.dev), so they test the library the way people
use it. Agents can run them unattended: each prints a table and exits non-zero when a check fails.

## Setup

```sh
pnpm add -D playwright                          # once
npx playwright install chromium webkit firefox  # the engines you want
pnpm dev                                        # the site, on http://localhost:3000
```

Point the scripts at another server with `--url` or `VASO_URL`.

## Modes

Every script takes `--modes`, a comma separated list:

| Mode | What it runs |
| --- | --- |
| `chromium` | Chromium: refraction through `backdrop-filter` |
| `webkit` | WebKit, the engine in Safari: refraction of a backdrop copy |
| `firefox` | Gecko, the engine in Firefox: refraction of a backdrop copy |
| `safari-ua` | Chromium posing as Safari, so vaso takes Safari's code path (copy + WebKit's framed filter) |
| `firefox-ua` | Chromium posing as Firefox, so vaso takes Firefox's code path |

The default is `chromium,safari-ua,firefox-ua`, which needs only Chromium. The `-ua` modes catch logic bugs in the
Safari and Firefox paths anywhere, but Chromium still draws them: confirm rendering in `webkit` / `firefox` (or a
real Safari, below) before calling a Safari bug fixed.

Other shared options: `--out <dir>` for screenshots (default `validation/out`, ignored by git), `--offline` to answer
requests to other sites locally (remote photos turn gray, fonts fall back), `--headed` to watch.

## Scripts

| Script | Checks | Fails when |
| --- | --- | --- |
| `smoke.mjs` | Loads the homepage, screenshots every demo, reports each glass's rendering path | Page errors, or anything `probe.js` flags |
| `search.mjs` | Types into Liquid search: one highlight per match, the bar's two pieces merged, highlights leave on clear, frame rate while typing | Any of those |
| `compare.mjs` | One demo in every mode, motion reduced, diffed against the first mode | Never; read the table and sheets |
| `perf.mjs` | Frame rate and main thread time (Chromium modes) for one demo, in autoplay and at rest | Never; compare runs |
| `switcher.mjs` | The theme switch flips from the knob, both ends and the Space key; `aria-checked` follows | Any of those |
| `ab.mjs` | Every demo on two builds (`--base`, `--head`), diffed | A demo differs by more than `--tolerance` % |

```sh
node validation/smoke.mjs --modes chromium,webkit,firefox
node validation/search.mjs --query light
node validation/compare.mjs --demo "Liquid search" --query the --modes chromium,webkit
node validation/perf.mjs --demo "Liquid touch" --seconds 5
node validation/ab.mjs --base http://localhost:3001 --head http://localhost:3000
```

For `ab.mjs`, serve the base build from a second checkout (`git worktree add ../vaso-base main`, then
`pnpm build && pnpm devjar dev site --port 3001` there). Run it once with the same URL on both sides first: demos animated by time rather than
by input (Materials, Liquid touch) differ from themselves a little, and that's the noise to ignore.

## `probe.js`: diagnostics in any browser

`probe.js` reports what vaso built on the page: each glass's rendering path (`backdrop`, `copy` or `frosted`), each
group's members, filter and copy, and a list of `problems`, such as a filter missing from the document, a group with
members but no displacement map, or a copy that never got its backdrop. The scripts inject it; `smoke.mjs` fails on
its problems.

In a browser you can only look at (a real Safari, a phone), open the developer console (Safari: Develop > Show Web
Inspector > Console), paste the file, then run:

```js
vasoProbe()       // the report
vasoProbe.show()  // a live panel in the corner of the page
vasoProbe.hide()
```

## Writing a new check

`lib.mjs` has the pieces: `open(mode, args, { reducedMotion, scale })` returns a page with `probe.js` injected and
page errors collected; `showDemo(page, title)` scrolls a demo into view and returns its rect; `probe`, `frameRate`,
`mainThread`, `shot`, `compareImages` and `table` do the rest. Demos are found by the title above them on the
homepage, so a new demo needs no test ids.

Two lessons from earlier runs:

- Open the search bar with a script click (`element.click()`), not Playwright's `click()`, which scrolls the page
  first and throws off screenshot positions.
- In Safari and Firefox modes the page is cloned into glass layers, so a selector can match a copy before the real
  element. `lib.mjs` skips anything inside `[data-vaso]`; do the same in new selectors.
