'use client'

import { Vaso, type VasoProps } from 'vaso'
import { Switcher } from '../components/switcher'
import { HoverCodeGlass } from '../components/hover-vaso'
import { GlassProvider, useGlassContext } from '../contexts/glass-context'
import { useRef, useState, useEffect, useLayoutEffect, useCallback, startTransition } from 'react'

import '../styles/globals.css'
import '../styles/page.css'
import { useSpring } from '@react-spring/web'

function CodeGlass({ children, ...props }: { children: React.ReactNode } & VasoProps<HTMLSpanElement>) {
  const { settings } = useGlassContext()

  return (
    <Vaso
      component="span"
      px={settings.px}
      py={settings.py}
      radius={settings.radius}
      blur={settings.blur}
      depth={settings.depth}
      dispersion={settings.dispersion}
      {...props}
    >
      {children}
    </Vaso>
  )
}

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
            depth={0.6}
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
  const [isDragging, setIsDragging] = useState(false)
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
            setIsDragging(true)

            // Capture the pointer to track movement even outside the thumb
            // This allows smooth dragging without losing tracking if cursor moves fast
            const target = e.currentTarget
            target.setPointerCapture(e.pointerId)

            const startX = e.clientX
            const startValue = value

            const handlePointerMove = (e: PointerEvent) => {
              e.preventDefault()
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
              setIsDragging(false)
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
          depth={4}
          blur={0.2}
          dispersion={settings.dispersion}
          className={`vaso-slider-thumb transition-all duration-100 ease-out pointer-events-none ${
            isDragging ? 'scale-110' : 'hover:scale-105'
          }`}
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

// Hit-test the glass layers themselves: they ignore pointer events and can overhang their element (px/py)
function getGlassAt(target: EventTarget | null, x: number, y: number) {
  if (target instanceof Element && target.closest(PANEL_TRIGGER_EXCLUDE)) return null
  return (
    Array.from(document.querySelectorAll('[data-vaso]')).find((glass) => {
      if (glass.closest('[data-glass-panel]')) return false
      const rect = glass.getBoundingClientRect()
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    }) ?? null
  )
}
const DOUBLE_CLICK_MS = 300
const DOUBLE_CLICK_MOVE_TOLERANCE = 5
const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_TOLERANCE = 10
const PANEL_MARGIN = 12
const SCROLL_CLOSE_DISTANCE = 8

function GlassPanel() {
  const { settings, updateSettings } = useGlassContext()
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
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
        setAnchor({ x: e.clientX, y: e.clientY })
        return
      }
      lastMousePress = { time: e.timeStamp, x: e.clientX, y: e.clientY, glass: getGlassAt(e.target, e.clientX, e.clientY) }
    }

    let pressTimer: ReturnType<typeof setTimeout> | undefined
    let pressStart: { x: number; y: number } | null = null
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
      if (!getGlassAt(e.target, e.clientX, e.clientY)) return
      pressStart = { x: e.clientX, y: e.clientY }
      clearTimeout(pressTimer)
      pressTimer = setTimeout(() => {
        if (!pressStart) return
        navigator.vibrate?.(10)
        suppressNextClick()
        setAnchor(pressStart)
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
                onChange={(value) => updateSettings({ [key]: value })}
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
    <div className="flex flex-col gap-3 items-start mt-6">
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

const FROSTED_VIDEO_SPEED = 2

function WaterFlowDemo() {
  const { settings } = useGlassContext()
  // The MP4 version of the GIF, so the playback speed can be changed
  const videoUrl = 'https://media1.giphy.com/media/EzUMaltmsbK3G1Y5Ow/giphy.mp4'
  const [frostedGlass, setFrostedGlass] = useState(true)
  // 0 = clear glass, 1 = frosted; animated between the two
  const [frost, setFrost] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Metadata can load before hydration attaches onLoadedMetadata, so also apply the rate on mount
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = FROSTED_VIDEO_SPEED
  }, [])
  useSpring({
    frost: frostedGlass ? 1 : 0,
    config: {
      tension: 170,
      friction: 26,
      duration: 220,
    },
    easing: 'easeInOutCubic',
    onChange: ({ value }) => {
      setFrost(value.frost)
    },
  })
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Background Container (larger) */}
      <div className="relative w-72 h-30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Background video (fills entire container) */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          // Loading media resets the rate, so apply it again once metadata is ready
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = FROSTED_VIDEO_SPEED
          }}
        />

        {/* Dynamic Island (centered, smaller) */}
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-50 h-12 overflow-hidden">
          {/* Vaso Glass Effect (only over island) */}
          <Vaso
            radius={20}
            // Clear: crisp and strongly refracting. Frosted: heavily blurred with a brighter rim
            depth={2.4 - frost * 1.2}
            blur={0.3 + frost * 5.7}
            specular={0.5 + frost * 0.4}
            dispersion={settings.dispersion * (1 - frost * 0.5)}
            className="top-0 left-0 w-full h-full rounded-full overflow-hidden"
          ></Vaso>

          {/* Icons (always on top) */}
          {/* The frosted tint sits above the glass with the icons, so it looks the same in every browser */}
          <div
            className="absolute inset-0 flex items-center justify-between rounded-full text-[#fff]"
            style={{ backgroundColor: `rgba(255, 255, 255, ${frost * 0.18})` }}
          >
            {/* Back Arrow */}
            <button className="p-3 rounded-full transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Folder */}
            <button className="p-3 rounded-full transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Trash */}
            <button className="p-3 rounded-full transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Toggle Control */}
      <div className="flex items-center justify-center gap-4 w-64 rounded-xl">
        <span className="text-sm font-medium theme-controls-title mr-4">Frosted</span>
        <button
          onClick={() => setFrostedGlass(!frostedGlass)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            frostedGlass ? 'bg-[#e3a75a]' : 'bg-[#bcbeb3]'
          }`}
        >
          <span className="absolute top-1/2 left-1/2 -translate-y-[50%] -translate-x-1/2 w-[56px] h-[36px]">
            <Vaso
              width={56}
              height={36}
              radius={20}
              depth={frostedGlass ? 2 : 0.5}
              dispersion={settings.dispersion}
              blur={0.3}
              className={`transform transition-transform translate-y-1/2 ${
                frostedGlass ? 'translate-x-4' : '-translate-x-4'
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  )
}

function DraggableGlassDemo() {
  const { settings } = useGlassContext()
  const [position, setPosition] = useState({ x: 100, y: 60 })
  const [glassIntensity, setGlassIntensity] = useState(0.5)
  const dragStartRef = useRef({ pointer: { x: 0, y: 0 }, position: { x: 0, y: 0 } })
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const glassSize = 120
  const overflowGap = 24

  // Glass drag handlers - all using React synthetic events
  const handleGlassPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLElement

      // Capture all pointer events to this element until released
      // This ensures we continue receiving pointermove events even when
      // the pointer moves outside the element boundaries (e.g. fast dragging)
      // Without this, the drag would stop when cursor leaves the element
      target.setPointerCapture(e.pointerId)

      // Store initial pointer position and element position for delta calculations
      dragStartRef.current = {
        pointer: { x: e.clientX, y: e.clientY },
        position: { x: position.x, y: position.y },
      }
    },
    [position]
  )

  const handleGlassPointerMove = useCallback((e: React.PointerEvent) => {
    // Only handle move events if we're actively capturing this pointer
    // This prevents processing moves when not dragging
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return

    // Calculate new position based on pointer movement delta
    const newPosition = {
      x: dragStartRef.current.position.x + (e.clientX - dragStartRef.current.pointer.x),
      y: dragStartRef.current.position.y + (e.clientY - dragStartRef.current.pointer.y),
    }

    // Constrain to container bounds to keep glass visible
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect) {
      newPosition.x = Math.max(
        glassSize / 2 - overflowGap,
        Math.min(containerRect.width - glassSize / 2 + overflowGap, newPosition.x)
      )
      newPosition.y = Math.max(
        glassSize / 2 - overflowGap,
        Math.min(containerRect.height - glassSize / 2 + overflowGap, newPosition.y)
      )
    }

    // Wrap in startTransition to prioritize pointer responsiveness over visual updates
    // This keeps the drag smooth even if re-rendering the Vaso effect is expensive
    startTransition(() => {
      setPosition(newPosition)
    })
  }, [glassSize, overflowGap])

  const handleGlassPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture(e.pointerId)) {
      // Release the pointer capture to return to normal event handling
      // After this, pointer events will only fire when over the element again
      target.releasePointerCapture(e.pointerId)
    }
  }, [])

  // Slider handlers - all using React synthetic events
  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent this from triggering glass drag

    const target = e.currentTarget as HTMLElement
    // Capture pointer so slider keeps responding even if pointer moves outside track
    target.setPointerCapture(e.pointerId)

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
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas container */}
      <div className="relative w-[360px] h-[240px] p-8" ref={containerRef}>
        {/* Background image */}
        <div
          className="relative w-full h-full bg-center rounded-3xl"
          style={{
            backgroundImage: `url(/flower.jpg)`,
          }}
        >
          {/* Instruction overlay */}
          <div className="absolute select-none top-4 left-4 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2">
            <p className="text-xs text-white/90 font-medium">Drag the glass around</p>
          </div>
        </div>

        {/* Draggable glass element */}
        <div
          className="absolute"
          style={{
            left: position.x - glassSize / 2,
            top: position.y - glassSize / 2,
            width: glassSize,
            height: glassSize,
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
          onPointerDown={handleGlassPointerDown}
          onPointerMove={handleGlassPointerMove}
          onPointerUp={handleGlassPointerUp}
          onPointerCancel={handleGlassPointerUp}
        >
          <Vaso
            width={glassSize}
            height={glassSize}
            radius={glassSize / 2}
            depth={1 + glassIntensity * 3}
            blur={0.1 + glassIntensity * 0.3}
            dispersion={settings.dispersion * (1 + glassIntensity)}
            className="w-full h-full"
          >
            <div className="w-full h-full rounded-full bg-transparent" />
          </Vaso>
        </div>
      </div>

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
                depth={1 + glassIntensity * 2}
                dispersion={settings.dispersion}
                blur={0.3}
                className="w-full h-full"
              >
                <div className="w-full h-full rounded-full bg-white/20" />
              </Vaso>
            </div>
          </div>
        </div>
      </div>
    </div>
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
        className="min-h-screen lg:p-8 lg:pt-22 lg:pb-32 p-2 pt-[calc(2rem+30px)] pb-8 root"
        data-theme={theme}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="max-w-3xl mx-auto">
          <header className="mb-8 flex items-center justify-between mobile-header">
            <div className="max-w-sm mobile-title">
              <h1 className="text-[88px] font-bold mb-12 mobile-h1 user-select-none theme-title">
                <small className="mobile-h1-small font-light mr-8 theme-subtitle"></small>
                <VasoTitle />
              </h1>
              <p className="text-lg theme-description">Liquid Glass Effect for React</p>
            </div>
          </header>

          {/* Floating controls, opened by double click or long press */}
          <GlassPanel />

          <div className="px-4 py-6 lg:p-8 sm:p-4 space-y-8 rounded-lg theme-content">
            <section className="relative border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Play</h2>
              <div className="mt-2 relative border-t border-[var(--theme-border-color)] py-4">
                {/* 2x2 Grid Layout */}
                <div className="grid grid-cols-2 gap-4 md:gap-8">
                  {/* Theme Switcher Example */}
                  <div className="flex flex-col items-start">
                    <ThemeSwitcherDemo theme={theme} setTheme={setTheme} />
                  </div>

                  {/* Icon Grid with Vaso Control Example */}
                  <div className="flex flex-col items-start">
                    <IconGridDemo />
                  </div>

                  {/* Draggable Glass Demo */}

                  {/* Water Flow Demo - spans 2 columns */}
                  <div className="col-span-2 flex flex-col justify-center pt-4 border-t border-[var(--theme-border-color)]">
                    <div className="col-span-2 flex justify-center mb-12">
                      <DraggableGlassDemo />
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <WaterFlowDemo />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Installation</h2>
              <p className="mb-4 theme-text">
                <CodeGlass depth={0} dispersion={1.2}>
                  <code className="px-2 py-1 text-sm theme-text">npm install vaso</code>
                </CodeGlass>
              </p>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Usage</h2>

              <p className="mb-4 theme-text">
                Import the{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">{`<Vaso>`}</code>
                </CodeGlass>{' '}
                component in your React application and wrap it around any content you want to apply the glass effect
                to.
              </p>

              <p className="mb-4 theme-text">
                Vaso provides intuitive props to control every aspect of the liquid glass effect. Use{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">depth</code>
                </CodeGlass>{' '}
                to control distortion intensity,{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">blur</code>
                </CodeGlass>{' '}
                for backdrop filtering,{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">dispersion</code>
                </CodeGlass>{' '}
                for chromatic aberration effects, and{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">radius</code>
                </CodeGlass>{' '}
                for rounded corners.
              </p>
              <p className="mb-4 theme-text">
                Add spacing with{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">px</code>
                </CodeGlass>{' '}
                and{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">py</code>
                </CodeGlass>{' '}
                for padding, or enable{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">draggable</code>
                </CodeGlass>{' '}
                to make the glass element interactive and moveable by users.
              </p>
            </section>

            <section>
              <p className="theme-text">
                <CodeGlass>
                  <span className="font-bold p-1 rounded-md theme-author">huozhi</span>
                </CodeGlass>
                <span className="theme-text">{' • '}</span>
                <HoverCodeGlass px={4} py={2} dispersion={0} radius={16}>
                  <a href="https://x.com/huozhi" className="font-bold underline theme-link">
                    <span className="font-bold p-1 rounded-md theme-author">X</span>
                  </a>
                </HoverCodeGlass>

                {/* github link */}
                <span className="theme-text">{' • '}</span>
                <a href="https://github.com/huozhi/vaso" className="font-bold underline theme-link">
                  GitHub
                </a>
              </p>
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
