'use client'

import { useEffect, useState } from 'react'
import { useSpring } from '@react-spring/web'
import clsx from 'clsx'
import { Vaso } from 'vaso'
import { useGlassContext } from '../contexts/glass-context'

/** Marks an element inside a FloatingGlass that the glass jumps onto when hovered */
export const GLASS_TARGET_ATTRIBUTE = 'data-glass-target'
export const glassTarget = { [GLASS_TARGET_ATTRIBUTE]: '' }

// Room around the hovered target
const PADDING_X = 10
const PADDING_Y = 5
// Smallest scale before the glass is hidden. Not 0, so it shrinks into a point instead of vanishing
const MIN_SCALE = 0.01
// How long the glass stays on a target after the finger lifts, so a quick tap is still seen
const TOUCH_LINGER_MS = 900

type Box = { x: number; y: number; width: number; height: number; scale: number }

// One glass shared by every target inside: it jumps from target to target as they're hovered, and shrinks into
// the border where the pointer leaves. On touch, pressing a target stands in for hovering it, sliding the
// finger moves the glass across targets, and lifting it leaves the glass a moment before it shrinks away
export function FloatingGlass({
  component: Component = 'span',
  className,
  children,
}: {
  component?: 'span' | 'div' | 'footer'
  className?: string
  children: React.ReactNode
}) {
  const { settings } = useGlassContext()
  const [target, setTarget] = useState<Box>({ x: 0, y: 0, width: 0, height: 0, scale: MIN_SCALE })
  const [glass, setGlass] = useState(target)
  // Appear on the first hovered target instead of gliding in from wherever the glass last left
  const [snap, setSnap] = useState(false)

  useSpring({
    ...target,
    immediate: (key) => snap && key !== 'scale',
    // Slightly underdamped, so the glass lands on each target with a small bounce
    config: { tension: 360, friction: 22 },
    onChange: ({ value }) => setGlass(value as Box),
  })

  const hidden = glass.scale <= MIN_SCALE * 2
  // The finger lifted: keep the glass on its target for a moment, then shrink it away
  const [lifted, setLifted] = useState(false)

  useEffect(() => {
    if (!lifted) return
    const timer = setTimeout(() => {
      setLifted(false)
      setSnap(false)
      shrinkInto(null)
    }, TOUCH_LINGER_MS)
    return () => clearTimeout(timer)
  }, [lifted])

  const jumpTo = (root: Element, element: Element | null) => {
    if (!element || !root.contains(element)) return
    // Measured against the root's box, since targets can sit inside inline text
    const rect = element.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    setSnap(hidden)
    setTarget({
      x: rect.left - rootRect.left + rect.width / 2,
      y: rect.top - rootRect.top + rect.height / 2,
      width: rect.width + PADDING_X * 2,
      height: rect.height + PADDING_Y * 2,
      scale: 1,
    })
  }
  const targetAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest(`[${GLASS_TARGET_ATTRIBUTE}]`) ?? null

  // Shrink into a point: the border where the pointer left, or the target itself after a touch
  const shrinkInto = (point: { x: number; y: number } | null) =>
    setTarget((current) => ({ ...current, ...point, scale: MIN_SCALE }))

  return (
    <Component
      className={clsx('relative floating-glass', className)}
      onPointerOver={(e: React.PointerEvent) => {
        // Touch is handled from pointerdown, which also covers a finger landing without moving
        if (e.pointerType !== 'mouse') return
        jumpTo(e.currentTarget, (e.target as Element).closest(`[${GLASS_TARGET_ATTRIBUTE}]`))
      }}
      onPointerDown={(e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') return
        // A new touch takes over from a lingering glass
        setLifted(false)
        jumpTo(e.currentTarget, targetAt(e.clientX, e.clientY))
      }}
      onPointerMove={(e: React.PointerEvent) => {
        // Touch pointers stay captured by the element they started on, so find the target under the finger
        if (e.pointerType === 'mouse') return
        jumpTo(e.currentTarget, targetAt(e.clientX, e.clientY))
      }}
      onPointerUp={(e: React.PointerEvent) => {
        // Lifting the finger ends the touch's "hover": the glass lingers, then shrinks away where it is
        if (e.pointerType !== 'mouse') setLifted(true)
      }}
      onPointerCancel={() => {
        // The page started scrolling
        setLifted(false)
        setSnap(false)
        shrinkInto(null)
      }}
      onPointerLeave={(e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        const rect = e.currentTarget.getBoundingClientRect()
        setSnap(false)
        shrinkInto({
          x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
          y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
        })
      }}
    >
      {/* The targets come before the glass in the DOM, so the glass refracts them */}
      {children}
      {!hidden && (
        // Sized to the glass and centered on its target, so it scales around that point
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: glass.x - glass.width / 2,
            top: glass.y - glass.height / 2,
            width: glass.width,
            height: glass.height,
            transform: `scale(${glass.scale})`,
            pointerEvents: 'none',
          }}
        >
          <Vaso
            width={glass.width}
            height={glass.height}
            radius={glass.height / 2}
            depth={1.4}
            blur={settings.blur * 0.4}
            dispersion={settings.dispersion + 0.4}
          />
        </span>
      )}
    </Component>
  )
}
