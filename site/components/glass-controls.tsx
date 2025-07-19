'use client'

import React, { useState } from 'react'
import { useGlassContext } from '../contexts/glass-context'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  unit?: string
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, unit = '' }) => {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="flex items-center justify-between mb-6 last:mb-0">
      <label className="font-medium text-white/90 min-w-[80px] text-sm">{label}</label>
      <div className="flex items-center gap-4 flex-1 ml-5">
        <div className="relative flex-1 h-1 bg-white/10 rounded-sm">
          <div 
            className="absolute h-full bg-blue-500 rounded-sm transition-all duration-100 ease-out" 
            style={{ width: `${percentage}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
          <div 
            className="absolute top-[-6px] w-4 h-4 bg-white rounded-full shadow-md transform -translate-x-1/2 transition-all duration-100 ease-out pointer-events-none" 
            style={{ left: `${percentage}%` }}
          />
        </div>
        <span className="text-white/80 min-w-8 text-right text-xs font-mono">
          {Math.round(value * 100) / 100}
          {unit}
        </span>
      </div>
    </div>
  )
}

export function GlassControls() {
  const { settings, updateSettings } = useGlassContext()
  const [isOpen, setIsOpen] = useState(true)

  const updateValue = (key: keyof typeof settings, newValue: number) => {
    updateSettings({ [key]: newValue })
  }

  return (
    <div className="w-[280px] bg-gray-900/85 border border-white/15 rounded-xl text-white text-sm overflow-hidden shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 font-medium">
          <div className="text-base opacity-80">◐</div>
          <span>Glass</span>
          <span className="opacity-60 ml-1">⌄</span>
        </div>
        <span className="bg-blue-500/80 px-2 py-1 rounded text-xs font-medium">Beta</span>
        <button 
          className="w-6 h-6 flex items-center justify-center text-lg opacity-60 hover:opacity-100 transition-opacity"
          onClick={() => setIsOpen(!isOpen)}
        >
          ×
        </button>
      </div>

      {isOpen && (
        <>
          <div className="px-5 py-5 border-b border-white/5">
            <div className="mb-5">
              <div className="font-medium mb-3 opacity-90">Light</div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="flex justify-center text-2xl text-blue-500">⧨</div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="opacity-60">↗</span>
                  <span>-45°</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="opacity-60">☀</span>
                  <span>0%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <Slider
              label="Scale"
              value={settings.scale || 0}
              min={-2}
              max={2}
              step={0.1}
              onChange={(val) => updateValue('scale', val)}
            />

            <Slider
              label="Blur"
              value={settings.blur || 0.25}
              min={0.1}
              max={2}
              step={0.1}
              onChange={(val) => updateValue('blur', val)}
            />

            <Slider
              label="Contrast"
              value={settings.contrast || 1}
              min={0.2}
              max={2}
              step={0.1}
              onChange={(val) => updateValue('contrast', val)}
            />

            <Slider
              label="Radius"
              value={settings.borderRadius || 0}
              min={0}
              max={20}
              step={1}
              onChange={(val) => updateValue('borderRadius', val)}
              unit="px"
            />
          </div>
        </>
      )}
    </div>
  )
}

export default GlassControls 