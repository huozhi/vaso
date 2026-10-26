# vaso

Liquid glass for React. Source in `src/` (`src/core/` is the framework-free engine, `src/index.tsx` the React
binding), the demo site in `site/`, docs for users in `README.md`, `site/public/llms.txt` and `skills/vaso/`.

- `pnpm dev`: builds `dist/`, rebuilds on change, serves the site on http://localhost:3000
- `pnpm build`: the package only

## Checking changes

Browser checks live in `validation/` (see its README). With the site running:

- `node validation/smoke.mjs`: every demo loads, renders and reports no problems
- `node validation/search.mjs`: merging glass end to end
- `node validation/compare.mjs --demo "<title>"`: the same demo across browsers
- `node validation/ab.mjs --base <url> --head <url>`: regressions against another build

Chromium refracts the real backdrop; Safari and Firefox refract a copy of it (`src/core/backdrop-copy.ts`). A change
to glass rendering needs checking on both paths: the default modes cover both, and `--modes webkit` runs the real
Safari engine. `validation/probe.js` pasted into a browser console reports what vaso built on that page.
