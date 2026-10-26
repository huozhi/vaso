// Liquid search, end to end: types a query, checks that every match got a highlight and that the search bar's two
// pieces merged, measures the frame rate while the highlights move, then clears the query and checks they leave.
//
//   node validation/search.mjs [--modes chromium,webkit] [--query glass]

import { frameRate, open, parseArgs, probe, shot, showDemo, table } from './lib.mjs'

const args = parseArgs({ query: 'glass' })
const rows = []
let failed = false

for (const mode of args.modes) {
  const session = await open(mode, args)
  const { page, errors } = session
  const clip = await showDemo(page, 'Liquid search')
  // Open the bar with a script click: Playwright's own click scrolls the page first
  await page.evaluate(() => document.querySelector('.lab-merge .lab-url').click())
  await page.waitForTimeout(600)
  await page.locator('.lab-merge input').fill('')
  const typing = page.locator('.lab-merge input').pressSequentially(args.query, { delay: 80 })
  // The highlights stream out of the search field while it types
  const fps = await frameRate(page, 1500)
  await typing
  await page.waitForTimeout(2200)
  const count = Number(await page.textContent('.lab-merge .lab-count')) || 0
  const report = await probe(page)
  // The demo's two groups: the highlights, then the bar
  const [marks, bar] = report.groups.filter((g) => g.demo === 'Liquid search')
  await shot(page, args, `search/${mode}-typed`, clip)

  await page.locator('.lab-merge input').fill('')
  await page.waitForTimeout(1600)
  const after = await probe(page)
  await shot(page, args, `search/${mode}-cleared`, clip)

  const checks = {
    'matches highlighted': count > 0 && marks?.members === count,
    'bar merged': bar?.members === 2,
    'highlights left': after.groups.find((g) => g.demo === 'Liquid search')?.members === 0,
    'no problems': report.problems.length === 0,
    'no errors': errors.length === 0,
  }
  for (const problem of report.problems) console.log(`[${mode}] problem: ${problem}`)
  for (const error of errors) console.log(`[${mode}] page error: ${error}`)
  const fails = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name)
  failed ||= fails.length > 0
  rows.push({ mode, path: marks?.path, matches: count, highlights: marks?.members, 'fps typing': fps, failed: fails.join(', ') || '-' })
  await session.close()
}

table(rows)
console.log(`Screenshots: ${args.out}/search`)
process.exit(failed ? 1 : 0)
