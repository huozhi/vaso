// A glass on any element, without a framework. `createGlass` owns everything the effect needs inside the element:
// the glass layer, its SVG filter, measuring, displacement maps, and the backdrop copy for Safari and Firefox.

import {
  attachBackdropCopy,
  FRAME_ATTRIBUTE,
  FRAME_AXES_ATTRIBUTE,
  FRAME_SCALE_ATTRIBUTE,
  GLASS_LAYER_ATTRIBUTE,
  GLASS_ROOT_ATTRIBUTE,
} from './backdrop-copy'
import {
  BEZEL_RATIO,
  createSpecularShadow,
  DISPERSION,
  getDisplacementMap,
  getSpectrum,
  MAX_COPY_SPECTRUM_SAMPLES,
  MAX_COPY_SPECTRUM_STEP,
  MAX_SPECTRUM_SAMPLES,
  type Outset,
  REFRACTION,
  resolveOutset,
  RESIZE_SETTLE_MS,
  SMALL_GLASS_SIZE,
  SMALL_GLASS_SPECTRUM_SAMPLES,
  SPECTRUM_STEP,
} from './optics'
import { getSvgBackdropSupport, isWebKit, WEBKIT_MIN_BLUR } from './support'

export type GlassOptions = {
  /** Explicit width of the glass in pixels. Defaults to the element's width */
  width?: number
  /** Explicit height of the glass in pixels. Defaults to the element's height */
  height?: number
  /** How far the glass extends beyond the element, without affecting layout */
  outset?: Outset
  /** @deprecated Use `outset: { x }` */
  px?: number
  /** @deprecated Use `outset: { y }` */
  py?: number
  /** Corner radius in pixels. Defaults to the element's computed `border-radius` */
  radius?: number
  /** Refraction strength at the bezel, -5 to 5. Negative values make a concave glass. Default 0 */
  depth?: number
  /** Backdrop blur in pixels. Default 0.1 */
  blur?: number
  /** Spectral dispersion along the refracting edge, 0 to 3, or false. Default 0.5 */
  dispersion?: number | false
  /** Intensity of the specular rim, 0 to 1, or false. Default 0.5 */
  specular?: number | false
}

export type Glass = {
  /** The id of the glass's SVG filter, also on the glass layer as `data-vaso` */
  readonly id: string
  /** Merges new options into the current ones; a key set to `undefined` goes back to its default. Only what
   * changed is touched, so it can run on every animation frame */
  update(options: GlassOptions): void
  /** Removes everything the glass added */
  destroy(): void
}

type Geometry = {
  width: number
  height: number
  radius: number
  href: string
  /** The map was drawn for another size and is stretched to this one until the resize settles */
  stale: boolean
}

type Settings = {
  width?: number
  height?: number
  radius?: number
  top: number
  right: number
  bottom: number
  left: number
  depth: number
  blur: number
  dispersion: number | false
  specular: number | false
}

// A filter primitive as tag and attributes, so the filter can be patched in place instead of rebuilt
type Primitive = [tag: string, attributes: Record<string, string | number>]

const SVG_NS = 'http://www.w3.org/2000/svg'
let glassCount = 0

function settle(options: GlassOptions): Settings {
  return {
    width: options.width,
    height: options.height,
    radius: options.radius,
    ...resolveOutset(options.outset, options.px, options.py),
    depth: options.depth ?? 0,
    blur: options.blur ?? 0.1,
    dispersion: options.dispersion ?? 0.5,
    specular: options.specular ?? 0.5,
  }
}

/** The glass's look before it has measured itself: frosted, with its rim. Framework bindings can render this on the
 * server so the first paint already shows the glass */
export function initialGlassStyle(options: GlassOptions) {
  const s = settle(options)
  const frost = `blur(${s.blur}px) saturate(1.2)`
  return {
    position: 'absolute',
    top: `${-s.top}px`,
    left: `${-s.left}px`,
    width: `calc(100% + ${s.left + s.right}px)`,
    height: `calc(100% + ${s.top + s.bottom}px)`,
    overflow: 'hidden',
    backdropFilter: frost,
    WebkitBackdropFilter: frost,
    boxShadow: createSpecularShadow(s.specular),
    // Inherit so CSS radius changes (late stylesheets, toggled classes) apply without re-measuring
    borderRadius: s.radius != null ? `${s.radius}px` : 'inherit',
    cursor: 'default',
    userSelect: 'none',
    // Clicks pass through to the content
    pointerEvents: 'none',
  } as const
}

/**
 * Turns `root` into glass: whatever is painted behind it is refracted through a lens shaped like the element.
 * Content inside `root` sits on top of the glass. A direct child marked `data-vaso` (rendered on the server, say)
 * is adopted as the glass layer; otherwise one is created.
 */
export function createGlass(root: HTMLElement, options: GlassOptions = {}): Glass {
  let current: GlassOptions = { ...options }
  let settings = settle(current)
  root.setAttribute(GLASS_ROOT_ATTRIBUTE, '')
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative'

  let container = Array.from(root.children).find((child) => child.hasAttribute(GLASS_LAYER_ATTRIBUTE)) as
    | HTMLElement
    | undefined
  const ownsContainer = !container
  if (!container) {
    container = document.createElement('span')
    root.insertBefore(container, root.firstChild)
  }
  const glassLayer = container
  const id = glassLayer.getAttribute(GLASS_LAYER_ATTRIBUTE) || `vaso-g${++glassCount}`
  glassLayer.setAttribute(GLASS_LAYER_ATTRIBUTE, id)
  Object.assign(glassLayer.style, initialGlassStyle(options))

  // Without backdrop refraction (Safari, Firefox), refract a clone of what's behind the glass instead
  const svgSupported = getSvgBackdropSupport()
  const copyMode = !svgSupported

  let geometry: Geometry | null = null
  let lastChange = 0
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let svg: SVGSVGElement | null = null
  let filter: SVGFilterElement | null = null
  let filterPrimitives: Primitive[] = []
  let copyWrap: HTMLElement | null = null
  let copyLayer: HTMLElement | null = null
  let detachCopy: (() => void) | null = null
  let destroyed = false

  const settleLater = () => {
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => measure(true), RESIZE_SETTLE_MS)
  }

  const measure = (settled = false) => {
    if (destroyed) return
    const { top, right, bottom, left } = settings
    // offsetWidth/Height ignore CSS transforms, matching the filter's local coordinates
    const width = Math.max(1, (settings.width ?? root.offsetWidth) + left + right)
    const height = Math.max(1, (settings.height ?? root.offsetHeight) + top + bottom)
    // The layer either has the explicit radius or inherits the element's CSS radius
    const cssRadius = parseFloat(getComputedStyle(glassLayer).borderTopLeftRadius) || 0
    const radius = Math.min(cssRadius, width / 2, height / 2)

    const prev = geometry
    if (prev && !(settled && prev.stale) && prev.width === width && prev.height === height && prev.radius === radius) {
      return
    }
    const bezel = (Math.min(width, height) / 2) * BEZEL_RATIO

    // A change right after another one is part of a continuous resize (dragging, animating). Drawing and
    // encoding a map for every intermediate size is wasted work, so stretch the last one until it settles
    const now = performance.now()
    const resizing = !settled && !!prev && now - lastChange < RESIZE_SETTLE_MS
    lastChange = now
    clearTimeout(settleTimer)

    let href: string
    let stale = false
    if (resizing) {
      const cached = getDisplacementMap(width, height, radius, bezel, true)
      href = cached ?? prev.href
      stale = !cached
      if (stale) settleLater()
    } else {
      href = getDisplacementMap(width, height, radius, bezel) ?? ''
    }

    geometry = { width, height, radius, href, stale }
    render()
  }

  const render = () => {
    if (destroyed) return
    const { top, right, bottom, left, depth, blur, dispersion, specular } = settings
    const useSvgFilter = svgSupported && !!geometry?.href
    const useCopyFilter = copyMode && !!geometry?.href

    const bezel = geometry ? (Math.min(geometry.width, geometry.height) / 2) * BEZEL_RATIO : 0
    // The map stores unit vectors in [-0.5, 0.5], so double the scale to reach full offset
    const scale = 2 * depth * bezel * REFRACTION
    // Total separation in pixels between the red and violet images at the rim
    // Flat glass doesn't refract, so fade dispersion out as depth approaches zero
    // Small glass has a narrow rim, where extra bands are indistinguishable; each band is a full displacement pass
    const sizeSamples =
      geometry && Math.min(geometry.width, geometry.height) < SMALL_GLASS_SIZE ? SMALL_GLASS_SPECTRUM_SAMPLES : Infinity
    const maxSamples = Math.min(copyMode ? MAX_COPY_SPECTRUM_SAMPLES : MAX_SPECTRUM_SAMPLES, sizeSamples)
    const fullSpreadPx = dispersion ? Math.max(dispersion, 0) * bezel * DISPERSION * Math.min(1, Math.abs(depth) * 4) : 0
    // The copy's few bands can't cover a wide spread without splitting into colored ghosts of every edge, so
    // narrow it there to what they blend smoothly
    const spreadPx = copyMode ? Math.min(fullSpreadPx, (maxSamples - 1) * MAX_COPY_SPECTRUM_STEP) : fullSpreadPx
    const spectrum =
      spreadPx > 0.5 ? getSpectrum(Math.min(maxSamples, Math.max(3, Math.ceil(spreadPx / SPECTRUM_STEP) + 1))) : null

    // WebKit sizes the copy's filter by a frame around the whole copy instead of by the glass, so the filter is
    // written in fractions of that frame, which backdrop-copy.ts measures. Pixel values go in data attributes for it
    const framed = useCopyFilter && isWebKit()
    const visibleBlur = framed && blur < WEBKIT_MIN_BLUR ? 0 : blur
    // Avoid brightness/contrast boosts here: they clip light backdrops to flat white
    const frost = `blur(${visibleBlur}px) saturate(1.2)`
    // Without backdrop refraction (Safari, Firefox), keep the same blur as Chromium. The backdrop copy
    // covers what it can; the specular rim and shadow still outline the glass elsewhere
    const backdropFilter = useSvgFilter ? `url(#${id}) ${frost}` : frost

    const style = glassLayer.style
    style.top = `${-top}px`
    style.left = `${-left}px`
    style.width = geometry ? `${geometry.width}px` : `calc(100% + ${left + right}px)`
    style.height = geometry ? `${geometry.height}px` : `calc(100% + ${top + bottom}px)`
    style.backdropFilter = backdropFilter
    style.setProperty('-webkit-backdrop-filter', backdropFilter)
    style.boxShadow = createSpecularShadow(specular)
    style.borderRadius = settings.radius != null ? `${settings.radius}px` : 'inherit'

    if (useCopyFilter && geometry) {
      if (!copyWrap || !copyLayer) {
        // Safari can paint filtered pixels outside clip-path and rounded overflow, so a mask clips them. It sits on
        // a wrapper: on the filtered layer itself, it makes WebKit size the filter by the layer alone
        copyWrap = document.createElement('span')
        copyWrap.setAttribute('aria-hidden', 'true')
        Object.assign(copyWrap.style, { position: 'absolute', inset: '0', overflow: 'hidden' })
        copyWrap.style.setProperty('-webkit-mask-image', '-webkit-radial-gradient(white, black)')
        // Sized to the glass so the filter's coordinates line up with the displacement map. Its children are
        // managed by backdrop-copy.ts
        copyLayer = document.createElement('span')
        Object.assign(copyLayer.style, { position: 'absolute', top: '0', left: '0' })
        copyWrap.appendChild(copyLayer)
        glassLayer.appendChild(copyWrap)
      }
      const layerStyle = copyLayer.style
      layerStyle.width = `${geometry.width}px`
      layerStyle.height = `${geometry.height}px`
      // Clip the copy so the element's bounding box, used by objectBoundingBox filters, is the glass. Except
      // in WebKit, which counts positioned descendants regardless; it measures a frame around the copy instead,
      // and leaving overflow visible makes every WebKit version measure that same frame. Not rounded:
      // refraction samples next to the rim, where a rounded edge is transparent and leaves a colored fringe in
      // the bands that bend least. clip-path rounds the filtered output instead
      layerStyle.overflow = framed ? 'visible' : 'hidden'
      layerStyle.filter = `url(#${id}) ${frost}`
    }

    if ((useSvgFilter || useCopyFilter) && geometry) {
      writeFilter(geometry, scale, spreadPx, spectrum, framed)
    }

    // Clone what's behind the glass into it and keep the clone aligned (see backdrop-copy.ts)
    if (useCopyFilter && !detachCopy && copyLayer) {
      detachCopy = attachBackdropCopy({
        wrapper: root,
        container: glassLayer,
        layer: copyLayer,
        filter: isWebKit() ? filter : null,
      })
    }
  }

  const writeFilter = (geometry: Geometry, scale: number, spreadPx: number, spectrum: string[] | null, framed: boolean) => {
    if (!svg || !filter) {
      svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('focusable', 'false')
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')
      Object.assign(svg.style, { position: 'fixed', top: '0', left: '0', pointerEvents: 'none' })
      const defs = document.createElementNS(SVG_NS, 'defs')
      filter = document.createElementNS(SVG_NS, 'filter')
      filter.setAttribute('id', id)
      defs.appendChild(filter)
      svg.appendChild(defs)
      // Right after the layer, ahead of the content; backdrop-copy.ts recognizes it as the glass's own <svg>
      glassLayer.after(svg)
    }

    // Framed filters keep the whole frame as their region: WebKit misplaces the source for a smaller one.
    // Each primitive is limited to the glass instead, which also keeps the work to the glass's size
    setAttributes(filter, {
      filterUnits: framed ? 'objectBoundingBox' : 'userSpaceOnUse',
      primitiveUnits: framed ? 'objectBoundingBox' : 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
      x: 0,
      y: 0,
      width: framed ? 1 : geometry.width,
      height: framed ? 1 : geometry.height,
    })

    type Attributes = Primitive[1]
    const inFrame: Attributes = framed ? { [FRAME_ATTRIBUTE]: '' } : {}
    const scaleOf = (px: number): Attributes => (framed ? { [FRAME_SCALE_ATTRIBUTE]: px } : { scale: px })
    const next: Primitive[] = framed
      ? [
          ['feImage', { ...inFrame, href: geometry.href, preserveAspectRatio: 'none', result: 'rawMap' }],
          // Rescales the map's axes for a frame of another aspect ratio than the glass's
          ['feColorMatrix', { ...inFrame, [FRAME_AXES_ATTRIBUTE]: '', in: 'rawMap', type: 'matrix', result: 'map' }],
        ]
      : [
          [
            'feImage',
            { href: geometry.href, x: 0, y: 0, width: geometry.width, height: geometry.height, preserveAspectRatio: 'none', result: 'map' },
          ],
        ]
    if (spectrum) {
      spectrum.forEach((matrix, i) => {
        next.push([
          'feDisplacementMap',
          {
            ...inFrame,
            ...scaleOf(scale + spreadPx * (i / (spectrum.length - 1) - 0.5) * 2),
            in: 'SourceGraphic',
            in2: 'map',
            xChannelSelector: 'R',
            yChannelSelector: 'G',
            result: `displaced${i}`,
          },
        ])
        next.push(['feColorMatrix', { ...inFrame, in: `displaced${i}`, type: 'matrix', values: matrix, result: `band${i}` }])
        if (i > 0) {
          next.push([
            'feComposite',
            {
              ...inFrame,
              in: i === 1 ? 'band0' : `spectrum${i - 1}`,
              in2: `band${i}`,
              operator: 'lighter',
              result: `spectrum${i}`,
            },
          ])
        }
      })
    } else {
      next.push([
        'feDisplacementMap',
        { ...inFrame, ...scaleOf(scale), in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G' },
      ])
    }

    // Patch in place when the structure is the same. backdrop-copy.ts positions framed primitives itself, and
    // rebuilding them on every animated change would drop those positions for a frame
    const elements = Array.from(filter.children)
    const sameShape = elements.length === next.length && next.every(([tag], i) => elements[i].localName === tag)
    if (sameShape) {
      next.forEach(([, attributes], i) => {
        const previous = filterPrimitives[i]?.[1] ?? {}
        for (const name of Object.keys(previous)) if (!(name in attributes)) elements[i].removeAttribute(name)
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
    filterPrimitives = next
  }

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure())
  observer?.observe(root)
  measure()
  if (!geometry) render()

  return {
    id,
    update(options) {
      if (destroyed) return
      current = { ...current, ...options }
      const next = settle(current)
      const prev = settings
      const changed = (Object.keys(next) as (keyof Settings)[]).some((key) => next[key] !== prev[key])
      if (!changed) return
      settings = next
      const sized = (['width', 'height', 'radius', 'top', 'right', 'bottom', 'left'] as const).some(
        (key) => next[key] !== prev[key],
      )
      if (sized) {
        // The radius is read back from the layer's computed style, so apply it before measuring
        glassLayer.style.borderRadius = next.radius != null ? `${next.radius}px` : 'inherit'
        measure()
        // An earlier redraw may have been waiting for the size to settle; a new size cancels it, so ask again
        if (geometry?.stale) settleLater()
      }
      render()
    },
    destroy() {
      destroyed = true
      observer?.disconnect()
      clearTimeout(settleTimer)
      detachCopy?.()
      svg?.remove()
      copyWrap?.remove()
      if (ownsContainer) glassLayer.remove()
    },
  }
}

function setAttributes(element: Element, attributes: Record<string, string | number>) {
  for (const [name, value] of Object.entries(attributes)) {
    const text = String(value)
    if (element.getAttribute(name) !== text) element.setAttribute(name, text)
  }
}
