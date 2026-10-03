'use client'

import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react'

export interface GlassSettings {
  depth: number
  blur: number
  dispersion: number
  radius: number
  px: number
  py: number
}

export const defaultSettings: GlassSettings = {
  depth: 0.4,
  blur: 0.25,
  dispersion: 0.3,
  radius: 12,
  px: 2,
  py: 0,
}

interface GlassStore {
  settingsFor: (id: string | null) => GlassSettings
  updateSettingsFor: (id: string, newSettings: Partial<GlassSettings>) => void
}

const GlassStoreContext = createContext<GlassStore>({
  settingsFor: () => defaultSettings,
  updateSettingsFor: () => {},
})

// The demo a glass belongs to. Glass outside any scope keeps the defaults, since nothing can tune it
const GlassScopeContext = createContext<{ id: string; label: string } | null>(null)

/** Attribute marking a tunable demo in the DOM, so the panel can tell which demo a glass belongs to */
export const GLASS_SCOPE_ATTRIBUTE = 'data-glass-scope'
export const GLASS_SCOPE_LABEL_ATTRIBUTE = 'data-glass-scope-label'

export const GlassProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settingsById, setSettingsById] = useState<Record<string, GlassSettings>>({})

  const settingsFor = useCallback(
    (id: string | null) => (id && settingsById[id]) || defaultSettings,
    [settingsById]
  )
  const updateSettingsFor = useCallback((id: string, newSettings: Partial<GlassSettings>) => {
    setSettingsById((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultSettings), ...newSettings } }))
  }, [])

  return (
    <GlassStoreContext.Provider value={{ settingsFor, updateSettingsFor }}>{children}</GlassStoreContext.Provider>
  )
}

/** Makes the glass inside tunable from the panel, independently of every other demo */
export function GlassScope({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <GlassScopeContext.Provider value={{ id, label }}>
      <div className="contents" {...{ [GLASS_SCOPE_ATTRIBUTE]: id, [GLASS_SCOPE_LABEL_ATTRIBUTE]: label }}>
        {children}
      </div>
    </GlassScopeContext.Provider>
  )
}

/** DOM attributes for glass rendered outside its scope's element, e.g. through a portal */
export function useGlassScopeAttributes() {
  const scope = useContext(GlassScopeContext)
  return scope ? { [GLASS_SCOPE_ATTRIBUTE]: scope.id, [GLASS_SCOPE_LABEL_ATTRIBUTE]: scope.label } : {}
}

export function useGlassStore() {
  return useContext(GlassStoreContext)
}

/** Settings of the demo this glass belongs to */
export const useGlassContext = () => {
  const scope = useContext(GlassScopeContext)
  const { settingsFor } = useContext(GlassStoreContext)
  return { settings: settingsFor(scope?.id ?? null) }
}

/** How far the demo's settings are from the defaults, to add onto each glass's own base values */
export function useGlassTuning() {
  const { settings } = useGlassContext()
  return {
    depth: settings.depth - defaultSettings.depth,
    blur: settings.blur - defaultSettings.blur,
    dispersion: settings.dispersion - defaultSettings.dispersion,
    radius: settings.radius - defaultSettings.radius,
  }
}
