// Smoke test: loads the homepage in each mode, screenshots every demo, and fails on page errors or on anything
// probe.js reports as broken.
//
//   node validation/smoke.mjs [--modes chromium,webkit] [--demo "Liquid search"]

import { demoTitles, open, parseArgs, probe, shot, showDemo, slug, table } from './lib.mjs'

const args = parseArgs({ demo: '' })
const rows = []
let failed = false

for (const mode of args.modes) {
  const session = await open(mode, args, { reducedMotion: true })
  const { page, errors } = session
  const titles = args.demo ? [args.demo] : await demoTitles(page)
  for (const title of titles) {
    const clip = await showDemo(page, title, 900)
    await shot(page, args, `smoke/${mode}/${slug(title)}`, clip)
  }
  const report = await probe(page)
  rows.push({
    mode,
    demos: titles.length,
    backdrop: report.glasses.backdrop,
    copy: report.glasses.copy,
    frosted: report.glasses.frosted,
    groups: report.groups.map((g) => `${g.path}:${g.members}`).join(' '),
    problems: report.problems.length,
    errors: errors.length,
  })
  for (const problem of report.problems) console.log(`[${mode}] problem: ${problem}`)
  for (const error of errors) console.log(`[${mode}] page error: ${error}`)
  failed ||= errors.length > 0 || report.problems.length > 0
  await session.close()
}

table(rows)
console.log(`Screenshots: ${args.out}/smoke`)
process.exit(failed ? 1 : 0)
