#!/usr/bin/env node
/**
 * Homepage quote follows #186: the newest story not already shown above,
 * unless the pack or Editor names a pin. The hero sentence copied into
 * home-preview.json is not a pin. Fails if that file is a stale pack, or if
 * the quote stays the same when the pack date (and its hero set) changes.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HomepageStructure } from '../src/homepage-structure.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function story(slug, date, title = slug) {
  return {
    slug,
    title,
    era: 'other',
    publishedDate: date,
    briefDate: date,
    photo: { image_url: '/x.jpg' },
  }
}

function warnsOf(fn) {
  const lines = []
  const orig = console.warn
  console.warn = (...args) => lines.push(args.map(String).join(' '))
  try {
    return { value: fn(), lines }
  } finally {
    console.warn = orig
  }
}

const hero = story('hero-story', '2026-10-09', 'Hero')
const highlight = story('highlight-story', '2026-10-08', 'Highlight')
const older = [
  story('q-one', '2026-10-07', 'One'),
  story('q-two', '2026-10-06', 'Two'),
  story('q-three', '2026-10-05', 'Three'),
]
const catalog = [hero, highlight, ...older]
const exclude = ['hero-story', 'highlight-story']
const heroSlugs = ['hero-story']

const newest = HomepageStructure.pickQuote(catalog, exclude, { heroSlugs })
assert.equal(newest.slug, 'q-one')
assert.ok(!exclude.includes(newest.slug))
const nextHero = ['q-one']
const nextExclude = ['q-one', 'highlight-story']
const nextPack = HomepageStructure.pickQuote(catalog, nextExclude, { heroSlugs: nextHero })
assert.notEqual(nextPack.slug, newest.slug, 'quote must change when the pack hero set changes')
assert.ok(!nextExclude.includes(nextPack.slug))

const pinned = HomepageStructure.pickQuote(catalog, exclude, {
  date: '2026-10-09',
  heroSlugs,
  pin: { slug: 'q-three', allowsHero: true },
})
assert.equal(pinned.slug, 'q-three')

const intendedHero = HomepageStructure.pickQuote(catalog, exclude, {
  date: '2026-10-09',
  heroSlugs,
  pin: { slug: 'hero-story', allowsHero: true },
})
assert.equal(intendedHero.slug, 'hero-story')

const rejected = warnsOf(() =>
  HomepageStructure.pickQuote(catalog, exclude, {
    date: '2026-10-09',
    heroSlugs,
    pin: { slug: 'hero-story', allowsHero: false },
  }),
)
assert.ok(rejected.lines.some((line) => line.includes('hero story') && line.includes('not shown above')))
assert.ok(!heroSlugs.includes(rejected.value.slug))
assert.ok(!exclude.includes(rejected.value.slug))

const missingPin = warnsOf(() =>
  HomepageStructure.pickQuote(catalog, exclude, {
    date: '2026-10-09',
    heroSlugs,
    pin: { slug: 'not-a-story', allowsHero: true },
  }),
)
assert.ok(missingPin.lines.some((line) => line.includes('not in the catalog')))
assert.equal(missingPin.value.slug, 'q-one')
assert.ok(!exclude.includes(missingPin.value.slug))

const unpinned = warnsOf(() => HomepageStructure.pickQuote(catalog, exclude, { heroSlugs }))
assert.deepEqual(unpinned.lines, [])
assert.equal(unpinned.value.slug, 'q-one')

const empty = warnsOf(() =>
  HomepageStructure.pickQuote(catalog, catalog.map((s) => s.slug), { date: '2026-10-09', heroSlugs }),
)
assert.equal(empty.value, null)
assert.ok(empty.lines.some((line) => line.includes('leaving the quote empty')))

const mirror = {
  quote: {
    text: 'Hero sentence.',
    source: 'Hero',
    href: '/#timeline/hero-story',
  },
}
assert.equal(HomepageStructure.quotePinFromPack(mirror, heroSlugs), null)

const named = HomepageStructure.quotePinFromPack(
  { quote: { slug: 'q-two', href: '/#timeline/q-two' } },
  heroSlugs,
)
assert.equal(named.slug, 'q-two')

const explicitHero = HomepageStructure.quotePinFromPack(
  { quote: { slug: 'hero-story', pinned: false } },
  heroSlugs,
)
assert.equal(explicitHero.allowsHero, false)

const allowedHero = HomepageStructure.quotePinFromPack(
  { quote: { slug: 'hero-story', pinned: true } },
  heroSlugs,
)
assert.equal(allowedHero.allowsHero, true)
assert.equal(HomepageStructure.editorQuotePin({}), null)
assert.deepEqual(HomepageStructure.editorQuotePin({ quote: { slug: 'q-one', pinned: true } }), {
  slug: 'q-one',
  allowsHero: true,
})

function loadCatalog() {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'public/content/stories.json'), 'utf8'))
  const photos = JSON.parse(fs.readFileSync(path.join(root, 'public/content/story-photos.json'), 'utf8'))
  const bySlug = photos.bySlug || {}
  const stories = []
  for (const row of index.stories || []) {
    if (!row?.slug) continue
    const photo = bySlug[row.slug]?.photo
    if (!photo?.image_url || !(photo.attribution || photo.source_label)) continue
    stories.push({
      slug: row.slug,
      title: row.title || '',
      era: row.era || 'other',
      publishedDate: row.publishedDate || row.briefDate || '',
      briefDate: row.briefDate || '',
      photo,
    })
  }
  return stories
}

const pack = JSON.parse(fs.readFileSync(path.join(root, 'public/content/home-preview.json'), 'utf8'))
const overrides = JSON.parse(fs.readFileSync(path.join(root, 'scripts/hero-deck-overrides.json'), 'utf8'))
const liveCatalog = loadCatalog()
assert.equal(HomepageStructure.editorQuotePin(overrides), null, '#189 and the Editor file do not name a quote')

function slugsForDate(date) {
  return liveCatalog.filter((s) => s.briefDate === date).map((s) => s.slug)
}
const dates = [...new Set(liveCatalog.map((s) => s.briefDate).filter(Boolean))].sort()
const latest = dates[dates.length - 1]
const previous = dates[dates.length - 2]
assert.ok(latest && previous)
assert.equal(pack.briefDate, latest, 'home-preview.json briefDate is behind the story catalog')
const packSlugs = (pack.stories || []).map((s) => s.slug).filter(Boolean).sort()
assert.deepEqual(packSlugs, slugsForDate(latest).sort(), 'home-preview.json is not today’s hero set')
const mirrorSlug = HomepageStructure.slugFromHref(pack.quote?.href)
assert.ok(packSlugs.includes(mirrorSlug), 'pack quote href is not one of today’s stories')
assert.equal(
  HomepageStructure.quotePinFromPack(pack, packSlugs),
  null,
  'the copied hero sentence is not a pin',
)

function quoteFor(date) {
  const heroSlugsForDay = slugsForDate(date)
  const highlights = HomepageStructure.pickHighlights(liveCatalog, heroSlugsForDay, 4)
  const exclude = [...heroSlugsForDay, ...highlights.map((s) => s.slug)]
  const picked = HomepageStructure.pickQuote(liveCatalog, exclude, { heroSlugs: heroSlugsForDay })
  assert.ok(picked?.slug, date)
  assert.ok(!exclude.includes(picked.slug), `${date} quote ${picked.slug} is already shown above`)
  return picked
}
const todayQuote = quoteFor(latest)
const previousQuote = quoteFor(previous)
assert.notEqual(
  todayQuote.slug,
  previousQuote.slug,
  `quote froze on ${todayQuote.slug} when the pack date changed from ${previous} to ${latest}`,
)
assert.notEqual(todayQuote.slug, mirrorSlug, 'quote reused the hero sentence stored in home-preview.json')
console.log(
  `homepage quote ${latest}: ${todayQuote.slug} (${todayQuote.title}); ${previous}: ${previousQuote.slug}`,
)
console.log('homepage quote checks passed')
