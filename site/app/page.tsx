'use client'

import { Vaso, VasoProps } from '../../src'
import { Switcher } from './switcher'
import { HoverCodeGlass } from '../components/hover-vaso'
import { useGlassContext } from '../contexts/glass-context'
import { useState } from 'react'

import './page.css'

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
      depth={1.2}
      blur={settings.blur}
      dispersion={settings.dispersion * 1.2}
    >
      <span>{'Vaso'}</span>
    </Vaso>
  )
}

const DEFAULT_VASO_WIDTH = 130
const DEFAULT_VASO_HEIGHT = 60

function IconGridDemo() {
  const vasoHeight = DEFAULT_VASO_HEIGHT // Bigger than text rows
  const [vasoWidth, setVasoWidth] = useState(DEFAULT_VASO_WIDTH) // Direct width control
  const [isDragging, setIsDragging] = useState(false)  
  
  return (
    <div className="relative theme-text-bg rounded-xl p-2 w-80">
      {/* Two rows of text - no background */}
      <div className="relative select-none">
        {/* First row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1">
          Once upon a time in a shimmering
        </div>
        
        {/* Second row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1 select-none">
          land called Crystal Cove, there lived a glass named Vaso.
        </div>
        
        {/* Third row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1 select-none">
          Vaso was blessed by the God of SVG and became a powerful glass.
        </div>
        
        {/* Left-anchored Vaso with right-side draggable bar */}
        <div className="absolute -left-[30px] top-[10px]">
          <Vaso
            width={vasoWidth}
            height={vasoHeight}
            depth={0.8}
            blur={0.2}
            dispersion={0.5}
            className="vaso-slider transition-all rounded-full shadow-gray-50/30 duration-20 ease-out"
          >
            <div 
              className="w-full h-full bg-transparent relative"
              style={{ width: vasoWidth, height: vasoHeight }}
            >
              {/* Right-side draggable bar */}
              <div 
                className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-theme-text-bg-sample-text/30 rounded-full transition-all duration-80 ease-out hover:scale-x-150 hover:brightness-150 ${isDragging ? 'cursor-grabbing scale-x-150 brightness-150' : 'cursor-ew-resize'}`}
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

export default function Page() {
  const { settings, updateSettings } = useGlassContext()
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

          {/* Sticky Controls */}
          <div className="fixed top-4 right-4 z-50 backdrop-blur-sm rounded-lg p-3 max-w-sm shadow-lg mobile-controls theme-controls">
            <p className="text-sm font-medium mb-3 theme-controls-title">Glass Controls</p>
            <div className="grid grid-cols-2 gap-2 text-xs mobile-controls-grid theme-controls-text">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Depth</span>
                  <span className="font-mono">{settings.depth}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value={settings.depth}
                  onChange={(e) => updateSettings({ depth: parseFloat(e.target.value) })}
                  className="w-full h-1 custom-range"
                  style={{
                    background: '#9ca3af',
                    outline: 'none',
                    borderRadius: '2px',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Blur</span>
                  <span className="font-mono">{settings.blur}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={settings.blur}
                  onChange={(e) => updateSettings({ blur: parseFloat(e.target.value) })}
                  className="w-full h-1 custom-range"
                  style={{
                    background: '#9ca3af',
                    outline: 'none',
                    borderRadius: '2px',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Radius</span>
                  <span className="font-mono">{settings.radius}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="2"
                  value={settings.radius}
                  onChange={(e) => updateSettings({ radius: parseInt(e.target.value) })}
                  className="w-full h-1 custom-range"
                  style={{
                    background: '#9ca3af',
                    outline: 'none',
                    borderRadius: '2px',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Dispersion</span>
                  <span className="font-mono">{settings.dispersion?.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2.0"
                  step="0.1"
                  value={settings.dispersion}
                  onChange={(e) => updateSettings({ dispersion: parseFloat(e.target.value) })}
                  className="w-full h-1 custom-range"
                  style={{
                    background: '#9ca3af',
                    outline: 'none',
                    borderRadius: '2px',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8 rounded-lg shadow-[0_35px_60px_-15px_rgba(0,0,0,0.2),0_20px_25px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)] theme-content">
            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Play</h2>
              <div className="mt-6">
                {/* Row with two examples and divider */}
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {/* Theme Switcher Example */}
                  <div className="flex flex-col gap-3 items-start mt-6">
                    <div className="flex justify-start">
                      <Switcher
                        xOption={{
                          id: 'light',
                          label: 'Light',
                          icon:
                            theme === 'light' ? (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
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
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
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

                  {/* Vertical Divider (hidden on mobile) */}
                  <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px theme-divider transform -translate-x-1/2"></div>

                  {/* Icon Grid with Vaso Control Example */}
                  <div className="flex flex-col items-start px-4">
                    <IconGridDemo />
                  </div>
                </div>
              </div>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Installation</h2>
              <p className="mb-4 theme-text">
                Install Vaso using your preferred package manager. You can install it with{' '}
                <CodeGlass depth={0} dispersion={1.2}>
                  <code className="px-2 py-1 text-sm theme-text">npm install vaso</code>
                </CodeGlass>
              </p>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Quick Start</h2>
              <p className="mb-4 theme-text">
                Import the{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">Vaso</code>
                </CodeGlass>{' '}
                component in your React application and wrap it around any content you want to apply the glass effect
                to.
              </p>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Usage</h2>
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
                <HoverCodeGlass px={4} py={2} radius={16}>
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
