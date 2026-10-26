// The banner's theme switch: a click anywhere on it (the glass knob, either end of the track) and the Space key
// each flip the theme, and aria-checked follows.
//
//   node validation/switcher.mjs [--modes chromium,webkit]

import { open, parseArgs, table } from './lib.mjs'

const args = parseArgs()
const rows = []
let failed = false

for (const mode of args.modes) {
  const session = await open(mode, args)
  const { page, errors } = session
  const toggle = page.locator('[role="switch"][aria-label^="Switch to"]').first()
  await toggle.scrollIntoViewIfNeeded()
  const theme = () => page.evaluate(() => document.querySelector('[data-theme]')?.getAttribute('data-theme'))
  const box = await toggle.boundingBox()
  const knob = await page.evaluate(() => {
    const r = document.querySelector('[role="switch"][aria-label^="Switch to"] .vaso-switching')?.getBoundingClientRect()
    return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  const targets = [
    ['knob', knob],
    ['left end', { x: box.x + 6, y: box.y + box.height / 2 }],
    ['right end', { x: box.x + box.width - 6, y: box.y + box.height / 2 }],
  ]
  const results = {}
  for (const [name, at] of targets) {
    const before = await theme()
    if (at) await page.mouse.click(at.x, at.y)
    await page.waitForTimeout(400)
    results[name] = at ? (await theme()) !== before : false
  }
  const before = await theme()
  await toggle.focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  results.space = (await theme()) !== before
  const checked = await toggle.getAttribute('aria-checked')
  results['aria-checked'] = checked === String((await theme()) === 'dark')
  results['no errors'] = errors.length === 0

  const fails = Object.entries(results).filter(([, ok]) => !ok).map(([name]) => name)
  failed ||= fails.length > 0
  rows.push({ mode, ...Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v ? 'ok' : 'FAIL'])) })
  await session.close()
}

table(rows)
process.exit(failed ? 1 : 0)
