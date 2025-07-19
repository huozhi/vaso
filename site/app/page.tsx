'use client'

import { Vaso, VasoProps } from '../../src'
import { HoverCodeGlass } from '../components/hover-vaso'
import { useGlassContext } from '../contexts/glass-context'
import './page.css'

function CodeGlass({ children, ...props }: { children: React.ReactNode } & VasoProps<HTMLSpanElement>) {
  const { settings } = useGlassContext()

  return (
    <Vaso
      component="span"
      px={settings.px}
      py={settings.py}
      borderRadius={settings.borderRadius}
      blur={settings.blur}
      depth={settings.depth}
      brightness={settings.brightness}
      saturation={settings.saturation}
      dispersion={settings.dispersion / 2}
      distortionIntensity={settings.distortionIntensity}
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
      positioningDuration={0}
      px={36}
      py={8}
      draggable
      borderRadius={settings.borderRadius * 4}
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

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      <div
        className="min-h-screen p-8 pt-22 bg-[#e0e5e1] pb-32 root"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="max-w-3xl mx-auto">
          <header className="mb-8 flex items-center justify-between mobile-header">
            <div className="max-w-sm mobile-title">
              <h1 className="text-[88px] font-bold text-gray-900 mb-12 mobile-h1 user-select-none">
                <small className="mobile-h1-small font-light mr-8">{'El '}</small>
                <VasoTitle />
              </h1>
              <p className="text-lg text-gray-600">Liquid Glass Effect for React</p>
            </div>
          </header>

          {/* Sticky Controls */}
          <div className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-sm rounded-lg p-3 max-w-sm border border-white/20 shadow-lg mobile-controls">
            <p className="text-sm font-medium text-gray-700 mb-3">Glass Controls</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mobile-controls-grid">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Depth</span>
                  <span className="font-mono">{settings.depth}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.0"
                  step="0.2"
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
                  <span className="font-mono">{settings.borderRadius}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="2"
                  value={settings.borderRadius}
                  onChange={(e) => updateSettings({ borderRadius: parseInt(e.target.value) })}
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

          <div className="bg-[#dbdcd7] p-8 space-y-8 rounded-lg shadow-[0_35px_60px_-15px_rgba(0,0,0,0.2),0_20px_25px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)]">
            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Installation</h2>
              <p className="text-gray-700 mb-4">
                Install Vaso using your preferred package manager. You can install it with{' '}
                <HoverCodeGlass positioningDuration={0}>
                  <code className="px-2 py-1 text-sm text-black">npm install vaso</code>
                </HoverCodeGlass>{' '}
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
              <p className="text-gray-700 mb-4">
                Import the{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">Vaso</code>
                </CodeGlass>{' '}
                component in your React application and wrap it around any content you want to apply the glass effect
                to.
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Props</h2>
              <p className="text-gray-700 mb-4">
                The component accepts several props to customize the glass effect. The most commonly used ones are{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">scale</code>
                </CodeGlass>{' '}
                for distortion intensity,{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">blur</code>
                </CodeGlass>{' '}
                for background blur, and{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">borderRadius</code>
                </CodeGlass>{' '}
                for rounded corners.
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Features</h2>
              <p className="text-gray-700 mb-4">
                For more complex effects, you can use{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">distortionIntensity</code>
                </CodeGlass>{' '}
                to control the warping effect, or enable{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">draggable={true}</code>
                </CodeGlass>{' '}
                \ to make the glass moveable by the user.
              </p>
            </section>

            <section className="border-b border-gray-400 pb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Tips</h2>
              <p className="text-gray-700">
                For optimal performance, avoid using too many Vaso instances simultaneously. Consider using{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">React.memo()</code>
                </CodeGlass>{' '}
                to prevent unnecessary re-renders and implement{' '}
                <CodeGlass>
                  <code className="px-2 py-1 text-sm text-black">onPositionChange</code>
                </CodeGlass>{' '}
                callbacks efficiently to maintain smooth animations.
              </p>
            </section>

            <section>
              <p className="text-gray-700">
                author:{' '}
                <CodeGlass>
                  <span className="text-gray-700 font-bold p-1 rounded-md">huozhi</span>
                </CodeGlass>
                {/* github link */}
                <span className="text-gray-700">{' • '}</span>
                <a href="https://github.com/huozhi/vaso" className="text-gray-700 font-bold underline">
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
