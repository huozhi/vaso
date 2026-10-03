'use client'

import { useEffect, useState } from 'react'
import { Vaso } from 'vaso'
import { useGlassContext, useGlassTuning } from '../contexts/glass-context'

const MESSAGES = [
  { title: 'Design review', body: 'Starts in 10 minutes' },
  { title: 'New star', body: 'Someone starred huozhi/vaso' },
  { title: 'Build passed', body: 'Deployed to production' },
]

const SHOW_MS = 2600
const HIDDEN_MS = 1200

export function ToastStack() {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  // Slide a toast in, let it sit, slide it out, then bring in the next one
  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (visible) {
          setVisible(false)
        } else {
          setIndex((current) => (current + 1) % MESSAGES.length)
          setVisible(true)
        }
      },
      visible ? SHOW_MS : HIDDEN_MS,
    )
    return () => clearTimeout(timer)
  }, [visible])

  const message = MESSAGES[index]

  return (
    <div className="relative w-full max-w-[340px] h-[200px] rounded-3xl overflow-hidden toast-backdrop select-none">
      {/* Slides in from above the card. Transform only: opacity < 1 would blank the glass */}
      <div
        className="absolute left-3 right-3 top-3 transition-transform duration-500"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-130%)',
          transitionTimingFunction: visible ? 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' : 'ease-in',
        }}
        aria-live="polite"
      >
        {/* Clear glass: strong rim refraction and highlight, only a light blur to keep the text readable */}
        <Vaso
          radius={Math.max(0, 18 + tuning.radius)}
          depth={1.6 + tuning.depth}
          blur={Math.max(0, 1.5 + tuning.blur)}
          specular={1}
          dispersion={settings.dispersion + 0.8}
        >
          <div className="relative px-4 py-3">
            <div className="text-xs font-semibold toast-title">{message.title}</div>
            <div className="text-xs toast-body">{message.body}</div>
          </div>
        </Vaso>
      </div>
    </div>
  )
}
