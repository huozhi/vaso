'use client'

import { Vaso, type VasoProps } from '../../src'
import { Switcher } from './switcher'
import { HoverCodeGlass } from '../components/hover-vaso'
import { useGlassContext } from '../contexts/glass-context'
import { useRef, useState, useEffect, useCallback, startTransition } from 'react'

import './page.css'
import { useSpring } from '@react-spring/web'

// Browser support detection
function detectBrowserSupport() {
  if (typeof window === 'undefined') return { isSupported: true }

  const userAgent = navigator.userAgent.toLowerCase()

  // Safari detection (including mobile Safari)
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent)

  // Firefox detection
  const isFirefox = /firefox/.test(userAgent)

  // Check for SVG filter support
  const svgSupported =
    'createElementNS' in document &&
    document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap') instanceof SVGElement

  // Check for backdrop-filter support
  const backdropFilterSupported = CSS.supports('backdrop-filter', 'blur(1px)')

  let browser = 'unknown'
  if (isSafari) browser = 'safari'
  else if (isFirefox) browser = 'firefox'

  const isSupported = svgSupported && backdropFilterSupported && !isSafari && !isFirefox

  return { isSupported, browser }
}

function BrowserWarning() {
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    const info = detectBrowserSupport()
    setShowWarning(!info.isSupported)
  }, [])

  if (!showWarning) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[30px]">
      <div className="bg-yellow-100/80 backdrop-blur-xl h-full shadow-[0_8px_32px_rgba(0,0,0,0.1)] border-b border-yellow-200/50 px-4">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          {/* Content */}
          <p className="text-sm text-gray-700 dark:text-gray-800">Browser not fully supported</p>

          {/* Close button */}
          <button
            onClick={() => setShowWarning(false)}
            className="ml-4 p-1.5 rounded-full bg-transparent dark:bg-gray-700/50 dark:hover:bg-gray-700/70 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-700" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function CodeGlass({ children, ...props }: { children: React.ReactNode } & VasoProps<HTMLSpanElement>) {
  const { settings } = useGlassContext()

  return (
    <Vaso
      component="span"
      px={settings.px}
      py={settings.py}
      radius={settings.radius}
      blur={settings.blur}
      depth={settings.depth}
      dispersion={settings.dispersion / 2}
      {...props}
    >
      {children}
    </Vaso>
  )
}

function VasoTitle() {
  const { settings } = useGlassContext()
  const isHovering = useRef(false)

  // Local state for values (defaulting to settings)
  const [values, setValues] = useState({
    depth: Math.max(1.1, settings.depth),
    dispersion: settings.dispersion * 1.2
  })

  // Update local state when settings change (if not hovering)
  useEffect(() => {
    if (!isHovering.current) {
      setValues({
        depth: Math.max(1.1, settings.depth),
        dispersion: settings.dispersion * 1.2,
      })
    }
  }, [settings])

  const handlePointerMove = (e: React.PointerEvent) => {
    isHovering.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    // normalized -0.5 to 0.5
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5

    const baseDepth = Math.max(1.1, settings.depth)
    const baseDispersion = settings.dispersion * 1.2

    // Interact effect:
    // Moving mouse changes depth and dispersion to simulate luster/shifting light
    const targetDepth = Math.max(0, baseDepth + y * 2)
    const targetDispersion = Math.max(0, baseDispersion + Math.abs(x) * 3)

    setValues({
      depth: targetDepth,
      dispersion: targetDispersion
    })
  }

  const handlePointerLeave = () => {
    isHovering.current = false
    const baseDepth = Math.max(1.1, settings.depth)
    const baseDispersion = settings.dispersion * 1.2

    setValues({
      depth: baseDepth,
      dispersion: baseDispersion
    })
  }

  return (
    <div
      className="inline-block cursor-pointer"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ touchAction: 'none' }} // Prevent scrolling while interacting on touch
    >
      <Vaso
        component="span"
        px={36}
        py={8}
        radius={settings.radius * 4}
        depth={values.depth}
        blur={settings.blur}
        dispersion={values.dispersion}
      >
        <span>{'Vaso'}</span>
      </Vaso>
    </div>
  )
}

const DEFAULT_VASO_WIDTH = 200
const DEFAULT_VASO_HEIGHT = 60

function IconGridDemo() {
  const vasoHeight = DEFAULT_VASO_HEIGHT // Bigger than text rows
  const [vasoWidth, setVasoWidth] = useState(DEFAULT_VASO_WIDTH) // Direct width control
  const [isDragging, setIsDragging] = useState(false)
  const { settings } = useGlassContext()

  return (
    <div className="relative theme-text-bg rounded-xl p-2 w-80 max-w-full">
      {/* Two rows of text - no background */}
      <div className="relative select-none">
        {/* First row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1">
          Quick start to draw a glass:
        </div>

        {/* Second row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed select-none">
          <pre className="text-xs font-mono bg-theme-text bg-sample-text/20 font-bold rounded-md whitespace-break-spaces">
            <code>{`import { Vaso } from 'vaso'`}</code>
          </pre>
        </div>

        {/* Third row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1 select-none">
          Vaso was blessed by the SVG filter and became a powerful glass.
        </div>

        {/* Left-anchored Vaso with right-side draggable bar */}
        <div className="absolute -left-[30px] top-[4px]">
          <Vaso
            width={vasoWidth}
            height={vasoHeight}
            depth={0.6}
            blur={settings.blur}
            dispersion={settings.dispersion}
            className="vaso-slider transition-all rounded-full shadow-gray-50/30 duration-20 ease-out"
          >
            <div className="w-full h-full bg-transparent relative" style={{ width: vasoWidth, height: vasoHeight }}>
              {/* Right-side draggable bar */}
              <div
                className={`absolute left-[20px] top-1/2 -translate-y-1/2 w-[calc(100%-40px)] h-full bg-theme-text-bg-sample-text/30 rounded-full transition-all duration-80 ease-out hover:scale-x-150 hover:brightness-150 ${
                  isDragging ? 'cursor-grabbing scale-x-150 brightness-150' : 'cursor-ew-resize'
                }`}
                onPointerDown={(e) => {
                  setIsDragging(true)
                  const startX = e.clientX
                  const startWidth = vasoWidth

                  const handlePointerMove = (e: PointerEvent) => {
                    const deltaX = e.clientX - startX
                    // 1:1 movement - cursor moves same distance as width change
                    const newWidth = Math.max(60, Math.min(320 + 40, startWidth + deltaX))
                    setVasoWidth(newWidth)
                  }

                  const handlePointerUp = () => {
                    setIsDragging(false)
                    document.removeEventListener('pointermove', handlePointerMove)
                    document.removeEventListener('pointerup', handlePointerUp)
                  }

                  document.addEventListener('pointermove', handlePointerMove)
                  document.addEventListener('pointerup', handlePointerUp)
                }}
              />
            </div>
          </Vaso>
        </div>
      </div>
    </div>
  )
}

function VasoSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [trackWidth, setTrackWidth] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  // Measure track width after mount and on resize
  useEffect(() => {
    const measureTrack = () => {
      if (trackRef.current) {
        setTrackWidth(trackRef.current.clientWidth)
      }
    }
    measureTrack()
    window.addEventListener('resize', measureTrack)
    return () => window.removeEventListener('resize', measureTrack)
  }, [])

  // Calculate position as percentage
  const percentage = ((value - min) / (max - min)) * 100
  const thumbSize = 20 // Vaso thumb size
  const touchAreaSize = thumbSize + 8 // 28px touch target
  const maxThumbLeft = Math.max(0, trackWidth - thumbSize)
  const thumbPosition = (percentage / 100) * maxThumbLeft
  // Position touch area centered on thumb, clamped to track bounds
  const touchAreaLeft = Math.max(0, Math.min(trackWidth - touchAreaSize, thumbPosition - 4))

  return (
    <div className="relative w-full h-4 flex items-center select-none">
      {/* Background track */}
      <div className="w-full h-1 bg-[#cdcfc1a8] rounded-full" ref={trackRef} />

      {/* Draggable Vaso thumb with larger touch area */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: `${touchAreaLeft}px`,
          width: `${touchAreaSize}px`,
          height: `${touchAreaSize}px`,
        }}
      >
        {/* Larger invisible touch area */}
        <div
          className="absolute inset-0 touch-manipulation"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragging(true)

            // Capture the pointer to track movement even outside the thumb
            // This allows smooth dragging without losing tracking if cursor moves fast
            const target = e.currentTarget
            target.setPointerCapture(e.pointerId)

            const startX = e.clientX
            const startValue = value

            const handlePointerMove = (e: PointerEvent) => {
              e.preventDefault()
              const currentTrackWidth = trackRef.current?.clientWidth || trackWidth
              const deltaX = e.clientX - startX
              const deltaPercentage = (deltaX / Math.max(1, currentTrackWidth - thumbSize)) * 100
              const deltaValue = (deltaPercentage / 100) * (max - min)
              const newValue = Math.max(min, Math.min(max, startValue + deltaValue))

              // Round to nearest step
              const steppedValue = Math.round(newValue / step) * step
              startTransition(() => {
                onChange(steppedValue)
              })
            }

            const handlePointerUp = (e: PointerEvent) => {
              setIsDragging(false)
              // Release pointer capture to end the drag interaction
              target.releasePointerCapture(e.pointerId)
              target.removeEventListener('pointermove', handlePointerMove)
              target.removeEventListener('pointerup', handlePointerUp)
              target.removeEventListener('pointercancel', handlePointerUp)
            }

            target.addEventListener('pointermove', handlePointerMove)
            target.addEventListener('pointerup', handlePointerUp)
            target.addEventListener('pointercancel', handlePointerUp)
          }}
        />

        {/* Visual Vaso thumb */}
        <Vaso
          width={thumbSize}
          height={thumbSize}
          radius={999}
          depth={4}
          blur={0.2}
          dispersion={0}
          className={`vaso-slider-thumb transition-all duration-100 ease-out pointer-events-none ${
            isDragging ? 'scale-110' : 'hover:scale-105'
          }`}
        >
          <div
            className="w-full h-full rounded-full pointer-events-none"
            style={{ width: thumbSize, height: thumbSize }}
          />
        </Vaso>
      </div>
    </div>
  )
}

function GlassControls() {
  const { settings, updateSettings } = useGlassContext()
  return (
    <div className="sticky top-[50px] lg:fixed lg:top-4 lg:right-4 z-50 rounded-xl shadow-[0_35px_30px_-15px_rgba(0,0,0,0.2),0_10px_10px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)] overflow-hidden mb-4 lg:mb-0 mx-4 lg:mx-0">
      <div className="backdrop-blur-sm px-6 py-3 mobile-controls theme-controls w-auto">
        <p className="text-sm font-medium mb-3 theme-controls-title">Glass Attributes</p>
        <div className="grid grid-cols-2 gap-3 text-xs mobile-controls-grid theme-controls-text">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span>Depth</span>
              <span className="font-mono">{settings.depth.toFixed(1)}</span>
            </div>
            <VasoSlider
              value={settings.depth}
              min={0}
              max={2}
              step={0.1}
              onChange={(value) => updateSettings({ depth: value })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span>Blur</span>
              <span className="font-mono">{settings.blur?.toFixed(1)}</span>
            </div>
            <VasoSlider
              value={settings.blur}
              min={0}
              max={2}
              step={0.2}
              onChange={(value) => updateSettings({ blur: value })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span>Radius</span>
              <span className="font-mono">{settings.radius?.toFixed(1)}</span>
            </div>
            <VasoSlider
              value={settings.radius}
              min={0}
              max={16}
              step={2}
              onChange={(value) => updateSettings({ radius: value })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span>Dispersion</span>
              <span className="font-mono">{settings.dispersion?.toFixed(1)}</span>
            </div>
            <VasoSlider
              value={settings.dispersion}
              min={0}
              max={2}
              step={0.1}
              onChange={(value) => updateSettings({ dispersion: value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeSwitcherDemo({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  return (
    <div className="flex flex-col gap-3 items-start mt-6">
      <div className="flex justify-start">
        <Switcher
          xOption={{
            id: 'light',
            label: 'Light',
            icon:
              theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : null,
          }}
          yOption={{
            id: 'dark',
            label: 'Dark',
            icon:
              theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="currentColor"
                  />
                </svg>
              ) : null,
          }}
          value={theme}
          onChange={setTheme}
        />
      </div>
    </div>
  )
}

function WaterFlowDemo() {
  const bgUrl =
    'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG1wZWU5azNrYmV3NXJ1enplbDFoMXR2ZXV5MWE2bm5yMnU1MHhrdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EzUMaltmsbK3G1Y5Ow/giphy.gif'
  const [frostedGlass, setFrostedGlass] = useState(false)
  const [factor, setFactor] = useState(0.5)
  useSpring({
    factor: frostedGlass ? 1.5 : 0.2,
    config: {
      tension: 170,
      friction: 26,
      duration: 220,
    },
    easing: 'easeInOutCubic',
    onChange: ({ value }) => {
      setFactor(value.factor)
    },
  })
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Background Container (larger) */}
      <div className="relative w-72 h-30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Background Image (fills entire container) */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${bgUrl})`,
          }}
        />

        {/* Dynamic Island (centered, smaller) */}
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-50 h-12 overflow-hidden">
          {/* Vaso Glass Effect (only over island) */}
          <Vaso
            radius={20}
            depth={factor * 2}
            blur={factor * 1.2}
            dispersion={factor * 0.1}
            className="top-0 left-0 w-full h-full rounded-full overflow-hidden"
          ></Vaso>

          {/* Icons (always on top) */}
          <div className="absolute inset-0 flex items-center justify-between rounded-full text-[#fff]">
            {/* Back Arrow */}
            <button className="p-3 rounded-full transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Folder */}
            <button className="p-3 rounded-full transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Trash */}
            <button className="p-3 rounded-full transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Toggle Control */}
      <div className="flex items-center justify-center gap-4 w-64 rounded-xl">
        <span className="text-sm font-medium theme-controls-title mr-4">Frosted</span>
        <button
          onClick={() => setFrostedGlass(!frostedGlass)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            frostedGlass ? 'bg-[#e3a75a]' : 'bg-[#bcbeb3]'
          }`}
        >
          <span className="absolute top-1/2 left-1/2 -translate-y-[50%] -translate-x-1/2 w-[56px] h-[36px]">
            <Vaso
              width={56}
              height={36}
              radius={20}
              depth={frostedGlass ? 2 : 0.5}
              dispersion={0}
              blur={0.3}
              className={`transform transition-transform translate-y-1/2 ${
                frostedGlass ? 'translate-x-4' : '-translate-x-4'
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  )
}

function DraggableGlassDemo() {
  const [position, setPosition] = useState({ x: 100, y: 60 })
  const [glassIntensity, setGlassIntensity] = useState(0.5)
  const dragStartRef = useRef({ pointer: { x: 0, y: 0 }, position: { x: 0, y: 0 } })
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const glassSize = 120
  const overflowGap = 24

  // Glass drag handlers - all using React synthetic events
  const handleGlassPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLElement

      // Capture all pointer events to this element until released
      // This ensures we continue receiving pointermove events even when
      // the pointer moves outside the element boundaries (e.g. fast dragging)
      // Without this, the drag would stop when cursor leaves the element
      target.setPointerCapture(e.pointerId)

      // Store initial pointer position and element position for delta calculations
      dragStartRef.current = {
        pointer: { x: e.clientX, y: e.clientY },
        position: { x: position.x, y: position.y },
      }
    },
    [position]
  )

  const handleGlassPointerMove = useCallback((e: React.PointerEvent) => {
    // Only handle move events if we're actively capturing this pointer
    // This prevents processing moves when not dragging
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return

    // Calculate new position based on pointer movement delta
    const newPosition = {
      x: dragStartRef.current.position.x + (e.clientX - dragStartRef.current.pointer.x),
      y: dragStartRef.current.position.y + (e.clientY - dragStartRef.current.pointer.y),
    }

    // Constrain to container bounds to keep glass visible
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect) {
      newPosition.x = Math.max(
        glassSize / 2 - overflowGap,
        Math.min(containerRect.width - glassSize / 2 + overflowGap, newPosition.x)
      )
      newPosition.y = Math.max(
        glassSize / 2 - overflowGap,
        Math.min(containerRect.height - glassSize / 2 + overflowGap, newPosition.y)
      )
    }

    // Wrap in startTransition to prioritize pointer responsiveness over visual updates
    // This keeps the drag smooth even if re-rendering the Vaso effect is expensive
    startTransition(() => {
      setPosition(newPosition)
    })
  }, [glassSize, overflowGap])

  const handleGlassPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture(e.pointerId)) {
      // Release the pointer capture to return to normal event handling
      // After this, pointer events will only fire when over the element again
      target.releasePointerCapture(e.pointerId)
    }
  }, [])

  // Slider handlers - all using React synthetic events
  const handleSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent this from triggering glass drag

    const target = e.currentTarget as HTMLElement
    // Capture pointer so slider keeps responding even if pointer moves outside track
    target.setPointerCapture(e.pointerId)

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
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas container */}
      <div className="relative w-[360px] h-[240px] p-8" ref={containerRef}>
        {/* Background image */}
        <div
          className="relative w-full h-full bg-center rounded-3xl"
          style={{
            backgroundImage: `url(/flower.jpg)`,
          }}
        >
          {/* Instruction overlay */}
          <div className="absolute select-none top-4 left-4 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2">
            <p className="text-xs text-white/90 font-medium">Drag the glass around</p>
          </div>
        </div>

        {/* Draggable glass element */}
        <div
          className="absolute"
          style={{
            left: position.x - glassSize / 2,
            top: position.y - glassSize / 2,
            width: glassSize,
            height: glassSize,
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
          onPointerDown={handleGlassPointerDown}
          onPointerMove={handleGlassPointerMove}
          onPointerUp={handleGlassPointerUp}
          onPointerCancel={handleGlassPointerUp}
        >
          <Vaso
            width={glassSize}
            height={glassSize}
            radius={glassSize / 2}
            depth={1 + glassIntensity * 3}
            blur={0.1 + glassIntensity * 0.3}
            dispersion={glassIntensity * 0.8}
            className="w-full h-full"
          >
            <div className="w-full h-full rounded-full bg-transparent" />
          </Vaso>
        </div>
      </div>

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
                depth={1 + glassIntensity * 2}
                dispersion={0}
                blur={0.3}
                className="w-full h-full"
              >
                <div className="w-full h-full rounded-full bg-white/20" />
              </Vaso>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [theme, setTheme] = useState('light')

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      <div
        className="min-h-screen lg:p-8 lg:pt-22 lg:pb-32 p-2 pt-[calc(2rem+30px)] pb-8 root"
        data-theme={theme}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="max-w-3xl mx-auto">
          <header className="mb-8 flex items-center justify-between mobile-header">
            <div className="max-w-sm mobile-title">
              <h1 className="text-[88px] font-bold mb-12 mobile-h1 user-select-none theme-title">
                <small className="mobile-h1-small font-light mr-8 theme-subtitle">{'El '}</small>
                <VasoTitle />
              </h1>
              <p className="text-lg theme-description">Liquid Glass Effect for React</p>
            </div>
          </header>

          {/* Browser compatibility warning */}
          <BrowserWarning />

          {/* Sticky Controls */}
          <GlassControls />

          <div className="px-4 py-6 lg:p-8 sm:p-4 space-y-8 rounded-lg shadow-[0_35px_60px_-15px_rgba(0,0,0,0.2),0_20px_25px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)] theme-content">
            <section className="relative border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Play</h2>
              <div className="mt-2 relative border-t border-[var(--theme-border-color)] py-4">
                {/* 2x2 Grid Layout */}
                <div className="grid grid-cols-2 gap-4 md:gap-8">
                  {/* Theme Switcher Example */}
                  <div className="flex flex-col items-start">
                    <ThemeSwitcherDemo theme={theme} setTheme={setTheme} />
                  </div>

                  {/* Icon Grid with Vaso Control Example */}
                  <div className="flex flex-col items-start">
                    <IconGridDemo />
                  </div>

                  {/* Draggable Glass Demo */}

                  {/* Water Flow Demo - spans 2 columns */}
                  <div className="col-span-2 flex flex-col justify-center pt-4 border-t border-[var(--theme-border-color)]">
                    <div className="col-span-2 flex justify-center mb-12">
                      <DraggableGlassDemo />
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <WaterFlowDemo />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Installation</h2>
              <p className="mb-4 theme-text">
                <CodeGlass depth={0} dispersion={1.2}>
                  <code className="px-2 py-1 text-sm theme-text">npm install vaso</code>
                </CodeGlass>
              </p>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Usage</h2>

              <p className="mb-4 theme-text">
                Import the{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">{`<Vaso>`}</code>
                </CodeGlass>{' '}
                component in your React application and wrap it around any content you want to apply the glass effect
                to.
              </p>

              <p className="mb-4 theme-text">
                Vaso provides intuitive props to control every aspect of the liquid glass effect. Use{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">depth</code>
                </CodeGlass>{' '}
                to control distortion intensity,{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">blur</code>
                </CodeGlass>{' '}
                for backdrop filtering,{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">dispersion</code>
                </CodeGlass>{' '}
                for chromatic aberration effects, and{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">radius</code>
                </CodeGlass>{' '}
                for rounded corners.
              </p>
              <p className="mb-4 theme-text">
                Add spacing with{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">px</code>
                </CodeGlass>{' '}
                and{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">py</code>
                </CodeGlass>{' '}
                for padding, or enable{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">draggable</code>
                </CodeGlass>{' '}
                to make the glass element interactive and moveable by users.
              </p>
            </section>

            <section>
              <p className="theme-text">
                <CodeGlass>
                  <span className="font-bold p-1 rounded-md theme-author">huozhi</span>
                </CodeGlass>
                <span className="theme-text">{' • '}</span>
                <HoverCodeGlass px={4} py={2} dispersion={0} radius={16}>
                  <a href="https://x.com/huozhi" className="font-bold underline theme-link">
                    <span className="font-bold p-1 rounded-md theme-author">X</span>
                  </a>
                </HoverCodeGlass>

                {/* github link */}
                <span className="theme-text">{' • '}</span>
                <a href="https://github.com/huozhi/vaso" className="font-bold underline theme-link">
                  GitHub
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
