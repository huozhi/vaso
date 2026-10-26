'use client'

import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  createGlass,
  createGlassGroup,
  initialGlassStyle,
  supportsBackdropRefraction,
  type Glass,
  type GlassGroup,
  type GlassGroupOptions,
  type GlassOptions,
  type GroupMember,
  type Light,
  type Outset,
} from './core'

export type { Light, Outset } from './core'

// Our own ref plus the caller's, so `ref` on <Vaso> and <VasoGroup> reaches the root element
function useMergedRef(own: React.MutableRefObject<HTMLElement | null>, forwarded: React.ForwardedRef<HTMLElement>) {
  const forwardedRef = useRef(forwarded)
  forwardedRef.current = forwarded
  const [merged] = useState(() => (node: HTMLElement | null) => {
    own.current = node
    const target = forwardedRef.current
    if (typeof target === 'function') target(node)
    else if (target) target.current = node
  })
  return merged
}

// The group a <Vaso> belongs to, if it sits inside a <VasoGroup> that can merge (Chromium)
const GroupContext = createContext<GlassGroup | null>(null)

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

  /** Where the light comes from: an angle in degrees (0 above, 90 right), or `'pointer'` to follow the cursor
   * @default top left
   */
  light?: Light

  /** Swell under a press, with a small lens forming under the finger */
  pressable?: boolean

  /** Send a ripple through the glass from every tap */
  ripple?: boolean
}

const Vaso = React.forwardRef<HTMLElement, VasoProps>(function Vaso({
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
  light,
  pressable,
  ripple,
  style,
  ...htmlProps
}, ref) {
  const id = `vaso-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const rootRef = useRef<HTMLElement>(null)
  const glassRef = useRef<Glass | null>(null)
  const memberRef = useRef<GroupMember | null>(null)
  const group = useContext(GroupContext)
  const options: GlassOptions = {
    width,
    height,
    outset,
    px,
    py,
    radius,
    depth,
    blur,
    dispersion,
    specular,
    light,
    pressable,
    ripple,
  }
  // What the server renders and the first paint shows: frosted glass with its rim. After mount the glass layer
  // belongs to vaso/core, so this style object never changes and React never writes to it again
  const [layerStyle] = useState(() => initialGlassStyle(options) as React.CSSProperties)

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current!
    if (group) {
      // Inside a group the group draws the glass; this element only lends it its shape
      const layer = root.querySelector<HTMLElement>(':scope > [data-vaso]')
      if (layer) layer.style.display = 'none'
      const member = group.add(root, { outset, px, py, radius })
      memberRef.current = member
      return () => {
        member.remove()
        memberRef.current = null
        if (layer) layer.style.display = ''
      }
    }
    const glass = createGlass(root, options)
    glassRef.current = glass
    return () => {
      glass.destroy()
      glassRef.current = null
    }
  }, [group])

  // Every render: update() compares and only touches what changed
  useIsomorphicLayoutEffect(() => {
    glassRef.current?.update(options)
    memberRef.current?.update({ outset, px, py, radius })
  })

  return (
    <WrapComponent
      {...htmlProps}
      data-vaso-root=""
      style={{ position: 'relative', ...style }}
      // @ts-expect-error: dynamic ref assignment, improve this ref type later
      ref={useMergedRef(rootRef, ref)}
    >
      <WrapComponent data-vaso={id} style={layerStyle} />
      {children}
    </WrapComponent>
  )
})

export type VasoGroupProps<Element extends HTMLElement = HTMLDivElement> = React.HTMLAttributes<Element> &
  GlassGroupOptions & {
    /** The HTML element or React component to render as the group's root
     * @default 'div'
     */
    component?: string | React.ComponentType<React.HTMLAttributes<Element>>
    children?: React.ReactNode
  }

/**
 * Glass that merges: every `<Vaso>` inside becomes part of one glass, and members that come close flow into each
 * other like drops of water. Move members with CSS or any animation library; the group follows them.
 * In browsers without backdrop refraction (Safari, Firefox) members render as standalone glass instead.
 */
const VasoGroup = React.forwardRef<HTMLElement, VasoGroupProps>(function VasoGroup({
  component: WrapComponent = 'div',
  children,
  smooth,
  depth,
  blur,
  dispersion,
  specular,
  light,
  overflow,
  style,
  ...htmlProps
}, ref) {
  const rootRef = useRef<HTMLElement>(null)
  const [group, setGroup] = useState<GlassGroup | null>(null)
  const options: GlassGroupOptions = { smooth, depth, blur, dispersion, specular, light, overflow }

  useIsomorphicLayoutEffect(() => {
    if (!supportsBackdropRefraction()) return
    const created = createGlassGroup(rootRef.current!, options)
    setGroup(created)
    return () => {
      created.destroy()
      setGroup(null)
    }
  }, [])

  useIsomorphicLayoutEffect(() => {
    group?.update(options)
  })

  return (
    <WrapComponent
      {...htmlProps}
      // No inline position: core makes the root relative only if CSS left it static, so classes still work
      style={style}
      // @ts-expect-error: dynamic ref assignment, improve this ref type later
      ref={useMergedRef(rootRef, ref)}
    >
      <GroupContext.Provider value={group}>{children}</GroupContext.Provider>
    </WrapComponent>
  )
})

export { Vaso, VasoGroup }
