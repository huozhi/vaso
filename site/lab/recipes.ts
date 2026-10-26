// How each example on the home page is made: a sentence, and the smallest snippet that reproduces it.
// Keep these honest: every snippet uses the public API, and previews say what is and isn't in the package yet.

export type Recipe = { how: string; code: string; filename?: string }

export const RECIPES = {
  search: {
    how: 'Each match gets a <Vaso>, and one <VasoGroup> unions them, so neighbours melt together. Positions are plain CSS transforms with a transition; the group follows its members every frame. The bar is two <Vaso> trading widths the same way.',
    filename: 'search.tsx',
    code: `import { Vaso, VasoGroup } from 'vaso'

// One glass per match; the group merges the ones that touch
<VasoGroup smooth={14} depth={0.9} style={{ position: 'absolute', inset: 0 }}>
  {matches.map((m) => (
    <Vaso
      key={m.key}
      style={{
        position: 'absolute',
        width: m.width,
        height: m.height,
        borderRadius: 999,
        transform: \`translate(\${m.x}px, \${m.y}px)\`,
        transition: 'transform 0.5s, width 0.4s',
      }}
    />
  ))}
</VasoGroup>

// The bar: animate the two widths in CSS, the neck between them is free
<VasoGroup smooth={34} depth={1.2} light="pointer">
  <Vaso className="toolbar" style={{ position: 'absolute' }} />
  <Vaso className="search" style={{ position: 'absolute' }} />
</VasoGroup>`,
  },
  crystal: {
    how: 'Each ball is a round <Vaso> with a strong depth. A small physics loop moves the balls with transforms, and on phones the tilt feeds gravity.',
    filename: 'ball.tsx',
    code: `import { Vaso } from 'vaso'

<div style={{ transform: \`translate(\${x}px, \${y}px) rotate(\${angle}rad)\` }}>
  <img src={photo} />
  <Vaso
    radius={size / 2}
    depth={5.5}
    dispersion={0.9}
    specular={0.9}
    style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}
  />
</div>`,
  },
  touch: {
    how: '`pressable` swells the glass and forms a small lens under the finger; `ripple` sends a ring through it from every tap; `light="pointer"` turns the rim towards the cursor. The drag is an ordinary transform on a wrapper.',
    filename: 'player.tsx',
    code: `import { Vaso } from 'vaso'

<div style={{ transform: \`translate(\${dx}px, \${dy}px)\` }}>
  <Vaso pressable ripple light="pointer" radius={44} depth={1.4} blur={1.2}>
    <Player />
  </Vaso>
</div>`,
  },
  frosted: {
    how: 'One toggle drives every glass in the card between clear and frosted: blur goes up, depth comes down, the rim gets brighter.',
    filename: 'card.tsx',
    code: `import { Vaso } from 'vaso'

// frost animates from 0 (clear) to 1 (frosted)
const glass = {
  depth: 2.4 - frost * 1.2,
  blur: 0.3 + frost * 5.7,
  specular: 0.5 + frost * 0.4,
}

<Vaso radius={24} {...glass}>
  <Clock />
</Vaso>`,
  },
  materials: {
    how: 'Preview. Each lens comes from the lab engine: the index of refraction and the surface profile shape the displacement map, ice mixes in turbulence and the bubble gets a thin-film rim. A `material` prop is next; until then, depth, blur and dispersion get you close.',
    filename: 'lens.tsx',
    code: `import { Vaso } from 'vaso'

// Closest today: shape the lens with depth, blur and dispersion
<Vaso width={160} height={160} radius={80} depth={2.6} dispersion={1.4} /> // crystal
<Vaso width={160} height={160} radius={80} depth={1.2} blur={4} />         // ice
<Vaso width={160} height={160} radius={80} depth={0.8} dispersion={0.2} /> // water`,
  },
  adaptive: {
    how: 'The scroll thumb is a plain <Vaso>. The bars read the lightness of what scrolls under them and flip their ink with two thresholds, so a busy photo never makes them flicker. The bars themselves are a preview.',
    filename: 'scrollbar.tsx',
    code: `import { Vaso } from 'vaso'

// Two thresholds: flip only on a clear change
if (ink === 'dark' && lightness < 0.42) ink = 'light'
else if (ink === 'light' && lightness > 0.6) ink = 'dark'

<div style={{ position: 'absolute', right: 5, transform: \`translateY(\${y}px)\` }}>
  <Vaso radius={10} depth={1.6} blur={0.2}>
    <div className="thumb" data-ink={ink} />
  </Vaso>
</div>`,
  },
  segmented: {
    how: 'The pill is one <Vaso> moved by an underdamped spring. While it travels it stretches toward its target and refracts a little harder, then bounces into place.',
    filename: 'segmented.tsx',
    code: `import { Vaso } from 'vaso'

<Vaso
  width={pill.width + stretch}
  height={36}
  radius={18}
  depth={1.4 + stretch * 0.04}
  style={{ position: 'absolute', transform: \`translateX(\${x}px)\` }}
/>`,
  },
  resizable: {
    how: 'Width is just a prop. While it keeps changing, vaso stretches the last displacement map instead of drawing a new one, and draws a sharp one once the size settles.',
    filename: 'resizable.tsx',
    code: `import { Vaso } from 'vaso'

<Vaso width={width} height={60} depth={0.6} blur={0.6} className="rounded-full" />`,
  },
  color: {
    how: 'A concave lens: negative depth pulls the surrounding colours in instead of magnifying them, so the wheel twists visibly around the rim.',
    filename: 'picker.tsx',
    code: `import { Vaso } from 'vaso'

<Vaso width={60} height={60} radius={30} depth={-5} dispersion={1.5} />`,
  },
  notification: {
    how: 'A plain <Vaso> with some blur and a bright rim, slid in and out with a CSS transition. The text stays crisp on top of the glass.',
    filename: 'toast.tsx',
    code: `import { Vaso } from 'vaso'

<Vaso radius={18} depth={1.6} blur={1.5} specular={1}>
  <div className="px-4 py-3">
    <strong>Build passed</strong>
    <p>Deployed to production</p>
  </div>
</Vaso>`,
  },
  outset: {
    how: '`outset` grows the glass past the element without moving anything around it. A number applies to every side; sides win over axes.',
    filename: 'outset.tsx',
    code: `import { Vaso } from 'vaso'

<span style={{ position: 'relative' }}>
  i
  <Vaso
    outset={{ x: 20, y: 14, top: 32 }}
    radius={12}
    depth={1.6}
    style={{ position: 'absolute', inset: 0 }}
  />
</span>`,
  },
} satisfies Record<string, Recipe>
