'use client'

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createGlass, initialGlassStyle, type Glass, type GlassOptions, type Outset } from './core'

export type { Outset } from './core'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export type VasoProps<Element extends HTMLElement = HTMLDivElement> = React.HTMLAttributes<Element> & {
  /** The HTML element or React component to render as the glass container
   * @default 'div'
   */
  component?: string | React.ComponentType<React.HTMLAttributes<Element>>

  /** The content to be rendered inside the glass effect */
  children?: React.ReactNode

  /** Explicit width of the glass element in pixels
   * @default auto-calculated from content
   */
  width?: number

  /** Explicit height of the glass element in pixels
   * @default auto-calculated from content
   */
  height?: number

  /** How far the glass extends beyond the element, in pixels, without affecting layout. A number applies to
   * every side; an object sets the axes (`x`, `y`) or single sides (`top`, `right`, `bottom`, `left`), with
   * sides taking precedence over axes
   * @default 0
   */
  outset?: Outset

  /** @deprecated Use `outset={{ x }}`. Extends the glass horizontally beyond the element */
  px?: number

  /** @deprecated Use `outset={{ y }}`. Extends the glass vertically beyond the element */
  py?: number

  /** Border radius of the glass container in pixels
   * @default inherited from the element's computed border-radius
   * @range 0-Infinity
   */
  radius?: number

  /** Depth factor for the refraction. Negative values create a concave (compressing) glass
   * @default 0
   * @range -5.0 to 5.0
   */
  depth?: number

  /** Blur amount applied to the backdrop filter in pixels
   * @default 0.1
   * @range 0-10
   */
  blur?: number

  /** Spectral dispersion along the refracting edge, splitting light into a rainbow like a prism
   * @default 0.5
   * @range 0-3.0 or false to disable
   */
  dispersion?: number | false

  /** Intensity of the specular rim highlight
   * @default 0.5
   * @range 0-1.0 or false to disable
   */
  specular?: number | false
}

const Vaso: React.FC<VasoProps> = ({
  component: WrapComponent = 'div',
  children,
  width,
  height,
  outset,
  px,
  py,
  radius,
  depth = 0,
  blur = 0.1,
  dispersion = 0.5,
  specular = 0.5,
  style,
  ...htmlProps
}) => {
  const id = `vaso-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const rootRef = useRef<HTMLElement>(null)
  const glassRef = useRef<Glass | null>(null)
  const options: GlassOptions = { width, height, outset, px, py, radius, depth, blur, dispersion, specular }
  // What the server renders and the first paint shows: frosted glass with its rim. After mount the glass layer
  // belongs to vaso/core, so this style object never changes and React never writes to it again
  const [layerStyle] = useState(() => initialGlassStyle(options) as React.CSSProperties)

  useIsomorphicLayoutEffect(() => {
    const glass = createGlass(rootRef.current!, options)
    glassRef.current = glass
    return () => {
      glass.destroy()
      glassRef.current = null
    }
  }, [])

  // Every render: update() compares and only touches what changed
  useIsomorphicLayoutEffect(() => {
    glassRef.current?.update(options)
  })

  return (
    <WrapComponent
      {...htmlProps}
      data-vaso-root=""
      style={{ position: 'relative', ...style }}
      // @ts-expect-error: dynamic ref assignment, improve this ref type later
      ref={rootRef}
    >
      <WrapComponent data-vaso={id} style={layerStyle} />
      {children}
    </WrapComponent>
  )
}

export { Vaso }
