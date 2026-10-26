'use client'

import { Section, useChromium } from '../lab/ui'
import { GlassText } from '../lab/sections/glass-text'
import { LiquidSearch } from '../lab/sections/merge'
import { LiquidTouch } from '../lab/sections/liquid-touch'
import { AdaptiveInk } from '../lab/sections/adaptive'
import { Materials } from '../lab/sections/materials'

import '../lab/lab.css'

export default function Lab() {
  const chromium = useChromium()

  return (
    <>
      <title>Vaso Lab</title>
      <meta name="description" content="Experiments for what liquid glass could do next" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
        precedence="default"
      />

      <main className="lab-root">
        {/* The glass word is the page's banner */}
        <GlassText className="lab-banner" />

        <div className="lab-wrap">
          {!chromium && <p className="lab-notice">Refraction in the lab needs a Chromium browser for now.</p>}

          <Section index="01" title="Liquid search" lede="Matches light up with glass that flows between them.">
            <LiquidSearch />
          </Section>

          <Section index="02" title="Liquid touch" lede="It swells, stretches and wobbles back.">
            <LiquidTouch />
          </Section>

          <Section index="03" title="Materials" lede="Same optics, different matter.">
            <Materials />
          </Section>

          <Section index="04" title="Adaptive ink" lede="The bars pick their ink from what scrolls beneath.">
            <AdaptiveInk />
          </Section>
        </div>
      </main>
    </>
  )
}
