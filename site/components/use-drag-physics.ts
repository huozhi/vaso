'use client'

import { useRef, useState } from 'react'
import { useSpring } from '@react-spring/web'

// How much bigger the glass gets while held
const PRESS_SCALE = 0.5
// Stretch per px/ms of drag speed, and the most it can stretch
const STRETCH_PER_SPEED = 0.22
const MAX_STRETCH = 0.35
// Once the pointer stops moving for this long, the stretch relaxes
const IDLE_MS = 70

// Squash and stretch for a dragged glass: it swells while held, stretches along the drag with speed and narrows
// across it, then wobbles back on release. Underdamped springs give it the liquid overshoot
export function useDragPhysics() {
  const [pressed, setPressed] = useState(false)
  const [stretchTarget, setStretchTarget] = useState(0)
  const [state, setState] = useState({ press: 0, stretch: 0 })
  const lastRef = useRef<{ x: number; time: number } | null>(null)
  const idleRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useSpring({
    press: pressed ? 1 : 0,
    stretch: stretchTarget,
    config: { tension: 420, friction: 16 },
    onChange: ({ value }) => setState({ press: value.press, stretch: value.stretch }),
  })

  const start = (x: number) => {
    lastRef.current = { x, time: performance.now() }
    setPressed(true)
  }

  const move = (x: number) => {
    const now = performance.now()
    const last = lastRef.current
    if (last) {
      const speed = Math.abs(x - last.x) / Math.max(1, now - last.time)
      setStretchTarget(Math.min(MAX_STRETCH, speed * STRETCH_PER_SPEED))
    }
    lastRef.current = { x, time: now }
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => setStretchTarget(0), IDLE_MS)
  }

  const end = () => {
    clearTimeout(idleRef.current)
    lastRef.current = null
    setPressed(false)
    setStretchTarget(0)
  }

  const scale = 1 + state.press * PRESS_SCALE
  // The spring overshoots past zero on release; a negative stretch reads as the rebound squash
  const stretch = state.stretch
  return {
    start,
    move,
    end,
    /** 0 at rest, 1 while held (overshoots slightly as it springs) */
    press: state.press,
    transform: `scale(${scale * (1 + stretch)}, ${scale * (1 - stretch * 0.45)})`,
  }
}
