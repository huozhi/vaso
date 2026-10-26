# Idea: `vaso/core` — framework-agnostic glass engine

Status: `createGlass` landed (#15). The `glass-features` branch adds `createGlassGroup` / `<VasoGroup>` (merging
glass), `pressable`, `ripple` and `light`. Next: `material` presets, `shape="text"`, then `vaso/element`.

## Why

Today all of the glass logic lives in `src/index.tsx` (React) and `src/backdrop-copy.ts`. Only React users can
use it. Pulling the engine out lets us ship Vue / Svelte / Solid / plain HTML bindings and a Web Component
without duplicating the optics or the Safari/Firefox fallback, which is the hardest part to get right.

## Shape of the split

```
vaso/core      – no framework imports
  optics        refraction profile (squircle surface, Snell, IOR), displacement map rendering + LRU cache,
                spectrum matrices for dispersion, specular shadow
  filter        builds the SVG <filter> DOM (map, displacement, spectrum bands, framed variant for WebKit)
  backdrop-copy current src/backdrop-copy.ts, unchanged API
  support       Chromium SVG-backdrop detection, WebKit quirks (min blur, framed filters)
  glass         createGlass(element, options) → { update(options), destroy() }
                owns ResizeObserver, resize-settle logic, radius-from-CSS, outset, mode switching

vaso            React binding: <Vaso> becomes a thin wrapper around createGlass
vaso/element    <vaso-glass depth="1.2" blur="0.5"> custom element (covers Vue, Svelte, plain HTML)
```

## Notes

- Keep the public React API identical; `<Vaso>` should be a pure re-plumb.
- `createGlass` must render nothing extra during SSR; the binding decides when to call it.
- Once core exists, the effects explored in `/lab` (merging glass, SDF shapes / glass text, pointer light,
  liquid press) become core features with a single implementation.
- Possible later: a Tailwind plugin on top of `vaso/element`, and an optional WebGL backend in core for
  canvas / video / image backdrops (caustics, per-pixel dispersion).
