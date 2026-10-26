// Where the light comes from. A fixed angle, or the pointer: one shared listener for the whole page, so any number
// of glasses can follow the cursor for the cost of a single event handler.

/** An angle in degrees the light comes from, clockwise from the top (CSS gradient convention: 0 is above,
 * 90 is to the right), or `'pointer'` to follow the cursor */
export type Light = number | 'pointer'

let pointer: { x: number; y: number } | null = null
const subscribers = new Set<() => void>()
let scheduled = false

const onPointerMove = (event: PointerEvent) => {
  pointer = { x: event.clientX, y: event.clientY }
  if (scheduled) return
  scheduled = true
  // Coalesce to one update per frame however fast the pointer reports
  requestAnimationFrame(() => {
    scheduled = false
    for (const subscriber of subscribers) subscriber()
  })
}

/** Calls `subscriber` (at most once a frame) whenever the pointer moves. Returns the unsubscribe function */
export function watchPointer(subscriber: () => void) {
  if (!subscribers.size) window.addEventListener('pointermove', onPointerMove, { passive: true })
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
    if (!subscribers.size) window.removeEventListener('pointermove', onPointerMove)
  }
}

/** The light's angle for a glass occupying `rect` (viewport coordinates), or undefined before the pointer has moved */
export function lightAngle(light: Light | undefined, rect: DOMRect): number | undefined {
  if (light === undefined) return undefined
  if (light !== 'pointer') return light
  if (!pointer) return undefined
  const dx = pointer.x - (rect.left + rect.width / 2)
  const dy = pointer.y - (rect.top + rect.height / 2)
  // 0 is straight up, increasing clockwise
  return (Math.atan2(dx, -dy) * 180) / Math.PI
}

/** The light as a point in the coordinates of a box at `origin` (viewport), for shading glass of any shape */
export function lightPoint(light: Light | undefined, origin: DOMRect, width: number, height: number) {
  if (light === 'pointer' && pointer) return { x: pointer.x - origin.left, y: pointer.y - origin.top }
  const angle = ((typeof light === 'number' ? light : 315) * Math.PI) / 180
  // A distant light in that direction, so its angle barely changes across the glass
  const far = Math.max(width, height) * 4
  return { x: width / 2 + Math.sin(angle) * far, y: height / 2 - Math.cos(angle) * far }
}
