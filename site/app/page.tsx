'use client'

import { useState } from 'react'
import { Vaso, VasoProps } from '../../src'
import { HoverCodeGlass } from '../components/hover-vaso'
import { useSpring } from '@react-spring/web'
import './page.css'

function CodeGlass({ children, ...props }: { children: React.ReactNode } & VasoProps<HTMLSpanElement>) {
  return (
    <Vaso component="span" px={2} py={0} borderRadius={3} blur={0.25} contrast={1.1} {...props}>
      {children}
    </Vaso>
  )
}

function VasoTitle({ controls, onMouseEnter, onMouseLeave }) {
  return (
    <Vaso
      component="span"
      positioningDuration={0}
      px={36}
      py={8}
      borderRadius={controls.borderRadius}
      scale={controls.scale}
      contrast={controls.contrast}
      // brightness={1 + controls.brightness * currentFactor}
      // saturation={controls.saturation * currentFactor}
      blur={controls.blur}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span>{'Vaso'}</span>
    </Vaso>
  )
}

export default function Page() {
  const [isHovered, setIsHovered] = useState(false)
  const [controls, setControls] = useState({
    scale: 0,
    blur: 0.5,
    borderRadius: 44,
    contrast: 1,
    brightness: 0.1,
    saturation: 1.3,
  })

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      <div className="min-h-screen p-8 pt-22 bg-[#e0e5e1]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <div className="max-w-3xl mx-auto">
          <header className="mb-8 flex items-center justify-between">
            <div className="max-w-sm">
              <h1 className="text-[88px] font-bold text-gray-900 mb-12">
                <span>{'El '}</span>
                <VasoTitle 
                  controls={controls}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                />
              </h1>
              <p className="text-lg text-gray-600">Liquid Glass Effect for React</p>
            </div>
            
            {/* Compact Controls */}
            <div className="mt-4 bg-white/40 rounded-lg p-2 max-w-sm self-end">
              {/* <p className="text-sm font-medium text-gray-700 mb-2">Glass Tuning</p> */}
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Scale</span>
                    <span className="font-mono">{controls.scale}</span>
                  </div>
                  <input
                    type="range"
                    min="-2.0"
                    max="2.0"
                    step="0.1"
                    value={controls.scale}
                    onChange={(e) => setControls(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
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
                    <span className="font-mono">{controls.blur}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={controls.blur}
                    onChange={(e) => setControls(prev => ({ ...prev, blur: parseFloat(e.target.value) }))}
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
                    <span className="font-mono">{controls.borderRadius}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="2"
                    value={controls.borderRadius}
                    onChange={(e) => setControls(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
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
                    <span>Contrast</span>
                    <span className="font-mono">{controls.contrast.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.2"
                    value={controls.contrast}
                    onChange={(e) => setControls(prev => ({ ...prev, contrast: parseFloat(e.target.value) }))}
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
          </header>

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
                to make the glass moveable by the user.
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
                {/* dot divider */}
                <span className="text-gray-700">{' • '}</span>
                <span>license:</span>
                <span className="text-gray-700 font-bold">MIT</span>
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
