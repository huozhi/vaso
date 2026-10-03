'use client'

import { Vaso, type Outset } from 'vaso'
import { useGlassContext, useGlassTuning } from '../contexts/glass-context'

// The same letter under four panes of glass, growing from left to right in both width and height. Every pane
// leaves room around the letter; the last one reaches further above it
const EXHIBITS: { outset: Outset; code: string }[] = [
  { outset: 6, code: '6' },
  { outset: 12, code: '12' },
  { outset: { x: 20, y: 14 }, code: '{ x: 20, y: 14 }' },
  { outset: { x: 28, y: 14, top: 32 }, code: '{ x: 28, y: 14, top: 32 }' },
]

// Outset doesn't take up layout space, so each letter reserves its pane's sides with margins: the panes keep
// their own room, and lifting each letter by its bottom outset puts every pane's bottom on the same line
const sidesOf = (outset: Outset) =>
  typeof outset === 'number'
    ? { left: outset, right: outset, bottom: outset }
    : { left: outset.left ?? outset.x ?? 0, right: outset.right ?? outset.x ?? 0, bottom: outset.bottom ?? outset.y ?? 0 }

export function OutsetGallery() {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()

  return (
    // Each exhibit is as wide as its pane, with labels wrapping under it, so the gaps between panes stay even
    <div className="flex flex-wrap justify-center items-start gap-x-12 gap-y-8 select-none">
      {EXHIBITS.map((exhibit) => (
        <figure key={exhibit.code} className="flex flex-col items-center gap-3">
          {/* Panes share a bottom edge, so the growth reads as steps */}
          <div className="flex items-end justify-center h-32 pb-4">
            <span className="relative inline-block" style={{
                marginLeft: sidesOf(exhibit.outset).left,
                marginRight: sidesOf(exhibit.outset).right,
                marginBottom: sidesOf(exhibit.outset).bottom,
              }}>
              {/* The letter comes before the glass in the DOM, so the glass refracts it */}
              <span className="text-5xl font-bold theme-title">i</span>
              <Vaso
                component="span"
                outset={exhibit.outset}
                radius={Math.max(0, 12 + tuning.radius)}
                depth={1.6 + tuning.depth}
                blur={Math.max(0, 0.1 + tuning.blur)}
                dispersion={settings.dispersion + 0.3}
                style={{ position: 'absolute', inset: 0 }}
              />
            </span>
          </div>
          <figcaption className="max-w-[7rem] text-[11px] leading-snug text-center theme-label">
            <code>{exhibit.code}</code>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
