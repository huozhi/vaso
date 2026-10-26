// Performance: frame rate and main thread time while one demo runs its autoplay, and again at rest (motion reduced).
// Main thread time comes from Chromium's DevTools protocol, so the WebKit and Firefox rows only have a frame rate.
// Headless browsers render on the CPU: compare numbers between runs on one machine, not with what a real browser shows.
//
//   node validation/perf.mjs [--demo "Liquid search"] [--seconds 5] [--modes chromium,safari-ua]

import { frameRate, mainThread, open, parseArgs, showDemo, table } from './lib.mjs'

const args = parseArgs({ demo: 'Liquid search', seconds: '5' })
const ms = Number(args.seconds) * 1000
const rows = []

for (const mode of args.modes) {
  for (const phase of ['autoplay', 'rest']) {
    const session = await open(mode, args, { reducedMotion: phase === 'rest' })
    const { page } = session
    await showDemo(page, args.demo, 800)
    // Keep the pointer off the demos: hovering one takes over from its autoplay
    await page.mouse.move(1, 1)
    await page.waitForTimeout(800)
    const [fps, busy] = await Promise.all([frameRate(page, ms), mainThread(session, ms)])
    rows.push({
      mode,
      phase,
      fps,
      'main thread ms/s': busy?.task ?? '-',
      script: busy?.script ?? '-',
      layout: busy?.layout ?? '-',
      style: busy?.style ?? '-',
    })
    await session.close()
  }
}

table(rows)
