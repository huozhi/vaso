---
name: vaso
description: Add a liquid glass (refraction, dispersion, frosted) effect to React UI with the vaso component. Use for glass buttons, toolbars, pills, lenses and panels over live page content; not for plain CSS blur cards.
---

# Vaso

Use `vaso` when the user wants Apple-style liquid glass in a React app: controls,
toolbars, tab bars, lenses or panels that bend the content behind them.

Read https://vaso-react.vercel.app/llms.txt before implementing. It is the current
reference for props, defaults and browser behavior.

## Usage

- Install with `npm add vaso` and import `{ Vaso }`. It is a client component; in
  frameworks with server components, use it from a `'use client'` file.
- Wrap the content: `<Vaso depth={1.2} blur={0.5} outset={4}>…</Vaso>`. The glass
  sizes itself to its children. Without children, give it `width` and `height`
  and position it over the content it should refract.
- Leave `radius` out when the element already has a CSS radius (`rounded-full`);
  the glass follows it.
- Use `outset` to make the glass larger than the content without changing layout.
- Always set a `depth`: the default `0` is flat glass with no refraction.
  Controls: depth 1–1.5, blur 0.3–1. Lenses: depth 2–3. Panels: depth 0.2–0.5,
  blur 4–8. Negative depth makes a concave lens.

## Merging, press and light

- Glass that should merge (a button peeling off a toolbar, highlights that touch): put the `<Vaso>` pieces in one
  `<VasoGroup smooth={…}>` and move them with CSS. Don't build blob shapes by hand.
- Tactile controls: `<Vaso pressable ripple>`. Rim that follows the cursor: `light="pointer"`.
- Animate position and scale with CSS transforms on a wrapper; they cost nothing. `<Vaso>` forwards `ref`.

## Make sure it shows

- Glass needs something behind it to bend: text, imagery, a gradient. Over a flat
  color it reads as a rim only; tell the user, or add a backdrop.
- An ancestor with `filter`, `opacity` < 1, `mask`, `clip-path`, `mix-blend-mode`
  or `backdrop-filter` limits what the glass can see in Chromium. Keep those off
  the glass's ancestors, or put the backdrop content inside that ancestor.
- Safari and Firefox are supported through a backdrop copy with no extra setup.

## Performance

- Dispersion costs one displacement pass per band. Use `dispersion={false}` or a
  low value on large glass, or when many glass elements are on screen.
- Keep the number of glass elements on screen modest; each is its own layer.

Use plain CSS `backdrop-filter: blur()` instead when the user only wants a frosted
blur without refraction.
