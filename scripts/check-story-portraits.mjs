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
 *
 * People in this story (separate rule): every story is checked, including ones with no
 * storySubject(). The people are the ones resolvePeopleInStory puts on the strip: people.json
 * records whose stories[] includes the slug, story-people.json portraits and links, research
 * notes people[], and /people/#id links in the body. A self-hosted portrait counts, including
 * an AI likeness credited "AI illustration · Kentucky History Drive; no known likeness exists".
 * A missing image falls back to initials and fails. A document, map, or place image never counts.
 * Current gaps stay in scripts/prominent-portrait-gaps.json, which is shrink-only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storySubject, heroPhotoIsPortrait, hasSafePortrait } from '../src/related-people.js'
import { indexResearchByStory } from '../src/story-markdown.js'
import { resolvePeopleInStory } from './lib/unified-story-data.mjs'

/** Standard credit for an AI likeness when no historical portrait is known. This is a portrait. */
export const AI_LIKENESS_CREDIT = 'AI illustration · Kentucky History Drive; no known likeness exists'

/**
 * Person ids and image-file ids whose known image is a map, document, or place, not a face.
 * daniel-smith: the Wikipedia image is a map he made. jean-baptiste-franquelin: the Commons
 * image is his 1688 map. A wired AI likeness still counts and is not rejected by this list.
 */
export const NON_PORTRAIT_IMAGE_IDS = {
  'daniel-smith': 'map',
  'jean-baptiste-franquelin': 'map',
}

const KIND_WORD = /\b(document|map|place)\b/i

function kindWord(value) {
  const match = KIND_WORD.exec(String(value || ''))
  return match ? match[1].toLowerCase() : ''
}

function asImage(value) {
  if (!value || typeof value !== 'object') return null
  if (value.webp || value.jpg) return value
  return null
}

function wiredImage(person) {
  return asImage(person?.image) || asImage(person?.portrait) || asImage(person?.photo)
}

function labeledKind(person) {
  const image = wiredImage(person)
  const fields = [
    person?.type,
    person?.kind,
    person?.imageType,
    person?.imageKind,
    person?.likeness,
    person?.image?.type,
    person?.image?.kind,
    person?.portrait?.type,
    person?.portrait?.kind,
    person?.photo?.type,
    person?.photo?.kind,
    image?.type,
    image?.kind,
  ]
  for (const field of fields) {
    const word = kindWord(field)
    if (word) return word
  }
  return ''
}

function imageIds(person, image) {
  const ids = []
  if (person?.id) ids.push(person.id)
  for (const file of [image?.webp, image?.jpg]) {
    if (typeof file !== 'string') continue
    const base = file.split('/').pop().replace(/\.(webp|jpe?g|png)$/i, '')
    if (base) ids.push(base)
  }
  return ids
}

/** True when the wired files are a likeness: the standard AI credit, or any ai portrait with safe paths. */
function isAiLikeness(person, image) {
  if (!hasSafePortrait({ image })) return false
  if (person?.ai === true) return true
  return String(person?.credit || '').includes(AI_LIKENESS_CREDIT)
}

function portraitReason(person, denylist) {
  if (!person) return 'unknown person id'
  const labeled = labeledKind(person)
  if (labeled) return `image is a ${labeled}`
  const image = wiredImage(person)
  if (image && !isAiLikeness(person, image)) {
    for (const id of imageIds(person, image)) {
      const word = kindWord(denylist?.[id])
      if (word) return `image is a ${word}`
    }
  }
  if (!hasSafePortrait({ image })) return 'no portrait'
  return ''
}

function storyEntries(storyPeople) {
  if (storyPeople && storyPeople.stories && typeof storyPeople.stories === 'object') return storyPeople.stories
  return storyPeople && typeof storyPeople === 'object' ? storyPeople : {}
}

function personRows(people) {
  if (Array.isArray(people)) return people
  if (Array.isArray(people?.people)) return people.people
  return []
}

function notesFor(notesByStory, slug) {
  if (!notesByStory) return null
  if (notesByStory instanceof Map) return notesByStory.get(slug) || null
  return notesByStory[slug] || null
}

function storyRecords(stories, storyPeopleStories, subjects) {
  if (Array.isArray(stories)) {
    return stories.filter((story) => story?.slug && !String(story.slug).startsWith('_'))
  }
  const slugs = new Set([...Object.keys(storyPeopleStories || {}), ...Object.keys(subjects || {})])
  return [...slugs].filter((slug) => slug && !slug.startsWith('_')).map((slug) => ({ slug, bodyMarkdown: '' }))
}

/**
 * Failures are { slug, id, reason }, sorted. People come from resolvePeopleInStory, so a story
 * with no title subject is still checked. An allowlist row covers a gap only when slug, id, and
 * reason all match, so wiring a map over a "no portrait" row still fails. An allowlist row that
 * is not a current gap fails so the list can only shrink.
 * @returns {{ failures: { slug: string, id: string, reason: string }[] }}
 */
export function assessProminentPortraits({
  people,
  stories = null,
  storyPeople,
  storySubjects = null,
  notesByStory = null,
  allowlist = [],
  denylist = NON_PORTRAIT_IMAGE_IDS,
} = {}) {
  const rows = personRows(people)
  const byId = new Map(rows.map((person) => [person.id, person]))
  const subjects = storySubjects || (!Array.isArray(people) && people?.storySubjects) || {}
  const peopleData = {
    byId,
    people: rows,
    storySubjects: subjects,
    storyPeople: { stories: storyEntries(storyPeople) },
  }
  const gaps = new Map()
  for (const story of storyRecords(stories, peopleData.storyPeople.stories, subjects)) {
    const shown = resolvePeopleInStory(story, peopleData, notesFor(notesByStory, story.slug), null)
    for (const person of shown) {
      const source = byId.get(person.id) || person
      const reason = portraitReason(
        {
          ...source,
          id: person.id,
          name: person.name || source.name,
          image: person.image ?? source.image,
          credit: person.credit || source.credit,
          ai: person.ai ?? source.ai,
        },
        denylist,
      )
      if (!reason) continue
      const key = `${story.slug}\0${person.id}\0${reason}`
      if (!gaps.has(key)) gaps.set(key, { slug: story.slug, id: person.id, reason })
    }
  }

  const failures = []
  const covered = new Set()
  for (const entry of allowlist || []) {
    const slug = entry?.slug || ''
    const id = entry?.id || ''
    if (!slug || !id) {
      failures.push({ slug: slug || '?', id: id || '?', reason: 'allowlist entry is missing a slug or id' })
      continue
    }
    const listedReason = typeof entry?.reason === 'string' ? entry.reason : ''
    const key = `${slug}\0${id}\0${listedReason}`
    if (covered.has(key)) {
      failures.push({ slug, id, reason: 'duplicate allowlist entry' })
      continue
    }
    covered.add(key)
    if (!gaps.has(key)) failures.push({ slug, id, reason: 'allowlist entry is no longer a gap; remove it' })
  }
  for (const [key, gap] of gaps) {
    if (!covered.has(key)) failures.push(gap)
  }
  failures.sort((a, b) => a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id) || a.reason.localeCompare(b.reason))
  return { failures }
}

/** Empty string when the allowlist length is still the cap. Growth fails; a shrink must lower the cap. */
export function shrinkOnlyError(entries, max) {
  const count = Array.isArray(entries) ? entries.length : 0
  if (count > max) return `allowlist grew from ${max} to ${count}; a new entry was added without removing one`
  if (count < max) return `allowlist shrank from ${max} to ${count}; lower the cap so it cannot grow back`
  return ''
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))

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

function checkInlineSubjectPortraits() {
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
    return 1
  }
  console.log(`check-story-portraits: ${packDate} OK (${index.stories.length} stories, ${pack.length} in pack, ${warnings.length} grandfathered gaps)`)
  return 0
}

function loadStoryRecords() {
  const dir = path.join(root, 'public/content/stories')
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')))
    .map((story) => ({ slug: story.slug, bodyMarkdown: story.bodyMarkdown || '' }))
}

function loadNotesByStory() {
  const dir = path.join(root, 'public/content/research')
  if (!fs.existsSync(dir)) return {}
  const notes = fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')))
  return Object.fromEntries(indexResearchByStory(notes))
}

function checkProminentPortraits() {
  const people = read('public/data/people.json')
  const storyPeople = read('public/data/web/story-people.json')
  const allowlist = read('scripts/prominent-portrait-gaps.json').gaps
  const stories = loadStoryRecords()
  const { failures } = assessProminentPortraits({
    people,
    stories,
    storyPeople,
    storySubjects: people.storySubjects,
    notesByStory: loadNotesByStory(),
    allowlist,
  })
  if (failures.length) {
    console.error(`check-story-portraits: ${failures.length} prominent people have no real portrait:`)
    for (const failure of failures) console.error(`  ${failure.slug} → ${failure.id} → ${failure.reason}`)
    return 1
  }
  console.log(`check-story-portraits: prominent people OK (${stories.length} stories, ${(allowlist || []).length} grandfathered gaps)`)
  return 0
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const prominent = checkProminentPortraits()
  const inline = checkInlineSubjectPortraits()
  if (prominent || inline) process.exit(1)
}
