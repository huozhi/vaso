// What the current browser can render

// SVG filters inside `backdrop-filter` are only rendered by Chromium based browsers.
// Safari and Firefox drop the whole declaration when it contains `url()`, so we must
// fall back to a plain CSS glass there.
let svgBackdropSupport: boolean | undefined
export function getSvgBackdropSupport() {
  if (svgBackdropSupport === undefined) {
    const ua = navigator.userAgent
    const isChromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\/|FxiOS|CriOS|EdgiOS/.test(ua)
    svgBackdropSupport = isChromium && typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url(#a)')
  }
  return svgBackdropSupport
}
// WebKit: Safari, and every iOS browser
let webKit: boolean | undefined
export function isWebKit() {
  webKit ??= /AppleWebKit\//.test(navigator.userAgent) && !/Chrome\/|Chromium\/|Edg\/|Firefox\//.test(navigator.userAgent)
  return webKit
}
// WebKit's Gaussian blur has a minimum kernel, so any blur below about half a pixel renders like ~0.6px and
// softens everything behind the glass. Chromium keeps blurs that small nearly invisible, so WebKit skips them
export const WEBKIT_MIN_BLUR = 0.4
