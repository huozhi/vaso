import { execFileSync } from 'node:child_process'

const version = process.argv[2]

if (!version) {
  throw new Error('Usage: node scripts/release-notes.mjs <version-tag>')
}

let previousTag
try {
  previousTag = execFileSync('git', ['describe', '--tags', '--abbrev=0', `${version}^`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
} catch {
  // The first release includes all commits reachable from its tag.
}

const range = previousTag ? `${previousTag}..${version}` : version
const subjects = execFileSync('git', ['log', '-z', '--format=%s', range], {
  encoding: 'utf8',
}).split('\0')

const sections = { feat: [], fix: [] }
for (const subject of subjects) {
  const match = /^(feat|fix)(?:\([^)]+\))?!?:\s+(.+)$/i.exec(subject.trim())
  if (match) sections[match[1].toLowerCase()].push(match[2])
}

for (const [type, heading] of [['feat', 'Features'], ['fix', 'Fixes']]) {
  if (sections[type].length === 0) continue
  process.stdout.write(`## ${heading}\n\n`)
  for (const subject of sections[type]) process.stdout.write(`- ${subject}\n`)
  process.stdout.write('\n')
}
