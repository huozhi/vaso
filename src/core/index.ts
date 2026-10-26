// vaso/core: the glass without a framework. `createGlass(element, options)` turns any element into liquid glass;
// `createGlassGroup(element, options)` makes glass that merges. The React components in `vaso` wrap these.

export { createGlass, initialGlassStyle } from './glass'
export type { Glass, GlassOptions } from './glass'
export { createGlassGroup } from './group'
export type { GlassGroup, GlassGroupOptions, GroupMember, GroupMemberOptions } from './group'
export type { Light } from './light'
export { resolveOutset } from './optics'
export type { Outset } from './optics'
export { getSvgBackdropSupport as supportsBackdropRefraction } from './support'
