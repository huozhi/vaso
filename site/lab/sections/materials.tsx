'use client'

import { useEffect, useRef } from 'react'
import { Look, makeProfile, Profile, sdCircle } from '../engine'
import { GlassLayer, RenderFn } from '../glass-layer'
import { Hint, Spring, useIdle, useTried } from '../ui'

type Material = {
  name: string
  note: string
  profile: Profile
  /** Bezel width as a fraction of the lens radius */
  bezel: number
  /** Peak displacement as a fraction of the lens radius */
  strength: number
  dispersion: number
  frost?: number
  noise?: number
  look: Look
  animated?: boolean
}

const MATERIALS: Material[] = [
  {
    name: 'Water',
    note: 'n 1.33 · round dome',
    profile: makeProfile(1.33, 2),
    bezel: 1,
    strength: 0.3,
    dispersion: 0.1,
    look: { tint: 0.03, rim: 0.6, glow: 0.5, shadow: 0.18 },
  },
  {
    name: 'Crystal',
    note: 'n 2.1 · cut bevel',
    profile: makeProfile(2.1, 7),
    bezel: 0.55,
    strength: 0.42,
    dispersion: 0.55,
    look: { tint: 0.02, rim: 1, glow: 0.75, shadow: 0.28, rimWidth: 1.2 },
  },
  {
    name: 'Ice',
    note: 'frosted · turbulent',
    profile: makeProfile(1.31, 3),
    bezel: 0.8,
    strength: 0.22,
    dispersion: 0.08,
    frost: 3.5,
    noise: 0.45,
    look: { tint: 0.3, tintColor: [226, 240, 255], rim: 0.8, glow: 0.35, shadow: 0.2 },
  },
  {
    name: 'Bubble',
    note: 'thin film · iridescent',
    profile: makeProfile(1.08, 2),
    bezel: 1,
    strength: 0.12,
    dispersion: 0.5,
    look: { tint: 0, rim: 0.95, glow: 0.2, shadow: 0.04, iridescence: 1, rimWidth: 2.6 },
    animated: true,
  },
]

const MARGIN = 26

type Lens = { x: Spring; y: Spring; home: { x: number; y: number }; moved: boolean }

export function Materials() {
  const stageRef = useRef<HTMLDivElement>(null)
  const lensRefs = useRef<(HTMLDivElement | null)[]>([])
  const idle = useIdle(stageRef)
  const tried = useTried(stageRef)
  const state = useRef({
    lenses: MATERIALS.map((): Lens => ({ x: new Spring(0, 140, 16), y: new Spring(0, 140, 16), home: { x: 0, y: 0 }, moved: false })),
    held: -1,
    grab: { x: 0, y: 0 },
    size: 0,
    layout: '',
    last: 0,
  })

  // A row of four on wide screens, a 2 × 2 grid on phones
  const narrow = (W: number) => W < 760
  const lensSize = (W: number) => Math.round(narrow(W) ? Math.min(150, W * 0.34) : Math.min(190, (W - 40) / 4.6))

  // One loop positions every lens; each lens's own layer only re-renders its highlights
  const driver: RenderFn = (t, { width: W, height: H }) => {
    const s = state.current
    const dt = Math.min(0.05, t - (s.last || t))
    s.last = t
    const L = lensSize(W)
    const layout = `${W}x${H}`
    if (layout !== s.layout) {
      s.layout = layout
      s.size = L
      s.lenses.forEach((lens, i) => {
        lens.home = narrow(W)
          ? { x: W * (i % 2 ? 0.72 : 0.28), y: H * (i < 2 ? 0.27 : 0.66) }
          : { x: (W / (MATERIALS.length + 1)) * (i + 1), y: H * 0.47 }
        lens.x.value = lens.x.target = lens.home.x
        lens.y.value = lens.y.target = lens.home.y
      })
    }
    const auto = idle.auto() && !idle.state.current.reduced
    s.lenses.forEach((lens, i) => {
      if (i !== s.held && auto) {
        // Drift home and bob gently, out of step with each other
        lens.x.target = lens.home.x + Math.sin(t * 0.6 + i * 1.7) * L * 0.12
        lens.y.target = lens.home.y + Math.cos(t * 0.8 + i * 2.3) * L * 0.14
      }
      lens.x.step(dt)
      lens.y.step(dt)
      const el = lensRefs.current[i]
      if (el) {
        el.style.width = el.style.height = `${L + MARGIN * 2}px`
        el.style.transform = `translate(${lens.x.value - L / 2 - MARGIN}px, ${lens.y.value - L / 2 - MARGIN}px)`
      }
    })
    return null
  }

  const lensRender = (m: Material): RenderFn => (t, { width: W }) => {
    const L = W - MARGIN * 2
    const r = L / 2
    const c = W / 2
    return {
      sdf: (x, y) => sdCircle(x, y, c, c, r),
      bounds: [MARGIN, MARGIN, W - MARGIN, W - MARGIN],
      bezel: r * m.bezel,
      profile: m.profile,
      strength: r * m.strength,
      dispersion: m.dispersion,
      frost: m.frost,
      noise: m.noise,
      light: { x: W * 0.15, y: -W * 0.4 },
      look: m.look,
      time: t,
      mapKey: W,
      specKey: m.animated ? undefined : W,
    }
  }

  const local = (e: React.PointerEvent) => {
    const rect = stageRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <div
      ref={stageRef}
      className="lab-stage lab-materials"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        const p = local(e)
        const s = state.current
        s.held = s.lenses.findIndex((l) => Math.hypot(p.x - l.x.value, p.y - l.y.value) < s.size / 2)
        if (s.held < 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const lens = s.lenses[s.held]
        s.grab = { x: p.x - lens.x.value, y: p.y - lens.y.value }
      }}
      onPointerMove={(e) => {
        const s = state.current
        const p = local(e)
        if (s.held < 0) {
          const over = s.lenses.some((l) => Math.hypot(p.x - l.x.value, p.y - l.y.value) < s.size / 2)
          stageRef.current!.style.cursor = over ? 'grab' : ''
          return
        }
        const lens = s.lenses[s.held]
        lens.x.target = p.x - s.grab.x
        lens.y.target = p.y - s.grab.y
      }}
      onPointerUp={() => (state.current.held = -1)}
    >
      <div className="lab-specimen" aria-hidden>
        <div className="lab-row lab-row-serif">
          <span>Refraction · Dispersion · Caustics · Refraction · Dispersion · Caustics ·&nbsp;</span>
          <span>Refraction · Dispersion · Caustics · Refraction · Dispersion · Caustics ·&nbsp;</span>
        </div>
        <div className="lab-row lab-row-stripes" />
        <div className="lab-row lab-row-mono">
          <span>0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ&nbsp;</span>
          <span>0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ&nbsp;</span>
        </div>
        <div className="lab-row lab-row-checker" />
        <div className="lab-row lab-row-serif lab-row-reverse">
          <span>n = sin θ₁ / sin θ₂ · n = sin θ₁ / sin θ₂ · n = sin θ₁ / sin θ₂ ·&nbsp;</span>
          <span>n = sin θ₁ / sin θ₂ · n = sin θ₁ / sin θ₂ · n = sin θ₁ / sin θ₂ ·&nbsp;</span>
        </div>
      </div>

      {/* Invisible full-size layer that only drives the lens positions */}
      <Driver render={driver} />

      {MATERIALS.map((m, i) => (
        <div key={m.name} ref={(el) => (lensRefs.current[i] = el)} className="lab-lens">
          <GlassLayer render={lensRender(m)} className="lab-fill" turbulence={!!m.noise} prism={m.dispersion > 0.05} />
          <div className="lab-lens-label">
            <strong>{m.name}</strong>
            <span>{m.note}</span>
          </div>
        </div>
      ))}
      <Hint done={tried}>Drag a lens</Hint>
    </div>
  )
}

/** Runs a render callback every frame with the stage size, without drawing any glass */
function Driver({ render }: { render: RenderFn }) {
  const ref = useRef<HTMLDivElement>(null)
  const renderRef = useRef(render)
  renderRef.current = render
  useRefLoop(ref, renderRef)
  return <div ref={ref} className="lab-fill" style={{ pointerEvents: 'none' }} />
}

function useRefLoop(ref: React.RefObject<HTMLDivElement | null>, renderRef: React.RefObject<RenderFn>) {
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const el = ref.current
      if (!el) return
      renderRef.current(now / 1000, { width: el.clientWidth, height: el.clientHeight })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ref, renderRef])
}
