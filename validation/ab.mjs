// A/B regression: the same demos on two builds of the site, screenshotted with motion reduced and diffed. Run the
// base build (say, `main`) on one port and your branch on another. Differences above --tolerance are listed; open
// the sheets in validation/out/ab to see them. Run it twice against the same build first (an A/A run) to learn how
// much a demo differs from itself: anything animated by time rather than input still moves a little.
//
//   node validation/ab.mjs --base http://localhost:3001 --head http://localhost:3000 [--modes chromium,safari-ua]
//                          [--demo "Liquid search"] [--tolerance 0.2]

import { compareImages, demoTitles, open, parseArgs, shot, showDemo, slug, table } from './lib.mjs'

const args = parseArgs({ base: '', head: '', demo: '', tolerance: '0.2', threshold: '24' })
if (!args.base || !args.head) {
  console.error('Pass both --base <url> and --head <url>')
  process.exit(2)
}

const rows = []
let failed = false

for (const mode of args.modes) {
  const files = {}
  let titles = []
  for (const side of ['base', 'head']) {
    const session = await open(mode, { ...args, url: args[side] }, { reducedMotion: true })
    const { page } = session
    titles = args.demo ? [args.demo] : await demoTitles(page)
    for (const title of titles) {
      try {
        const clip = await showDemo(page, title, 900)
        ;(files[title] ??= {})[side] = await shot(page, args, `ab/${mode}/${slug(title)}-${side}`, clip)
      } catch (error) {
        console.log(`[${mode} ${side}] ${title}: ${error.message}`)
      }
    }
    await session.close()
  }
  const session = await open('chromium', { ...args, url: args.head, offline: true })
  for (const title of titles) {
    const pair = files[title]
    if (!pair?.base || !pair?.head) {
      rows.push({ mode, demo: title, '%': 'missing on one side' })
      continue
    }
    const diff = await compareImages(session.page, args, pair.base, pair.head, `ab/${mode}/${slug(title)}-diff`, Number(args.threshold))
    const percent = diff.ratio * 100
    const changed = percent > Number(args.tolerance)
    failed ||= changed
    rows.push({ mode, demo: title, '%': percent.toFixed(2), 'max delta': diff.max, verdict: changed ? 'CHANGED' : 'same' })
  }
  await session.close()
}

table(rows)
console.log(`Sheets: ${args.out}/ab`)
process.exit(failed ? 1 : 0)
