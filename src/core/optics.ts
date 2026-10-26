// The optics behind every glass: the refraction profile of the bezel, the displacement maps drawn from it, the
// spectrum used for dispersion and the specular rim. No DOM beyond an offscreen canvas, no framework.

// Index of refraction of the simulated glass
const IOR = 1.5
// Portion of the shorter side (per half) that is curved bezel; the rest is a flat top
export const BEZEL_RATIO = 0.6
// Displacement maps are smooth, so they can be rendered at a reduced resolution
export const MAX_MAP_PIXELS = 160_000
// Size changes closer together than this count as one continuous resize. While resizing, the last displacement map
// is stretched to the new size instead of drawing a new one, and a sharp map is drawn once the size settles
export const RESIZE_SETTLE_MS = 100
// Peak displacement at the rim, as a fraction of the bezel width per unit of depth
export const REFRACTION = 0.35
// Spread between the least and most refracted wavelengths, as a fraction of the bezel width
export const DISPERSION = 0.5

export type Outset =
  | number
  | { x?: number; y?: number; top?: number; right?: number; bottom?: number; left?: number }

// Resolves `outset` (and the deprecated `px`/`py`) into the four sides
export function resolveOutset(outset: Outset | undefined, px = 0, py = 0) {
  if (typeof outset === 'number') return { top: outset, right: outset, bottom: outset, left: outset }
  const x = outset?.x ?? px
  const y = outset?.y ?? py
  return {
    top: outset?.top ?? y,
    right: outset?.right ?? x,
    bottom: outset?.bottom ?? y,
    left: outset?.left ?? x,
  }
}

// Refraction profile across the bezel, sampled from the rim (t = 0) to the flat top (t = 1).
// The surface is a convex squircle h(t) = (1 - (1 - t)^4)^(1/4). For each point we compute
// how far a vertical ray bends when entering the glass (Snell's law), normalized to [0, 1].
const PROFILE_SAMPLES = 256
const refractionProfile = (() => {
  const profile = new Float32Array(PROFILE_SAMPLES)
  let max = 0
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const u = 1 - i / (PROFILE_SAMPLES - 1)
    const slope = (u * u * u) / Math.pow(Math.max(1 - u * u * u * u, 1e-9), 0.75)
    const incident = Math.atan(slope)
    const refracted = Math.asin(Math.sin(incident) / IOR)
    const offset = Math.tan(incident - refracted)
    profile[i] = offset
    max = Math.max(max, offset)
  }
  for (let i = 0; i < PROFILE_SAMPLES; i++) profile[i] /= max
  return profile
})()

function sampleProfile(t: number) {
  const f = Math.min(Math.max(t, 0), 1) * (PROFILE_SAMPLES - 1)
  const i = Math.floor(f)
  const next = refractionProfile[Math.min(i + 1, PROFILE_SAMPLES - 1)]
  return refractionProfile[i] + (next - refractionProfile[i]) * (f - i)
}

// Encodes a unit displacement field for a rounded rectangle into the R/G channels.
// The field is independent of depth, so depth changes only update the filter scale.
const mapCache = new Map<string, string>()
let mapCanvas: HTMLCanvasElement | undefined

export function getDisplacementMap(width: number, height: number, radius: number, bezel: number, cachedOnly = false) {
  const res = Math.min(1, Math.sqrt(MAX_MAP_PIXELS / (width * height)))
  const w = Math.max(1, Math.round(width * res))
  const h = Math.max(1, Math.round(height * res))
  const key = `${w}:${h}:${radius}:${bezel}`

  const cached = mapCache.get(key)
  if (cached) {
    // Refresh recency for LRU eviction
    mapCache.delete(key)
    mapCache.set(key, cached)
    return cached
  }
  if (cachedOnly) return null

  mapCanvas ??= document.createElement('canvas')
  mapCanvas.width = w
  mapCanvas.height = h
  const context = mapCanvas.getContext('2d')
  if (!context) return ''

  const image = context.createImageData(w, h)
  const data = image.data
  const halfW = width / 2
  const halfH = height / 2
  // Round the lens at least as much as the bezel so the displacement field has no seams
  const r = Math.min(Math.max(radius, bezel), halfW, halfH)

  for (let y = 0; y < h; y++) {
    const cy = (y + 0.5) / res - halfH
    for (let x = 0; x < w; x++) {
      const cx = (x + 0.5) / res - halfW
      const qx = Math.abs(cx) - (halfW - r)
      const qy = Math.abs(cy) - (halfH - r)

      // Distance from the edge and the outward normal of the rounded rectangle
      let distance: number
      let nx = 0
      let ny = 0
      if (qx > 0 && qy > 0) {
        const len = Math.sqrt(qx * qx + qy * qy)
        distance = r - len
        nx = qx / len
        ny = qy / len
      } else if (qx > qy) {
        distance = r - qx
        nx = 1
      } else {
        distance = r - qy
        ny = 1
      }

      let dx = 0
      let dy = 0
      if (distance < bezel) {
        // Light bends toward the center of a convex lens, so sample inward
        const magnitude = sampleProfile(distance / bezel)
        dx = -Math.sign(cx) * nx * magnitude
        dy = -Math.sign(cy) * ny * magnitude
      }

      const i = (y * w + x) * 4
      data[i] = 128 + dx * 127
      data[i + 1] = 128 + dy * 127
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  const url = mapCanvas.toDataURL()

  if (mapCache.size >= 32) {
    mapCache.delete(mapCache.keys().next().value!)
  }
  mapCache.set(key, url)
  return url
}

export function createSpecularShadow(specular: number | false) {
  const outer = '0 4px 12px rgba(0, 0, 0, 0.18)'
  if (specular === false || specular <= 0) return outer
  const a = Math.min(specular, 1)
  return [
    `inset 0 0 0 0.5px rgba(255, 255, 255, ${0.5 * a})`,
    `inset 1.5px 1.5px 1px -1px rgba(255, 255, 255, ${a})`,
    `inset -1.5px -1.5px 1px -1px rgba(255, 255, 255, ${0.6 * a})`,
    outer,
  ].join(', ')
}

// Spectral dispersion: the backdrop is refracted several times, each sample standing in for a
// band of wavelengths. Red bends the least and violet the most, like light through a prism.
// Every channel's weights sum to 1 across the samples so undispersed areas stay neutral.
export const MAX_SPECTRUM_SAMPLES = 9
// Refracting a backdrop copy runs on the CPU in Safari, so keep the spectrum cheap there
export const MAX_COPY_SPECTRUM_SAMPLES = 3
// Maximum pixels between two neighboring samples before the bands show as separate ghosts
export const SPECTRUM_STEP = 1.25
// The widest gap between the copy's bands. Wider than SPECTRUM_STEP, since a softer spectrum still reads as
// dispersion, but narrow enough that the bands don't come apart
export const MAX_COPY_SPECTRUM_STEP = 2.5
// Glass whose shorter side is below this many pixels renders at most SMALL_GLASS_SPECTRUM_SAMPLES bands
export const SMALL_GLASS_SIZE = 80
export const SMALL_GLASS_SPECTRUM_SAMPLES = 5
const spectrumCache = new Map<number, string[]>()

export function getSpectrum(samples: number) {
  let matrices = spectrumCache.get(samples)
  if (matrices) return matrices

  // Hue centers along the spectrum, from least (0) to most (1) refracted
  const centers = [0, 0.5, 1]
  const weights = centers.map((center) => {
    const channel = Array.from({ length: samples }, (_, i) => {
      const d = i / (samples - 1) - center
      return Math.exp((-d * d) / (2 * 0.3 * 0.3))
    })
    const sum = channel.reduce((a, b) => a + b, 0)
    return channel.map((w) => w / sum)
  })

  matrices = Array.from({ length: samples }, (_, i) => {
    const [r, g, b] = weights.map((channel) => channel[i].toFixed(4))
    return `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`
  })
  spectrumCache.set(samples, matrices)
  return matrices
}
