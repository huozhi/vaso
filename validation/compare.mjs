// Cross-browser comparison: screenshots one demo in every mode with motion reduced (so the demos hold still) and
// diffs each against the first mode. The sheets in validation/out/compare show both shots and the differences in
// red. Glass should look the same on every path; a large difference is a rendering bug or a stale copy.
//
//   node validation/compare.mjs [--demo "Liquid search"] [--query glass] [--modes chromium,safari-ua,webkit]

import { compareImages, open, parseArgs, shot, showDemo, slug, table } from './lib.mjs'

const args = parseArgs({ demo: 'Liquid search', query: '', threshold: '24' })
const shots = []

for (const mode of args.modes) {
  const session = await open(mode, args, { reducedMotion: true, scale: 2 })
  const { page, errors } = session
  let clip = await showDemo(page, args.demo, 900)
  if (args.query && args.demo === 'Liquid search') {
    await page.evaluate(() => document.querySelector('.lab-merge .lab-url').click())
    await page.waitForTimeout(600)
    await page.locator('.lab-merge input').fill(args.query)
    await page.waitForTimeout(2500)
    clip = await showDemo(page, args.demo, 300)
  }
  shots.push({ mode, file: await shot(page, args, `compare/${slug(args.demo)}-${mode}`, clip), errors: errors.length })
  await session.close()
}

// Any browser can diff the images; use Chromium, which is always installed
const session = await open('chromium', { ...args, offline: true }, {})
const [reference, ...rest] = shots
const rows = [{ mode: reference.mode, 'differs (px)': 'reference', '%': '', 'max delta': '', errors: reference.errors }]
for (const other of rest) {
  const diff = await compareImages(session.page, args, reference.file, other.file, `compare/${slug(args.demo)}-${reference.mode}-vs-${other.mode}`, Number(args.threshold))
  rows.push({ mode: other.mode, 'differs (px)': diff.count, '%': (diff.ratio * 100).toFixed(2), 'max delta': diff.max, box: diff.box?.join(',') ?? '-', errors: other.errors })
}
await session.close()

table(rows)
console.log(`Sheets: ${args.out}/compare`)
