'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface GlassSettings {
  depth?: number
  blur?: number
  dispersion?: number
  radius?: number
  px?: number
  py?: number
}

interface GlassContextType {
  settings: GlassSettings
  updateSettings: (newSettings: Partial<GlassSettings>) => void
}

const defaultSettings: GlassSettings = {
  depth: 0.4,
  blur: 0.25,
  dispersion: 0.3,
  radius: 12,
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
