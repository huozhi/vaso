'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useSpring } from '@react-spring/web'
import { Vaso } from 'vaso'
import { useGlassContext, useGlassTuning } from '../contexts/glass-context'

const TABS = ['Photos', 'Music', 'Files', 'Mail']
// Like the theme switcher, the glass is bigger than the track and overhangs it on every side
const TRACK_HEIGHT = 40
const PILL_HEIGHT = 52
const OVERHANG_X = 8
// How much wider the pill gets per pixel it still has to travel, so it stretches like a drop while moving
const STRETCH = 0.35
const MAX_STRETCH = 36

export function SegmentedControl() {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()
  const [active, setActive] = useState(0)
  const [tabs, setTabs] = useState<{ left: number; width: number }[]>([])
  const [pill, setPill] = useState({ x: 0, width: 0 })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Measure every tab, so the pill can travel between them
  useLayoutEffect(() => {
    const measure = () =>
      setTabs(tabRefs.current.map((tab) => ({ left: tab?.offsetLeft ?? 0, width: tab?.offsetWidth ?? 0 })))
    measure()
    const observer = new ResizeObserver(measure)
    tabRefs.current.forEach((tab) => tab && observer.observe(tab))
    return () => observer.disconnect()
  }, [])

  const tab = tabs[active] ?? { left: 0, width: 0 }
  const target = { left: tab.left - OVERHANG_X, width: tab.width + OVERHANG_X * 2 }
  useSpring({
    x: target.left,
    width: target.width,
    // Jump into place on the first measurement instead of sliding in from the left edge
    immediate: pill.width === 0,
    // Underdamped, so the pill overshoots its tab and bounces back before settling
    config: { tension: 300, friction: 17 },
    onChange: ({ value }) => setPill({ x: value.x, width: value.width }),
  })

  const remaining = target.left - pill.x
  // Stay inside the track: the stretch can't reach past the first or last tab
  const start = (tabs[0]?.left ?? 0) - OVERHANG_X
  const end = tabs.length ? tabs[tabs.length - 1].left + tabs[tabs.length - 1].width + OVERHANG_X : 0
  const room = remaining < 0 ? pill.x - start : end - (pill.x + pill.width)
  const stretch = Math.max(0, Math.min(MAX_STRETCH, Math.abs(remaining) * STRETCH, room))
  // Grow toward where the pill is heading, so the leading edge reaches ahead
  const pillX = pill.x - (remaining < 0 ? stretch : 0)

  return (
    <div
      role="tablist"
      aria-label="Library"
      className="relative flex p-1.5 rounded-full border shadow-md segmented-track select-none max-w-full"
      style={{ height: TRACK_HEIGHT }}
    >
      {/* Tabs come before the glass in the DOM, so the glass refracts their labels */}
      {TABS.map((tab, i) => (
        <button
          key={tab}
          ref={(el) => {
            tabRefs.current[i] = el
          }}
          role="tab"
          aria-selected={active === i}
          onClick={() => setActive(i)}
          className={`relative px-4 h-full text-sm font-medium rounded-full cursor-pointer transition-colors duration-300 ${
            active === i ? 'segmented-tab-active' : 'segmented-tab'
          }`}
        >
          {tab}
        </button>
      ))}
      {pill.width > 0 && (
        <Vaso
          width={pill.width + stretch}
          height={PILL_HEIGHT - Math.min(6, stretch * 0.2)}
          radius={PILL_HEIGHT / 2}
          depth={1.4 + tuning.depth + stretch * 0.04}
          blur={Math.max(0, 0.1 + tuning.blur)}
          dispersion={settings.dispersion}
          className="segmented-pill"
          style={{
            position: 'absolute',
            // Centered on the track's padding box, which is 2px shorter than the track because of its border
            top: (TRACK_HEIGHT - 2 - PILL_HEIGHT) / 2 + Math.min(3, stretch * 0.1),
            left: pillX,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
