'use client'

import { Analytics } from '@vercel/analytics/react'
import { GlassProvider, GlassScope } from '../contexts/glass-context'
import { VasoTitle } from '../components/vaso-title'
import { ResizableGlass } from '../components/resizable-glass'
import { GlassPanel } from '../components/glass-panel'
import { ThemeSwitch } from '../components/theme-switch'
import { LensDemo } from '../components/lens-demo'
import { OutsetGallery } from '../components/outset-gallery'
import { FrostedCard } from '../components/frosted-card'
import { SegmentedControl } from '../components/segmented-control'
import { ColorPicker } from '../components/color-picker'
import { ToastStack } from '../components/toast-stack'
import { FloatingGlass, glassTarget } from '../components/floating-glass'
import { CodeBlock } from '../components/code-block'
import { SiteFooter } from '../components/site-footer'
import { useState } from 'react'

import '../styles/globals.css'
import '../styles/page.css'

const USAGE_CODE = `import { Vaso } from 'vaso'

export function Toolbar() {
  return (
    <Vaso radius={24} depth={1.2} blur={0.5} dispersion={0.6} outset={{ x: 8, y: 4 }}>
      <button>Share</button>
    </Vaso>
  )
}`

function DemoCard({
  title,
  caption,
  wide,
  align = 'center',
  children,
}: {
  title: string
  caption?: string
  wide?: boolean
  align?: 'start' | 'center'
  children: React.ReactNode
}) {
  return (
    <figure className={`flex flex-col gap-5 min-w-0 ${wide ? 'md:col-span-2' : ''}`}>
      <figcaption className={`text-xs theme-label ${align === 'center' ? 'text-center' : ''}`}>
        <span className="font-semibold theme-heading">{title}</span>
        {caption && <> · {caption}</>}
      </figcaption>
      <div className={`flex ${align === 'center' ? 'justify-center' : 'justify-start'}`}>{children}</div>
    </figure>
  )
}

function Home() {
  const [theme, setTheme] = useState('light')

  return (
    <>
      <title>Vaso</title>
      <meta name="description" content="Glass Effect for React" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
        precedence="default"
      />

      <div
        id="top"
        className="min-h-screen lg:p-8 lg:pt-22 lg:pb-32 p-2 pt-[calc(2rem+30px)] pb-8 root"
        data-theme={theme}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="max-w-3xl mx-auto">
          <header className="relative mb-8 flex items-center justify-between mobile-header">
            {/* Soft color glow behind the hero */}
            <div aria-hidden className="hero-glow" />
            <div className="relative max-w-sm mobile-title">
              <h1 className="text-[88px] font-bold mb-12 mobile-h1 user-select-none theme-title">
                <small className="mobile-h1-small font-light mr-8 theme-subtitle"></small>
                <GlassScope id="title" label="Title">
                  <VasoTitle />
                </GlassScope>
              </h1>
              <p className="text-lg theme-description">Liquid Glass Effect for React</p>
            </div>
          </header>

          {/* Floating controls, opened by double click or long press */}
          <GlassPanel />

          <div className="px-4 py-6 lg:p-8 sm:p-4 space-y-8 rounded-lg theme-content">
            <section id="examples" className="relative border-b pb-6 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Examples</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-20 pt-8 border-t border-[var(--theme-border-color)]">
                <DemoCard title="Theme switch" align="start">
                  <GlassScope id="theme" label="Theme switch">
                    <ThemeSwitch theme={theme} setTheme={setTheme} />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Resizable glass" caption="drag the handle" align="start">
                  <GlassScope id="resizable" label="Resizable glass">
                    <ResizableGlass />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Lens" caption="drag it anywhere on the page" wide>
                  <GlassScope id="lens" label="Lens">
                    <LensDemo />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Frosted glass" caption="toggle frost on every glass" wide>
                  <GlassScope id="frosted" label="Frosted glass">
                    <FrostedCard />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Segmented control" caption="the pill bounces into place" wide>
                  <GlassScope id="segmented" label="Segmented control">
                    <SegmentedControl />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Color picker" caption="drag the lens around the wheel" wide>
                  <GlassScope id="color" label="Color picker">
                    <ColorPicker />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Outset" caption="how far the glass reaches past the letter" wide>
                  <GlassScope id="outset" label="Outset">
                    <OutsetGallery />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Notification" wide>
                  <GlassScope id="notification" label="Notification">
                    <ToastStack />
                  </GlassScope>
                </DemoCard>
              </div>
            </section>

            <section className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Installation</h2>
              <p className="mb-4 theme-text">
                <FloatingGlass>
                  <code {...glassTarget} className="text-sm font-bold theme-code">
                    npm install vaso
                  </code>
                </FloatingGlass>
              </p>
            </section>

            <section id="usage" className="border-b pb-4 theme-section">
              <h2 className="text-lg font-semibold mb-4 theme-heading">Usage</h2>

              <p className="mb-4 theme-text">
                Import the{' '}
                <FloatingGlass>
                  <code {...glassTarget} className="text-sm font-bold theme-code">{`<Vaso>`}</code>
                </FloatingGlass>{' '}
                component in your React application and wrap it around any content you want to apply the glass effect
                to.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 theme-text mb-3">
                <span>Tune it with</span>
                <FloatingGlass className="inline-flex flex-wrap items-center gap-x-5 gap-y-3 py-3">
                  {['depth', 'blur', 'dispersion', 'radius', 'specular'].map((prop) => (
                    <code key={prop} {...glassTarget} className="text-sm font-bold theme-code">
                      `{prop}`
                    </code>
                  ))}
                </FloatingGlass>
              </div>

              <div className="mb-3">
                <CodeBlock filename="toolbar.tsx" code={USAGE_CODE} />
              </div>
            </section>

            <section>
              <SiteFooter />
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Page() {
  return (
    <>
      <GlassProvider>
        <Home />
      </GlassProvider>
      <Analytics mode={process.env.NODE_ENV || 'development'} />
    </>
  )
}
