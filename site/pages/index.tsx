'use client'

import { Vaso } from 'vaso'
import { Switcher } from '../components/switcher'
import {
  GLASS_SCOPE_ATTRIBUTE,
  GLASS_SCOPE_LABEL_ATTRIBUTE,
  GlassProvider,
  GlassScope,
  useGlassContext,
  useGlassScopeAttributes,
  useGlassStore,
  useGlassTuning,
} from '../contexts/glass-context'
import { SegmentedControl } from '../components/segmented-control'
import { FloatingGlass, glassTarget } from '../components/floating-glass'
import { useDragPhysics } from '../components/use-drag-physics'
import { ToastStack } from '../components/toast-stack'
import { FrostedCard } from '../components/frosted-card'
import { ColorPicker } from '../components/color-picker'
import { CodeBlock } from '../components/code-block'
import { SiteFooter } from '../components/site-footer'
import { useRef, useState, useEffect, useLayoutEffect, useCallback, startTransition } from 'react'
import { createPortal } from 'react-dom'

import '../styles/globals.css'
import '../styles/page.css'

// How far the title glass can be dragged away from its resting spot over the title
const TITLE_DRAG_LIMIT = { x: 72, y: 28 }

// Intro for the title glass: a quick, damped shake so the rim refraction flashes across the letters
const TITLE_INTRO_KEYFRAMES = [
  { x: 0, y: 0 },
  { x: 30, y: 6 },
  { x: -24, y: -5 },
  { x: 16, y: 3 },
  { x: -9, y: -2 },
  { x: 4, y: 1 },
  { x: 0, y: 0 },
]
const TITLE_INTRO_SEGMENT = 85
// Cap each frame's time step so load-time jank slows the shake down instead of skipping its peaks
const TITLE_INTRO_MAX_STEP = 32

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function VasoTitle() {
  const { settings } = useGlassContext()
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ pointer: { x: 0, y: 0 }, offset: { x: 0, y: 0 } })
  const introFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const duration = TITLE_INTRO_SEGMENT * (TITLE_INTRO_KEYFRAMES.length - 1)
    let elapsed = 0
    let lastTime: number | undefined
    const tick = (now: number) => {
      elapsed += Math.min(now - (lastTime ?? now), TITLE_INTRO_MAX_STEP)
      lastTime = now
      const segment = Math.min(Math.floor(elapsed / TITLE_INTRO_SEGMENT), TITLE_INTRO_KEYFRAMES.length - 2)
      const progress = easeInOutCubic(Math.min(1, (elapsed - segment * TITLE_INTRO_SEGMENT) / TITLE_INTRO_SEGMENT))
      const from = TITLE_INTRO_KEYFRAMES[segment]
      const to = TITLE_INTRO_KEYFRAMES[segment + 1]
      setOffset({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress })
      if (elapsed >= duration) {
        introFrameRef.current = null
        return
      }
      introFrameRef.current = requestAnimationFrame(tick)
    }
    introFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (introFrameRef.current !== null) cancelAnimationFrame(introFrameRef.current)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    // Grabbing the glass takes over from the intro animation
    if (introFrameRef.current !== null) {
      cancelAnimationFrame(introFrameRef.current)
      introFrameRef.current = null
    }
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { pointer: { x: e.clientX, y: e.clientY }, offset }
    setIsDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const { pointer, offset: start } = dragStartRef.current
    const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
    setOffset({
      x: clamp(start.x + e.clientX - pointer.x, TITLE_DRAG_LIMIT.x),
      y: clamp(start.y + e.clientY - pointer.y, TITLE_DRAG_LIMIT.y),
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setIsDragging(false)
  }

  return (
    <span className="relative inline-block">
      <span>{'Vaso'}</span>
      {/* The glass floats over the static title text so the refraction shows while dragging across it */}
      <Vaso
        component="span"
        radius={settings.radius * 4}
        // Lift the glass a little while it's being held
        depth={Math.max(2.4, settings.depth * 3) + (isDragging ? 0.6 : 0)}
        blur={settings.blur}
        dispersion={settings.dispersion * 1.2}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'absolute',
          // Size the element itself to the glass so the whole glass is grabbable
          inset: '-8px -36px',
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none', // Prevent scrolling while dragging on touch
        }}
      />
    </span>
  )
}

const DEFAULT_VASO_WIDTH = 200
const DEFAULT_VASO_HEIGHT = 60

function IconGridDemo() {
  const vasoHeight = DEFAULT_VASO_HEIGHT // Bigger than text rows
  const [vasoWidth, setVasoWidth] = useState(DEFAULT_VASO_WIDTH) // Direct width control
  const [isDragging, setIsDragging] = useState(false)
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()

  return (
    <div className="relative theme-text-bg rounded-xl p-2 w-80 max-w-full">
      {/* Two rows of text - no background */}
      <div className="relative select-none">
        {/* First row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1">
          Quick start:
        </div>

        {/* Second row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed select-none">
          <pre className="text-xs font-mono bg-theme-text bg-sample-text/20 font-bold rounded-md whitespace-break-spaces">
            <code>{`import { Vaso } from 'vaso'`}</code>
          </pre>
        </div>

        {/* Third row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1 select-none">
          Vaso was blessed by the SVG filter and became a powerful glass.
        </div>

        {/* Left-anchored Vaso with right-side draggable bar */}
        <div className="absolute -left-[30px] top-[4px]">
          <Vaso
            width={vasoWidth}
            height={vasoHeight}
            depth={0.6 + tuning.depth}
            // Frostier and more colorful than the global settings, while still following the panel
            blur={settings.blur + 0.5}
            dispersion={settings.dispersion + 0.5}
            className="vaso-slider transition-all rounded-full shadow-gray-50/30 duration-20 ease-out"
          >
            <div className="w-full h-full bg-transparent relative" style={{ width: vasoWidth, height: vasoHeight }}>
              {/* Right-side draggable bar */}
              <div
                className={`absolute left-[20px] top-1/2 -translate-y-1/2 w-[calc(100%-40px)] h-full bg-theme-text-bg-sample-text/30 rounded-full transition-all duration-80 ease-out hover:scale-x-150 hover:brightness-150 ${
                  isDragging ? 'cursor-grabbing scale-x-150 brightness-150' : 'cursor-ew-resize'
                }`}
                onPointerDown={(e) => {
                  setIsDragging(true)
                  const startX = e.clientX
                  const startWidth = vasoWidth

                  const handlePointerMove = (e: PointerEvent) => {
                    const deltaX = e.clientX - startX
                    // 1:1 movement - cursor moves same distance as width change
                    const newWidth = Math.max(60, Math.min(320 + 40, startWidth + deltaX))
                    setVasoWidth(newWidth)
                  }

                  const handlePointerUp = () => {
                    setIsDragging(false)
                    document.removeEventListener('pointermove', handlePointerMove)
                    document.removeEventListener('pointerup', handlePointerUp)
                  }

                  document.addEventListener('pointermove', handlePointerMove)
                  document.addEventListener('pointerup', handlePointerUp)
                }}
                title="Drag to resize"
                aria-label="Drag to resize the glass"
              />
              {/* Drag affordance, so it reads as resizable at a glance */}
              <span
                className={`drag-hint absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center w-7 h-5 rounded-full shadow-sm ${
                  isDragging ? 'drag-hint-active' : ''
                }`}
                aria-hidden
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
                </svg>
              </span>
            </div>
          </Vaso>
        </div>
      </div>
    </div>
  )
}

function VasoSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const { settings } = useGlassContext()
  const thumb = useDragPhysics()
  const [trackWidth, setTrackWidth] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  // Track the track's width, which can settle after mount (e.g. inside the floating panel)
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measureTrack = () => setTrackWidth(track.clientWidth)
    measureTrack()
    const observer = new ResizeObserver(measureTrack)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  // Calculate position as percentage
  const percentage = ((value - min) / (max - min)) * 100
  const thumbSize = 20 // Vaso thumb size
  const touchAreaSize = thumbSize + 8 // 28px touch target
  const maxThumbLeft = Math.max(0, trackWidth - thumbSize)
  const thumbPosition = (percentage / 100) * maxThumbLeft
  // Position touch area centered on thumb, clamped to track bounds
  const touchAreaLeft = Math.max(0, Math.min(trackWidth - touchAreaSize, thumbPosition - 4))

  return (
    <div className="relative w-full h-4 flex items-center select-none">
      {/* Background track */}
      <div className="w-full h-1 bg-[#cdcfc1a8] rounded-full" ref={trackRef} />

      {/* Draggable Vaso thumb with larger touch area */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: `${touchAreaLeft}px`,
          width: `${touchAreaSize}px`,
          height: `${touchAreaSize}px`,
        }}
      >
        {/* Larger invisible touch area */}
        <div
          className="absolute inset-0 touch-manipulation"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            thumb.start(e.clientX)

            // Capture the pointer to track movement even outside the thumb
            // This allows smooth dragging without losing tracking if cursor moves fast
            const target = e.currentTarget
            target.setPointerCapture(e.pointerId)

            const startX = e.clientX
            const startValue = value

            const handlePointerMove = (e: PointerEvent) => {
              e.preventDefault()
              thumb.move(e.clientX)
              const currentTrackWidth = trackRef.current?.clientWidth || trackWidth
              const deltaX = e.clientX - startX
              const deltaPercentage = (deltaX / Math.max(1, currentTrackWidth - thumbSize)) * 100
              const deltaValue = (deltaPercentage / 100) * (max - min)
              const newValue = Math.max(min, Math.min(max, startValue + deltaValue))

              // Round to nearest step
              const steppedValue = Math.round(newValue / step) * step
              startTransition(() => {
                onChange(steppedValue)
              })
            }

            const handlePointerUp = (e: PointerEvent) => {
              thumb.end()
              // Release pointer capture to end the drag interaction
              target.releasePointerCapture(e.pointerId)
              target.removeEventListener('pointermove', handlePointerMove)
              target.removeEventListener('pointerup', handlePointerUp)
              target.removeEventListener('pointercancel', handlePointerUp)
            }

            target.addEventListener('pointermove', handlePointerMove)
            target.addEventListener('pointerup', handlePointerUp)
            target.addEventListener('pointercancel', handlePointerUp)
          }}
        />

        {/* Visual Vaso thumb */}
        <Vaso
          width={thumbSize}
          height={thumbSize}
          radius={999}
          depth={4 + thumb.press * 2}
          blur={0.2}
          dispersion={settings.dispersion + thumb.press * 0.6}
          className="vaso-slider-thumb pointer-events-none"
          // Clear while held, so the swollen glass shows the track through it
          style={{ transform: thumb.transform, backgroundColor: thumb.press > 0.05 ? 'transparent' : undefined }}
        >
          <div
            className="w-full h-full rounded-full pointer-events-none"
            style={{ width: thumbSize, height: thumbSize }}
          />
        </Vaso>
      </div>
    </div>
  )
}

const GLASS_ATTRIBUTES = [
  { key: 'depth', label: 'Depth', min: 0, max: 2, step: 0.1 },
  { key: 'blur', label: 'Blur', min: 0, max: 2, step: 0.2 },
  { key: 'radius', label: 'Radius', min: 0, max: 16, step: 2 },
  { key: 'dispersion', label: 'Dispersion', min: 0, max: 2, step: 0.1 },
] as const

// Presses on controls are their own interaction (e.g. toggling the theme twice), never a panel trigger
const PANEL_TRIGGER_EXCLUDE =
  'a, button, input, textarea, select, label, [role="button"], [role="switch"], [data-glass-panel]'

// Hit-test the glass layers themselves: they ignore pointer events and can overhang their element (px/py).
// Only glass in a tunable demo counts
function getGlassAt(target: EventTarget | null, x: number, y: number) {
  if (target instanceof Element && target.closest(PANEL_TRIGGER_EXCLUDE)) return null
  return (
    Array.from(document.querySelectorAll('[data-vaso]')).find((glass) => {
      if (glass.closest('[data-glass-panel]') || !glass.closest(`[${GLASS_SCOPE_ATTRIBUTE}]`)) return false
      const rect = glass.getBoundingClientRect()
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    }) ?? null
  )
}
function scopeOf(glass: Element) {
  const scope = glass.closest(`[${GLASS_SCOPE_ATTRIBUTE}]`)!
  return { id: scope.getAttribute(GLASS_SCOPE_ATTRIBUTE)!, label: scope.getAttribute(GLASS_SCOPE_LABEL_ATTRIBUTE)! }
}

const DOUBLE_CLICK_MS = 300
const DOUBLE_CLICK_MOVE_TOLERANCE = 5
const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_TOLERANCE = 10
const PANEL_MARGIN = 12
const SCROLL_CLOSE_DISTANCE = 8

function GlassPanel() {
  const { settingsFor, updateSettingsFor } = useGlassStore()
  // Where the panel opened, and the demo whose glass it tunes
  const [anchor, setAnchor] = useState<{ x: number; y: number; scope: { id: string; label: string } } | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number; origin: string } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Open on double click (mouse) or long press (touch) on a glass
  useEffect(() => {
    // Detect double clicks from pointerdown instead of the dblclick event: draggables that call
    // preventDefault() on pointerdown suppress dblclick, and toggles move away after the first click,
    // so the glass is hit-tested on the first press
    let lastMousePress: { time: number; x: number; y: number; glass: Element | null } | null = null
    const handleMousePress = (e: PointerEvent) => {
      const previous = lastMousePress
      const isDoubleClick =
        previous &&
        e.timeStamp - previous.time < DOUBLE_CLICK_MS &&
        Math.hypot(e.clientX - previous.x, e.clientY - previous.y) < DOUBLE_CLICK_MOVE_TOLERANCE
      if (isDoubleClick) {
        lastMousePress = null
        // Both presses must land on the same glass
        if (!previous.glass || previous.glass !== getGlassAt(e.target, e.clientX, e.clientY)) return
        // Drop the word selection the double click makes
        requestAnimationFrame(() => window.getSelection()?.removeAllRanges())
        setAnchor({ x: e.clientX, y: e.clientY, scope: scopeOf(previous.glass) })
        return
      }
      lastMousePress = { time: e.timeStamp, x: e.clientX, y: e.clientY, glass: getGlassAt(e.target, e.clientX, e.clientY) }
    }

    let pressTimer: ReturnType<typeof setTimeout> | undefined
    let pressStart: { x: number; y: number; glass: Element } | null = null
    const cancelPress = () => {
      clearTimeout(pressTimer)
      pressStart = null
    }
    // A long press ends with a click on whatever is under the finger, so swallow it
    const suppressNextClick = () => {
      const swallow = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 800)
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return handleMousePress(e)
      const glass = getGlassAt(e.target, e.clientX, e.clientY)
      if (!glass) return
      pressStart = { x: e.clientX, y: e.clientY, glass }
      clearTimeout(pressTimer)
      pressTimer = setTimeout(() => {
        if (!pressStart) return
        navigator.vibrate?.(10)
        suppressNextClick()
        setAnchor({ x: pressStart.x, y: pressStart.y, scope: scopeOf(pressStart.glass) })
        pressStart = null
      }, LONG_PRESS_MS)
    }
    const handlePointerMove = (e: PointerEvent) => {
      if (!pressStart) return
      if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > LONG_PRESS_MOVE_TOLERANCE) cancelPress()
    }
    // Stop the native context menu from competing with the long press on touch devices
    const handleContextMenu = (e: MouseEvent) => {
      if (pressStart || (e as PointerEvent).pointerType === 'touch') e.preventDefault()
    }

    // Capture phase, so handlers that stop propagation (on the page or from extensions) can't swallow the gesture
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('pointermove', handlePointerMove, true)
    window.addEventListener('pointerup', cancelPress, true)
    window.addEventListener('pointercancel', cancelPress, true)
    window.addEventListener('scroll', cancelPress, { passive: true })
    window.addEventListener('contextmenu', handleContextMenu)
    return () => {
      cancelPress()
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('pointermove', handlePointerMove, true)
      window.removeEventListener('pointerup', cancelPress, true)
      window.removeEventListener('pointercancel', cancelPress, true)
      window.removeEventListener('scroll', cancelPress)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  // Close on outside press, Escape, or scroll
  useEffect(() => {
    if (!anchor) return
    const close = () => setAnchor(null)
    // The press that opened the panel can still be dispatching when this listener is added, so skip it
    const openedAt = performance.now()
    const handlePointerDown = (e: PointerEvent) => {
      if (e.timeStamp < openedAt) return
      if (!panelRef.current?.contains(e.target as Node)) close()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // Close once the page actually scrolls. Small layout-driven adjustments (scroll anchoring) don't count
    const openedScrollY = window.scrollY
    const handleScroll = (e: Event) => {
      const isPage = e.target === document
      if (!isPage || Math.abs(window.scrollY - openedScrollY) > SCROLL_CLOSE_DISTANCE) close()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    // Capture phase catches scrolling in any container, not just the page
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [anchor])

  // Place the panel next to the pointer, flipping sides so it stays inside the viewport
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!anchor || !panel) {
      setPosition(null)
      return
    }
    const place = () => {
      const { offsetWidth: width, offsetHeight: height } = panel
      const flipX = anchor.x + width + PANEL_MARGIN > window.innerWidth
      const flipY = anchor.y + height + PANEL_MARGIN > window.innerHeight
      const clamp = (value: number, size: number, viewport: number) =>
        Math.max(PANEL_MARGIN, Math.min(viewport - size - PANEL_MARGIN, value))
      setPosition({
        left: clamp(flipX ? anchor.x - width : anchor.x, width, window.innerWidth),
        top: clamp(flipY ? anchor.y - height : anchor.y, height, window.innerHeight),
        origin: `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`,
      })
    }
    place()
    // Re-place when the panel's size settles (late styles or fonts) or the viewport changes
    const observer = new ResizeObserver(place)
    observer.observe(panel)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [anchor])

  if (!anchor) return null
  const settings = settingsFor(anchor.scope.id)

  return (
    <div
      ref={panelRef}
      data-glass-panel
      role="dialog"
      aria-label="Glass attributes"
      className="glass-panel z-[1000] w-[calc(100vw-24px)] max-w-[288px]"
      style={{
        // Inline so the panel never lands in the page flow, even before utility styles are ready
        position: 'fixed',
        left: position?.left ?? anchor.x,
        top: position?.top ?? anchor.y,
        transformOrigin: position?.origin,
        // Measure off-screen first, then reveal at the clamped position
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <Vaso radius={20} depth={0.3} blur={6} dispersion={0} className="rounded-[20px]">
        {/* Positioned so the content paints above the glass layer instead of being refracted by it */}
        <div className="relative grid grid-cols-2 gap-x-5 gap-y-4 px-5 py-4 rounded-[20px] text-xs theme-controls theme-controls-text">
          <div className="col-span-2 font-semibold theme-controls-title">{anchor.scope.label}</div>
          {GLASS_ATTRIBUTES.map(({ key, label, min, max, step }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span>{label}</span>
                <span className="font-mono tabular-nums">{settings[key].toFixed(1)}</span>
              </div>
              <VasoSlider
                value={settings[key]}
                min={min}
                max={max}
                step={step}
                onChange={(value) => updateSettingsFor(anchor.scope.id, { [key]: value })}
              />
            </div>
          ))}
        </div>
      </Vaso>
    </div>
  )
}

function ThemeSwitcherDemo({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  return (
    <div className="flex flex-col gap-3 items-start">
      <div className="flex justify-start">
        <Switcher
          xOption={{
            id: 'light',
            label: 'Light',
            icon:
              theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : null,
          }}
          yOption={{
            id: 'dark',
            label: 'Dark',
            icon:
              theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="currentColor"
                  />
                </svg>
              ) : null,
          }}
          value={theme}
          onChange={setTheme}
        />
      </div>
    </div>
  )
}

const LENS_SIZE = 120
// How far the lens may hang over the page edges
const LENS_OVERFLOW = 24

// A lens that starts over the photo and can be dragged anywhere on the page. It's portaled to the body and
// positioned in page coordinates, so it scrolls with the content it sits on
function DraggableGlassDemo() {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()
  // The lens is portaled out of the demo, so it carries the demo's scope itself
  const scopeAttributes = useGlassScopeAttributes()
  // Center of the lens in page coordinates; null until it's anchored to the photo after mount
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [glassIntensity, setGlassIntensity] = useState(0.5)
  const dragStartRef = useRef({ pointer: { x: 0, y: 0 }, position: { x: 0, y: 0 } })
  // Until the lens is first dragged, it follows the photo through layout changes
  const movedRef = useRef(false)
  const photoRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const thumb = useDragPhysics()

  useLayoutEffect(() => {
    const anchor = () => {
      const photo = photoRef.current
      if (movedRef.current || !photo) return
      const rect = photo.getBoundingClientRect()
      setPosition({ x: rect.left + window.scrollX + rect.width * 0.35, y: rect.top + window.scrollY + rect.height / 2 })
    }
    anchor()
    const observer = new ResizeObserver(anchor)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  const handleGlassPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!position) return
      e.preventDefault()
      // Capture the pointer so fast drags keep tracking outside the lens
      e.currentTarget.setPointerCapture(e.pointerId)
      dragStartRef.current = { pointer: { x: e.clientX, y: e.clientY }, position }
      movedRef.current = true
      setIsDragging(true)
    },
    [position]
  )

  const handleGlassPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const { pointer, position: start } = dragStartRef.current
    // Keep the lens on the page
    const page = document.documentElement
    const min = LENS_SIZE / 2 - LENS_OVERFLOW
    const next = {
      x: Math.max(min, Math.min(page.scrollWidth - min, start.x + e.clientX - pointer.x)),
      y: Math.max(min, Math.min(page.scrollHeight - min, start.y + e.clientY - pointer.y)),
    }
    // Keep pointer handling responsive even if re-rendering the glass is expensive
    startTransition(() => {
      setPosition(next)
    })
  }, [])

  const handleGlassPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setIsDragging(false)
  }, [])

  // Slider handlers - all using React synthetic events
  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent this from triggering glass drag

    const target = e.currentTarget as HTMLElement
    // Capture pointer so slider keeps responding even if pointer moves outside track
    target.setPointerCapture(e.pointerId)
    thumb.start(e.clientX)

    // Calculate intensity from click/touch position on slider track
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    startTransition(() => {
      setGlassIntensity(percentage)
    })
  }, [])

  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    // Only update if we're actively dragging the slider
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    thumb.move(e.clientX)

    // Recalculate intensity based on current pointer position
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    startTransition(() => {
      setGlassIntensity(percentage)
    })
  }, [])

  const handleSliderPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture(e.pointerId)) {
      // Release capture when done dragging slider
      target.releasePointerCapture(e.pointerId)
    }
    thumb.end()
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-[296px] max-w-full h-[176px]">
        <div ref={photoRef} className="relative w-full h-full bg-center rounded-3xl" style={{ backgroundImage: `url(/flower.jpg)` }}>
          {/* Instruction overlay */}
          <div className="absolute select-none top-4 left-4 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2">
            <p className="text-xs text-white/90 font-medium">Drag the glass anywhere</p>
          </div>
        </div>
      </div>

      {position &&
        createPortal(
          <div
            {...scopeAttributes}
            style={{
              position: 'absolute',
              left: position.x - LENS_SIZE / 2,
              top: position.y - LENS_SIZE / 2,
              width: LENS_SIZE,
              height: LENS_SIZE,
              // Above the page content and the header, so it can refract both
              zIndex: 950,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onPointerDown={handleGlassPointerDown}
            onPointerMove={handleGlassPointerMove}
            onPointerUp={handleGlassPointerUp}
            onPointerCancel={handleGlassPointerUp}
          >
            <Vaso
              width={LENS_SIZE}
              height={LENS_SIZE}
              radius={LENS_SIZE / 2}
              // Lift the lens a little while it's being held
              depth={1 + glassIntensity * 3 + tuning.depth + (isDragging ? 0.4 : 0)}
              blur={settings.blur * 0.4 + glassIntensity * 0.3}
              dispersion={settings.dispersion * (1 + glassIntensity)}
              className="w-full h-full"
              style={{ transform: `scale(${isDragging ? 1.04 : 1})`, transition: 'transform 120ms ease-out' }}
            >
              <div className="w-full h-full rounded-full bg-transparent" />
            </Vaso>
          </div>,
          document.body,
        )}

      {/* Glass Intensity Slider Control */}
      <div className="flex items-center justify-center gap-4 w-64 rounded-xl">
        <span className="text-sm font-medium theme-controls-title">Depth</span>
        <div className="relative w-48 h-6 flex items-center">
          <div
            ref={sliderRef}
            className="relative w-full h-2 bg-[#bcbeb3] rounded-full cursor-pointer"
            style={{ touchAction: 'none' }}
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
          >
            {/* Slider track */}
            <div
              className="absolute h-2 bg-[#e3a75a] rounded-full overflow-hidden"
              style={{ width: `${glassIntensity * 100}%` }}
            />

            {/* Vaso slider thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[36px] h-[24px]"
              style={{
                left: `calc(${glassIntensity * 100}% - 18px)`
              }}
            >
              <Vaso
                width={36}
                height={24}
                radius={12}
                // Bends harder as it swells under the finger
                depth={1 + glassIntensity * 2 + thumb.press * 1.5}
                dispersion={settings.dispersion + thumb.press * 0.6}
                blur={0.3}
                className="w-full h-full"
                style={{ transform: thumb.transform }}
              >
                {/* The white fill fades out while held, leaving clear glass over the track */}
                <div
                  className="w-full h-full rounded-full"
                  style={{ backgroundColor: `rgba(255, 255, 255, ${0.2 * Math.max(0, 1 - thumb.press)})` }}
                />
              </Vaso>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const USAGE_CODE = `import { Vaso } from 'vaso'

export function Toolbar() {
  return (
    <Vaso radius={24} depth={1.2} blur={0.5} dispersion={0.6} px={8} py={4}>
      <button>Share</button>
    </Vaso>
  )
}`

function DemoCard({
  title,
  caption,
  wide,
  align = 'center',
  children,
}: {
  title: string
  caption?: string
  wide?: boolean
  align?: 'start' | 'center'
  children: React.ReactNode
}) {
  return (
    <figure className={`flex flex-col gap-5 min-w-0 ${wide ? 'md:col-span-2' : ''}`}>
      <figcaption className={`text-xs theme-label ${align === 'center' ? 'text-center' : ''}`}>
        <span className="font-semibold theme-heading">{title}</span>
        {caption && <> · {caption}</>}
      </figcaption>
      <div className={`flex ${align === 'center' ? 'justify-center' : 'justify-start'}`}>{children}</div>
    </figure>
  )
}

function Home() {
  const [theme, setTheme] = useState('light')

  return (
    <>
      <title>Vaso</title>
      <meta name="description" content="Glass Effect for React" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
        precedence="default"
      />

      <div
        id="top"
        className="min-h-screen lg:p-8 lg:pt-22 lg:pb-32 p-2 pt-[calc(2rem+30px)] pb-8 root"
        data-theme={theme}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >

        <div className="max-w-3xl mx-auto">
          <header className="relative mb-8 flex items-center justify-between mobile-header">
            {/* Soft color glow behind the hero */}
            <div aria-hidden className="hero-glow" />
            <div className="relative max-w-sm mobile-title">
              <h1 className="text-[88px] font-bold mb-12 mobile-h1 user-select-none theme-title">
                <small className="mobile-h1-small font-light mr-8 theme-subtitle"></small>
                <GlassScope id="title" label="Title">
                  <VasoTitle />
                </GlassScope>
              </h1>
              <p className="text-lg theme-description">Liquid Glass Effect for React</p>
            </div>
          </header>

          {/* Floating controls, opened by double click or long press */}
          <GlassPanel />

          <div className="px-4 py-6 lg:p-8 sm:p-4 space-y-8 rounded-lg theme-content">
            <section id="examples" className="relative border-b pb-6 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Examples</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-20 pt-8 border-t border-[var(--theme-border-color)]">
                <DemoCard title="Theme switch" align="start">
                  <GlassScope id="theme" label="Theme switch">
                    <ThemeSwitcherDemo theme={theme} setTheme={setTheme} />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Resizable glass" caption="drag the handle" align="start">
                  <GlassScope id="resizable" label="Resizable glass">
                    <IconGridDemo />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Lens" caption="drag it anywhere on the page" wide>
                  <GlassScope id="lens" label="Lens">
                    <DraggableGlassDemo />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Frosted glass" caption="toggle frost on every glass" wide>
                  <GlassScope id="frosted" label="Frosted glass">
                    <FrostedCard />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Segmented control" caption="the pill bounces into place" wide>
                  <GlassScope id="segmented" label="Segmented control">
                    <SegmentedControl />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Color picker" caption="drag the lens around the wheel" wide>
                  <GlassScope id="color" label="Color picker">
                    <ColorPicker />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Notification" wide>
                  <GlassScope id="notification" label="Notification">
                    <ToastStack />
                  </GlassScope>
                </DemoCard>
              </div>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Installation</h2>
              <p className="mb-4 theme-text">
                <FloatingGlass>
                  <code {...glassTarget} className="text-sm font-bold theme-code">
                    npm install vaso
                  </code>
                </FloatingGlass>
              </p>
            </section>

            <section id="usage" className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Usage</h2>

              <p className="mb-4 theme-text">
                Import the{' '}
                <FloatingGlass>
                  <code {...glassTarget} className="text-sm font-bold theme-code">{`<Vaso>`}</code>
                </FloatingGlass>{' '}
                component in your React application and wrap it around any content you want to apply the glass effect
                to.
              </p>

              <div className="mb-6">
                <CodeBlock filename="toolbar.tsx" code={USAGE_CODE} />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 theme-text">
                <span>Tune it with</span>
                <FloatingGlass className="inline-flex flex-wrap items-center gap-x-5 gap-y-3 py-3">
                  {['depth', 'blur', 'dispersion', 'radius', 'specular'].map((prop) => (
                    <code key={prop} {...glassTarget} className="text-sm font-bold theme-code">
                      `{prop}`
                    </code>
                  ))}
                </FloatingGlass>
              </div>
            </section>

            <section>
              <SiteFooter />
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Page() {
  return (
    <GlassProvider>
      <Home />
    </GlassProvider>
  )
}
