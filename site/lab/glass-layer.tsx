'use client'

import React, { useEffect, useId, useRef } from 'react'
import { Frame, GlassRenderer } from './engine'

export type LayerFrame = Frame & {
  /** Peak displacement at the rim in px */
  strength: number
  /** Spread between red and blue bands, as a fraction of strength (needs `prism`) */
  dispersion?: number
  /** Backdrop blur in px */
  frost?: number
  /** Turbulence mixed into the displacement (frosted ice), 0-1 */
  noise?: number
  /** Re-render the map only when this changes (static glass); undefined renders every frame */
  mapKey?: unknown
  /** Re-render the highlights only when this changes */
  specKey?: unknown
  /** DOM updates that belong to this frame (content riding on the glass), applied together with its glass */
  commit?: () => void
}

export type RenderFn = (time: number, size: { width: number; height: number }) => LayerFrame | null

/** Filter regions snap to this grid so a moving shape doesn't rebuild the filter every frame */
const REGION_STEP = 32

/** A glass overlay. Positioned by its parent (absolute), it refracts whatever is painted beneath it */
export function GlassLayer({
  render,
  className,
  style,
  children,
  prism = true,
  turbulence = false,
}: {
  render: RenderFn
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  /** Split the refraction into red, green and blue passes for dispersion. Off is a single, cheaper pass */
  prism?: boolean
  /** Include the noise source used by `noise` (frosted ice). It costs a pass even at zero, so it's opt-in */
  turbulence?: boolean
}) {
  const id = `lab-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const rootRef = useRef<HTMLDivElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const renderRef = useRef(render)
  renderRef.current = render

  useEffect(() => {
    const root = rootRef.current!
    const glass = glassRef.current!
    const canvas = canvasRef.current!
    const svg = svgRef.current!
    const renderer = new GlassRenderer()
    const q = (sel: string) => svg.querySelector(sel) as SVGElement
    const filter = q('filter')
    const feImage = q('feImage')
    const blur = q('[data-role=blur]')
    const bands = Array.from(svg.querySelectorAll('[data-role=band]')) as SVGElement[]
    const noiseMix = svg.querySelector('[data-role=noise-mix]')

    let size = { width: 0, height: 0 }
    let visible = true
    let raf = 0
    let lastMapKey: unknown = Symbol()
    let lastSpecKey: unknown = Symbol()
    let applied = ''
    let region = ''
    let disposed = false
    const urls: string[] = []

    const resize = () => {
      // Layout size, not the transformed box: a layer scaled with CSS keeps its map
      const width = root.offsetWidth
      const height = root.offsetHeight
      if (width === size.width && height === size.height) return
      size = { width, height }
      renderer.resize(width, height, canvas)
      feImage.setAttribute('width', String(width))
      feImage.setAttribute('height', String(height))
      region = ''
      lastMapKey = Symbol()
      lastSpecKey = Symbol()
    }

    const stats = () => (window as any).__labStats as Record<string, number[]> | undefined
    const record = (key: string, ms: number) => {
      const s = stats()
      if (s) (s[`${id}:${key}`] ??= []).push(ms)
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible || disposed) return
      if (!size.width) resize()
      if (!size.width || !size.height) return
      const frame = renderRef.current(now / 1000, size)
      if (!frame) return

      // Only the area around the glass is filtered; the rest of the layer costs nothing on the GPU
      const pad = frame.strength * 1.5 + 24
      const [bx0, by0, bx1, by1] = frame.bounds
      const rx0 = Math.max(0, Math.floor((bx0 - pad) / REGION_STEP) * REGION_STEP)
      const ry0 = Math.max(0, Math.floor((by0 - pad) / REGION_STEP) * REGION_STEP)
      const rx1 = Math.min(size.width, Math.ceil((bx1 + pad) / REGION_STEP) * REGION_STEP)
      const ry1 = Math.min(size.height, Math.ceil((by1 + pad) / REGION_STEP) * REGION_STEP)
      const nextRegion = `${rx0},${ry0},${Math.max(1, rx1 - rx0)},${Math.max(1, ry1 - ry0)}`
      if (nextRegion !== region) {
        region = nextRegion
        const [x, y, w, h] = nextRegion.split(',')
        filter.setAttribute('x', x)
        filter.setAttribute('y', y)
        filter.setAttribute('width', w)
        filter.setAttribute('height', h)
      }

      // Shapes that have come to rest need no new map: key them by their rounded geometry
      const mapKey =
        frame.mapKey !== undefined || !frame.shapes || frame.extra
          ? frame.mapKey
          : frame.shapes.map((sh) => (sh.kind === 'circle' ? `${sh.x.toFixed(1)},${sh.y.toFixed(1)},${sh.r.toFixed(1)}` : `${sh.x.toFixed(1)},${sh.y.toFixed(1)},${sh.w.toFixed(1)},${sh.h.toFixed(1)}`)).join(';') + `|${size.width}x${size.height}`
      const mapDue = mapKey === undefined || mapKey !== lastMapKey
      const specKey = frame.specKey === undefined && mapKey !== undefined && !frame.look?.iridescence ? `${mapKey}|${frame.light?.x.toFixed(0)},${frame.light?.y.toFixed(0)}` : frame.specKey
      const specDue = mapDue || specKey === undefined || specKey !== lastSpecKey
      if (mapDue) {
        lastMapKey = mapKey
        lastSpecKey = specKey
        let t0 = performance.now()
        renderer.drawMap(frame)
        const url = renderer.mapUrl()
        feImage.setAttribute('href', url)
        urls.push(url)
        // Keep the previous map alive until the new one has had a chance to decode
        while (urls.length > 3) URL.revokeObjectURL(urls.shift()!)
        record('map', performance.now() - t0)
        t0 = performance.now()
        renderer.renderSpecular(frame, canvas)
        record('spec', performance.now() - t0)
      } else if (specDue) {
        lastSpecKey = specKey
        const t0 = performance.now()
        renderer.renderSpecular(frame, canvas)
        record('spec', performance.now() - t0)
      }
      frame.commit?.()

      // feDisplacementMap moves by scale × (value - 0.5), so the full ±1 range needs twice the peak offset
      const scale = frame.strength * 2
      const spread = prism ? frame.dispersion ?? 0.25 : 0
      const frost = frame.frost ?? 0
      const noise = frame.noise ?? 0
      const signature = `${scale.toFixed(1)}|${spread}|${frost}|${noise}`
      if (signature !== applied) {
        applied = signature
        const scales = prism ? [scale * (1 - spread), scale, scale * (1 + spread)] : [scale]
        bands.forEach((band, i) => band.setAttribute('scale', String(scales[i])))
        blur.setAttribute('stdDeviation', String(frost))
        noiseMix?.setAttribute('k3', String(noise))
        noiseMix?.setAttribute('k4', String(-noise / 2))
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(root)
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: '80px' })
    io.observe(root)
    resize()
    raf = requestAnimationFrame(tick)
    // The filter only takes effect once it exists in the DOM
    glass.style.backdropFilter = `url(#${id})`
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [id, prism, turbulence])

  // Keeps one color channel of a displaced copy: red bends least, blue most, like light through a prism
  const band = (channel: number) =>
    [0, 1, 2].map((row) => (row === channel ? ['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'][row] : '0 0 0 0 0')).join('  ') +
    '  0 0 0 1 0'

  return (
    <div ref={rootRef} className={className} style={style}>
      <div ref={glassRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {children}
      <svg ref={svgRef} aria-hidden width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <filter
            id={id}
            x="0"
            y="0"
            width="1"
            height="1"
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
            {/* Coverage lives in the map's blue channel; it becomes the alpha that cuts out the glass shape */}
            <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="mask" />
            {turbulence ? (
              <>
                <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="noise" />
                <feComposite data-role="noise-mix" in="map" in2="noise" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" result="field" />
              </>
            ) : (
              <feOffset in="map" dx="0" dy="0" result="field" />
            )}
            <feGaussianBlur data-role="blur" in="SourceGraphic" stdDeviation="0" result="source" />
            {prism ? (
              <>
                {[0, 1, 2].map((channel) => (
                  <React.Fragment key={channel}>
                    <feDisplacementMap
                      data-role="band"
                      in="source"
                      in2="field"
                      scale="0"
                      xChannelSelector="R"
                      yChannelSelector="G"
                      result={`d${channel}`}
                    />
                    <feColorMatrix in={`d${channel}`} type="matrix" values={band(channel)} result={`c${channel}`} />
                  </React.Fragment>
                ))}
                <feComposite in="c0" in2="c1" operator="arithmetic" k2="1" k3="1" result="c01" />
                <feComposite in="c01" in2="c2" operator="arithmetic" k2="1" k3="1" result="rgb" />
              </>
            ) : (
              <feDisplacementMap
                data-role="band"
                in="source"
                in2="field"
                scale="0"
                xChannelSelector="R"
                yChannelSelector="G"
                result="rgb"
              />
            )}
            <feComposite in="rgb" in2="mask" operator="in" />
          </filter>
        </defs>
      </svg>
    </div>
  )
}
