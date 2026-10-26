import { SpecGL } from './spec-gl'

// Prototype glass engine for the lab. It generalizes vaso's refraction (squircle bezel + Snell's law) from a
// rounded rectangle to any signed distance field, which is what makes merging shapes, glass text and
// deforming glass possible. Everything here is CPU work at a reduced resolution; the GPU only runs the
// SVG filter that displaces the live backdrop.

export type Profile = { table: Float32Array; peak: number }

const PROFILE_SAMPLES = 256

/** Refraction offset across the bezel, from the rim (t = 0) to the flat top (t = 1). `power` shapes the
 * surface: 2 is a round dome, 4 is vaso's squircle, higher values give a flat top with a sharp bevel */
export function makeProfile(ior = 1.5, power = 4): Profile {
  const table = new Float32Array(PROFILE_SAMPLES)
  let peak = 0
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const u = 1 - i / (PROFILE_SAMPLES - 1)
    const slope = Math.pow(u, power - 1) / Math.pow(Math.max(1 - Math.pow(u, power), 1e-9), (power - 1) / power)
    const incident = Math.atan(slope)
    const refracted = Math.asin(Math.sin(incident) / ior)
    const offset = Math.tan(incident - refracted)
    table[i] = offset
    peak = Math.max(peak, offset)
  }
  for (let i = 0; i < PROFILE_SAMPLES; i++) table[i] /= peak
  return { table, peak }
}

export const DEFAULT_PROFILE = makeProfile(1.5, 4)

function sampleProfile(table: Float32Array, t: number) {
  const f = (t <= 0 ? 0 : t >= 1 ? 1 : t) * (PROFILE_SAMPLES - 1)
  const i = f | 0
  const next = table[i + 1 < PROFILE_SAMPLES ? i + 1 : i]
  return table[i] + (next - table[i]) * (f - i)
}

// ---------------------------------------------------------------------------------------------------------
// Signed distance functions (negative inside)

export function sdRoundRect(px: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number) {
  r = Math.min(r, hw, hh)
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  const ox = qx > 0 ? qx : 0
  const oy = qy > 0 ? qy : 0
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - r
}

export function sdCircle(px: number, py: number, cx: number, cy: number, r: number) {
  const dx = px - cx
  const dy = py - cy
  return Math.sqrt(dx * dx + dy * dy) - r
}

/** Polynomial smooth minimum: unions two fields with a liquid neck of width `k` */
export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export type Shape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number }

export function sdShape(s: Shape, px: number, py: number) {
  return s.kind === 'circle' ? sdCircle(px, py, s.x, s.y, s.r) : sdRoundRect(px, py, s.x, s.y, s.w / 2, s.h / 2, s.r)
}

export function shapeBounds(s: Shape): Bounds {
  return s.kind === 'circle'
    ? [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r]
    : [s.x - s.w / 2, s.y - s.h / 2, s.x + s.w / 2, s.y + s.h / 2]
}

export type Bounds = [number, number, number, number]

export function unionBounds(list: Bounds[]): Bounds {
  const b: Bounds = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x0, y0, x1, y1] of list) {
    b[0] = Math.min(b[0], x0)
    b[1] = Math.min(b[1], y0)
    b[2] = Math.max(b[2], x1)
    b[3] = Math.max(b[3], y1)
  }
  return b
}

/** A smooth union of shapes as a single field */
export function blend(shapes: Shape[], k: number) {
  return (x: number, y: number) => {
    if (!shapes.length) return 1e4
    let d = sdShape(shapes[0], x, y)
    for (let i = 1; i < shapes.length; i++) d = k > 0 ? smin(d, sdShape(shapes[i], x, y), k) : Math.min(d, sdShape(shapes[i], x, y))
    return d
  }
}

// ---------------------------------------------------------------------------------------------------------
// Text as a distance field: rasterize, run an exact Euclidean distance transform inside and out, smooth it

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}

function edt2d(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]
  }
}

export type GridField = { sample: (x: number, y: number) => number; bounds: Bounds }

/** Distance field of `text` centered in a w × h box (css px), computed at `scale` resolution */
export function textField(text: string, font: string, w: number, h: number, scale = 0.5, letterSpacing = 0): GridField {
  const gw = Math.max(2, Math.round(w * scale))
  const gh = Math.max(2, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = gw
  canvas.height = gh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.scale(scale, scale)
  ctx.font = font
  ;(ctx as any).letterSpacing = `${letterSpacing}px`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const m = ctx.measureText(text)
  const textH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  ctx.fillStyle = '#000'
  ctx.fillText(text, w / 2, h / 2 + textH / 2 - m.actualBoundingBoxDescent)
  const alpha = ctx.getImageData(0, 0, gw, gh).data

  const INF = 1e20
  const outside = new Float64Array(gw * gh)
  const inside = new Float64Array(gw * gh)
  let x0 = gw, y0 = gh, x1 = 0, y1 = 0
  for (let i = 0; i < gw * gh; i++) {
    const on = alpha[i * 4 + 3] > 127
    outside[i] = on ? 0 : INF
    inside[i] = on ? INF : 0
    if (on) {
      const x = i % gw
      const y = (i / gw) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  edt2d(outside, gw, gh)
  edt2d(inside, gw, gh)
  let field = new Float32Array(gw * gh)
  for (let i = 0; i < gw * gh; i++) field[i] = (Math.sqrt(outside[i]) - Math.sqrt(inside[i])) / scale

  // Two box blur passes take the staircase out of the gradient, which would otherwise show as facets
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(gw * gh)
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let sum = 0
        let count = 0
        for (let j = -1; j <= 1; j++) {
          const yy = y + j
          if (yy < 0 || yy >= gh) continue
          for (let i = -1; i <= 1; i++) {
            const xx = x + i
            if (xx < 0 || xx >= gw) continue
            sum += field[yy * gw + xx]
            count++
          }
        }
        next[y * gw + x] = sum / count
      }
    }
    field = next
  }

  const sample = (x: number, y: number) => {
    const fx = Math.min(Math.max(x * scale - 0.5, 0), gw - 1.001)
    const fy = Math.min(Math.max(y * scale - 0.5, 0), gh - 1.001)
    const ix = fx | 0
    const iy = fy | 0
    const tx = fx - ix
    const ty = fy - iy
    const i = iy * gw + ix
    const a = field[i] + (field[i + 1] - field[i]) * tx
    const b = field[i + gw] + (field[i + gw + 1] - field[i + gw]) * tx
    return a + (b - a) * ty
  }
  return { sample, bounds: [x0 / scale, y0 / scale, (x1 + 1) / scale, (y1 + 1) / scale] }
}

// ---------------------------------------------------------------------------------------------------------
// Frame rendering

export type Look = {
  /** White body tint inside the glass, 0-1 */
  tint?: number
  /** Body tint color, defaults to white */
  tintColor?: [number, number, number]
  /** Rim highlight strength, 0-1 */
  rim?: number
  /** Light passing through and pooling on the far side, 0-1 */
  glow?: number
  /** Drop shadow strength, 0-1 */
  shadow?: number
  /** Thin-film rainbow on the rim (soap bubble), 0-1 */
  iridescence?: number
  /** Width of the bright rim line in px */
  rimWidth?: number
  /** Soft highlight on the bezel slope facing the light (GPU path), 0-1 */
  sheen?: number
}

export type Frame = {
  /** The glass as one distance field. Either this or `shapes` */
  sdf?: (x: number, y: number) => number
  /** The glass as primitives smoothly unioned with `k`. Much faster than `sdf` for many shapes: each one is only
   * evaluated near itself */
  shapes?: Shape[]
  /** Width of the liquid neck between `shapes`; 0 joins them with a plain union */
  k?: number
  /** Area covered by glass (css px); everything outside is skipped */
  bounds: Bounds
  bezel: number
  profile?: Profile
  /** Adds displacement inside the glass (unit vector space, ±1 = the full bezel offset) */
  extra?: (x: number, y: number, depth: number, out: { x: number; y: number }) => void
  /** Point light in layer coordinates */
  light?: { x: number; y: number }
  look?: Look
  /** Animation phase for iridescence */
  time?: number
}

const SHADOW_REACH = 22
/** Pixels closer to the edge than this get an exact distance; the rest is interpolated from the coarse grid */
const EDGE_BAND = 5

export class GlassRenderer {
  private mapImage: ImageData | null = null
  private specImage: ImageData | null = null
  // Coarse distance field and outward normals at map resolution, shared by both passes
  private grid = new Float32Array(0)
  private normalX = new Float32Array(0)
  private normalY = new Float32Array(0)
  private region = [0, 0, -1, -1]
  private gl: SpecGL | null | undefined
  private packed = new Float32Array(0)
  private bmp: Uint8Array | null = null
  mapScale = 0.5
  specScale = 1
  width = 0
  height = 0

  resize(width: number, height: number, specCanvas: HTMLCanvasElement) {
    this.width = width
    this.height = height
    const area = Math.max(1, width * height)
    this.mapScale = Math.min(0.5, Math.sqrt(70_000 / area))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // The GPU path shades at full device resolution; the CPU fallback is held to a pixel budget
    this.gl = SpecGL.shared()
    this.specScale = this.gl ? dpr : Math.min(dpr, Math.sqrt(400_000 / area))
    const mw = Math.max(1, Math.round(width * this.mapScale))
    const mh = Math.max(1, Math.round(height * this.mapScale))
    this.mapImage = new ImageData(mw, mh)
    this.grid = new Float32Array(mw * mh)
    this.normalX = new Float32Array(mw * mh)
    this.normalY = new Float32Array(mw * mh)
    this.region = [0, 0, -1, -1]
    specCanvas.width = Math.max(1, Math.round(width * this.specScale))
    specCanvas.height = Math.max(1, Math.round(height * this.specScale))
    this.specImage = this.gl ? null : specCanvas.getContext('2d')!.createImageData(specCanvas.width, specCanvas.height)
  }

  /** The sampled region of the coarse grid as distance + normal texels for the GPU */
  private packRegion() {
    const [x0, y0, x1, y1] = this.region
    const width = Math.max(0, x1 - x0 + 1)
    const height = Math.max(0, y1 - y0 + 1)
    if (this.packed.length < width * height * 4) this.packed = new Float32Array(width * height * 4)
    const gw = this.mapImage!.width
    const out = this.packed
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y + y0) * gw + x + x0
        const o = (y * width + x) * 4
        out[o] = this.grid[i]
        out[o + 1] = this.normalX[i]
        out[o + 2] = this.normalY[i]
      }
    }
    return { data: out.subarray(0, width * height * 4), width, height, x0, y0 }
  }

  /** Samples the field on the coarse grid over the frame's bounds, plus room for the shadow */
  private sampleGrid(frame: Frame) {
    const w = this.mapImage!.width
    const h = this.mapImage!.height
    const s = this.mapScale
    const margin = SHADOW_REACH + 8
    const [bx0, by0, bx1, by1] = frame.bounds
    const x0 = Math.max(0, Math.floor((bx0 - margin) * s))
    const y0 = Math.max(0, Math.floor((by0 - margin) * s))
    const x1 = Math.min(w - 1, Math.ceil((bx1 + margin) * s))
    const y1 = Math.min(h - 1, Math.ceil((by1 + margin) * s))
    this.region = [x0, y0, x1, y1]
    const { grid, normalX, normalY } = this
    if (frame.shapes) {
      // Splat each shape into the cells around it. Cells beyond every shape's reach stay far away, which is all
      // the highlights and shadow need to know about them
      const k = frame.k ?? 0
      const FAR = 1e4
      for (let y = y0; y <= y1; y++) grid.fill(FAR, y * w + x0, y * w + x1 + 1)
      const reach = margin + k
      for (const shape of frame.shapes) {
        const [sx0, sy0, sx1, sy1] = shapeBounds(shape)
        const cx0 = Math.max(x0, Math.floor((sx0 - reach) * s))
        const cy0 = Math.max(y0, Math.floor((sy0 - reach) * s))
        const cx1 = Math.min(x1, Math.ceil((sx1 + reach) * s))
        const cy1 = Math.min(y1, Math.ceil((sy1 + reach) * s))
        for (let y = cy0; y <= cy1; y++) {
          const py = (y + 0.5) / s
          for (let x = cx0; x <= cx1; x++) {
            const i = y * w + x
            const d = sdShape(shape, (x + 0.5) / s, py)
            const g = grid[i]
            grid[i] = g >= FAR ? d : k > 0 ? smin(g, d, k) : Math.min(g, d)
          }
        }
      }
    } else {
      const sdf = frame.sdf!
      for (let y = y0; y <= y1; y++) {
        const py = (y + 0.5) / s
        for (let x = x0; x <= x1; x++) grid[y * w + x] = sdf((x + 0.5) / s, py)
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const gx = grid[y * w + Math.min(x + 1, x1)] - grid[y * w + Math.max(x - 1, x0)]
        const gy = grid[Math.min(y + 1, y1) * w + x] - grid[Math.max(y - 1, y0) * w + x]
        const len = Math.sqrt(gx * gx + gy * gy) || 1
        normalX[y * w + x] = gx / len
        normalY[y * w + x] = gy / len
      }
    }
  }

  /** Displacement map: R/G hold the offset, B the glass coverage (used as the mask), A stays opaque so the
   * offsets survive premultiplication */
  /** The last drawn map as an uncompressed BMP blob URL. Building it is a byte copy, synchronous and far cheaper
   * than PNG encoding, so a moving shape can get a fresh map every frame. The caller revokes old URLs */
  mapUrl(): string {
    const image = this.mapImage!
    const { width: w, height: h, data } = image
    const HEADER = 54
    const size = HEADER + w * h * 4
    if (!this.bmp || this.bmp.byteLength !== size) {
      this.bmp = new Uint8Array(size)
      const view = new DataView(this.bmp.buffer)
      view.setUint8(0, 0x42) // 'B'
      view.setUint8(1, 0x4d) // 'M'
      view.setUint32(2, size, true)
      view.setUint32(10, HEADER, true)
      view.setUint32(14, 40, true) // BITMAPINFOHEADER
      view.setInt32(18, w, true)
      view.setInt32(22, -h, true) // negative height: rows run top to bottom
      view.setUint16(26, 1, true)
      view.setUint16(28, 32, true) // BGRA
      view.setUint32(34, w * h * 4, true)
    }
    const out = this.bmp
    for (let i = 0, o = HEADER; i < data.length; i += 4, o += 4) {
      out[o] = data[i + 2]
      out[o + 1] = data[i + 1]
      out[o + 2] = data[i]
      out[o + 3] = 255
    }
    return URL.createObjectURL(new Blob([out], { type: 'image/bmp' }))
  }

  /** Draws the map and samples the coarse grid the highlights reuse */
  drawMap(frame: Frame) {
    const image = this.mapImage!
    const w = image.width
    const s = this.mapScale
    const data = image.data
    new Uint32Array(data.buffer).fill(0xff008080)
    this.sampleGrid(frame)
    const [x0, y0, x1, y1] = this.region
    const { grid, normalX, normalY } = this
    const table = (frame.profile ?? DEFAULT_PROFILE).table
    const bezel = frame.bezel
    const extra = frame.extra
    const tmp = { x: 0, y: 0 }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x
        const d = grid[i]
        const coverage = Math.min(Math.max(0.5 - d * s, 0), 1)
        if (coverage <= 0) continue
        const depth = -d
        let dx = 0
        let dy = 0
        if (depth < bezel) {
          // Light bends toward the inside of a convex surface, so the backdrop is sampled inward
          const m = sampleProfile(table, Math.max(depth, 0) / bezel)
          dx = -normalX[i] * m
          dy = -normalY[i] * m
        }
        if (extra) {
          tmp.x = 0
          tmp.y = 0
          extra((x + 0.5) / s, (y + 0.5) / s, depth, tmp)
          dx += tmp.x
          dy += tmp.y
        }
        const o = i * 4
        data[o] = 128 + Math.max(-1, Math.min(1, dx)) * 127
        data[o + 1] = 128 + Math.max(-1, Math.min(1, dy)) * 127
        data[o + 2] = coverage * 255
      }
    }
  }

  /** Rim light, body tint, far-side glow and drop shadow, drawn to the overlay canvas. Reuses the coarse grid
   * from the last renderMap, so the map must have been rendered for the same shapes */
  renderSpecular(frame: Frame, canvas: HTMLCanvasElement) {
    const gl = SpecGL.shared()
    if (gl) {
      gl.draw(frame, this.packRegion(), this.mapScale, this.specScale, { width: this.width, height: this.height }, canvas)
      return
    }
    // CPU fallback, also taken if the shared context was lost after this layer was sized
    this.specImage ??= canvas.getContext('2d')!.createImageData(canvas.width, canvas.height)
    const image = this.specImage
    const w = image.width
    const h = image.height
    const s = this.specScale
    const data = image.data
    new Uint32Array(data.buffer).fill(0)
    const ctx = canvas.getContext('2d')!
    const [gx0, gy0, gx1, gy1] = this.region
    if (gx1 < gx0 || gy1 < gy0) {
      ctx.putImageData(image, 0, 0)
      return
    }
    const ms = this.mapScale
    const gw = this.mapImage!.width
    const { grid, normalX, normalY } = this

    const look = frame.look ?? {}
    const tint = look.tint ?? 0.06
    const [tr, tg, tb] = look.tintColor ?? [255, 255, 255]
    const rim = look.rim ?? 0.75
    const glow = look.glow ?? 0.35
    const shadow = look.shadow ?? 0.22
    const iridescence = look.iridescence ?? 0
    const rimWidth = look.rimWidth ?? 1.4
    const bezel = frame.bezel
    const light = frame.light ?? { x: this.width * 0.2, y: -this.height }
    const time = frame.time ?? 0
    const sdf = frame.sdf ?? blend(frame.shapes ?? [], frame.k ?? 0)
    const band = EDGE_BAND + 1 / ms

    // Bilinear lookup into the coarse grid; outside the sampled region counts as far away
    let nxOut = 0
    let nyOut = 0
    const coarse = (px: number, py: number, withNormal: boolean) => {
      let fx = px * ms - 0.5
      let fy = py * ms - 0.5
      if (fx < gx0 || fy < gy0 || fx > gx1 || fy > gy1) return 1e9
      const ix = Math.min(fx | 0, gx1 - 1 < gx0 ? gx0 : gx1 - 1)
      const iy = Math.min(fy | 0, gy1 - 1 < gy0 ? gy0 : gy1 - 1)
      const tx = Math.min(fx - ix, 1)
      const ty = Math.min(fy - iy, 1)
      const i = iy * gw + ix
      const j = Math.min(ix + 1, gx1) - ix
      const k = (Math.min(iy + 1, gy1) - iy) * gw
      const w00 = (1 - tx) * (1 - ty)
      const w10 = tx * (1 - ty)
      const w01 = (1 - tx) * ty
      const w11 = tx * ty
      if (withNormal) {
        nxOut = normalX[i] * w00 + normalX[i + j] * w10 + normalX[i + k] * w01 + normalX[i + j + k] * w11
        nyOut = normalY[i] * w00 + normalY[i + j] * w10 + normalY[i + k] * w01 + normalY[i + j + k] * w11
      }
      return grid[i] * w00 + grid[i + j] * w10 + grid[i + k] * w01 + grid[i + j + k] * w11
    }

    const x0 = Math.max(0, Math.floor((gx0 / ms) * s))
    const y0 = Math.max(0, Math.floor((gy0 / ms) * s))
    const x1 = Math.min(w - 1, Math.ceil(((gx1 + 1) / ms) * s))
    const y1 = Math.min(h - 1, Math.ceil(((gy1 + 1) / ms) * s))

    for (let y = y0; y <= y1; y++) {
      const py = (y + 0.5) / s
      for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) / s
        let d = coarse(px, py, true)
        if (d > SHADOW_REACH + 2) continue
        let nx = nxOut
        let ny = nyOut
        if (d > -band && d < band) d = sdf(px, py)
        const coverage = Math.min(Math.max(0.5 - d * s, 0), 1)

        let r = 0
        let g = 0
        let b = 0
        let a = 0

        // Drop shadow: the field sampled a few pixels up, so the shadow falls below the glass
        if (shadow > 0 && coverage < 1) {
          const ds = coarse(px, py - 5, false)
          if (ds < SHADOW_REACH) {
            const k = Math.max(ds, 0) / SHADOW_REACH
            a = shadow * (1 - k) * (1 - k) * (1 - coverage)
          }
        }

        if (coverage > 0) {
          const nl = Math.sqrt(nx * nx + ny * ny) || 1
          nx /= nl
          ny /= nl
          let lx = light.x - px
          let ly = light.y - py
          const ll = Math.sqrt(lx * lx + ly * ly) || 1
          lx /= ll
          ly /= ll
          const facing = nx * lx + ny * ly
          const depth = Math.max(-d, 0)

          // Body tint
          let ca = tint * coverage
          r = r * (1 - ca) + tr * ca
          g = g * (1 - ca) + tg * ca
          b = b * (1 - ca) + tb * ca
          a = a * (1 - ca) + ca

          // Light entering on the near side exits and pools on the far side of the bezel
          const pool = glow * Math.max(-facing, 0) * Math.exp(-depth / (bezel * 0.55)) * coverage
          if (pool > 0.002) {
            r = r * (1 - pool) + 255 * pool
            g = g * (1 - pool) + 255 * pool
            b = b * (1 - pool) + 255 * pool
            a = a * (1 - pool) + pool
          }

          // Fresnel rim: brightest where the rim faces the light, with a fainter kick on the opposite edge
          if (depth < rimWidth * 7) {
            const rimBand = Math.exp(-depth / rimWidth)
            const lit = facing > 0 ? 0.18 + 0.82 * facing * facing : 0.18 + 0.5 * Math.pow(-facing, 3)
            ca = Math.min(1, rim * rimBand * lit * coverage * 1.15)
            if (ca > 0.002) {
              let cr = 255
              let cg = 255
              let cb = 255
              if (iridescence > 0) {
                // Thin-film interference: hue drifts with depth into the rim, direction and time
                const phase = depth * 0.09 + Math.atan2(ny, nx) * 0.5 + time * 0.6
                const m = iridescence
                cr = 255 * (1 - m) + 255 * (0.62 + 0.38 * Math.cos(6.2832 * phase)) * m
                cg = 255 * (1 - m) + 255 * (0.62 + 0.38 * Math.cos(6.2832 * (phase + 0.33))) * m
                cb = 255 * (1 - m) + 255 * (0.62 + 0.38 * Math.cos(6.2832 * (phase + 0.67))) * m
              }
              r = r * (1 - ca) + cr * ca
              g = g * (1 - ca) + cg * ca
              b = b * (1 - ca) + cb * ca
              a = a * (1 - ca) + ca
            }
          }

          // Soap film: a broad, faint rainbow sheen over the whole bubble
          if (iridescence > 0) {
            const phase = depth * 0.012 + (px + py) * 0.002 + time * 0.25
            const sheen = 0.16 * iridescence * coverage * Math.exp(-depth / (bezel * 1.4))
            r = r * (1 - sheen) + 255 * (0.5 + 0.5 * Math.cos(6.2832 * phase)) * sheen
            g = g * (1 - sheen) + 255 * (0.5 + 0.5 * Math.cos(6.2832 * (phase + 0.33))) * sheen
            b = b * (1 - sheen) + 255 * (0.5 + 0.5 * Math.cos(6.2832 * (phase + 0.67))) * sheen
            a = a * (1 - sheen) + sheen
          }
        }

        if (a > 0.002) {
          const o = (y * w + x) * 4
          // r/g/b were accumulated premultiplied; ImageData wants straight alpha
          data[o] = r / a
          data[o + 1] = g / a
          data[o + 2] = b / a
          data[o + 3] = a * 255
        }
      }
    }
    ctx.putImageData(image, 0, 0)
  }
}
