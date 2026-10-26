'use client'

import { useRef } from 'react'
import { Vaso } from 'vaso'
import { PHOTOS } from '../photos'
import { Ghost, Hint, placeGhost, Spring, useFrame, useIdle, useTried } from '../ui'

// The glass effects are two props: `pressable` swells the glass and forms a lens under the finger, `ripple` sends
// a ring through it from every tap. The drag, squash and stretch below are ordinary CSS transforms on a wrapper;
// vaso keeps refracting through them.

const COVERS = [PHOTOS.flower, PHOTOS.aurora, PHOTOS.desert, PHOTOS.forest, PHOTOS.waterfall, PHOTOS.alpine, PHOTOS.stream, PHOTOS.cliffs, PHOTOS.desert, PHOTOS.flower, PHOTOS.forest, PHOTOS.aurora]

type Pointer = { x: number; y: number }

// The demo's own gesture: drag the card sideways, then tap it twice
function script(phase: number, W: number, H: number, card: { w: number; h: number }) {
  const cx = W / 2
  const cy = H / 2
  const A = { x: cx - card.w * 0.22, y: cy + 10 }
  const B = { x: cx + card.w * 0.3, y: cy - 20 }
  const C = { x: cx - card.w * 0.05, y: cy + 30 }
  const rest = { x: W * 0.86, y: H * 0.86 }
  const lerp = (p: Pointer, q: Pointer, k: number) => {
    const e = k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k)
    return { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e }
  }
  if (phase < 0.6) return { ...lerp(rest, A, phase / 0.6), down: false, show: true }
  if (phase < 1.6) return { ...lerp(A, { x: A.x + 130, y: A.y - 24 }, (phase - 0.7) / 0.8), down: true, show: true }
  if (phase < 2.4) return { ...lerp({ x: A.x + 130, y: A.y - 24 }, B, (phase - 1.6) / 0.8), down: false, show: true }
  if (phase < 2.55) return { ...B, down: true, show: true }
  if (phase < 3.2) return { ...lerp(B, C, (phase - 2.55) / 0.65), down: false, show: true }
  if (phase < 3.35) return { ...C, down: true, show: true }
  if (phase < 4.2) return { ...lerp(C, rest, (phase - 3.35) / 0.85), down: false, show: true }
  return { ...rest, down: false, show: false }
}

export function LiquidTouch() {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const glassRef = useRef<HTMLElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const idle = useIdle(stageRef)
  const tried = useTried(stageRef)
  const state = useRef({
    ox: new Spring(0, 260, 13),
    oy: new Spring(0, 260, 13),
    down: null as null | { grab: Pointer },
    last: 0,
    virtualDown: false,
    card: { w: 0, h: 0 },
  })

  const local = (p: { clientX: number; clientY: number }) => {
    const rect = stageRef.current!.getBoundingClientRect()
    return { x: p.clientX - rect.left, y: p.clientY - rect.top }
  }
  const grab = (p: Pointer) => (state.current.down = { grab: p })
  const drag = (p: Pointer) => {
    const s = state.current
    if (!s.down) return
    // Rubber band: the card follows the finger, with resistance that grows the further it is pulled
    const band = (d: number) => Math.sign(d) * 150 * (1 - Math.exp(-Math.abs(d) / 220))
    s.ox.target = band(p.x - s.down.grab.x)
    s.oy.target = band(p.y - s.down.grab.y)
  }
  const release = () => {
    const s = state.current
    s.down = null
    s.ox.target = 0
    s.oy.target = 0
  }

  // The ghost presses the real glass: pointer events dispatched on it trigger `pressable` and `ripple` exactly
  // as a finger would. They don't bubble, so the stage doesn't mistake the ghost for a visitor
  const ghostPointer = (type: string, at: Pointer) => {
    const stage = stageRef.current!.getBoundingClientRect()
    glassRef.current?.dispatchEvent(new PointerEvent(type, { clientX: stage.left + at.x, clientY: stage.top + at.y }))
  }

  useFrame(stageRef, (t) => {
    const s = state.current
    const stage = stageRef.current!
    const W = stage.clientWidth
    const H = stage.clientHeight
    const dt = Math.min(0.05, t - (s.last || t))
    s.last = t
    s.card = { w: Math.min(460, W * 0.8), h: Math.min(170, H * 0.42) }

    if (idle.auto() && !idle.state.current.reduced) {
      const g = script(t % 6.2, W, H, s.card)
      if (g.down && !s.virtualDown) {
        s.virtualDown = true
        grab(g)
        ghostPointer('pointerdown', g)
      } else if (g.down && s.virtualDown) {
        drag(g)
        ghostPointer('pointermove', g)
      } else if (!g.down && s.virtualDown) {
        s.virtualDown = false
        release()
        ghostPointer('pointerup', g)
      }
      placeGhost(ghostRef.current, g.x, g.y, g.down, g.show)
    } else {
      if (s.virtualDown) {
        s.virtualDown = false
        release()
        ghostPointer('pointerup', { x: 0, y: 0 })
      }
      placeGhost(ghostRef.current, 0, 0, false, false)
    }

    s.ox.step(dt)
    s.oy.step(dt)
    // Squash and stretch along the direction of travel, keeping the area roughly constant
    const vx = Math.min(Math.abs(s.ox.velocity) / 2200, 0.2)
    const vy = Math.min(Math.abs(s.oy.velocity) / 2200, 0.2)
    const el = cardRef.current
    if (el) {
      el.style.width = `${s.card.w}px`
      el.style.height = `${s.card.h}px`
      el.style.transform = `translate(-50%, -50%) translate(${s.ox.value}px, ${s.oy.value}px) scale(${1 + vx - vy * 0.6}, ${1 + vy - vx * 0.6})`
    }
  })

  return (
    <div
      ref={stageRef}
      className="lab-stage lab-touch"
      style={{ touchAction: 'none' }}
      onPointerMove={(e) => drag(local(e))}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div className="lab-covers" aria-hidden>
        {[0, 1].map((copy) => (
          <div key={copy} className="lab-covers-grid">
            {COVERS.map((src, i) => (
              <img key={i} src={src} alt="" draggable={false} />
            ))}
          </div>
        ))}
      </div>
      <div ref={cardRef} className="lab-card-pos">
        <Vaso
          ref={glassRef}
          pressable
          ripple
          light="pointer"
          radius={44}
          depth={1.4}
          blur={1.2}
          dispersion={0.4}
          className="lab-player"
          onPointerDown={(e) => {
            if (!e.isTrusted) return
            if (state.current.virtualDown) state.current.virtualDown = false
            e.currentTarget.setPointerCapture(e.pointerId)
            grab(local(e))
          }}
        >
          <img src={PHOTOS.flower} alt="" draggable={false} />
          <div className="lab-player-meta">
            <strong>Surface Tension</strong>
            <span>The Refractions</span>
            <div className="lab-progress">
              <i />
            </div>
          </div>
          <div className="lab-player-controls" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M11 6v12L3 12zM20 6v12l-8-6z" /></svg>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M7 4h4v16H7zM14 4h4v16h-4z" /></svg>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M13 6v12l8-6zM4 6v12l8-6z" /></svg>
          </div>
        </Vaso>
      </div>
      <Ghost ref={ghostRef} />
      <Hint done={tried}>Press and drag</Hint>
    </div>
  )
}
