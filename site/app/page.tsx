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
      depth={settings.depth}
      blur={settings.blur}
      dispersion={settings.dispersion * 1.2}
    >
      <span>{'Vaso'}</span>
    </Vaso>
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
              <h2 className="text-lg font-semibold mb-4 theme-heading">Installation</h2>
              <p className="mb-4 theme-text">
                Install Vaso using your preferred package manager. You can install it with{' '}
                <HoverCodeGlass>
                  <code className="px-2 py-1 text-sm theme-text">npm install vaso</code>
                </HoverCodeGlass>{' '}
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex flex-col gap-4 items-start">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm theme-label">Theme</span>
                    <Switcher
                      options={[
                        { id: 'light', label: 'Light' },
                        { id: 'dark', label: 'Dark' },
                      ]}
                      value={theme}
                      onChange={setTheme}
                    />
                  </div>
                </div>
              </div>
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
                author:{' '}
                <CodeGlass px={4} py={2}>
                  <span className="font-bold p-1 rounded-md theme-author">huozhi</span>
                </CodeGlass>
                {/* github link */}
                <span className="theme-text">{' • '}</span>
                <a 
                  href="https://github.com/huozhi/vaso" 
                  className="font-bold underline theme-link"
                >
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
