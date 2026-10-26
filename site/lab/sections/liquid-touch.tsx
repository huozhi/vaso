'use client'

import { useRef } from 'react'
import { sdRoundRect } from '../engine'
import { GlassLayer, RenderFn } from '../glass-layer'
import { PHOTOS } from '../photos'
import { pruneRipples, Ripple, rippleExtra } from '../ripples'
import { Ghost, Hint, placeGhost, Spring, useFrame, useIdle, useTried } from '../ui'

const COVERS = [PHOTOS.flower, PHOTOS.aurora, PHOTOS.desert, PHOTOS.forest, PHOTOS.waterfall, PHOTOS.alpine, PHOTOS.stream, PHOTOS.cliffs, PHOTOS.desert, PHOTOS.flower, PHOTOS.forest, PHOTOS.aurora]

/** Room around the card for its shadow and for the press to swell into */
const MARGIN = 30
const RADIUS = 44

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

// The glass is drawn once for the card's size and moved, squashed and stretched with a CSS transform, so motion
// costs nothing. Its map is only redrawn while a ripple or a press is deforming the surface itself.
export function LiquidTouch() {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const idle = useIdle(stageRef)
  const tried = useTried(stageRef)
  const state = useRef({
    ox: new Spring(0, 260, 13),
    oy: new Spring(0, 260, 13),
    scale: new Spring(1, 340, 11),
    press: new Spring(0, 300, 20),
    down: null as null | { grab: Pointer; at: Pointer },
    ripples: [] as Ripple[],
    last: 0,
    now: 0,
    virtualDown: false,
    card: { w: 0, h: 0, cx: 0, cy: 0 },
    pose: { x: 0, y: 0, sx: 1, sy: 1 },
  })

  // Stage point → the card layer's own, untransformed coordinates
  const toLocal = (p: Pointer) => {
    const { pose, card } = state.current
    return { x: (p.x - pose.x) / pose.sx + card.w / 2 + MARGIN, y: (p.y - pose.y) / pose.sy + card.h / 2 + MARGIN }
  }
  const inside = (p: Pointer) => {
    const { card, pose } = state.current
    return sdRoundRect(p.x, p.y, pose.x, pose.y, (card.w / 2) * pose.sx, (card.h / 2) * pose.sy, RADIUS) < 4
  }

  const press = (p: Pointer) => {
    const s = state.current
    if (!inside(p)) return false
    s.down = { grab: p, at: p }
    s.scale.target = 1.05
    s.press.target = 1
    s.ripples.push({ ...toLocal(p), t0: s.now, amp: 0.75 })
    return true
  }
  const move = (p: Pointer) => {
    const s = state.current
    if (!s.down) return
    s.down.at = p
    // Rubber band: the card follows the finger, with resistance that grows the further it is pulled
    const band = (d: number) => Math.sign(d) * 150 * (1 - Math.exp(-Math.abs(d) / 220))
    s.ox.target = band(p.x - s.down.grab.x)
    s.oy.target = band(p.y - s.down.grab.y)
  }
  const release = () => {
    const s = state.current
    if (!s.down) return
    s.down = null
    s.ox.target = 0
    s.oy.target = 0
    s.scale.target = 1
    s.press.target = 0
  }

  // Physics and the card's transform
  useFrame(stageRef, (t) => {
    const s = state.current
    const stage = stageRef.current!
    const W = stage.clientWidth
    const H = stage.clientHeight
    const dt = Math.min(0.05, t - (s.last || t))
    s.last = t
    s.now = t
    const cw = Math.round(Math.min(460, W * 0.8))
    const ch = Math.round(Math.min(170, H * 0.42))
    s.card = { w: cw, h: ch, cx: W / 2, cy: H / 2 }

    if (idle.auto() && !idle.state.current.reduced) {
      const g = script(t % 6.2, W, H, s.card)
      if (g.down && !s.virtualDown) s.virtualDown = press(g)
      else if (g.down && s.virtualDown) move(g)
      else if (!g.down && s.virtualDown) {
        release()
        s.virtualDown = false
      }
      placeGhost(ghostRef.current, g.x, g.y, g.down, g.show)
    } else {
      if (s.virtualDown) {
        release()
        s.virtualDown = false
      }
      placeGhost(ghostRef.current, 0, 0, false, false)
    }

    for (const sp of [s.ox, s.oy, s.scale, s.press]) sp.step(dt)
    pruneRipples(s.ripples, t)

    // Squash and stretch along the direction of travel, keeping the area roughly constant
    const vx = Math.min(Math.abs(s.ox.velocity) / 2200, 0.2)
    const vy = Math.min(Math.abs(s.oy.velocity) / 2200, 0.2)
    s.pose = {
      x: s.card.cx + s.ox.value,
      y: s.card.cy + s.oy.value,
      sx: s.scale.value * (1 + vx - vy * 0.6),
      sy: s.scale.value * (1 + vy - vx * 0.6),
    }
    const el = cardRef.current
    if (el) {
      el.style.width = `${cw + MARGIN * 2}px`
      el.style.height = `${ch + MARGIN * 2}px`
      el.style.transform = `translate(${s.pose.x - cw / 2 - MARGIN}px, ${s.pose.y - ch / 2 - MARGIN}px) scale(${s.pose.sx}, ${s.pose.sy})`
    }
  })

  const render: RenderFn = (t, { width: W, height: H }) => {
    const s = state.current
    const cw = W - MARGIN * 2
    const ch = H - MARGIN * 2
    const cx = W / 2
    const cy = H / 2
    const pressAmount = s.press.value
    const dent = s.down ? toLocal(s.down.at) : null
    const deforming = s.ripples.length > 0 || pressAmount > 0.02

    // A finger pressing in swells the glass under it into a small lens that magnifies what's beneath
    const ripple = s.ripples.length ? rippleExtra(s.ripples, t) : null
    const extra = deforming
      ? (px: number, py: number, depth: number, out: { x: number; y: number }) => {
          ripple?.(px, py, depth, out)
          if (dent) {
            const dx = px - dent.x
            const dy = py - dent.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const k = Math.exp(-(dist * dist) / (2 * 52 * 52)) * Math.min(1, dist / 52) * pressAmount * 0.4
            out.x -= (dx / dist) * k
            out.y -= (dy / dist) * k
          }
        }
      : undefined

    return {
      sdf: (px, py) => sdRoundRect(px, py, cx, cy, cw / 2, ch / 2, RADIUS),
      bounds: [MARGIN, MARGIN, W - MARGIN, H - MARGIN],
      bezel: 26,
      strength: 24 + pressAmount * 10,
      dispersion: 0.22,
      frost: 1.2,
      light: { x: W * 0.25, y: -H * 2 },
      look: { tint: 0.14, tintColor: [18, 16, 14], rim: 0.9, glow: 0.45, shadow: 0.32 },
      extra,
      mapKey: deforming ? undefined : `${W}x${H}`,
      specKey: `${W}x${H}`,
    }
  }

  const local = (e: React.PointerEvent) => {
    const rect = stageRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <div
      ref={stageRef}
      className="lab-stage lab-touch"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if (state.current.virtualDown) {
          release()
          state.current.virtualDown = false
        }
        if (press(local(e))) e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        move(local(e))
        stageRef.current!.style.cursor = state.current.down ? 'grabbing' : inside(local(e)) ? 'grab' : ''
      }}
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
      <div ref={cardRef} className="lab-card-layer">
        <GlassLayer render={render} className="lab-fill">
          <div className="lab-player" style={{ inset: MARGIN }}>
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
          </div>
        </GlassLayer>
      </div>
      <Ghost ref={ghostRef} />
      <Hint done={tried}>Press and drag</Hint>
    </div>
  )
}
