// Glass that merges. A group draws one glass for all its members: their rounded rectangles are unioned with a
// smooth minimum, so members that come close grow a liquid neck between them and flow into one shape.
//
// Members keep their own layout and content; the group only reads where they are. It follows them every frame
// while visible, so members moved by CSS transitions, transforms or springs merge and split on their own.
// Chromium refracts the real backdrop. Safari and Firefox refract a copy of it instead, like a single glass does
// (see backdrop-copy.ts): the copy fills the group's layer and the same filter cuts it to the members' shape.

import { attachBackdropCopy, GLASS_LAYER_ATTRIBUTE } from './backdrop-copy'
import { Field, type RoundRect } from './field'
import {
  createCopyLayer,
  createFilter,
  createWebKitMaps,
  dispersionBands,
  filterRegion,
  patchFilter,
  type Primitive,
  refractionPrimitives,
  setAttributes,
} from './filter'
import { Highlights, type Look } from './highlights'
import { type Light, lightPoint, watchPointer } from './light'
import { BEZEL_RATIO, type Outset, REFRACTION, resolveOutset } from './optics'
import { getSvgBackdropSupport, isWebKit, WEBKIT_MIN_BLUR } from './support'

export type GlassGroupOptions = {
  /** Width of the liquid neck between members, in px. 0 joins them without blending. Default 24 */
  smooth?: number
  /** Refraction strength at the bezel, -5 to 5. Default 1 */
  depth?: number
  /** Backdrop blur in px. Default 0.1 */
  blur?: number
  /** Spectral dispersion along the refracting edge, 0 to 3, or false. Default 0.5 */
  dispersion?: number | false
  /** Intensity of the specular rim, 0 to 1, or false. Default 0.5 */
  specular?: number | false
  /** Where the light comes from: an angle in degrees (0 above, 90 right) or 'pointer'. Default top left */
  light?: Light
  /** How far past the group's box members may reach and still be glass, in px. Default 64 */
  overflow?: number
}

export type GroupMemberOptions = {
  /** How far the member's glass extends beyond its box */
  outset?: Outset
  /** @deprecated Use `outset: { x }` */
  px?: number
  /** @deprecated Use `outset: { y }` */
  py?: number
  /** Corner radius in px. Defaults to the element's computed `border-radius` */
  radius?: number
}

export type GroupMember = {
  update(options: GroupMemberOptions): void
  remove(): void
}

export type GlassGroup = {
  readonly id: string
  /** Makes `element` part of the group's glass */
  add(element: HTMLElement, options?: GroupMemberOptions): GroupMember
  /** Merges new options into the current ones */
  update(options: GlassGroupOptions): void
  destroy(): void
}

type Member = { sides: { top: number; right: number; bottom: number; left: number }; radius?: number }

// Filter regions snap to this grid so moving members don't rewrite the filter every frame
const REGION_STEP = 32
let groupCount = 0

const memberSettings = (options: GroupMemberOptions = {}): Member => ({
  sides: resolveOutset(options.outset, options.px, options.py),
  radius: options.radius,
})

export function createGlassGroup(root: HTMLElement, options: GlassGroupOptions = {}): GlassGroup {
  let current: GlassGroupOptions = { ...options }
  const id = `vaso-group-${++groupCount}`
  root.setAttribute('data-vaso-group', id)
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative'

  const overflow = () => current.overflow ?? 64

  // The glass: one layer refracting the backdrop, cut to the members' shape by the filter
  const layer = document.createElement('span')
  layer.setAttribute('aria-hidden', 'true')
  layer.setAttribute('data-vaso-group-layer', '')
  Object.assign(layer.style, { position: 'absolute', pointerEvents: 'none', userSelect: 'none' })
  // Rim, sheen and shadow, shaded on the GPU from the same field
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'absolute', pointerEvents: 'none' })

  const { svg, filter } = createFilter(id)
  setAttributes(filter, { filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })
  let primitives: Primitive[] = []

  // Without backdrop refraction (Safari, Firefox) the layer holds a copy of the backdrop, filtered with `filter`.
  // WebKit sizes that filter by a frame around the whole copy, so it's written in fractions of the frame, which
  // backdrop-copy.ts measures and fills in
  const copyMode = !getSvgBackdropSupport()
  const framed = copyMode && isWebKit()
  let copyLayer: HTMLElement | null = null
  let detachCopy: ReturnType<typeof attachBackdropCopy> | null = null
  let copyBlur = 0
  // The copy's CSS filter: the SVG filter, then the frost
  const applyCopyFilter = () => {
    if (copyLayer && !destroyed) copyLayer.style.filter = `url(#${id}) blur(${copyBlur}px) saturate(${maps.saturation()})`
  }
  // WebKit's maps load before they're shown, each with the part of the layer it covers (see createWebKitMaps)
  const areas = new Map<string, typeof area>()
  const maps = createWebKitMaps((href) => {
    if (destroyed) return
    area = areas.get(href) ?? area
    filter.querySelector('feImage')?.setAttribute('href', href)
    // The cropped map and the area it covers change in the same frame
    detachCopy?.refresh()
    applyCopyFilter()
  })
  const shownMap = () => (framed ? maps.shown() : urls[urls.length - 1])
  // The part of the layer WebKit filters, in layer pixels, matching the cropped map
  let area = { x: 0, y: 0, width: 1, height: 1 }

  root.insertBefore(layer, root.firstChild)
  if (copyMode) {
    // Marked as glass, so this copy and the copies of other glasses leave the layer, rim canvas and filter out
    for (const el of [layer, canvas, svg]) el.setAttribute(GLASS_LAYER_ATTRIBUTE, el === layer ? id : '')
    const copy = createCopyLayer()
    copyLayer = copy.layer
    // Overflow visible in WebKit, which measures a frame around the copy anyway (see glass.ts)
    copyLayer.style.overflow = framed ? 'visible' : 'hidden'
    layer.append(copy.wrap)
    layer.after(canvas, svg)
  } else {
    layer.after(canvas, svg)
    layer.style.backdropFilter = `url(#${id}) saturate(1.2)`
  }

  const members = new Map<HTMLElement, Member>()
  const field = new Field()
  let packed: Float32Array = new Float32Array(0)
  let size = { width: 0, height: 0 }
  let ratio = 1
  let shapeKey = ''
  let shadeKey = ''
  let filterKey = ''
  let region = ''
  let rects: RoundRect[] = []
  let shaded: { x: number; y: number; width: number; height: number } | null = null
  let bezel = 0
  let visible = true
  let raf = 0
  let destroyed = false
  const urls: string[] = []

  const place = () => {
    const pad = `${-overflow()}px`
    for (const el of [layer, canvas]) Object.assign(el.style, { top: pad, left: pad })
    layer.style.right = layer.style.bottom = pad
  }
  place()

  const resize = () => {
    const width = layer.offsetWidth
    const height = layer.offsetHeight
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2)
    if (width === size.width && height === size.height && nextRatio === ratio) return
    size = { width, height }
    ratio = nextRatio
    field.resize(width, height)
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    if (copyLayer) {
      copyLayer.style.width = `${width}px`
      copyLayer.style.height = `${height}px`
    }
    shapeKey = shadeKey = filterKey = region = ''
    shaded = null
  }

  const measure = (origin: DOMRect) => {
    const next: RoundRect[] = []
    for (const [el, member] of members) {
      const box = el.getBoundingClientRect()
      if (!box.width && !box.height) continue
      const { top, right, bottom, left } = member.sides
      const width = box.width + left + right
      const height = box.height + top + bottom
      const css = member.radius ?? (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0)
      next.push({
        x: box.left - origin.left - left + width / 2,
        y: box.top - origin.top - top + height / 2,
        width,
        height,
        radius: Math.min(css, width / 2, height / 2),
      })
    }
    return next
  }

  const writeFilter = () => {
    const depth = current.depth ?? 1
    const blur = current.blur ?? 0.1
    // The map stores unit vectors, so double the scale to reach the full offset (as a single glass does)
    const scale = 2 * depth * bezel * REFRACTION
    const { spread, spectrum } = dispersionBands({
      bezel,
      depth,
      dispersion: current.dispersion ?? 0.5,
      shorterSide: rects.length ? Math.min(...rects.map((r) => Math.min(r.width, r.height))) : 0,
      copy: copyMode,
    })

    const key = `${scale.toFixed(2)}|${spread.toFixed(2)}|${spectrum?.length ?? 0}|${blur}|${size.width}x${size.height}`
    if (key === filterKey) return
    filterKey = key
    // The whole frame is the region when framed: WebKit misplaces the source for a smaller one. Otherwise the region
    // follows the members (see tick)
    if (framed) setAttributes(filter, filterRegion(true, { x: 0, y: 0, width: 1, height: 1 }))
    primitives = patchFilter(
      filter,
      refractionPrimitives({
        framed,
        // The href is set as the members move, in tick
        map: framed ? {} : { x: 0, y: 0, width: size.width, height: size.height },
        scale,
        spread,
        spectrum,
        // The real backdrop is blurred inside the filter; a copy is blurred by CSS after it
        blur: copyMode ? undefined : blur,
        mask: true,
      }),
      primitives,
    )
    // A rebuilt filter lost its map; put back the current one, which may have been drawn before the filter existed
    const image = filter.querySelector('feImage')
    const map = shownMap()
    if (image && !image.getAttribute('href') && map) image.setAttribute('href', map)
    if (copyLayer) {
      copyBlur = framed && blur < WEBKIT_MIN_BLUR ? 0 : blur
      applyCopyFilter()
    }

    // Copy what's behind the group into the layer and keep it aligned
    if (copyLayer && !detachCopy) {
      detachCopy = attachBackdropCopy({
        wrapper: root,
        container: layer,
        layer: copyLayer,
        filter: framed ? filter : null,
        ownContent: false,
        bounds: membersBounds,
        area: framed ? () => area : undefined,
      })
    }
  }

  // Where the members are, in viewport pixels: the part of the backdrop the copy has to cover
  const membersBounds = () => {
    const origin = layer.getBoundingClientRect()
    if (!rects.length) return new DOMRect(origin.left + origin.width / 2, origin.top + origin.height / 2, 0, 0)
    const reach = bezel * Math.abs(current.depth ?? 1) + 8
    const x0 = Math.min(...rects.map((r) => r.x - r.width / 2)) - reach
    const y0 = Math.min(...rects.map((r) => r.y - r.height / 2)) - reach
    const x1 = Math.max(...rects.map((r) => r.x + r.width / 2)) + reach
    const y1 = Math.max(...rects.map((r) => r.y + r.height / 2)) + reach
    return new DOMRect(origin.left + x0, origin.top + y0, x1 - x0, y1 - y0)
  }

  const look = (): Look => {
    const specular = current.specular ?? 0.5
    const s = specular === false ? 0 : Math.min(Math.max(specular, 0), 1)
    return { tint: 0.06, rim: 0.35 + s * 1.1, glow: 0.4 * s, shadow: 0.2, sheen: 0.25 * s, rimWidth: 1.4 }
  }

  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (!visible || destroyed) return
    resize()
    if (!size.width || !size.height) return
    const origin = layer.getBoundingClientRect()
    rects = measure(origin)

    const nextShape = rects.map((r) => `${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)},${r.radius.toFixed(1)}`).join(';') + `|${current.smooth ?? 24}`
    const light = lightPoint(current.light, origin, size.width, size.height)
    const specular = current.specular
    // The light as direction and distance from the glass, coarsely: a pointer moving a pixel shouldn't re-shade
    const lx = light.x - size.width / 2
    const ly = light.y - size.height / 2
    const lightKey = `${Math.round((Math.atan2(ly, lx) * 180) / Math.PI / 2)},${Math.round(Math.log2(Math.hypot(lx, ly) + 1) * 3)}`
    const nextShade = `${nextShape}|${lightKey}|${specular}`

    if (nextShape !== shapeKey) {
      shapeKey = nextShape
      bezel = rects.length ? Math.max(1, Math.min(...rects.map((r) => (Math.min(r.width, r.height) / 2) * BEZEL_RATIO))) : 1
      field.sample(rects, current.smooth ?? 24)

      // Only the area around the members is filtered; the rest of the layer costs nothing on the GPU
      let crop: [number, number, number, number] | undefined
      let nextArea = area
      if (rects.length) {
        const reach = bezel * Math.abs(current.depth ?? 1) + 24
        const x0 = Math.max(0, Math.floor((Math.min(...rects.map((r) => r.x - r.width / 2)) - reach) / REGION_STEP) * REGION_STEP)
        const y0 = Math.max(0, Math.floor((Math.min(...rects.map((r) => r.y - r.height / 2)) - reach) / REGION_STEP) * REGION_STEP)
        const x1 = Math.min(size.width, Math.ceil((Math.max(...rects.map((r) => r.x + r.width / 2)) + reach) / REGION_STEP) * REGION_STEP)
        const y1 = Math.min(size.height, Math.ceil((Math.max(...rects.map((r) => r.y + r.height / 2)) + reach) / REGION_STEP) * REGION_STEP)
        if (framed) {
          // WebKit filters on the CPU and its filter region has to be the whole frame, so the primitives are cut
          // down to the members instead, with the map cropped to the same cells
          const cw = size.width / field.cols
          const ch = size.height / field.rows
          crop = [Math.floor(x0 / cw), Math.floor(y0 / ch), Math.ceil(x1 / cw), Math.ceil(y1 / ch)]
          crop[2] = Math.max(crop[0] + 1, Math.min(field.cols, crop[2]))
          crop[3] = Math.max(crop[1] + 1, Math.min(field.rows, crop[3]))
          nextArea = { x: crop[0] * cw, y: crop[1] * ch, width: (crop[2] - crop[0]) * cw, height: (crop[3] - crop[1]) * ch }
        } else {
          const next = `${x0},${y0},${Math.max(1, x1 - x0)},${Math.max(1, y1 - y0)}`
          if (next !== region) {
            region = next
            const [x, y, w, h] = next.split(',')
            filter.setAttribute('x', x)
            filter.setAttribute('y', y)
            filter.setAttribute('width', w)
            filter.setAttribute('height', h)
          }
        }
      } else if (framed) {
        crop = [0, 0, 1, 1]
        nextArea = { x: 0, y: 0, width: size.width / field.cols, height: size.height / field.rows }
      }

      const url = field.draw(bezel, crop)
      urls.push(url)
      if (framed) {
        // WebKit gets the map once it has loaded, together with the area it covers (see createWebKitMaps)
        areas.set(url, nextArea)
        maps.request(url)
      } else {
        filter.querySelector('feImage')?.setAttribute('href', url)
      }
      // Keep the map on screen, and the ones after it that may still be loading
      while (urls.length > 3 && urls[0] !== shownMap()) {
        const old = urls.shift()!
        areas.delete(old)
        URL.revokeObjectURL(old)
      }
    }
    writeFilter()

    if (nextShade !== shadeKey) {
      shadeKey = nextShade
      const gl = Highlights.shared()
      if (gl) {
        const grid = field.pack(packed)
        packed = grid.data
        // The sampled part of the grid already covers the members plus their shadow; shade only that
        const [c0, r0, c1, r1] = field.region
        const toCanvas = ratio / field.scale
        const x = Math.max(0, Math.floor(c0 * toCanvas))
        const y = Math.max(0, Math.floor(r0 * toCanvas))
        const area = {
          x,
          y,
          width: Math.max(0, Math.min(canvas.width, Math.ceil((c1 + 1) * toCanvas)) - x),
          height: Math.max(0, Math.min(canvas.height, Math.ceil((r1 + 1) * toCanvas)) - y),
        }
        // Clear where the glass was last frame too, so nothing is left behind as it moves
        const clear = shaded
          ? {
              x: Math.min(shaded.x, area.x),
              y: Math.min(shaded.y, area.y),
              width: Math.max(shaded.x + shaded.width, area.x + area.width) - Math.min(shaded.x, area.x),
              height: Math.max(shaded.y + shaded.height, area.y + area.height) - Math.min(shaded.y, area.y),
            }
          : { x: 0, y: 0, width: canvas.width, height: canvas.height }
        gl.draw({ look: look(), light, bezel }, grid, field.scale, ratio, canvas, area, clear)
        shaded = area
      }
    }
  }

  const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: '100px' })
  observer.observe(root)
  // The group re-checks the light every frame anyway; subscribing only keeps the shared pointer listener running
  const followPointer = () => {}
  let unwatch = current.light === 'pointer' ? watchPointer(followPointer) : null
  raf = requestAnimationFrame(tick)

  return {
    id,
    add(element, options) {
      members.set(element, memberSettings(options))
      shapeKey = ''
      return {
        update(next) {
          if (!members.has(element)) return
          members.set(element, memberSettings(next))
          shapeKey = ''
        },
        remove() {
          members.delete(element)
          shapeKey = ''
        },
      }
    },
    update(options) {
      const next = { ...current, ...options }
      if ((Object.keys(next) as (keyof GlassGroupOptions)[]).every((key) => next[key] === current[key])) return
      const wasPointer = current.light === 'pointer'
      current = next
      if (current.light === 'pointer' && !wasPointer) unwatch = watchPointer(followPointer)
      if (current.light !== 'pointer' && wasPointer) {
        unwatch?.()
        unwatch = null
      }
      place()
      shapeKey = shadeKey = ''
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      unwatch?.()
      detachCopy?.()
      layer.remove()
      canvas.remove()
      svg.remove()
      urls.forEach((url) => URL.revokeObjectURL(url))
      root.removeAttribute('data-vaso-group')
    },
  }
}
