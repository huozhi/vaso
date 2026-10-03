'use client'

import { useEffect, useRef, useState } from 'react'
import { Vaso } from 'vaso'
import { useGlassContext } from '../contexts/glass-context'

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

export function VasoTitle() {
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
