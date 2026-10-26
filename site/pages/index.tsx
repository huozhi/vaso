'use client'

import { Analytics } from '@vercel/analytics/react'
import { GlassProvider, GlassScope } from '../contexts/glass-context'
import { ResizableGlass } from '../components/resizable-glass'
import { GlassPanel } from '../components/glass-panel'
import { ThemeSwitch } from '../components/theme-switch'
import { OutsetGallery } from '../components/outset-gallery'
import { FrostedCard } from '../components/frosted-card'
import { SegmentedControl } from '../components/segmented-control'
import { ColorPicker } from '../components/color-picker'
import { CrystalBalls } from '../components/crystal-balls'
import { ToastStack } from '../components/toast-stack'
import { FloatingGlass, glassTarget } from '../components/floating-glass'
import { CodeBlock } from '../components/code-block'
import { SiteFooter } from '../components/site-footer'
import { useState } from 'react'
import { GlassText } from '../lab/sections/glass-text'
import { LiquidSearch } from '../lab/sections/merge'
import { LiquidTouch } from '../lab/sections/liquid-touch'
import { Materials } from '../lab/sections/materials'
import { AdaptiveInk } from '../lab/sections/adaptive'
import { useChromium } from '../lab/ui'
import { RECIPES, type Recipe } from '../lab/recipes'

import '../styles/globals.css'
import '../styles/page.css'
import '../lab/lab.css'

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
  preview,
  recipe,
  align = 'center',
  children,
}: {
  title: string
  caption?: string
  wide?: boolean
  /** Not in the package yet: built on the lab engine, headed for vaso/core */
  preview?: boolean
  /** How it's made: a sentence and a snippet, shown under the demo */
  recipe?: Recipe
  align?: 'start' | 'center'
  children: React.ReactNode
}) {
  return (
    <figure className={`flex flex-col gap-5 min-w-0 ${wide ? 'md:col-span-2' : ''}`}>
      <figcaption className={`text-xs theme-label ${align === 'center' ? 'text-center' : ''}`}>
        <span className="font-semibold theme-heading">{title}</span>
        {preview && (
          <span className="ml-2 px-1.5 py-px rounded border border-[var(--theme-border-color)] text-[10px] uppercase tracking-wide">
            Preview
          </span>
        )}
        {caption && <> · {caption}</>}
      </figcaption>
      <div className={`flex ${align === 'center' ? 'justify-center' : 'justify-start'}`}>{children}</div>
      {recipe && (
        <div className="demo-how">
          <p className="text-xs leading-relaxed theme-label">
            {/* `backticks` in the text become inline code */}
            {recipe.how.split('`').map((part, i) => (i % 2 ? <code key={i} className="font-semibold theme-heading">{part}</code> : part))}
          </p>
          <details>
            <summary className="text-xs font-semibold theme-heading">Code</summary>
            <div className="mt-3">
              <CodeBlock filename={recipe.filename} code={recipe.code} />
            </div>
          </details>
        </div>
      )}
    </figure>
  )
}

function Home() {
  const [theme, setTheme] = useState('light')
  const chromium = useChromium()

  return (
    <>
      <title>Vaso</title>
      <meta property="og:title" content="Vaso" />
      <meta name="twitter:title" content="Vaso" />
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
        className="min-h-screen root"
        data-theme={theme}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {/* Banner: the word itself is the glass. Move to light it, tap to ripple */}
        <h1 className="sr-only">Vaso</h1>
        <GlassText className="home-banner">
          {/* The page's own theme toggle, sitting on the photo */}
          <div className="absolute top-7 right-7 z-20" onPointerDown={(e) => e.stopPropagation()}>
            <GlassScope id="theme" label="Theme switch">
              <ThemeSwitch theme={theme} setTheme={setTheme} />
            </GlassScope>
          </div>
        </GlassText>

        <div className="lg:p-8 lg:pt-12 lg:pb-32 p-2 pt-8 pb-8">
        <div className="max-w-3xl mx-auto">
          <p className="mb-8 px-4 lg:px-8 sm:px-4 text-lg theme-description">Liquid Glass Effect for React</p>

          {/* Floating controls, opened by double click or long press */}
          <GlassPanel />

          <div className="px-4 py-6 lg:p-8 sm:p-4 space-y-8 rounded-lg theme-content">
            <section id="examples" className="relative border-b pb-6 theme-section">
              <h2 className="text-lg font-semibold mb-1 theme-heading">Examples</h2>
              <p className="text-xs theme-label mb-4">
                Preview: not in the package yet{!chromium && ', refracts in Chromium browsers for now'}
              </p>

              {/* The big ones, one per row */}
              <div className="grid grid-cols-1 gap-y-16 pt-8 border-t border-[var(--theme-border-color)]">
                <DemoCard title="Liquid search" caption="matches light up with glass that flows between them" recipe={RECIPES.search}>
                  <div className="lab-frame">
                    <LiquidSearch />
                  </div>
                </DemoCard>
                <DemoCard title="Crystal balls" recipe={RECIPES.crystal}>
                  <GlassScope id="crystal" label="Crystal balls">
                    <CrystalBalls />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Liquid touch" caption="press and drag" recipe={RECIPES.touch}>
                  <div className="lab-frame">
                    <LiquidTouch />
                  </div>
                </DemoCard>
                <DemoCard title="Frosted glass" caption="toggle frost on every glass" recipe={RECIPES.frosted}>
                  <GlassScope id="frosted" label="Frosted glass">
                    <FrostedCard />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Materials" caption="same optics, different matter" preview recipe={RECIPES.materials}>
                  <div className="lab-frame">
                    <Materials />
                  </div>
                </DemoCard>
                <DemoCard title="Adaptive ink" caption="the bars pick their ink from what scrolls beneath" preview recipe={RECIPES.adaptive}>
                  <div className="lab-frame">
                    <AdaptiveInk />
                  </div>
                </DemoCard>
              </div>

              {/* The small ones, packed two to a row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12 mt-16 pt-10 border-t border-[var(--theme-border-color)]">
                <DemoCard title="Segmented control" caption="the pill bounces into place" recipe={RECIPES.segmented}>
                  <GlassScope id="segmented" label="Segmented control">
                    <SegmentedControl />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Resizable glass" caption="drag the handle" recipe={RECIPES.resizable}>
                  <GlassScope id="resizable" label="Resizable glass">
                    <ResizableGlass />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Color picker" caption="drag the lens" recipe={RECIPES.color}>
                  <GlassScope id="color" label="Color picker">
                    <ColorPicker />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Notification" recipe={RECIPES.notification}>
                  <GlassScope id="notification" label="Notification">
                    <ToastStack />
                  </GlassScope>
                </DemoCard>
                <DemoCard title="Outset" caption="how far the glass reaches past the letter" wide recipe={RECIPES.outset}>
                  <GlassScope id="outset" label="Outset">
                    <OutsetGallery />
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
