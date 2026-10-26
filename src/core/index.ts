// vaso/core: the glass without a framework. `createGlass(element, options)` turns any element into liquid glass;
// the React component in `vaso` is a thin wrapper around it.

export { createGlass, initialGlassStyle } from './glass'
export type { Glass, GlassOptions } from './glass'
export { resolveOutset } from './optics'
export type { Outset } from './optics'
export { getSvgBackdropSupport as supportsBackdropRefraction } from './support'
