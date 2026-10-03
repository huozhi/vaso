'use client'

import { startTransition, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Vaso } from 'vaso'
import { useGlassContext, useGlassScopeAttributes, useGlassTuning } from '../contexts/glass-context'
import { useDragPhysics } from './use-drag-physics'

const LENS_SIZE = 120
// How far the lens may hang over the page edges
const LENS_OVERFLOW = 24

// A lens that starts over the photo and can be dragged anywhere on the page. It's portaled to the body and
// positioned in page coordinates, so it scrolls with the content it sits on
export function LensDemo() {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()
  // The lens is portaled out of the demo, so it carries the demo's scope itself
  const scopeAttributes = useGlassScopeAttributes()
  // Center of the lens in page coordinates; null until it's anchored to the photo after mount
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [glassIntensity, setGlassIntensity] = useState(0.5)
  const dragStartRef = useRef({ pointer: { x: 0, y: 0 }, position: { x: 0, y: 0 } })
  // Until the lens is first dragged, it follows the photo through layout changes
  const [moved, setMoved] = useState(false)
  const photoRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const thumb = useDragPhysics()

  useLayoutEffect(() => {
    if (moved) return
    const anchor = () => {
      const photo = photoRef.current
      if (!photo) return
      const rect = photo.getBoundingClientRect()
      setPosition({ x: rect.left + window.scrollX + rect.width * 0.35, y: rect.top + window.scrollY + rect.height / 2 })
    }
    anchor()
    const observer = new ResizeObserver(anchor)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [moved])

  const handleGlassPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!position) return
      e.preventDefault()
      // Capture the pointer so fast drags keep tracking outside the lens
      e.currentTarget.setPointerCapture(e.pointerId)
      dragStartRef.current = { pointer: { x: e.clientX, y: e.clientY }, position }
      // Once dragged, the lens stays where it was put, so stop following the photo
      setMoved(true)
      setIsDragging(true)
    },
    [position]
  )

  const handleGlassPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const { pointer, position: start } = dragStartRef.current
    // Keep the lens on the page
    const page = document.documentElement
    const min = LENS_SIZE / 2 - LENS_OVERFLOW
    const next = {
      x: Math.max(min, Math.min(page.scrollWidth - min, start.x + e.clientX - pointer.x)),
      y: Math.max(min, Math.min(page.scrollHeight - min, start.y + e.clientY - pointer.y)),
    }
    // Keep pointer handling responsive even if re-rendering the glass is expensive
    startTransition(() => {
      setPosition(next)
    })
  }, [])

  const handleGlassPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setIsDragging(false)
  }, [])

  // Slider handlers - all using React synthetic events
  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent this from triggering glass drag

    const target = e.currentTarget as HTMLElement
    // Capture pointer so slider keeps responding even if pointer moves outside track
    target.setPointerCapture(e.pointerId)
    thumb.start(e.clientX)

    // Calculate intensity from click/touch position on slider track
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    startTransition(() => {
      setGlassIntensity(percentage)
    })
  }, [])

  const handleSliderPointerMove = useCallback((e: React.PointerEvent) => {
    // Only update if we're actively dragging the slider
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    thumb.move(e.clientX)

    // Recalculate intensity based on current pointer position
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    startTransition(() => {
      setGlassIntensity(percentage)
    })
  }, [])

  const handleSliderPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture(e.pointerId)) {
      // Release capture when done dragging slider
      target.releasePointerCapture(e.pointerId)
    }
    thumb.end()
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-[296px] max-w-full h-[176px]">
        <div ref={photoRef} className="relative w-full h-full bg-center rounded-3xl" style={{ backgroundImage: `url(/flower.jpg)` }}>
          {/* Instruction overlay */}
          <div className="absolute select-none top-4 left-4 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2">
            <p className="text-xs text-white/90 font-medium">Drag the glass anywhere</p>
          </div>
        </div>
      </div>

      {position &&
        createPortal(
          <div
            {...scopeAttributes}
            style={{
              position: 'absolute',
              left: position.x - LENS_SIZE / 2,
              top: position.y - LENS_SIZE / 2,
              width: LENS_SIZE,
              height: LENS_SIZE,
              // Above the page content and the header, so it can refract both
              zIndex: 950,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onPointerDown={handleGlassPointerDown}
            onPointerMove={handleGlassPointerMove}
            onPointerUp={handleGlassPointerUp}
            onPointerCancel={handleGlassPointerUp}
          >
            <Vaso
              width={LENS_SIZE}
              height={LENS_SIZE}
              radius={LENS_SIZE / 2}
              // Lift the lens a little while it's being held
              depth={1 + glassIntensity * 3 + tuning.depth + (isDragging ? 0.4 : 0)}
              blur={settings.blur * 0.4 + glassIntensity * 0.3}
              dispersion={settings.dispersion * (1 + glassIntensity)}
              className="w-full h-full"
              style={{ transform: `scale(${isDragging ? 1.04 : 1})`, transition: 'transform 120ms ease-out' }}
            >
              <div className="w-full h-full rounded-full bg-transparent" />
            </Vaso>
          </div>,
          document.body,
        )}

      {/* Glass Intensity Slider Control */}
      <div className="flex items-center justify-center gap-4 w-64 rounded-xl">
        <span className="text-sm font-medium theme-controls-title">Depth</span>
        <div className="relative w-48 h-6 flex items-center">
          <div
            ref={sliderRef}
            className="relative w-full h-2 bg-[#bcbeb3] rounded-full cursor-pointer"
            style={{ touchAction: 'none' }}
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
          >
            {/* Slider track */}
            <div
              className="absolute h-2 bg-[#e3a75a] rounded-full overflow-hidden"
              style={{ width: `${glassIntensity * 100}%` }}
            />

            {/* Vaso slider thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[36px] h-[24px]"
              style={{
                left: `calc(${glassIntensity * 100}% - 18px)`
              }}
            >
              <Vaso
                width={36}
                height={24}
                radius={12}
                // Bends harder as it swells under the finger
                depth={1 + glassIntensity * 2 + thumb.press * 1.5}
                dispersion={settings.dispersion + thumb.press * 0.6}
                blur={0.3}
                className="w-full h-full"
                style={{ transform: thumb.transform }}
              >
                {/* The white fill fades out while held, leaving clear glass over the track */}
                <div
                  className="w-full h-full rounded-full"
                  style={{ backgroundColor: `rgba(255, 255, 255, ${0.2 * Math.max(0, 1 - thumb.press)})` }}
                />
              </Vaso>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
