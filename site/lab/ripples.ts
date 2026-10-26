export type Ripple = { x: number; y: number; t0: number; amp: number }

const SPEED = 420
const WIDTH = 22
const LIFE = 2.4

export function pruneRipples(ripples: Ripple[], t: number) {
  for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t0 > LIFE) ripples.splice(i, 1)
}

/** A ring wave spreading from each tap, pushing the backdrop outward and back as it passes */
export function rippleExtra(ripples: Ripple[], t: number) {
  return (x: number, y: number, depth: number, out: { x: number; y: number }) => {
    const edge = Math.min(1, Math.max(depth, 0) / 6)
    for (const r of ripples) {
      const age = t - r.t0
      const dx = x - r.x
      const dy = y - r.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const u = (dist - age * SPEED) / WIDTH
      if (u < -3 || u > 3) continue
      const wave = Math.sin(u * 2.2) * Math.exp(-u * u) * Math.exp(-age * 1.6) * r.amp * edge
      out.x += (dx / dist) * wave
      out.y += (dy / dist) * wave
    }
  }
}
