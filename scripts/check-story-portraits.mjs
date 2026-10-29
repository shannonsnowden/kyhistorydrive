#!/usr/bin/env node
/**
 * Shannon's rule (Oct 13): every person-subject story in the daily pack carries an inline portrait
 * (figure.story-portrait as the first child of .story-body on its static page).
 *
 * Daily pack: stories in public/content/stories.json whose briefDate is briefDateRange.end, the same
 * rule build-home-preview.mjs uses for today's homepage / OTA pack.
 * Person-subject: storySubject() (people.json storySubjects + the related-people rules the pages use)
 * resolves a person when portrait availability is ignored. A person-subject story whose subject has
 * no shipped portrait, or whose built page lacks the figure, fails the build.
 *
 * Rules: every person story in the daily pack fails without a portrait, even if allowlisted; any story
 * not in scripts/story-portrait-gaps.json (a frozen legacy allowlist) fails too. Allowlisted stories outside
 * the pack only warn.
 *
 * Stories that already shipped without a portrait before this check existed are grandfathered in
 * scripts/story-portrait-gaps.json and reported as warnings, so main keeps building while they are
 * filled in. Remove a slug from that list once its portrait lands.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storySubject, heroPhotoIsPortrait } from '../src/related-people.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const index = read('public/content/stories.json')
const people = read('public/data/people.json')
const related = read('public/data/web/related-people.json')
const grandfathered = new Set(read('scripts/story-portrait-gaps.json').slugs)

const packDate = index.briefDateRange?.end
if (!packDate) throw new Error('check-story-portraits: stories.json has no briefDateRange.end')
const pack = index.stories.filter((s) => s.briefDate === packDate)
const inPack = new Set(pack.map((s) => s.slug))

// Same people, each treated as if it had a portrait, to learn who the story is about.
const placeholder = { webp: '/people/portraits/_.webp', jpg: '/people/portraits/_.jpg' }
const anyPortrait = people.people.map((p) => ({ ...p, image: p.image || placeholder, credit: p.credit || '-', license: p.license || '-' }))

/** True when the first element inside <div class="story-body"> is <figure class="story-portrait">. indexOf scan, no tag regex. */
function firstChildIsPortrait(html) {
  const at = html.indexOf('class="story-body"')
  if (at < 0) return false
  const open = html.indexOf('>', at)
  if (open < 0) return false
  const next = html.indexOf('<', open + 1)
  if (next < 0) return false
  if (html.slice(open + 1, next).trim()) return false
  const tagEnd = html.indexOf('>', next)
  const tag = html.slice(next, tagEnd + 1)
  return tag.startsWith('<figure') && tag.includes('story-portrait')
}

const failures = []
const warnings = []
// Every story is checked. Fail: any daily-pack person story (allowlist or not) and any story not on the
// frozen legacy allowlist. Warn only: legacy allowlisted stories outside today's pack.
for (const story of index.stories) {
  const subject = storySubject(related, anyPortrait, story, people.storySubjects).person
  if (!subject) continue
  const shipped = storySubject(related, people.people, story, people.storySubjects).person
  let problem = ''
  if (!shipped) problem = `${subject.id} has no shipped portrait`
  else if (heroPhotoIsPortrait(story.photo, shipped)) {
    // The Kentucky-today hero is this portrait, so the lead figure is omitted (face once).
  } else {
    const file = path.join(root, 'dist/stories', story.slug, 'index.html')
    if (!fs.existsSync(file)) problem = `missing ${path.relative(root, file)}`
    else if (!firstChildIsPortrait(fs.readFileSync(file, 'utf8'))) problem = 'built page has no figure.story-portrait as the first child of .story-body'
  }
  if (!problem) continue
  ;(grandfathered.has(story.slug) && !inPack.has(story.slug) ? warnings : failures).push(`${story.slug}: ${problem}`)
}

for (const w of warnings) console.warn(`  check-story-portraits: grandfathered gap ${w}`)
if (failures.length) {
  console.error(`check-story-portraits: ${failures.length} person-subject stories (daily pack ${packDate} or not on the legacy allowlist) have no inline portrait:`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`check-story-portraits: ${packDate} OK (${index.stories.length} stories, ${pack.length} in pack, ${warnings.length} grandfathered gaps)`)
