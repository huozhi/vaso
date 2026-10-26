// Glass of any shape: a signed distance field sampled on a coarse grid, turned into a displacement map with the
// same refraction profile as a single glass. Groups union their members' rounded rectangles here with a smooth
// minimum, which is what makes neighbouring glass flow into each other.

import { sampleProfile } from './optics'

/** A rounded rectangle by its center and size, in the field's pixel space */
export type RoundRect = { x: number; y: number; width: number; height: number; radius: number }

export type Bounds = [x0: number, y0: number, x1: number, y1: number]

/** Distance to a rounded rectangle's edge; negative inside */
export function sdRoundRect(px: number, py: number, rect: RoundRect) {
  const hw = rect.width / 2
  const hh = rect.height / 2
  const r = Math.min(rect.radius, hw, hh)
  const qx = Math.abs(px - rect.x) - hw + r
  const qy = Math.abs(py - rect.y) - hh + r
  const ox = qx > 0 ? qx : 0
  const oy = qy > 0 ? qy : 0
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - r
}

/** Polynomial smooth minimum: unions two fields with a liquid neck about `k` wide */
export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export function rectBounds(rects: RoundRect[], pad = 0): Bounds {
  const b: Bounds = [Infinity, Infinity, -Infinity, -Infinity]
  for (const r of rects) {
    b[0] = Math.min(b[0], r.x - r.width / 2 - pad)
    b[1] = Math.min(b[1], r.y - r.height / 2 - pad)
    b[2] = Math.max(b[2], r.x + r.width / 2 + pad)
    b[3] = Math.max(b[3], r.y + r.height / 2 + pad)
  }
  return b
}

/** How far the drop shadow reaches past the edge, which the grid also has to cover */
export const SHADOW_REACH = 22
const FAR = 1e4
// The map is smooth, so a coarse grid is enough
const MAX_FIELD_CELLS = 70_000

/** The distance field and its outward normals on a coarse grid, plus the displacement map drawn from them */
export class Field {
  width = 0
  height = 0
  /** Grid cells per pixel */
  scale = 0.5
  cols = 0
  rows = 0
  grid = new Float32Array(0)
  normalX = new Float32Array(0)
  normalY = new Float32Array(0)
  /** The part of the grid sampled for the current shapes: [col0, row0, col1, row1] */
  region: Bounds = [0, 0, -1, -1]
  private image: ImageData | null = null
  private bmp: Uint8Array<ArrayBuffer> | null = null
  private bmpWidth = 0
  private bmpHeight = 0

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.scale = Math.min(0.5, Math.sqrt(MAX_FIELD_CELLS / Math.max(1, width * height)))
    this.cols = Math.max(1, Math.round(width * this.scale))
    this.rows = Math.max(1, Math.round(height * this.scale))
    const cells = this.cols * this.rows
    this.grid = new Float32Array(cells)
    this.normalX = new Float32Array(cells)
    this.normalY = new Float32Array(cells)
    this.image = new ImageData(this.cols, this.rows)
    this.bmp = null
  }

  /** Samples the smooth union of `rects`. Each shape only touches the cells near it, so many small shapes stay cheap */
  sample(rects: RoundRect[], smooth: number) {
    const { cols, rows, scale: s, grid, normalX, normalY } = this
    const margin = SHADOW_REACH + 8 + smooth
    const [bx0, by0, bx1, by1] = rects.length ? rectBounds(rects, margin) : [0, 0, -1, -1]
    const x0 = Math.max(0, Math.floor(bx0 * s))
    const y0 = Math.max(0, Math.floor(by0 * s))
    const x1 = Math.min(cols - 1, Math.ceil(bx1 * s))
    const y1 = Math.min(rows - 1, Math.ceil(by1 * s))
    this.region = [x0, y0, x1, y1]
    if (x1 < x0 || y1 < y0) return
    for (let y = y0; y <= y1; y++) grid.fill(FAR, y * cols + x0, y * cols + x1 + 1)
    for (const rect of rects) {
      const cx0 = Math.max(x0, Math.floor((rect.x - rect.width / 2 - margin) * s))
      const cy0 = Math.max(y0, Math.floor((rect.y - rect.height / 2 - margin) * s))
      const cx1 = Math.min(x1, Math.ceil((rect.x + rect.width / 2 + margin) * s))
      const cy1 = Math.min(y1, Math.ceil((rect.y + rect.height / 2 + margin) * s))
      for (let y = cy0; y <= cy1; y++) {
        const py = (y + 0.5) / s
        for (let x = cx0; x <= cx1; x++) {
          const i = y * cols + x
          const d = sdRoundRect((x + 0.5) / s, py, rect)
          const g = grid[i]
          grid[i] = g >= FAR ? d : smooth > 0 ? smin(g, d, smooth) : Math.min(g, d)
        }
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const gx = grid[y * cols + Math.min(x + 1, x1)] - grid[y * cols + Math.max(x - 1, x0)]
        const gy = grid[Math.min(y + 1, y1) * cols + x] - grid[Math.max(y - 1, y0) * cols + x]
        const len = Math.sqrt(gx * gx + gy * gy) || 1
        normalX[y * cols + x] = gx / len
        normalY[y * cols + x] = gy / len
      }
    }
  }

  /** Displacement map: R/G hold the offset (light bends inward at the bezel), B the coverage that cuts out the
   * shape, A stays opaque so the offsets survive premultiplication. Returned as an uncompressed BMP blob URL:
   * building it is a byte copy, cheap enough for every frame of an animation. The caller revokes it.
   * `crop` limits the image to those cells, [col0, row0, col1, row1) */
  draw(bezel: number, crop?: Bounds): string {
    const image = this.image!
    const data = image.data
    new Uint32Array(data.buffer).fill(0xff008080)
    const [x0, y0, x1, y1] = this.region
    const { cols, scale: s, grid, normalX, normalY } = this
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * cols + x
        const d = grid[i]
        const coverage = Math.min(Math.max(0.5 - d * s, 0), 1)
        if (coverage <= 0) continue
        const depth = -d
        let dx = 0
        let dy = 0
        if (depth < bezel) {
          const m = sampleProfile(Math.max(depth, 0) / bezel)
          dx = -normalX[i] * m
          dy = -normalY[i] * m
        }
        const o = i * 4
        data[o] = 128 + dx * 127
        data[o + 1] = 128 + dy * 127
        data[o + 2] = coverage * 255
      }
    }
    return this.toBmpUrl(crop ?? [0, 0, this.cols, this.rows])
  }

  private toBmpUrl([c0, r0, c1, r1]: Bounds) {
    const { width: cols, data } = this.image!
    const w = Math.max(1, c1 - c0)
    const h = Math.max(1, r1 - r0)
    const HEADER = 54
    const size = HEADER + w * h * 4
    if (!this.bmp || this.bmpWidth !== w || this.bmpHeight !== h) {
      this.bmpWidth = w
      this.bmpHeight = h
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
    for (let y = 0, o = HEADER; y < h; y++) {
      for (let x = 0, i = ((y + r0) * cols + c0) * 4; x < w; x++, i += 4, o += 4) {
        out[o] = data[i + 2]
        out[o + 1] = data[i + 1]
        out[o + 2] = data[i]
        out[o + 3] = 255
      }
    }
    return URL.createObjectURL(new Blob([out], { type: 'image/bmp' }))
  }

  /** The sampled region as distance + normal texels for the GPU highlights */
  pack(into: Float32Array) {
    const [x0, y0, x1, y1] = this.region
    const width = Math.max(0, x1 - x0 + 1)
    const height = Math.max(0, y1 - y0 + 1)
    const data = into.length >= width * height * 4 ? into : new Float32Array(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y + y0) * this.cols + x + x0
        const o = (y * width + x) * 4
        data[o] = this.grid[i]
        data[o + 1] = this.normalX[i]
        data[o + 2] = this.normalY[i]
      }
    }
    return { data, width, height, x0, y0 }
  }
}
