// A glass on any element, without a framework. `createGlass` owns everything the effect needs inside the element:
// the glass layer, its SVG filter, measuring, displacement maps, and the backdrop copy for Safari and Firefox.

import { attachBackdropCopy, GLASS_LAYER_ATTRIBUTE, GLASS_ROOT_ATTRIBUTE } from './backdrop-copy'
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
import {
  BEZEL_RATIO,
  createSpecularShadow,
  drawLiveMap,
  getDisplacementMap,
  type Outset,
  REFRACTION,
  resolveOutset,
  RESIZE_SETTLE_MS,
} from './optics'
import { getSvgBackdropSupport, isWebKit, WEBKIT_MIN_BLUR } from './support'
import { type Light, lightAngle, watchPointer } from './light'

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
  /** Where the light comes from: an angle in degrees (0 above, 90 right) or 'pointer' to follow the cursor.
   * Default top left */
  light?: Light
  /** Swell under a press, with a small lens forming under the finger. Settles without overshoot when the visitor prefers reduced motion */
  pressable?: boolean
  /** Send a ripple through the glass from every tap. Off when the visitor prefers reduced motion */
  ripple?: boolean
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
  light?: Light
  pressable: boolean
  ripple: boolean
}

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
    light: options.light,
    pressable: options.pressable ?? false,
    ripple: options.ripple ?? false,
  }
}

let reducedMotionQuery: MediaQueryList | null | undefined
/** Whether the visitor asked for reduced motion. Read on every press, so changing the setting applies at once */
function prefersReducedMotion() {
  reducedMotionQuery ??= typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-reduced-motion: reduce)')
  return !!reducedMotionQuery?.matches
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

  // Press and ripples: while either is moving, the map is redrawn every frame with them in it
  // `calm`: the visitor asked for reduced motion, so the swell settles without overshooting
  const press = { value: 0, velocity: 0, target: 0, at: { x: 0, y: 0 }, calm: false }
  let ripples: { x: number; y: number; t0: number }[] = []
  let liveHref: string | null = null
  // The copy's CSS filter: the SVG filter, then the frost
  let copyBlur = 0
  const copyFilter = () => `url(#${id}) blur(${copyBlur}px) saturate(${maps.saturation()})`
  // WebKit shows a map only once it has loaded (see createWebKitMaps); a loaded map renders the glass again
  const maps = createWebKitMaps(() => render())
  let liveFrame = 0
  let liveLast = 0

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
    // A press deepens the lens as the glass swells
    const scale = 2 * depth * bezel * REFRACTION * (1 + 0.3 * press.value)
    const { spread, spectrum } = dispersionBands({
      bezel,
      depth,
      dispersion,
      shorterSide: geometry ? Math.min(geometry.width, geometry.height) : Infinity,
      copy: copyMode,
    })

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
    style.boxShadow = createSpecularShadow(specular, settings.light === undefined ? undefined : lightAngle(settings.light, root.getBoundingClientRect()))
    style.transform = press.value > 0.001 ? `scale(${1 + 0.035 * press.value})` : ''
    style.borderRadius = settings.radius != null ? `${settings.radius}px` : 'inherit'

    if (useCopyFilter && geometry) {
      if (!copyWrap || !copyLayer) {
        ;({ wrap: copyWrap, layer: copyLayer } = createCopyLayer())
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
      if (framed) maps.request(liveHref ?? geometry.href)
      copyBlur = visibleBlur
      layerStyle.filter = copyFilter()
    }

    if ((useSvgFilter || useCopyFilter) && geometry) {
      writeFilter(geometry, scale, spread, spectrum, framed)
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

  const writeFilter = (geometry: Geometry, scale: number, spread: number, spectrum: string[] | null, framed: boolean) => {
    if (!svg || !filter) {
      ;({ svg, filter } = createFilter(id))
      // Right after the layer, ahead of the content; backdrop-copy.ts recognizes it as the glass's own <svg>
      glassLayer.after(svg)
    }
    // Framed filters keep the whole frame as their region: WebKit misplaces the source for a smaller one.
    // Each primitive is limited to the glass instead, which also keeps the work to the glass's size
    setAttributes(filter, filterRegion(framed, { x: 0, y: 0, width: geometry.width, height: geometry.height }))
    // WebKit's map is the newest one that has loaded; until the first has, the one requested
    const href = framed ? maps.shown() || (liveHref ?? geometry.href) : (liveHref ?? geometry.href)
    filterPrimitives = patchFilter(
      filter,
      refractionPrimitives({
        framed,
        map: framed ? { href } : { href, x: 0, y: 0, width: geometry.width, height: geometry.height },
        scale,
        spread,
        spectrum,
      }),
      filterPrimitives,
    )
  }

  // How long a ripple runs, and how fast and wide its ring is
  const RIPPLE_LIFE = 1.6
  const RIPPLE_SPEED = 380
  const RIPPLE_WIDTH = 20

  const live = (now: number) => {
    liveFrame = 0
    if (destroyed || !geometry) return
    const t = now / 1000
    const dt = Math.min(0.05, t - (liveLast || t))
    liveLast = t
    // A slightly underdamped spring, so the glass overshoots a little as it swells and settles. With reduced motion
    // it's critically damped (2√300): the glass still answers the press, but doesn't wobble
    press.velocity += ((press.target - press.value) * 300 - press.velocity * (press.calm ? 34.6 : 20)) * dt
    press.value += press.velocity * dt
    ripples = ripples.filter((r) => t - r.t0 < RIPPLE_LIFE)
    const settled = Math.abs(press.value) < 0.002 && Math.abs(press.velocity) < 0.01 && press.target === 0
    if (settled && !ripples.length) {
      press.value = press.velocity = 0
      liveHref = null
      liveLast = 0
      render()
      return
    }
    const { width, height, radius } = geometry
    const bezel = (Math.min(width, height) / 2) * BEZEL_RATIO
    const lens = Math.min(52, Math.min(width, height) * 0.35)
    const pressed = press.value
    liveHref = drawLiveMap(width, height, radius, bezel, (x, y, inside, out) => {
      const edge = Math.min(1, Math.max(inside, 0) / 6)
      for (const r of ripples) {
        const age = t - r.t0
        const dx = x - r.x
        const dy = y - r.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const u = (dist - age * RIPPLE_SPEED) / RIPPLE_WIDTH
        if (u < -3 || u > 3) continue
        const wave = Math.sin(u * 2.2) * Math.exp(-u * u) * Math.exp(-age * 1.8) * 0.7 * edge
        out.x += (dx / dist) * wave
        out.y += (dy / dist) * wave
      }
      // The finger swells the glass under it into a small magnifying lens
      if (pressed > 0.01) {
        const dx = x - press.at.x
        const dy = y - press.at.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const k = Math.exp(-(dist * dist) / (2 * lens * lens)) * Math.min(1, dist / lens) * pressed * 0.4 * edge
        out.x -= (dx / dist) * k
        out.y -= (dy / dist) * k
      }
    })
    render()
    liveFrame = requestAnimationFrame(live)
  }
  const animate = () => {
    if (!liveFrame) liveFrame = requestAnimationFrame(live)
  }

  // Pointer position in the glass's own pixels (it may be scaled by a CSS transform)
  const toGlass = (event: PointerEvent) => {
    const box = root.getBoundingClientRect()
    const sx = box.width ? root.offsetWidth / box.width : 1
    const sy = box.height ? root.offsetHeight / box.height : 1
    return { x: (event.clientX - box.left) * sx + settings.left, y: (event.clientY - box.top) * sy + settings.top }
  }
  const onDown = (event: PointerEvent) => {
    if (!settings.pressable && !settings.ripple) return
    const at = toGlass(event)
    // With reduced motion, a press still swells the glass (calmly), but no ripple runs through it
    const reduced = prefersReducedMotion()
    if (settings.pressable) {
      press.target = 1
      press.at = at
      press.calm = reduced
    }
    if (settings.ripple && !reduced) ripples.push({ ...at, t0: performance.now() / 1000 })
    if (settings.pressable || ripples.length) animate()
  }
  const onMove = (event: PointerEvent) => {
    if (press.target) press.at = toGlass(event)
  }
  const onUp = () => {
    if (!press.target) return
    press.target = 0
    animate()
  }
  root.addEventListener('pointerdown', onDown)
  root.addEventListener('pointermove', onMove)
  for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) root.addEventListener(type, onUp)

  // A pointer light only changes the rim, so it skips everything else
  const shade = () => {
    if (!destroyed && settings.light === 'pointer') {
      glassLayer.style.boxShadow = createSpecularShadow(settings.specular, lightAngle('pointer', root.getBoundingClientRect()))
    }
  }
  let unwatch = settings.light === 'pointer' ? watchPointer(shade) : null

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
      if (next.light === 'pointer' && !unwatch) unwatch = watchPointer(shade)
      if (next.light !== 'pointer' && unwatch) {
        unwatch()
        unwatch = null
      }
      render()
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(liveFrame)
      unwatch?.()
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) root.removeEventListener(type, onUp)
      observer?.disconnect()
      clearTimeout(settleTimer)
      detachCopy?.()
      svg?.remove()
      copyWrap?.remove()
      if (ownsContainer) glassLayer.remove()
    },
  }
}
