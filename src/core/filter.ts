// The SVG filter behind every glass, shared by a single glass (glass.ts) and a group (group.ts): it refracts what's
// behind it through a displacement map, splits the refraction into spectral bands for dispersion, and in Safari and
// Firefox works on a copy of the backdrop instead of the backdrop itself. A glass only decides its shape (the map) and
// its strength; everything that depends on the browser lives here.

import { FRAME_ATTRIBUTE, FRAME_AXES_ATTRIBUTE, FRAME_SCALE_ATTRIBUTE } from './backdrop-copy'
import {
  DISPERSION,
  getSpectrum,
  MAX_COPY_SPECTRUM_SAMPLES,
  MAX_COPY_SPECTRUM_STEP,
  MAX_SPECTRUM_SAMPLES,
  SMALL_GLASS_SIZE,
  SMALL_GLASS_SPECTRUM_SAMPLES,
  SPECTRUM_STEP,
} from './optics'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A filter primitive as tag and attributes, so a filter can be patched in place instead of rebuilt */
export type Primitive = [tag: string, attributes: Record<string, string | number>]

/**
 * How far apart the red and violet images sit at the rim, in px, and the color matrices of the bands that cover it.
 * Flat glass doesn't refract, so dispersion fades out as depth approaches zero. Small glass has a narrow rim where
 * extra bands are indistinguishable, and each band is a full displacement pass. A copy gets fewer bands, which can't
 * cover a wide spread without splitting into colored ghosts of every edge, so its spread is narrowed to what they
 * blend smoothly
 */
export function dispersionBands(options: { bezel: number; depth: number; dispersion: number | false; shorterSide: number; copy: boolean }) {
  const { bezel, depth, dispersion, shorterSide, copy } = options
  const maxSamples = Math.min(
    copy ? MAX_COPY_SPECTRUM_SAMPLES : MAX_SPECTRUM_SAMPLES,
    shorterSide < SMALL_GLASS_SIZE ? SMALL_GLASS_SPECTRUM_SAMPLES : Infinity,
  )
  const fullSpread = dispersion ? Math.max(dispersion, 0) * bezel * DISPERSION * Math.min(1, Math.abs(depth) * 4) : 0
  const spread = copy ? Math.min(fullSpread, (maxSamples - 1) * MAX_COPY_SPECTRUM_STEP) : fullSpread
  const spectrum = spread > 0.5 ? getSpectrum(Math.min(maxSamples, Math.max(3, Math.ceil(spread / SPECTRUM_STEP) + 1))) : null
  return { spread, spectrum }
}

export type RefractionOptions = {
  /** WebKit's copy filter: written in fractions of a frame around the copy, which backdrop-copy.ts measures and fills
   * in. Each primitive is placed at the glass inside that frame, and pixel scales are converted to frame units */
  framed: boolean
  /** Attributes of the map's <feImage> besides its result: its href, and outside a frame where it sits */
  map: Record<string, string | number>
  /** Displacement at the rim in px: the map stores unit vectors, so twice the offset it should reach */
  scale: number
  spread: number
  spectrum: string[] | null
  /** Blur the source inside the filter, in px. Otherwise the caller blurs with CSS after the filter */
  blur?: number
  /** Cut the result to the map's coverage (its blue channel), for shapes that don't fill their box */
  mask?: boolean
}

/** The primitives of a refraction filter, see RefractionOptions */
export function refractionPrimitives(options: RefractionOptions): Primitive[] {
  const { framed, map, scale, spread, spectrum, blur, mask } = options
  type Attributes = Primitive[1]
  const inFrame: Attributes = framed ? { [FRAME_ATTRIBUTE]: '' } : {}
  const scaleOf = (px: number): Attributes => (framed ? { [FRAME_SCALE_ATTRIBUTE]: px } : { scale: px })
  const source = blur === undefined ? 'SourceGraphic' : 'source'
  const out: Primitive[] = framed
    ? [
        ['feImage', { ...inFrame, ...map, preserveAspectRatio: 'none', result: 'rawMap' }],
        // Rescales the map's axes for a frame of another aspect ratio than the glass's
        ['feColorMatrix', { ...inFrame, [FRAME_AXES_ATTRIBUTE]: '', in: 'rawMap', type: 'matrix', result: 'map' }],
      ]
    : [['feImage', { ...map, preserveAspectRatio: 'none', result: 'map' }]]
  if (mask) {
    // Coverage lives in the map's blue channel; it becomes the alpha that cuts out the shape
    out.push(['feColorMatrix', { ...inFrame, in: 'map', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0', result: 'mask' }])
  }
  if (blur !== undefined) out.push(['feGaussianBlur', { ...inFrame, in: 'SourceGraphic', stdDeviation: blur, result: 'source' }])
  const displace = (px: number, result: string): Primitive => [
    'feDisplacementMap',
    { ...inFrame, ...scaleOf(px), in: source, in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G', result },
  ]
  if (spectrum) {
    spectrum.forEach((matrix, i) => {
      out.push(displace(scale + spread * (i / (spectrum.length - 1) - 0.5) * 2, `displaced${i}`))
      out.push(['feColorMatrix', { ...inFrame, in: `displaced${i}`, type: 'matrix', values: matrix, result: `band${i}` }])
      if (i > 0) {
        const result = i === spectrum.length - 1 ? 'refracted' : `spectrum${i}`
        out.push(['feComposite', { ...inFrame, in: i === 1 ? 'band0' : `spectrum${i - 1}`, in2: `band${i}`, operator: 'lighter', result }])
      }
    })
  } else {
    out.push(displace(scale, 'refracted'))
  }
  if (mask) out.push(['feComposite', { ...inFrame, in: 'refracted', in2: 'mask', operator: 'in' }])
  return out
}

/** The filter's own region and units: a whole frame when framed, otherwise the given box in user space */
export function filterRegion(framed: boolean, box: { x: number; y: number; width: number; height: number }): Primitive[1] {
  return {
    filterUnits: framed ? 'objectBoundingBox' : 'userSpaceOnUse',
    primitiveUnits: framed ? 'objectBoundingBox' : 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
    ...(framed ? { x: 0, y: 0, width: 1, height: 1 } : box),
  }
}

/** A hidden <svg> holding one <filter id={id}> */
export function createFilter(id: string) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  Object.assign(svg.style, { position: 'fixed', top: '0', left: '0', pointerEvents: 'none' })
  const filter = document.createElementNS(SVG_NS, 'filter')
  filter.setAttribute('id', id)
  svg.appendChild(document.createElementNS(SVG_NS, 'defs')).appendChild(filter)
  return { svg, filter }
}

/**
 * Writes `next` into `filter`, patching the existing primitives in place when the structure is the same. Framed
 * primitives are positioned by backdrop-copy.ts, and rebuilding them on every animated change would drop those
 * positions for a frame. `previous` is what the last call wrote, so attributes it set that `next` drops are removed;
 * attributes neither wrote (those positions) are left alone. Returns `next`, to pass as `previous` next time
 */
export function patchFilter(filter: SVGFilterElement, next: Primitive[], previous: Primitive[]) {
  const elements = Array.from(filter.children)
  const sameShape = elements.length === next.length && next.every(([tag], i) => elements[i].localName === tag)
  if (sameShape) {
    next.forEach(([, attributes], i) => {
      const before = previous[i]?.[1] ?? {}
      for (const name of Object.keys(before)) if (!(name in attributes)) elements[i].removeAttribute(name)
      setAttributes(elements[i], attributes)
    })
  } else {
    filter.replaceChildren(
      ...next.map(([tag, attributes]) => {
        const element = document.createElementNS(SVG_NS, tag)
        setAttributes(element, attributes)
        return element
      }),
    )
  }
  return next
}

export function setAttributes(element: Element, attributes: Record<string, string | number>) {
  for (const [name, value] of Object.entries(attributes)) {
    const text = String(value)
    if (element.getAttribute(name) !== text) element.setAttribute(name, text)
  }
}

/**
 * The element a copy of the backdrop is refracted on, and the wrapper that clips it. Safari can paint filtered pixels
 * outside clip-path and rounded overflow, so a mask on the wrapper clips them; on the filtered layer itself, the mask
 * would make WebKit size the filter by the layer alone. The layer is sized by the caller to match the map, and its
 * children are managed by backdrop-copy.ts
 */
export function createCopyLayer() {
  const wrap = document.createElement('span')
  wrap.setAttribute('aria-hidden', 'true')
  Object.assign(wrap.style, { position: 'absolute', inset: '0', overflow: 'hidden' })
  wrap.style.setProperty('-webkit-mask-image', '-webkit-radial-gradient(white, black)')
  const layer = document.createElement('span')
  Object.assign(layer.style, { position: 'absolute', top: '0', left: '0' })
  wrap.appendChild(layer)
  return { wrap, layer }
}

/**
 * WebKit doesn't repaint an element when only the SVG filter it uses changes, and loads a new map later still, so a
 * changing glass (a press, a ripple, highlights moving) kept its old look until something forced a repaint. A different
 * but equivalent CSS filter makes it rebuild the filter: `mapChanged` flips the saturation by a hair once when the map
 * changes and once the new map has loaded, calling `apply` to write the CSS filter again
 */
export function createWebKitRepaint(apply: () => void) {
  let flipped = false
  let current = ''
  return {
    /** The saturation to write into the copy's CSS filter */
    saturation: () => (flipped ? 1.2001 : 1.2),
    mapChanged(href: string) {
      if (href === current) return
      current = href
      flipped = !flipped
      const image = new Image()
      image.onload = () => {
        if (current !== href) return
        flipped = !flipped
        apply()
      }
      image.src = href
    },
  }
}
