// Shared helpers for the validation scripts. See README.md for what each script checks and how to run it.

import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const here = path.dirname(fileURLToPath(import.meta.url))

// Chromium with another browser's user agent takes that browser's rendering path in vaso (the backdrop copy), so
// the copy can be checked where WebKit or Gecko isn't installed. It's still Chromium drawing it: confirm visual
// details in the real engine (the `webkit` and `firefox` modes) before calling a Safari or Firefox bug fixed
const USER_AGENTS = {
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
}

/** Every mode a script can run in: a real engine, or Chromium posing as another browser */
export const MODES = {
  chromium: { engine: 'chromium' },
  webkit: { engine: 'webkit' },
  firefox: { engine: 'firefox' },
  'safari-ua': { engine: 'chromium', userAgent: USER_AGENTS.safari },
  'firefox-ua': { engine: 'chromium', userAgent: USER_AGENTS.firefox },
}

/**
 * Command line options shared by every script:
 *   --url <url>          the site to test (default $VASO_URL or http://localhost:3000)
 *   --modes <a,b>        comma separated MODES (default chromium,safari-ua,firefox-ua)
 *   --out <dir>          where screenshots go (default validation/out)
 *   --offline            answer every request that isn't to the site locally: remote images become gray, fonts fall back
 *   --headed             show the browser
 * plus any script specific `--name value` pairs, returned as strings
 */
export function parseArgs(defaults = {}) {
  const args = {
    url: process.env.VASO_URL || 'http://localhost:3000',
    modes: 'chromium,safari-ua,firefox-ua',
    out: path.join(here, 'out'),
    offline: false,
    headed: false,
    ...defaults,
  }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const [key, inline] = argv[i].slice(2).split('=')
    const flag = typeof args[key] === 'boolean'
    args[key] = inline ?? (flag ? true : argv[++i])
  }
  args.modes = String(args.modes)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  for (const name of args.modes) {
    if (!MODES[name]) throw new Error(`Unknown mode "${name}". Modes: ${Object.keys(MODES).join(', ')}`)
  }
  mkdirSync(args.out, { recursive: true })
  return args
}

let playwright
// Playwright is CommonJS; depending on how it's resolved, its exports sit on the namespace or on `default`
const usable = (mod) => (mod.chromium ? mod : mod.default)
/** Playwright from the repo, the current directory, or a global install */
export async function loadPlaywright() {
  if (playwright) return playwright
  for (const base of [process.cwd(), here]) {
    try {
      const resolved = createRequire(path.join(base, 'noop.js')).resolve('playwright')
      return (playwright = usable(await import(pathToFileURL(resolved).href)))
    } catch {}
  }
  try {
    return (playwright = usable(await import('playwright')))
  } catch {
    console.error('Playwright is missing. Install it with `pnpm add -D playwright`, then the browsers with `npx playwright install chromium webkit firefox`.')
    process.exit(2)
  }
}

/**
 * Opens the site in one mode. `reducedMotion` stops the demos' autoplay, which makes screenshots repeatable.
 * Returns the page plus `errors`, every uncaught error the page threw
 */
export async function open(modeName, args, { viewport = { width: 1280, height: 900 }, scale = 1, reducedMotion = false, path: route = '/' } = {}) {
  const { engine, userAgent } = MODES[modeName]
  const pw = await loadPlaywright()
  let browser
  try {
    browser = await pw[engine].launch({ headless: !args.headed })
  } catch (error) {
    throw new Error(`Can't launch ${engine}: ${error.message.split('\n')[0]}. Install it with \`npx playwright install ${engine}\``)
  }
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    ...(userAgent ? { userAgent } : {}),
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  if (args.offline) {
    const origin = new URL(args.url).origin
    // Stand-ins rather than failures: a failed stylesheet rejects inside React, a failed image never decodes
    await page.route((url) => url.origin !== origin, (route) => {
      const type = route.request().resourceType()
      if (type === 'stylesheet') return route.fulfill({ body: '', contentType: 'text/css' })
      if (type === 'image') return route.fulfill({ body: Buffer.from(GRAY_PNG, 'base64'), contentType: 'image/png' })
      return route.abort()
    })
  }
  await page.goto(new URL(route, args.url).href)
  await page.addScriptTag({ path: path.join(here, 'probe.js') })
  await page.waitForTimeout(1000)
  return {
    browser,
    context,
    page,
    errors,
    engine,
    mode: modeName,
    close: () => browser.close(),
  }
}

// A 1x1 mid gray pixel, for remote images in --offline runs
const GRAY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg=='

/** The demo card titled `title` on the homepage (its <figure>) */
export function demo(page, title) {
  // Not the copies of it inside other glass (the backdrop copy in Safari and Firefox clones the page)
  return page
    .locator('figure:not([data-vaso] figure)')
    .filter({ has: page.locator('figcaption > span', { hasText: new RegExp(`^${escape(title)}$`) }) })
    .first()
}

/** Every demo title on the homepage, in order */
export function demoTitles(page) {
  return page.$$eval('figure:not([data-vaso] figure) > figcaption > span:first-child', (spans) => spans.map((span) => span.textContent.trim()))
}

/** Scrolls a demo to the middle of the viewport. Returns the rect of its stage (the part under the title) */
export async function showDemo(page, title, settle = 500) {
  const figure = demo(page, title)
  if (!(await figure.count())) throw new Error(`No demo titled "${title}"`)
  await figure.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(settle)
  return figure.evaluate((el) => {
    const stage = el.children[1] ?? el
    const r = stage.getBoundingClientRect()
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height }
  })
}

/** What vaso has built on the page, from probe.js: rendering path, glasses, groups and anything that looks broken */
export const probe = (page) => page.evaluate(() => window.vasoProbe())

/** Frames per second over `ms`, from requestAnimationFrame */
export function frameRate(page, ms = 2000) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        let frames = 0
        const start = performance.now()
        const tick = () => {
          frames++
          if (performance.now() - start < ms) requestAnimationFrame(tick)
          else resolve(Math.round((frames * 1000) / (performance.now() - start)))
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

/** Main thread busy time in ms per second over `ms` (Chromium only; null elsewhere) */
export async function mainThread(session, ms = 3000) {
  if (session.engine !== 'chromium') return null
  const cdp = await session.context.newCDPSession(session.page)
  await cdp.send('Performance.enable')
  const read = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  const before = await read()
  await session.page.waitForTimeout(ms)
  const after = await read()
  const per = (key) => Math.round(((after[key] - before[key]) * 1000 * 1000) / ms)
  return { task: per('TaskDuration'), script: per('ScriptDuration'), layout: per('LayoutDuration'), style: per('RecalcStyleDuration') }
}

/** Saves a screenshot to the output folder and returns its path */
export async function shot(page, args, name, clip) {
  const file = path.join(args.out, `${name}.png`)
  mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, ...(clip ? { clip } : {}) })
  return file
}

/**
 * Compares two PNGs in a browser canvas. Returns how many pixels differ by more than `threshold` (0-255 on any
 * channel), the largest difference, and the box around the differences. Also writes `<name>.png`: a, b, and the
 * differences in red, side by side
 */
export async function compareImages(page, args, a, b, name, threshold = 24) {
  const { readFileSync } = await import('node:fs')
  const toUrl = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`
  const result = await page.evaluate(
    async ({ a, b, threshold }) => {
      const load = (src) => new Promise((resolve, reject) => Object.assign(new Image(), { onload() { resolve(this) }, onerror: reject, src }))
      const [ia, ib] = await Promise.all([load(a), load(b)])
      const w = Math.min(ia.width, ib.width)
      const h = Math.min(ia.height, ib.height)
      const read = (image) => {
        const c = new OffscreenCanvas(w, h)
        const g = c.getContext('2d')
        g.drawImage(image, 0, 0)
        return g.getImageData(0, 0, w, h)
      }
      const da = read(ia)
      const db = read(ib)
      const canvas = document.createElement('canvas')
      canvas.width = w * 3
      canvas.height = h
      const g = canvas.getContext('2d')
      g.drawImage(ia, 0, 0)
      g.drawImage(ib, w, 0)
      const diff = g.createImageData(w, h)
      let count = 0
      let max = 0
      let box = null
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]))
        max = Math.max(max, d)
        const gray = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 12 + 180
        diff.data.set(d > threshold ? [255, 0, 0, 255] : [gray, gray, gray, 255], i)
        if (d > threshold) {
          count++
          const x = (i / 4) % w
          const y = Math.floor(i / 4 / w)
          box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y]
        }
      }
      g.putImageData(diff, w * 2, 0)
      return { count, ratio: count / (w * h), max, box, sheet: canvas.toDataURL('image/png') }
    },
    { a: toUrl(a), b: toUrl(b), threshold },
  )
  const file = path.join(args.out, `${name}.png`)
  writeFileSync(file, Buffer.from(result.sheet.split(',')[1], 'base64'))
  delete result.sheet
  return { ...result, file }
}

export const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Prints a line per row, columns padded */
export function table(rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const width = keys.map((key) => Math.max(key.length, ...rows.map((row) => String(row[key] ?? '').length)))
  const line = (cells) => cells.map((cell, i) => String(cell ?? '').padEnd(width[i])).join('  ')
  console.log(line(keys))
  for (const row of rows) console.log(line(keys.map((key) => row[key])))
}
