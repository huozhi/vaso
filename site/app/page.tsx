'use client'

import { Vaso, type VasoProps } from '../../src'
import { Switcher } from './switcher'
import { HoverCodeGlass } from '../components/hover-vaso'
import { useGlassContext } from '../contexts/glass-context'
import { useRef, useState, useEffect } from 'react'

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
    <div className="sticky top-4 z-20 w-full mb-4">
      <div className="bg-amber-300/50 rounded-lg p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400/50" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-amber-800">Vaso is not supported in your browser</h3>
            <p className="mt-2 text-sm text-amber-700">
              Your browser may not fully support the advanced glass effects used on this page.
            </p>
            <div>
              <button
                onClick={() => setShowWarning(false)}
                className="text-xs font-medium text-amber-800 hover:text-amber-900 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
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

  return (
    <Vaso
      component="span"
      px={36}
      py={8}
      radius={settings.radius * 4}
      depth={Math.max(1.1, settings.depth)}
      blur={settings.blur}
      dispersion={settings.dispersion * 1.2}
    >
      <span>{'Vaso'}</span>
    </Vaso>
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
    <div className="relative theme-text-bg rounded-xl p-2 w-80">
      {/* Two rows of text - no background */}
      <div className="relative select-none">
        {/* First row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1">
          Quick start to draw a glass:
        </div>

        {/* Second row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed select-none">
          <pre className="text-xs font-mono bg-theme-text bg-sample-text/20 font-bold rounded-md">
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
                className={`absolute left-[20px] top-1/2 -translate-y-1/2 w-[calc(100%-40px)] h-8 bg-theme-text-bg-sample-text/30 rounded-full transition-all duration-80 ease-out hover:scale-x-150 hover:brightness-150 ${
                  isDragging ? 'cursor-grabbing scale-x-150 brightness-150' : 'cursor-ew-resize'
                }`}
                onMouseDown={(e) => {
                  setIsDragging(true)
                  const startX = e.clientX
                  const startWidth = vasoWidth

                  const handleMouseMove = (e: MouseEvent) => {
                    const deltaX = e.clientX - startX
                    // 1:1 movement - cursor moves same distance as width change
                    const newWidth = Math.max(30, Math.min(320 + 40, startWidth + deltaX))
                    setVasoWidth(newWidth)
                  }

                  const handleMouseUp = () => {
                    setIsDragging(false)
                    document.removeEventListener('pointermove', handleMouseMove)
                    document.removeEventListener('pointerup', handleMouseUp)
                  }

                  document.addEventListener('pointermove', handleMouseMove)
                  document.addEventListener('pointerup', handleMouseUp)
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
  const trackRef = useRef<HTMLDivElement>(null)

  // Calculate position as percentage
  const percentage = ((value - min) / (max - min)) * 100
  const trackWidth = trackRef.current?.clientWidth || 180 // px, Track width in pixels
  const thumbSize = 20 // Vaso thumb size
  const thumbPosition = (percentage / 100) * (trackWidth - thumbSize)

  return (
    <div className="relative w-full h-4 flex items-center select-none">
      {/* Background track */}
      <div className="w-full h-1 bg-[#cdcfc1a8] rounded-full" ref={trackRef} />

      {/* Draggable Vaso thumb with larger touch area */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: `${thumbPosition - 4}px`, // Center the larger touch area
          width: `${thumbSize + 8}px`, // Larger touch target
          height: `${thumbSize + 8}px`,
        }}
      >
        {/* Larger invisible touch area */}
        <div
          className="absolute inset-0 touch-manipulation"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragging(true)

            // Capture the pointer for better tracking
            const target = e.currentTarget
            target.setPointerCapture(e.pointerId)

            const startX = e.clientX
            const startValue = value

            const handlePointerMove = (e: PointerEvent) => {
              e.preventDefault()
              const deltaX = e.clientX - startX
              const deltaPercentage = (deltaX / (trackWidth - thumbSize)) * 100
              const deltaValue = (deltaPercentage / 100) * (max - min)
              const newValue = Math.max(min, Math.min(max, startValue + deltaValue))

              // Round to nearest step
              const steppedValue = Math.round(newValue / step) * step
              onChange(steppedValue)
            }

            const handlePointerUp = (e: PointerEvent) => {
              setIsDragging(false)
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
    <div className="fixed top-4 right-4 z-10 rounded-xl shadow-[0_35px_30px_-15px_rgba(0,0,0,0.2),0_10px_10px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)] overflow-hidden">
      <div className="backdrop-blur-sm px-6 py-3 max-w-sm mobile-controls theme-controls w-[240px] w-md-[200px]">
        <p className="text-sm font-medium mb-3 theme-controls-title">Glass Attributes</p>
        <div className="grid grid-cols-1 gap-2 text-xs mobile-controls-grid theme-controls-text">
          <div>
            <div className="flex items-center justify-between">
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
          <div className="space-y-1">
            <div className="flex items-center justify-between">
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
          <div className="space-y-1">
            <div className="flex items-center justify-between">
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
          <div className="space-y-1">
            <div className="flex items-center justify-between">
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

const bgUrl = 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG1wZWU5azNrYmV3NXJ1enplbDFoMXR2ZXV5MWE2bm5yMnU1MHhrdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EzUMaltmsbK3G1Y5Ow/giphy.gif'

function WaterFlowDemo() {
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
    }
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
            draggable={false}
            radius={20}
            depth={factor * 2}
            blur={factor * 1.2}
            dispersion={factor * 0.1}
            className="top-0 left-0 w-full h-full rounded-full overflow-hidden"
          >
          </Vaso>

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
        <span className="text-sm font-medium theme-controls-title">Frosted</span>
        <button
          onClick={() => setFrostedGlass(!frostedGlass)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            frostedGlass ? 'bg-[#7b7e68]' : 'bg-[#bcbeb3]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              frostedGlass ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
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
        className="min-h-screen p-8 pt-22 pb-32 root"
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

          <div className="p-8 space-y-8 rounded-lg shadow-[0_35px_60px_-15px_rgba(0,0,0,0.2),0_20px_25px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)] theme-content">
            <section className="relative border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Play</h2>
              <div className="mt-2 relative border-t border-[var(--theme-border-color)] py-4">
                {/* Row with two examples and divider */}
                {/* Row 1 */}
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {/* Theme Switcher Example */}
                  <ThemeSwitcherDemo theme={theme} setTheme={setTheme} />

                  {/* Vertical Divider (hidden on mobile) */}
                  <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px theme-divider transform -translate-x-1/2"></div>

                  {/* Icon Grid with Vaso Control Example */}
                  <div className="flex flex-col items-start px-4">
                    <IconGridDemo />
                  </div>
                </div>
              </div>
              {/* Row 2 */}
              <div className="mt-2 border-t border-[var(--theme-border-color)] pt-8 pb-4">
                <WaterFlowDemo />
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
                  <span className="font-bold p-1 rounded-md theme-author">MIT</span>
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
