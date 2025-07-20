'use client'

import React, { useEffect, useId, useRef, useState, useCallback } from 'react'

const distortionIntensity = 0.15
const roundness = 0.6
const shapeWidth = 0.3
const shapeHeight = 0.2

const rAF = typeof window !== 'undefined' ? window.requestAnimationFrame || setTimeout : () => 0

const createBackdropFilter = (uid: string, blur: number) =>
  `url(#${uid}_filter) blur(${blur}px) contrast(1.1) brightness(1.04) saturate(1.1)`

export type VasoProps<Element extends HTMLElement = HTMLDivElement> = React.HTMLAttributes<Element> & {
  /** The HTML element or React component to render as the glass container
   * @default 'div'
   */
  component?: string | React.ComponentType<React.HTMLAttributes<Element>>

  /** The content to be rendered inside the glass effect (required) */
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
   * @default 0
   * @range 0-Infinity
   */
  radius?: number

  /** Depth factor for the distortion effect. Negative values create compression
   * @default 0
   * @range 0 to 5.0
   */
  depth?: number

  /** Blur amount applied to the backdrop filter in pixels
   * @default 0.1
   * @range 0-10
   */
  blur?: number

  /** Contrast level for the backdrop filter
   * @default 1
   * @range 0-1.0
   */

  /** Dispersion intensity for chromatic aberration effect (like Figma's liquid glass)
   * @default 0.5
   * @range 0-3.0
   */
  dispersion?: number

  /** Makes the glass element draggable with mouse/touch
   * @default false
   */
  draggable?: boolean
}

// Smooth interpolation (used for fade effects near the edge)
function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Euclidean distance
function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

// Signed Distance Function for a rounded rectangle with negative support
function roundedRectSDF(x: number, y: number, width: number, height: number, radius: number): number {
  // Handle negative dimensions by inverting the effect
  const absWidth = Math.abs(width)
  const absHeight = Math.abs(height)
  const absRadius = Math.abs(radius)

  const qx = Math.abs(x) - absWidth + absRadius
  const qy = Math.abs(y) - absHeight + absRadius
  const distance = Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - absRadius

  // Invert distance for negative dimensions
  return width < 0 || height < 0 ? -distance : distance
}

// Fragment simulation: computes UV displacement with full negative support
function createDisplacementFragment(uv: { x: number; y: number }, intensity = 0.15, depth = 0) {
  const ix = uv.x - 0.5
  const iy = uv.y - 0.5

  // Use absolute values for SDF calculation but preserve sign for effect direction
  const distanceToEdge = roundedRectSDF(ix, iy, Math.abs(shapeWidth), Math.abs(shapeHeight), Math.abs(roundness))
  const displacement = smoothStep(0.8, 0, distanceToEdge - Math.abs(intensity))
  const scaled = smoothStep(0, 1, displacement)

  // Determine effect direction based on parameter signs
  const depthReverse = depth < 0
  const intensityReverse = intensity < 0
  const widthReverse = shapeWidth < 0
  const heightReverse = shapeHeight < 0

  // Calculate final effect multiplier
  let effectMultiplier = scaled

  if (depthReverse || intensityReverse) {
    // Compression effect: pull inward
    effectMultiplier = 1 - scaled * 0.7
  }

  // Apply width/height direction
  const finalX = widthReverse ? ix * (2 - effectMultiplier) + 0.5 : ix * effectMultiplier + 0.5
  const finalY = heightReverse ? iy * (2 - effectMultiplier) + 0.5 : iy * effectMultiplier + 0.5

  return {
    x: finalX,
    y: finalY,
  }
}

// Memoized displacement data generation for performance
const generateDisplacementData = (() => {
  const cache = new Map<string, { data: Uint8ClampedArray; maxScale: number }>()

  return (width: number, height: number, intensity = 0.15, shapeWidth = 0.3, shapeHeight = 0.2, depth = 1.0) => {
    // Create cache key including all parameters
    const key = `${width}-${height}-${intensity}-${shapeWidth}-${shapeHeight}-${depth}`

    if (cache.has(key)) {
      return cache.get(key)!
    }

    // Validate dimensions
    if (!width || !height || width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
      console.warn('Invalid canvas dimensions:', { width, height })
      return { data: new Uint8ClampedArray(4), maxScale: 0 }
    }

    const w = Math.floor(width)
    const h = Math.floor(height)
    const data = new Uint8ClampedArray(w * h * 4)
    const rawValues: number[] = []

    let maxScale = 0

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % w
      const y = Math.floor(i / 4 / w)
      const uv = { x: x / w, y: y / h }

      const pos = createDisplacementFragment(uv, intensity, depth)
      const dx = pos.x * w - x
      const dy = pos.y * h - y

      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
      rawValues.push(dx, dy)
    }

    maxScale *= 0.5 // Normalize factor

    // Encode displacement into RG channels of image
    let index = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = rawValues[index++] / maxScale + 0.5
      const g = rawValues[index++] / maxScale + 0.5
      data[i] = r * 255
      data[i + 1] = g * 255
      data[i + 2] = 0
      data[i + 3] = 255
    }

    const result = { data, maxScale }

    // Cache management - keep only last 10 entries
    if (cache.size > 10) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }

    cache.set(key, result)
    return result
  }
})()

const Vaso: React.FC<VasoProps> = ({
  component: WrapComponent = 'div',
  children,
  width,
  height,
  px = 0,
  py = 0,
  radius = 0,
  depth = 0,
  blur = 0.1,
  dispersion = 0.5,
  draggable = false,
  ...htmlProps
}) => {
  const uid = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLElement>(null)
  const feImageRef = useRef<SVGFEImageElement>(null)
  const feDisplacementMapRef = useRef<SVGFEDisplacementMapElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const dragStartRef = useRef({ mouse: { x: 0, y: 0 }, position: { x: 0, y: 0 } })

  // Smooth movement with requestAnimationFrame
  const smoothUpdatePosition = useCallback((newPosition: { x: number; y: number }) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = rAF(() => {
      setPosition(newPosition)
    })
  }, [])

  // Optimized update function with requestAnimationFrame
  const updateEffectRef = useRef<number | null>(null)

  const scheduleUpdate = useCallback(() => {
    if (updateEffectRef.current) {
      cancelAnimationFrame(updateEffectRef.current)
    }

    const reposition = () => {
      const targetEl = wrapperRef.current
      const canvas = canvasRef.current
      const feImage = feImageRef.current
      const feDisplacementMap = feDisplacementMapRef.current
      const container = containerRef.current

      if (!targetEl || !canvas || !feImage || !feDisplacementMap || !container) {
        return
      }

      // Get dimensions from props or the target element
      let rect: DOMRect
      if (draggable) {
        const childElement = targetEl.firstElementChild as HTMLElement
        if (!childElement) return

        rect = {
          width: width || childElement.offsetWidth || 200,
          height: height || childElement.offsetHeight || 200,
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect
      } else {
        rect = targetEl.getBoundingClientRect()
        // Override with explicit width/height if provided
        if (width !== undefined) rect.width = width
        if (height !== undefined) rect.height = height
      }

      const finalWidth = Math.max(1, rect.width + 2 * px)
      const finalHeight = Math.max(1, rect.height + 2 * py)

      // Size distortion overlay (positioning handled by inline styles)
      container.style.width = `${finalWidth}px`
      container.style.height = `${finalHeight}px`

      // Calculate shadow based on dimensions
      const shadowWidth = finalWidth
      const shadowHeight = finalHeight
      const shadowScale = Math.min(Math.max(shadowWidth + shadowHeight, 100), 800) / 400

      const blurRadius = Math.round(4 * shadowScale)
      const spreadRadius = Math.round(8 * shadowScale)
      const insetBlur = Math.round(20 * shadowScale)
      const insetOffset = Math.round(-10 * shadowScale)
      container.style.boxShadow = `0 ${blurRadius}px ${spreadRadius}px rgba(0, 0, 0, 0.2), 0 ${insetOffset}px ${insetBlur}px inset rgba(0, 0, 0, 0.15)`

      // Use lower resolution for better performance
      const canvasDPI = 0.75
      const canvasWidth = Math.max(1, Math.floor(finalWidth * canvasDPI))
      const canvasHeight = Math.max(1, Math.floor(finalHeight * canvasDPI))

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      const context = canvas.getContext('2d')
      if (!context) return

      try {
        const { data, maxScale } = generateDisplacementData(
          canvasWidth,
          canvasHeight,
          distortionIntensity,
          shapeWidth,
          shapeHeight,
          depth
        )

        if (data.length >= 4 && canvasWidth > 0 && canvasHeight > 0) {
          const imageData = new ImageData(data, canvasWidth, canvasHeight)
          context.putImageData(imageData, 0, 0)

          feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL())
          feImage.setAttribute('width', `${finalWidth}`)
          feImage.setAttribute('height', `${finalHeight}`)

          // Use absolute value of scale for the final calculation
          const finalScale = Math.max(0, (maxScale * Math.abs(depth)) / canvasDPI)
          feDisplacementMap.setAttribute('scale', finalScale.toString())
          feDisplacementMap.parentElement?.setAttribute('width', `${finalWidth}`)
          feDisplacementMap.parentElement?.setAttribute('height', `${finalHeight}`)

          container.style.backdropFilter = createBackdropFilter(uid, blur)
        }
      } catch (error) {
        console.error(error)
      }
    }

    updateEffectRef.current = rAF(reposition)
  }, [
    width,
    height,
    px,
    py,
    depth,
    blur,
    dispersion,
    distortionIntensity,
    roundness,
    shapeWidth,
    shapeHeight,
    position,
    draggable,
    uid,
  ])

  // Update effect when any prop changes
  useEffect(() => {
    scheduleUpdate()
  }, [scheduleUpdate])

  // Draggable elements need to recalculate position on scroll/resize
  const scrollRafRef = useRef<number | null>(null)

  useEffect(() => {
    // Non-draggable elements use relative positioning and don't need repositioning
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [])

  // Mouse event handlers for dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable) return

      // @ts-expect-error: dynamic ref assignment, improve this ref type later
      htmlProps.onMouseDown?.(e)

      setIsDragging(true)
      dragStartRef.current = {
        mouse: { x: e.clientX, y: e.clientY },
        position: { x: position.x, y: position.y },
      }
    },
    [draggable, position, htmlProps]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !draggable) return

      const newPosition = {
        x: dragStartRef.current.position.x + (e.clientX - dragStartRef.current.mouse.x),
        y: dragStartRef.current.position.y + (e.clientY - dragStartRef.current.mouse.y),
      }
      smoothUpdatePosition(newPosition)
    },
    [isDragging, draggable, smoothUpdatePosition]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch event handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!draggable) return

      // @ts-expect-error: dynamic ref assignment, improve this ref type later
      htmlProps.onTouchStart?.(e)

      const touch = e.touches[0]
      setIsDragging(true)
      dragStartRef.current = {
        mouse: { x: touch.clientX, y: touch.clientY },
        position: { x: position.x, y: position.y },
      }
    },
    [draggable, position, htmlProps]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !draggable) return

      e.preventDefault()
      const touch = e.touches[0]
      const newPosition = {
        x: dragStartRef.current.position.x + (touch.clientX - dragStartRef.current.mouse.x),
        y: dragStartRef.current.position.y + (touch.clientY - dragStartRef.current.mouse.y),
      }
      smoothUpdatePosition(newPosition)
    },
    [isDragging, draggable, smoothUpdatePosition]
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add global event listeners for dragging
  useEffect(() => {
    if (draggable) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [draggable, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  // Cleanup timeouts and animation frames on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (updateEffectRef.current) {
        cancelAnimationFrame(updateEffectRef.current)
      }
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [])

  // Update initial position when it's mounted - use a simpler, more reliable approach
  useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
  }, [])

  return (
    <WrapComponent
      {...htmlProps}
      style={{ position: 'relative', ...htmlProps.style }}
      // @ts-expect-error: dynamic ref assignment, improve this ref type later
      ref={wrapperRef}
    >
      {children}

      {draggable && position.x !== 0 && position.y !== 0 && (
        <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }} />
      )}

      <WrapComponent
        data-vaso={uid}
        // @ts-expect-error: dynamic ref assignment, improve this ref type later
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          position: draggable ? 'fixed' : 'absolute',
          top: draggable ? position.y - ((height || 0) + py * 2) / 2 : -py,
          left: draggable ? position.x - ((width || 0) + px * 2) / 2 : -px,
          width: draggable ? (width || 0) + px * 2 : `calc(100% + ${px * 2}px)`,
          height: draggable ? (height || 0) + py * 2 : `calc(100% + ${py * 2}px)`,
          overflow: 'hidden',
          backdropFilter: createBackdropFilter(uid, blur),
          zIndex: draggable ? 999 : 1,
          ...(radius && { borderRadius: radius }),
          cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          pointerEvents: draggable ? 'auto' : 'none',
        }}
      />

      <svg width="0" height="0" style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
        <defs>
          <filter
            id={`${uid}_filter`}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
          >
            {/* Base displacement */}
            <feImage ref={feImageRef} id={`${uid}_map`} />
            <feDisplacementMap
              ref={feDisplacementMapRef}
              in="SourceGraphic"
              in2={`${uid}_map`}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />

            {/* Chromatic aberration - separate RGB channels with dispersion-controlled offsets */}
            <feOffset dx={dispersion} dy={dispersion} in="displaced" result="redShift" />
            <feOffset dx="0" dy="0" in="displaced" result="greenCenter" />
            <feOffset dx={-dispersion} dy={-dispersion} in="displaced" result="blueShift" />

            {/* Extract color channels */}
            <feColorMatrix
              in="redShift"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="redOnly"
            />
            <feColorMatrix
              in="greenCenter"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="greenOnly"
            />
            <feColorMatrix
              in="blueShift"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="blueOnly"
            />

            {/* Recombine with additive blending */}
            <feComposite in="redOnly" in2="greenOnly" operator="lighter" result="redGreen" />
            <feComposite in="redGreen" in2="blueOnly" operator="lighter" />
          </filter>
        </defs>
      </svg>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </WrapComponent>
  )
}

export { Vaso }
