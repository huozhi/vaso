'use client'

import { useState } from 'react'
import { Vaso } from 'vaso'
import { useGlassContext, useGlassTuning } from '../contexts/glass-context'

const DEFAULT_VASO_WIDTH = 200
const DEFAULT_VASO_HEIGHT = 60

export function ResizableGlass() {
  const vasoHeight = DEFAULT_VASO_HEIGHT // Bigger than text rows
  const [vasoWidth, setVasoWidth] = useState(DEFAULT_VASO_WIDTH) // Direct width control
  const [isDragging, setIsDragging] = useState(false)
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()

  return (
    <div className="relative theme-text-bg rounded-xl p-2 w-80 max-w-full">
      {/* Two rows of text - no background */}
      <div className="relative select-none">
        {/* First row */}
        <div className="text-sm theme-text-bg-sample-text font-normal leading-relaxed mb-1">
          Quick start:
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
            depth={0.6 + tuning.depth}
            // Frostier and more colorful than the global settings, while still following the panel
            blur={settings.blur + 0.5}
            dispersion={settings.dispersion + 0.5}
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
                title="Drag to resize"
                aria-label="Drag to resize the glass"
              />
              {/* Drag affordance, so it reads as resizable at a glance */}
              <span
                className={`drag-hint absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center w-7 h-5 rounded-full shadow-sm ${
                  isDragging ? 'drag-hint-active' : ''
                }`}
                aria-hidden
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
                </svg>
              </span>
            </div>
          </Vaso>
        </div>
      </div>
    </div>
  )
}
