'use client'

import React, { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Index of refraction of the simulated glass
const IOR = 1.5
// Portion of the shorter side (per half) that is curved bezel; the rest is a flat top
const BEZEL_RATIO = 0.6
// Displacement maps are smooth, so they can be rendered at a reduced resolution
const MAX_MAP_PIXELS = 160_000
// Peak displacement at the rim, as a fraction of the bezel width per unit of depth
const REFRACTION = 0.35
// Spread between the least and most refracted wavelengths, as a fraction of the bezel width
const DISPERSION = 0.5

export type VasoProps<Element extends HTMLElement = HTMLDivElement> = React.HTMLAttributes<Element> & {
  /** The HTML element or React component to render as the glass container
   * @default 'div'
   */
  component?: string | React.ComponentType<React.HTMLAttributes<Element>>

  /** The content to be rendered inside the glass effect */
  children?: React.ReactNode

  /** Explicit width of the glass element in pixels
   * @default auto-calculated from content
   */
  width?: number

  /** Explicit height of the glass element in pixels
   * @default auto-calculated from content
   */
  height?: number

  /** Horizontal padding around the glass effect in pixels
   * @default 0
   * @range 0-100
   */
  px?: number

  /** Vertical padding around the glass effect in pixels
   * @default 0
   * @range 0-100
   */
  py?: number

  /** Border radius of the glass container in pixels
   * @default inherited from the element's computed border-radius
   * @range 0-Infinity
   */
  radius?: number

  /** Depth factor for the refraction. Negative values create a concave (compressing) glass
   * @default 0
   * @range -5.0 to 5.0
   */
  depth?: number

  /** Blur amount applied to the backdrop filter in pixels
   * @default 0.1
   * @range 0-10
   */
  blur?: number

  /** Spectral dispersion along the refracting edge, splitting light into a rainbow like a prism
   * @default 0.5
   * @range 0-3.0 or false to disable
   */
  dispersion?: number | false

  /** Intensity of the specular rim highlight
   * @default 0.5
   * @range 0-1.0 or false to disable
   */
  specular?: number | false
}

// SVG filters inside `backdrop-filter` are only rendered by Chromium based browsers.
// Safari and Firefox drop the whole declaration when it contains `url()`, so we must
// fall back to a plain CSS glass there.
let svgBackdropSupport: boolean | undefined
function getSvgBackdropSupport() {
  if (svgBackdropSupport === undefined) {
    const ua = navigator.userAgent
    const isChromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\/|FxiOS|CriOS|EdgiOS/.test(ua)
    svgBackdropSupport = isChromium && typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url(#a)')
  }
  return svgBackdropSupport
}
const subscribeNoop = () => () => {}
const getServerSupport = () => false

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

function getDisplacementMap(width: number, height: number, radius: number, bezel: number) {
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

function createSpecularShadow(specular: number | false) {
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
const MAX_SPECTRUM_SAMPLES = 9
// Maximum pixels between two neighboring samples before the bands show as separate ghosts
const SPECTRUM_STEP = 1.25
const spectrumCache = new Map<number, string[]>()

function getSpectrum(samples: number) {
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

type Geometry = { width: number; height: number; radius: number; href: string }

const Vaso: React.FC<VasoProps> = ({
  component: WrapComponent = 'div',
  children,
  width,
  height,
  px = 0,
  py = 0,
  radius,
  depth = 0,
  blur = 0.1,
  dispersion = 0.5,
  specular = 0.5,
  style,
  ...htmlProps
}) => {
  const filterId = `vaso-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const wrapperRef = useRef<HTMLElement>(null)
  const svgSupported = useSyncExternalStore(subscribeNoop, getSvgBackdropSupport, getServerSupport)
  const [geometry, setGeometry] = useState<Geometry | null>(null)

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const measure = () => {
      // offsetWidth/Height ignore CSS transforms, matching the filter's local coordinates
      const finalWidth = Math.max(1, (width ?? wrapper.offsetWidth) + 2 * px)
      const finalHeight = Math.max(1, (height ?? wrapper.offsetHeight) + 2 * py)
      const inheritedRadius = parseFloat(getComputedStyle(wrapper).borderTopLeftRadius) || 0
      const finalRadius = Math.min(radius ?? inheritedRadius, finalWidth / 2, finalHeight / 2)

      setGeometry((prev) => {
        if (
          prev &&
          prev.width === finalWidth &&
          prev.height === finalHeight &&
          prev.radius === finalRadius &&
          !!prev.href === svgSupported
        ) {
          return prev
        }
        const bezel = (Math.min(finalWidth, finalHeight) / 2) * BEZEL_RATIO
        const href = svgSupported ? getDisplacementMap(finalWidth, finalHeight, finalRadius, bezel) : ''
        return { width: finalWidth, height: finalHeight, radius: finalRadius, href }
      })
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [width, height, px, py, radius, svgSupported])

  const useSvgFilter = svgSupported && !!geometry?.href
  const bezel = geometry ? (Math.min(geometry.width, geometry.height) / 2) * BEZEL_RATIO : 0
  // The map stores unit vectors in [-0.5, 0.5], so double the scale to reach full offset
  const scale = 2 * depth * bezel * REFRACTION
  // Total separation in pixels between the red and violet images at the rim
  // Flat glass doesn't refract, so fade dispersion out as depth approaches zero
  const spread = dispersion ? Math.max(dispersion, 0) * bezel * DISPERSION * Math.min(1, Math.abs(depth) * 4) : 0
  const spectrum =
    spread > 0.5 ? getSpectrum(Math.min(MAX_SPECTRUM_SAMPLES, Math.max(3, Math.ceil(spread / SPECTRUM_STEP) + 1))) : null

  // Avoid brightness/contrast boosts here: they clip light backdrops to flat white
  const backdropFilter = useSvgFilter
    ? `url(#${filterId}) blur(${blur}px) saturate(1.2)`
    : // Without refraction, lean on frosting so the glass still reads as glass
      `blur(${Math.min(blur + 4 * Math.abs(depth), 12)}px) saturate(1.5)`

  const containerRadius = radius ?? geometry?.radius

  return (
    <WrapComponent
      {...htmlProps}
      style={{ position: 'relative', ...style }}
      // @ts-expect-error: dynamic ref assignment, improve this ref type later
      ref={wrapperRef}
    >
      <WrapComponent
        data-vaso={filterId}
        style={{
          position: 'absolute',
          top: -py,
          left: -px,
          width: geometry ? geometry.width : `calc(100% + ${px * 2}px)`,
          height: geometry ? geometry.height : `calc(100% + ${py * 2}px)`,
          overflow: 'hidden',
          backdropFilter,
          WebkitBackdropFilter: backdropFilter,
          boxShadow: createSpecularShadow(specular),
          ...(containerRadius !== undefined && { borderRadius: containerRadius }),
          cursor: 'default',
          userSelect: 'none',
          pointerEvents: 'none', // Allow clicks to pass through to content
        }}
      />

      {useSvgFilter && (
        <svg
          aria-hidden
          focusable="false"
          width="0"
          height="0"
          style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <filter
              id={filterId}
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
              x="0"
              y="0"
              width={geometry.width}
              height={geometry.height}
            >
              <feImage
                href={geometry.href}
                x="0"
                y="0"
                width={geometry.width}
                height={geometry.height}
                preserveAspectRatio="none"
                result="map"
              />
              {spectrum ? (
                <>
                  {spectrum.map((matrix, i) => (
                    <React.Fragment key={i}>
                      <feDisplacementMap
                        in="SourceGraphic"
                        in2="map"
                        scale={scale + spread * (i / (spectrum.length - 1) - 0.5) * 2}
                        xChannelSelector="R"
                        yChannelSelector="G"
                        result={`displaced${i}`}
                      />
                      <feColorMatrix in={`displaced${i}`} type="matrix" values={matrix} result={`band${i}`} />
                      {i > 0 && (
                        <feComposite
                          in={i === 1 ? 'band0' : `spectrum${i - 1}`}
                          in2={`band${i}`}
                          operator="lighter"
                          result={`spectrum${i}`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="map"
                  scale={scale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              )}
            </filter>
          </defs>
        </svg>
      )}

      {children}
    </WrapComponent>
  )
}

export { Vaso }
