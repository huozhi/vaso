// Backdrop copies for browsers that can't refract the real backdrop (Safari, Firefox).
//
// Those browsers ignore SVG filters in `backdrop-filter`, but do apply them through `filter`. So each
// glass clones the content behind it into itself, keeps the clone aligned every frame, and refracts it.

/** Marks a glass's root element */
export const GLASS_ROOT_ATTRIBUTE = 'data-vaso-root'
/** Marks a glass's layer (the element carrying the filter), which clones leave out */
export const GLASS_LAYER_ATTRIBUTE = 'data-vaso'

// Cloning a large subtree on every change costs more than the effect is worth; those glasses stay frosted
const MAX_SOURCE_ELEMENTS = 400
// Minimum time between re-clones while the source keeps changing (transitions, typing, ...)
const RECLONE_INTERVAL = 100
// Video mirrors are drawn at device resolution, capped to keep large glasses cheap
const MAX_MIRROR_PIXEL_RATIO = 2
// Longest a replacement clone waits for its images and videos before it's shown anyway
const MAX_READY_WAIT = 1000
// Visibility is reported a frame late, so glass this close to the viewport keeps updating and is already
// aligned when it scrolls into view
const VISIBILITY_MARGIN = '100px'

const FOCUSABLE = 'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]'

// Inherited text styles, copied onto the clone root so it renders like the source in its new place
const INHERITED_PROPERTIES = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-transform',
  'text-indent',
  'white-space',
  'direction',
] as const

type MediaPair =
  | { type: 'video'; source: HTMLVideoElement; clone: HTMLCanvasElement; drawnTime?: number }
  | { type: 'canvas'; source: HTMLCanvasElement; clone: HTMLCanvasElement }

type Glass = {
  wrapper: HTMLElement
  container: HTMLElement
  layer: HTMLElement
}

const isTransparent = (color: string) =>
  color === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(color) || /\/\s*0\)$/.test(color)

// Glass layers hold the copies, and glass filters change with every setting; neither is backdrop content
const isGlassInternal = (node: Node) =>
  !!(node instanceof Element ? node : node.parentElement)?.closest(
    `[${GLASS_LAYER_ATTRIBUTE}], [${GLASS_ROOT_ATTRIBUTE}] > svg`,
  )

// Solid color behind an element, so transparent parts of the clone don't reveal the real content
function backgroundBehind(element: HTMLElement) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    if (!isTransparent(color)) return color
  }
  return 'white'
}

const zIndexOf = (style: CSSStyleDeclaration) => (style.zIndex === 'auto' ? 0 : parseInt(style.zIndex, 10) || 0)

function hasVisibleContent(element: Element, style: CSSStyleDeclaration) {
  if (/^(IMG|VIDEO|CANVAS|SVG|PICTURE)$/i.test(element.tagName)) return true
  if (!isTransparent(style.backgroundColor) || style.backgroundImage !== 'none') return true
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent!.trim()) return true
  }
  return false
}

// Clone `source` without glass layers and without what paints above this glass. Returns null when there
// is nothing left worth refracting, or the source is too large to clone
function cloneBackdrop(source: HTMLElement, glass: Glass) {
  const sourceElements = [source, ...source.querySelectorAll<HTMLElement>('*')]
  if (sourceElements.length > MAX_SOURCE_ELEMENTS) return null

  const root = source.cloneNode(true) as HTMLElement
  const cloneElements = [root, ...root.querySelectorAll<HTMLElement>('*')]
  const glassZ = zIndexOf(getComputedStyle(glass.wrapper))
  const removed = new Set<Element>()
  const media: MediaPair[] = []
  const loading: Array<() => Promise<unknown>> = []
  let hasContent = false

  sourceElements.forEach((element, i) => {
    const clone = cloneElements[i]
    if (element.parentElement && removed.has(element.parentElement)) {
      removed.add(element)
      return
    }
    const style = getComputedStyle(element)
    // Drop glass layers (and their filters) but keep a glass's own content: like in Chromium, content
    // under a glass layer is part of its backdrop
    const isGlassLayer =
      element.hasAttribute(GLASS_LAYER_ATTRIBUTE) ||
      (element.tagName.toLowerCase() === 'svg' && !!element.parentElement?.hasAttribute(GLASS_ROOT_ATTRIBUTE))
    // Positioned content that stacks above the glass layer isn't behind it. Its ancestors always stay
    const isAbove =
      style.position !== 'static' &&
      !element.contains(glass.container) &&
      (zIndexOf(style) > glassZ ||
        (zIndexOf(style) === glassZ &&
          !!(glass.container.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)))
    // This glass's own content moves with it, so it gets a separate copy (see cloneOwnContent)
    if (element === glass.wrapper || isGlassLayer || isAbove || style.display === 'none') {
      removed.add(element)
      clone.remove()
      return
    }
    hasContent ||= style.visibility !== 'hidden' && hasVisibleContent(element, style)
    clone.removeAttribute('id')
    for (const [, url] of style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      loading.push(() => {
        const image = new Image()
        image.src = url
        return image.decode()
      })
    }
    if (element instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
      loading.push(() => clone.decode())
    } else if (element instanceof HTMLVideoElement && clone instanceof HTMLVideoElement) {
      // Mirror videos into a canvas instead of playing a second copy: a cloned video needs its own
      // decode, drifts, and is blocked by autoplay policies (Safari requires the `muted` attribute,
      // which React only sets as a property)
      const mirror = document.createElement('canvas')
      for (const name of ['class', 'style']) {
        const value = clone.getAttribute(name)
        if (value !== null) mirror.setAttribute(name, value)
      }
      clone.replaceWith(mirror)
      media.push({ type: 'video', source: element, clone: mirror })
    } else if (element instanceof HTMLCanvasElement && clone instanceof HTMLCanvasElement) {
      media.push({ type: 'canvas', source: element, clone })
    }
  })

  if (!hasContent) return null

  // Glasses without content of their own leave empty wrappers behind; drop them, and unmark the rest
  for (const glassRoot of root.querySelectorAll(`[${GLASS_ROOT_ATTRIBUTE}]`)) {
    if (!glassRoot.childElementCount && !glassRoot.textContent!.trim()) glassRoot.remove()
    else glassRoot.removeAttribute(GLASS_ROOT_ATTRIBUTE)
  }

  applySourceStyles(root, source)
  detachClone(root)

  // Resolves once images have decoded and videos have a frame, so swapping clones never flashes empty
  const ready = () =>
    Promise.race([
      Promise.allSettled(loading.map((load) => load())),
      new Promise((resolve) => setTimeout(resolve, MAX_READY_WAIT)),
    ])
  return { source, root, media, ready }
}

// Make a clone a static picture, placed with left/top by the copy. Drop the original's own offsets,
// transforms and animations, since its measured rect already includes them. Keep left/top positioning:
// WebKit grows filter bounding boxes by child transforms
function detachClone(root: HTMLElement) {
  Object.assign(root.style, {
    position: 'absolute',
    margin: '0',
    inset: 'auto',
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    transition: 'none',
    animation: 'none',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  })
  // Not `inert`: WebKit skips painting parts of inert subtrees. Hide it from assistive technology and
  // keep its controls out of the tab order instead (pointer events are already off)
  root.setAttribute('aria-hidden', 'true')
  root.removeAttribute('id')
  for (const focusable of root.querySelectorAll<HTMLElement>(FOCUSABLE)) focusable.tabIndex = -1
}

// The glass's own content (e.g. an icon inside it) sits under the glass layer, so it's refracted too.
// It moves with the glass, so it's copied separately and positioned relative to the glass, not the page
function cloneOwnContent(glass: Glass) {
  const sourceElements = [...glass.wrapper.querySelectorAll<HTMLElement>('*')]
  if (sourceElements.length > MAX_SOURCE_ELEMENTS) return null
  const root = glass.wrapper.cloneNode(true) as HTMLElement
  const cloneElements = [...root.querySelectorAll<HTMLElement>('*')]
  const removed = new Set<Element>()
  sourceElements.forEach((element, i) => {
    const clone = cloneElements[i]
    if (element.parentElement && removed.has(element.parentElement)) {
      removed.add(element)
      return
    }
    const style = getComputedStyle(element)
    // Positioned content stacks above the glass layer (which comes first), so it isn't refracted
    // The glass's own filter <svg> is a direct child; SVGs inside its content (icons) are content
    const isFilter = element instanceof SVGSVGElement && element.parentElement === glass.wrapper
    if (element === glass.container || isFilter || style.position !== 'static' || style.display === 'none') {
      removed.add(element)
      clone.remove()
      return
    }
    clone.removeAttribute('id')
  })
  root.removeAttribute(GLASS_ROOT_ATTRIBUTE)
  if (!root.childElementCount && !root.textContent!.trim()) return null
  detachClone(root)
  return root
}

// Inherited text styles, so the clone renders like the source in its new place
function applySourceStyles(root: HTMLElement, source: HTMLElement) {
  const sourceStyle = getComputedStyle(source)
  for (const property of INHERITED_PROPERTIES) {
    root.style.setProperty(property, sourceStyle.getPropertyValue(property))
  }
}

function findBackdrop(glass: Glass) {
  // A transparent ancestor may contain only another glass's icons. Stopping there
  // loses an image or video immediately behind that ancestor and fills the copy
  // with the page color instead. Prefer the nearest ancestor with its own painted
  // background or media; retain the first usable copy for text-only backdrops.
  let nearest: ReturnType<typeof cloneBackdrop> = null
  for (let node = glass.wrapper.parentElement; node && node !== document.documentElement; node = node.parentElement) {
    const copy = cloneBackdrop(node, glass)
    if (copy) {
      nearest ??= copy
      const style = getComputedStyle(node)
      const painted = !isTransparent(style.backgroundColor) || style.backgroundImage !== 'none'
      const media = [...node.children].some((child) => /^(IMG|VIDEO|CANVAS|PICTURE)$/i.test(child.tagName))
      if (painted || media) return copy
    }
    if (node.querySelectorAll('*').length > MAX_SOURCE_ELEMENTS) return nearest
  }
  return nearest
}

// Where a video's frame lands in its box, following object-fit and object-position
function fitVideo(video: HTMLVideoElement, width: number, height: number) {
  const style = getComputedStyle(video)
  const { videoWidth, videoHeight } = video
  let drawWidth = width
  let drawHeight = height
  const fit = style.objectFit
  if (fit === 'cover' || fit === 'contain' || fit === 'scale-down' || fit === 'none') {
    const cover = Math.max(width / videoWidth, height / videoHeight)
    const contain = Math.min(width / videoWidth, height / videoHeight)
    const scale = fit === 'cover' ? cover : fit === 'contain' ? contain : fit === 'none' ? 1 : Math.min(1, contain)
    drawWidth = videoWidth * scale
    drawHeight = videoHeight * scale
  }
  const [x = '50%', y = '50%'] = style.objectPosition.split(/\s+/)
  const offset = (value: string, free: number) => (value.endsWith('%') ? (free * parseFloat(value)) / 100 : parseFloat(value) || 0)
  return { x: offset(x, width - drawWidth), y: offset(y, height - drawHeight), width: drawWidth, height: drawHeight }
}

function syncMedia(media: MediaPair[]) {
  for (const pair of media) {
    if (pair.type === 'video') {
      const { source, clone } = pair
      if (source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !source.videoWidth) continue
      const width = source.offsetWidth
      const height = source.offsetHeight
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_MIRROR_PIXEL_RATIO)
      const pixelWidth = Math.round(width * ratio)
      const pixelHeight = Math.round(height * ratio)
      const resized = clone.width !== pixelWidth || clone.height !== pixelHeight
      if (resized) {
        clone.width = pixelWidth
        clone.height = pixelHeight
      }
      // Paused videos only need redrawing when their frame or size changes
      if (!resized && pair.drawnTime === source.currentTime && source.paused) continue
      pair.drawnTime = source.currentTime
      const context = clone.getContext('2d')
      if (!context) continue
      const frame = fitVideo(source, width, height)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      try {
        // Cross-origin frames taint the canvas, which only blocks reading it back; it still displays
        context.drawImage(source, frame.x, frame.y, frame.width, frame.height)
      } catch {
        // Not ready yet
      }
    } else {
      const { source, clone } = pair
      if (clone.width !== source.width) clone.width = source.width
      if (clone.height !== source.height) clone.height = source.height
      try {
        clone.getContext('2d')?.drawImage(source, 0, 0)
      } catch {
        // Tainted or not-yet-ready canvases are left blank
      }
    }
  }
}

type Clone = NonNullable<ReturnType<typeof cloneBackdrop>> & { applied?: string }

function createBackdropCopy(glass: Glass) {
  // The visible clone, and a newer one waiting for its images and videos before replacing it
  let active: Clone | null = null
  let pending: Clone | null = null
  let observer: MutationObserver | null = null
  let domChanged = true
  let stylesChanged = false
  let lastBuild = -Infinity
  let signature = ''
  let appliedClipPath = ''
  // Copy of the glass's own content, painted above the backdrop copy
  let own: HTMLElement | null = null
  let ownApplied = ''
  let ownChanged = true
  let lastOwnBuild = -Infinity
  const ownObserver = new MutationObserver((records) => {
    // Restyling or moving the glass itself doesn't change its content
    ownChanged ||= records.some(
      (record) => !isGlassInternal(record.target) && !(record.type === 'attributes' && record.target === glass.wrapper),
    )
  })
  ownObserver.observe(glass.wrapper, { subtree: true, childList: true, attributes: true, characterData: true })

  const observe = (source: HTMLElement) => {
    observer?.disconnect()
    observer = new MutationObserver((records) => {
      for (const record of records) {
        // Ignore glass internals (including this copy), this glass and its content (copied separately),
        // and attribute changes on ancestors that only move this glass
        if (isGlassInternal(record.target) || glass.wrapper.contains(record.target)) continue
        if (record.type === 'attributes' && record.target.contains(glass.wrapper)) continue
        domChanged = true
        return
      }
    })
    observer.observe(source, { subtree: true, childList: true, attributes: true, characterData: true })
  }

  // Off-screen glass can't be seen, so it skips re-cloning and aligning until it comes back near the viewport.
  // Changes in the meantime stay flagged and are applied on its first visible frame
  let visible = true
  const visibilityObserver =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: VISIBILITY_MARGIN })
  visibilityObserver?.observe(glass.container)

  const dispose = () => {
    observer?.disconnect()
    observer = null
    ownObserver.disconnect()
    visibilityObserver?.disconnect()
    active?.root.remove()
    pending?.root.remove()
    own?.remove()
    active = pending = own = null
  }

  const build = (now: number) => {
    const rebuild = domChanged
    domChanged = stylesChanged = false
    lastBuild = now
    const found = findBackdrop(glass)
    if (!found) {
      dispose()
      return
    }
    // Only styles changed and the same element is still the backdrop: the clone shares the document's
    // stylesheets, so refreshing the copied inherited styles is enough
    if (!rebuild && active && found.source === active.source) {
      applySourceStyles(active.root, active.source)
      return
    }
    if (found.source !== active?.source) observe(found.source)
    if (!active) {
      active = found
      glass.layer.insertBefore(found.root, own)
      return
    }
    // Keep showing the current clone until the new one has loaded, underneath it
    pending?.root.remove()
    pending = found
    glass.layer.insertBefore(found.root, active.root)
    found.ready().then(() => {
      if (pending !== found) return
      active?.root.remove()
      active = found
      pending = null
    })
  }

  const align = (clone: Clone, containerRect: DOMRect, scale: number) => {
    const sourceRect = clone.source.getBoundingClientRect()
    // The backdrop behind a scaled glass isn't scaled, but the copy inside it is: undo that with zoom.
    // Zoom, not a transform: WebKit grows filter bounding boxes by child transforms. A zoomed element's
    // own lengths are in its zoomed units, so offsets are given in screen pixels divided by the zoom
    const zoom = 1 / scale
    const x = (sourceRect.left - containerRect.left) / scale / zoom
    const y = (sourceRect.top - containerRect.top) / scale / zoom
    const next = `${x},${y},${clone.source.offsetWidth},${clone.source.offsetHeight},${zoom}`
    if (next === clone.applied) return
    clone.applied = next
    Object.assign(clone.root.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${clone.source.offsetWidth}px`,
      height: `${clone.source.offsetHeight}px`,
      zoom: zoom === 1 ? '' : String(zoom),
    })
  }

  const buildOwn = (now: number) => {
    ownChanged = false
    lastOwnBuild = now
    own?.remove()
    own = cloneOwnContent(glass)
    ownApplied = ''
    if (own) glass.layer.appendChild(own)
  }

  const update = (now: number) => {
    if (!glass.container.isConnected || !visible) return
    if ((domChanged || stylesChanged) && now - lastBuild >= RECLONE_INTERVAL) build(now)
    if (ownChanged && now - lastOwnBuild >= RECLONE_INTERVAL) buildOwn(now)
    if (!active) return

    // Theme or inherited style changes don't mutate the source subtree, so watch the values the clone
    // copied. The clone shares the page's stylesheets, so refreshing those values is all it needs; this
    // runs every frame of a color transition, so it must stay cheap
    const sourceStyle = getComputedStyle(active.source)
    const background = backgroundBehind(active.source)
    const nextSignature = `${sourceStyle.color}|${sourceStyle.fontSize}|${background}`
    if (nextSignature !== signature) {
      signature = nextSignature
      glass.layer.style.backgroundColor = background
      applySourceStyles(active.root, active.source)
    }

    const containerRect = glass.container.getBoundingClientRect()
    const width = glass.container.offsetWidth
    const height = glass.container.offsetHeight
    // Rects are in screen pixels; convert back to the container's local pixels if it's scaled
    const scaleX = containerRect.width / (width || 1) || 1
    const scaleY = containerRect.height / (height || 1) || 1
    const scale = Math.sqrt(scaleX * scaleY)

    // Round the filtered output itself (clip-path applies after filter). Safari stops clipping a child to
    // its parent's rounded overflow once the child is composited (e.g. while dragging), which showed the
    // copy's square corners. Read the radius live, since it may come from CSS
    const radius = Math.min(parseFloat(getComputedStyle(glass.container).borderTopLeftRadius) || 0, width / 2, height / 2)
    const clipPath = `inset(0 round ${radius}px)`
    if (clipPath !== appliedClipPath) glass.layer.style.clipPath = appliedClipPath = clipPath

    align(active, containerRect, scale)
    if (own) {
      const wrapperRect = glass.wrapper.getBoundingClientRect()
      const x = (wrapperRect.left - containerRect.left) / scaleX
      const y = (wrapperRect.top - containerRect.top) / scaleY
      const next = `${x},${y},${glass.wrapper.offsetWidth},${glass.wrapper.offsetHeight}`
      if (next !== ownApplied) {
        ownApplied = next
        Object.assign(own.style, {
          left: `${x}px`,
          top: `${y}px`,
          width: `${glass.wrapper.offsetWidth}px`,
          height: `${glass.wrapper.offsetHeight}px`,
        })
      }
    }
    syncMedia(active.media)
    if (pending) {
      align(pending, containerRect, scale)
      syncMedia(pending.media)
    }
  }

  // Style changes can reveal backgrounds (or hide them) without touching the DOM, so re-pick the source
  const invalidate = () => {
    stylesChanged = true
  }

  return { update, dispose, invalidate }
}

// One animation loop for every glass with a copy
const copies = new Set<ReturnType<typeof createBackdropCopy>>()
let frame = 0
let stylesObserver: MutationObserver | null = null

function tick(now: number) {
  for (const copy of copies) copy.update(now)
  frame = copies.size ? requestAnimationFrame(tick) : 0
}

const invalidateAll = () => copies.forEach((copy) => copy.invalidate())

// Stylesheets that arrive late (lazy CSS, runtime CSS-in-JS, dev servers) change which ancestors paint
// something, so every copy re-picks its source when <head> changes and once the page has loaded
function watchStyles() {
  if (stylesObserver) return
  stylesObserver = new MutationObserver(invalidateAll)
  stylesObserver.observe(document.head, { childList: true, subtree: true, characterData: true })
  if (document.readyState !== 'complete') window.addEventListener('load', invalidateAll, { once: true })
  document.fonts?.ready.then(invalidateAll)
}

/** Starts cloning and aligning the backdrop of a glass. Returns a cleanup function */
export function attachBackdropCopy(glass: Glass) {
  const copy = createBackdropCopy(glass)
  copies.add(copy)
  watchStyles()
  if (!frame) frame = requestAnimationFrame(tick)
  return () => {
    copies.delete(copy)
    copy.dispose()
    glass.layer.style.backgroundColor = ''
    glass.layer.style.clipPath = ''
    if (!copies.size) {
      stylesObserver?.disconnect()
      stylesObserver = null
    }
  }
}
