'use client'

import React, { useEffect, useRef, useState } from 'react'

/** Tracks the last time the user touched a stage, so demos can play themselves until someone takes over */
export function useIdle(ref: React.RefObject<HTMLElement | null>, idleMs = 4500) {
  const state = useRef({ last: -Infinity, idleMs, reduced: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    state.current.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mark = () => (state.current.last = performance.now())
    // Hovering counts too: a pointer resting on the stage means someone is looking at it
    const move = () => mark()
    el.addEventListener('pointerdown', mark)
    el.addEventListener('pointermove', move)
    el.addEventListener('wheel', mark, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', mark)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('wheel', mark)
    }
  }, [ref])
  return {
    /** True while the demo should drive itself */
    auto: () => performance.now() - state.current.last > state.current.idleMs,
    touch: () => (state.current.last = performance.now()),
    state,
  }
}

/** A critically damped-ish spring stepped with the frame delta */
export class Spring {
  value: number
  velocity = 0
  target: number
  constructor(value: number, public stiffness = 180, public damping = 16) {
    this.value = value
    this.target = value
  }
  step(dt: number) {
    const force = (this.target - this.value) * this.stiffness - this.velocity * this.damping
    this.velocity += force * dt
    this.value += this.velocity * dt
    return this.value
  }
}

/** Pill shown on each stage telling people what to try; it fades once they have tried it */
export function Hint({ children, done, placement = 'left' }: { children: React.ReactNode; done?: boolean; placement?: 'left' | 'right' | 'top' }) {
  return (
    <div className={`lab-hint lab-hint-${placement} ${done ? 'is-done' : ''}`}>
      <span className="lab-hint-dot" />
      {children}
    </div>
  )
}

/** A ghost cursor that demonstrates the gesture while the demo plays itself */
export const Ghost = React.forwardRef<HTMLDivElement>(function Ghost(_, ref) {
  return (
    <div ref={ref} className="lab-ghost" aria-hidden>
      <div className="lab-ghost-ring" />
    </div>
  )
})

export function placeGhost(el: HTMLDivElement | null, x: number, y: number, pressed: boolean, visible: boolean) {
  if (!el) return
  el.style.transform = `translate(${x}px, ${y}px)`
  el.style.opacity = visible ? '1' : '0'
  el.dataset.pressed = pressed ? 'true' : 'false'
}

/** Becomes true after the first real interaction with an element */
export function useTried(ref: React.RefObject<HTMLElement | null>) {
  const [tried, setTried] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || tried) return
    const done = () => setTried(true)
    el.addEventListener('pointerdown', done, { once: true })
    return () => el.removeEventListener('pointerdown', done)
  }, [ref, tried])
  return tried
}

export function Section({
  index,
  title,
  lede,
  children,
  aside,
}: {
  index: string
  title: string
  lede: React.ReactNode
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <section className="lab-section">
      <header className="lab-section-head">
        <span className="lab-index">{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{lede}</p>
        </div>
        {aside && <div className="lab-aside">{aside}</div>}
      </header>
      <div className="lab-frame">{children}</div>
    </section>
  )
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Calls `callback` every animation frame with the time in seconds, while the element is near the viewport */
export function useFrame(ref: React.RefObject<HTMLElement | null>, callback: (t: number) => void) {
  const cb = useRef(callback)
  cb.current = callback
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let visible = true
    let raf = 0
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: '80px' })
    io.observe(el)
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (visible) cb.current(now / 1000)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [ref])
}

/** Whether this browser refracts with SVG filters in backdrop-filter (Chromium). The lab has no fallback yet */
export function useChromium() {
  const [supported, setSupported] = useState(true)
  useEffect(() => {
    const ua = navigator.userAgent
    const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\/|FxiOS|CriOS|EdgiOS/.test(ua)
    setSupported(chromium && CSS.supports('backdrop-filter', 'url(#a)'))
  }, [])
  return supported
}
