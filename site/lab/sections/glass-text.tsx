'use client'

import { useRef, type ReactNode } from 'react'
import { GridField, textField } from '../engine'
import { GlassLayer, RenderFn } from '../glass-layer'
import { Hint, useIdle, useTried } from '../ui'
import { pruneRipples, Ripple, rippleExtra } from '../ripples'

const WORD = 'vaso'

function fontFor(width: number, height: number) {
  const size = Math.round(Math.min(height * 0.62, width * 0.33))
  return { size, font: `900 ${size}px "Arial Black", "Helvetica Neue", Arial, system-ui, sans-serif` }
}

export function GlassText({ className = '', children }: { className?: string; children?: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const idle = useIdle(stageRef, 3500)
  const tried = useTried(stageRef)
  const state = useRef({
    field: null as GridField | null,
    key: '',
    size: 0,
    light: { x: 0, y: 0 },
    pointer: null as { x: number; y: number } | null,
    ripples: [] as Ripple[],
    nextRipple: 1.2,
    now: 0,
  })

  const local = (e: React.PointerEvent) => {
    const rect = stageRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const render: RenderFn = (t, { width, height }) => {
    const s = state.current
    s.now = t
    const key = `${width}x${height}`
    if (key !== s.key) {
      const { font, size } = fontFor(width, height)
      s.field = textField(WORD, font, width, height, 0.5, -size * 0.03)
      s.size = size
      s.key = key
      s.light = { x: width * 0.3, y: height * 0.1 }
    }
    const field = s.field!
    const auto = idle.auto() && !idle.state.current.reduced

    // The light drifts across the word on its own, and follows the pointer once there is one
    const target = s.pointer && !auto
      ? s.pointer
      : { x: width * (0.5 + 0.46 * Math.cos(t * 0.45)), y: height * (0.5 + 0.75 * Math.sin(t * 0.9)) }
    s.light.x += (target.x - s.light.x) * 0.08
    s.light.y += (target.y - s.light.y) * 0.08

    if (auto && t > s.nextRipple) {
      const [x0, y0, x1, y1] = field.bounds
      s.ripples.push({ x: x0 + Math.random() * (x1 - x0), y: y0 + (0.3 + Math.random() * 0.5) * (y1 - y0), t0: t, amp: 0.5 })
      s.nextRipple = t + 3.4
    }
    pruneRipples(s.ripples, t)

    const stem = s.size * 0.09
    return {
      sdf: field.sample,
      bounds: field.bounds,
      bezel: Math.max(8, stem),
      strength: Math.max(10, stem * 1.1),
      dispersion: 0.4,
      light: s.light,
      look: { tint: 0.07, rim: 0.95, glow: 0.5, shadow: 0.28, rimWidth: 1.6, sheen: 0.22 },
      extra: s.ripples.length ? rippleExtra(s.ripples, t) : undefined,
      mapKey: s.ripples.length ? undefined : key,
    }
  }

  return (
    <div
      ref={stageRef}
      className={`lab-stage lab-hero ${className}`}
      onPointerMove={(e) => (state.current.pointer = local(e))}
      onPointerLeave={() => (state.current.pointer = null)}
      onPointerDown={(e) => {
        const p = local(e)
        state.current.ripples.push({ ...p, t0: state.current.now, amp: 0.7 })
      }}
    >
      <div className="lab-hero-backdrop" aria-hidden>
        <img src="/flower.jpg" alt="" draggable={false} />
        <div className="lab-grid" />
      </div>
      <GlassLayer render={render} className="lab-fill" />
      <Hint done={tried}>Move to light it · tap to ripple</Hint>
      {children}
    </div>
  )
}
