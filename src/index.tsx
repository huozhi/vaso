'use client'

import React, { cloneElement, useEffect, useId, useRef, useState, useCallback } from 'react'

type VasoProps = {
  children: React.ReactNode
  width?: number
  height?: number
  px?: number
  py?: number
  borderRadius?: number
  scale?: number
  blur?: number
  contrast?: number
  brightness?: number
  saturation?: number
  distortionIntensity?: number
  roundness?: number
  shapeWidth?: number
  shapeHeight?: number
  draggable?: boolean
  initialPosition?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
  onSelect?: () => void
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
function createDisplacementFragment(
  uv: { x: number; y: number },
  intensity = 0.15,
  roundness = 0.6,
  shapeWidth = 0.3,
  shapeHeight = 0.2,
  scale = 50
) {
  const ix = uv.x - 0.5
  const iy = uv.y - 0.5

  // Use absolute values for SDF calculation but preserve sign for effect direction
  const distanceToEdge = roundedRectSDF(ix, iy, Math.abs(shapeWidth), Math.abs(shapeHeight), Math.abs(roundness))
  const displacement = smoothStep(0.8, 0, distanceToEdge - Math.abs(intensity))
  const scaled = smoothStep(0, 1, displacement)

  // Determine effect direction based on parameter signs
  const scaleReverse = scale < 0
  const intensityReverse = intensity < 0
  const roundnessReverse = roundness < 0
  const widthReverse = shapeWidth < 0
  const heightReverse = shapeHeight < 0

  // Calculate final effect multiplier
  let effectMultiplier = scaled

  if (scaleReverse || intensityReverse) {
    // Compression effect: pull inward
    effectMultiplier = 1 - scaled * 0.7
  }

  if (roundnessReverse) {
    // Invert the roundness effect
    effectMultiplier = 1 - effectMultiplier
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

  return (
    width: number,
    height: number,
    intensity = 0.15,
    roundness = 0.6,
    shapeWidth = 0.3,
    shapeHeight = 0.2,
    scale = 50
  ) => {
    // Create cache key including all parameters
    const key = `${width}-${height}-${intensity}-${roundness}-${shapeWidth}-${shapeHeight}-${scale}`

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

      const pos = createDisplacementFragment(uv, intensity, roundness, shapeWidth, shapeHeight, scale)
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
  children,
  width,
  height,
  px = 0,
  py = 0,
  borderRadius = 0,
  scale = 50,
  blur = 0.25,
  contrast = 1.2,
  brightness = 1.05,
  saturation = 1.1,
  distortionIntensity = 0.15,
  roundness = 0.6,
  shapeWidth = 0.3,
  shapeHeight = 0.2,
  draggable = false,
  initialPosition = { x: 300, y: 200 },
  onPositionChange,
  onSelect,
}) => {
  const idRef = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const feImageRef = useRef<SVGFEImageElement>(null)
  const feDisplacementMapRef = useRef<SVGFEDisplacementMapElement>(null)
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState(initialPosition)

  // Smooth movement with requestAnimationFrame
  const smoothUpdatePosition = useCallback((newPosition: { x: number; y: number }) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setPosition(newPosition)
    })
  }, [])

  // Debounced update function for performance
  const debouncedUpdateEffect = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    updateTimeoutRef.current = setTimeout(() => {
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

      // Position distortion overlay
      container.style.width = `${finalWidth}px`
      container.style.height = `${finalHeight}px`

      if (draggable) {
        container.style.left = `${position.x - finalWidth / 2}px`
        container.style.top = `${position.y - finalHeight / 2}px`
      } else {
        container.style.left = `${rect.left + rect.width / 2 - finalWidth / 2}px`
        container.style.top = `${rect.top + rect.height / 2 - finalHeight / 2}px`
      }

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
          roundness,
          shapeWidth,
          shapeHeight,
          scale
        )

        if (data.length >= 4 && canvasWidth > 0 && canvasHeight > 0) {
          const imageData = new ImageData(data, canvasWidth, canvasHeight)
          context.putImageData(imageData, 0, 0)

          feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL())
          feImage.setAttribute('width', `${finalWidth}`)
          feImage.setAttribute('height', `${finalHeight}`)

          // Use absolute value of scale for the final calculation
          const finalScale = Math.max(0, (maxScale * Math.abs(scale)) / 50 / canvasDPI)
          feDisplacementMap.setAttribute('scale', finalScale.toString())
          feDisplacementMap.parentElement?.setAttribute('width', `${finalWidth}`)
          feDisplacementMap.parentElement?.setAttribute('height', `${finalHeight}`)

          container.style.backdropFilter = `url(#${idRef}_filter) blur(${blur}px) contrast(${contrast}) brightness(${brightness}) saturate(${saturation})`
        }
      } catch (error) {
        console.error('Error updating liquid glass effect:', error)
      }
    }, 8) // Faster updates for smoother movement
  }, [
    width,
    height,
    px,
    py,
    scale,
    blur,
    contrast,
    brightness,
    saturation,
    distortionIntensity,
    roundness,
    shapeWidth,
    shapeHeight,
    position,
    draggable,
    idRef,
  ])

  // Update position when initialPosition changes (but don't cause infinite loops)
  useEffect(() => {
    if (initialPosition.x !== position.x || initialPosition.y !== position.y) {
      setPosition(initialPosition)
    }
  }, [initialPosition]) // Only depend on the actual values

  // Notify parent of position changes (with debouncing to prevent infinite loops)
  useEffect(() => {
    if (onPositionChange && (position.x !== initialPosition.x || position.y !== initialPosition.y)) {
      const timeoutId = setTimeout(() => {
        onPositionChange(position)
      }, 16) // Faster position updates
      return () => clearTimeout(timeoutId)
    }
  }, [position, onPositionChange]) // Don't include initialPosition to prevent loops

  // Update effect when any prop changes
  useEffect(() => {
    debouncedUpdateEffect()
  }, [debouncedUpdateEffect])

  useEffect(() => {
    if (!draggable) {
      const observer = new ResizeObserver(() => {
        debouncedUpdateEffect()
      })
      if (wrapperRef.current) observer.observe(wrapperRef.current)

      const handleScrollOrResize = () => {
        debouncedUpdateEffect()
      }
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)

      return () => {
        observer.disconnect()
        window.removeEventListener('scroll', handleScrollOrResize, true)
        window.removeEventListener('resize', handleScrollOrResize)
      }
    }
  }, [debouncedUpdateEffect, draggable])

  // Mouse event handlers for dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable) return

      // Select this glass when clicked
      onSelect?.()

      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    },
    [draggable, position, onSelect]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !draggable) return

      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      }
      smoothUpdatePosition(newPosition)
    },
    [isDragging, draggable, dragOffset, smoothUpdatePosition]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch event handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!draggable) return

      onSelect?.()

      const touch = e.touches[0]
      setIsDragging(true)
      setDragOffset({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      })
    },
    [draggable, position, onSelect]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !draggable) return

      e.preventDefault()
      const touch = e.touches[0]
      const newPosition = {
        x: touch.clientX - dragOffset.x,
        y: touch.clientY - dragOffset.y,
      }
      smoothUpdatePosition(newPosition)
    },
    [isDragging, draggable, dragOffset, smoothUpdatePosition]
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
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const id = idRef

  return (
    <>
      {!draggable &&
        cloneElement(React.Children.only(children) as React.ReactElement, {
          // @ts-expect-error: dynamic ref assignment
          ref: wrapperRef,
        })}

      {draggable && (
        <div ref={wrapperRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
          {children}
        </div>
      )}

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          position: 'fixed',
          overflow: 'hidden',
          backdropFilter: `url(#${id}_filter) blur(${blur}px) contrast(${contrast}) brightness(${brightness}) saturate(${saturation})`,
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25), 0 -10px 25px inset rgba(0, 0, 0, 0.15)',
          zIndex: 999,
          borderRadius: borderRadius || 0,
          cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      />

      <svg width="0" height="0" style={{ position: 'fixed', top: 0, left: 0, zIndex: 9998 }}>
        <defs>
          <filter id={`${id}_filter`} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" x="0" y="0">
            <feImage ref={feImageRef} id={`${id}_map`} />
            <feDisplacementMap
              ref={feDisplacementMapRef}
              in="SourceGraphic"
              in2={`${id}_map`}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}

export { Vaso }
