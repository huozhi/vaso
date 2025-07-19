'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface GlassSettings {
  scale?: number
  blur?: number
  contrast?: number
  brightness?: number
  saturation?: number
  distortionIntensity?: number
  roundness?: number
  shapeWidth?: number
  shapeHeight?: number
  borderRadius?: number
  px?: number
  py?: number
}

interface GlassContextType {
  settings: GlassSettings
  updateSettings: (newSettings: Partial<GlassSettings>) => void
}

const defaultSettings: GlassSettings = {
  scale: 0,
  blur: 0.25,
  contrast: 1.1,
  brightness: 1.0,
  saturation: 1.0,
  distortionIntensity: 0.15,
  roundness: 0.6,
  shapeWidth: 0.3,
  shapeHeight: 0.2,
  borderRadius: 3,
  px: 2,
  py: 0,
}

const GlassContext = createContext<GlassContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
})

export const GlassProvider: React.FC<{ children: ReactNode; initialSettings?: GlassSettings }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<GlassSettings>(defaultSettings)

  const updateSettings = (newSettings: Partial<GlassSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  return (
    <GlassContext.Provider value={{ settings, updateSettings }}>
      {children}
    </GlassContext.Provider>
  )
}

export const useGlassContext = () => {
  const context = useContext(GlassContext)
  return context
}
