'use client'

import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Vaso } from 'vaso'
import { GLASS_SCOPE_ATTRIBUTE, GLASS_SCOPE_LABEL_ATTRIBUTE, useGlassContext, useGlassStore } from '../contexts/glass-context'
import { useDragPhysics } from './use-drag-physics'

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

export function GlassPanel() {
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
