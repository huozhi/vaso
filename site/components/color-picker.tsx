'use client'

import { useRef, useState } from 'react'
import { Vaso } from 'vaso'
import { useGlassContext, useGlassTuning } from '../contexts/glass-context'

const WHEEL_SIZE = 200
const LENS_SIZE = 60
const SWATCH_SIZE = 44
const SWATCH_GLASS_SIZE = 68

// Hue around the wheel, saturation from the white center out, at full brightness
function hsvToHex(hue: number, saturation: number) {
  const channel = (n: number) => {
    const k = (n + hue / 60) % 6
    const value = 1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}

export function ColorPicker() {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()
  // Polar position of the lens: angle in degrees (clockwise from the right), distance as a fraction of the radius
  const [pick, setPick] = useState({ angle: 33, distance: 0.6 })
  const [isDragging, setIsDragging] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  const radius = WHEEL_SIZE / 2
  const color = hsvToHex(pick.angle, pick.distance)
  const lensX = radius + Math.cos((pick.angle * Math.PI) / 180) * pick.distance * radius
  const lensY = radius + Math.sin((pick.angle * Math.PI) / 180) * pick.distance * radius

  const pickAt = (clientX: number, clientY: number) => {
    const rect = wheelRef.current!.getBoundingClientRect()
    const dx = clientX - rect.left - radius
    const dy = clientY - rect.top - radius
    const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    setPick({ angle, distance: Math.min(1, Math.hypot(dx, dy) / radius) })
  }

  return (
    <div className="flex items-center gap-10 select-none">
      <div
        ref={wheelRef}
        className="relative rounded-full shadow-md color-wheel"
        style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          setIsDragging(true)
          pickAt(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pickAt(e.clientX, e.clientY)
        }}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
      >
        <Vaso
          width={LENS_SIZE}
          height={LENS_SIZE}
          radius={LENS_SIZE / 2}
          // Lift the lens a little while it's being held
          // Concave and strong: a smooth gradient shows no magnification, but pulling the surrounding colors in
          // twists them visibly around the rim
          depth={-5 - tuning.depth}
          blur={Math.max(0, 0.1 + tuning.blur)}
          dispersion={settings.dispersion + 1.5}
          className="color-lens"
          style={{
            position: 'absolute',
            left: lensX - LENS_SIZE / 2,
            top: lensY - LENS_SIZE / 2,
            transform: `scale(${isDragging ? 1.08 : 1})`,
            transition: 'transform 100ms ease-out',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center" style={{ width: SWATCH_GLASS_SIZE, height: SWATCH_GLASS_SIZE }}>
          {/* The dot comes before the glass in the DOM, so the glass refracts it */}
          <span className="rounded-full" style={{ width: SWATCH_SIZE, height: SWATCH_SIZE, backgroundColor: color }} />
          <Vaso
            width={SWATCH_GLASS_SIZE}
            height={SWATCH_GLASS_SIZE}
            radius={Math.max(0, 16 + tuning.radius)}
            depth={1.2 + tuning.depth}
            blur={settings.blur}
            dispersion={settings.dispersion}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
        </div>
        <span className="text-xs font-mono uppercase tabular-nums theme-text">{color}</span>
      </div>
    </div>
  )
}
