#!/usr/bin/env node
/**
 * Homepage quote: pinned when the pack or Editor names one, otherwise rotated
 * by the pack date among stories that are not in the hero or Highlights.
 * Fails if the quote freezes on the same story when the pack date changes.
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

function addDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + 86400000
  return new Date(t).toISOString().slice(0, 10)
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

const dayA = HomepageStructure.pickQuote(catalog, exclude, { date: '2026-10-09', heroSlugs })
const dayB = HomepageStructure.pickQuote(catalog, exclude, { date: '2026-10-10', heroSlugs })
assert.ok(dayA?.slug && dayB?.slug)
assert.notEqual(dayA.slug, dayB.slug, 'quote must change when the pack date changes')
for (const picked of [dayA, dayB]) {
  assert.ok(!exclude.includes(picked.slug), `${picked.slug} is in the hero or Highlights`)
}

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
assert.ok(rejected.lines.some((line) => line.includes('hero story') && line.includes('rotating')))
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
assert.ok(!exclude.includes(missingPin.value.slug))

const noDate = warnsOf(() => HomepageStructure.pickQuote(catalog, exclude, { heroSlugs }))
assert.ok(noDate.lines.some((line) => line.includes('no pack date')))
assert.ok(!exclude.includes(noDate.value.slug))

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
const liveHero = (pack.stories || []).map((s) => s.slug).filter(Boolean)
const liveCatalog = loadCatalog()
const liveHighlights = HomepageStructure.pickHighlights(liveCatalog, liveHero, 4)
const liveExclude = [...liveHero, ...liveHighlights.map((s) => s.slug)]
const livePin = HomepageStructure.quotePinFromPack(pack, liveHero)
assert.equal(livePin, null, 'today’s pack quote is the hero mirror, not an Editor pin')
const liveToday = HomepageStructure.pickQuote(liveCatalog, liveExclude, {
  date: pack.briefDate,
  heroSlugs: liveHero,
  pin: livePin,
})
const liveNext = HomepageStructure.pickQuote(liveCatalog, liveExclude, {
  date: addDay(pack.briefDate),
  heroSlugs: liveHero,
  pin: livePin,
})
assert.ok(liveToday?.slug && liveNext?.slug)
assert.notEqual(
  liveToday.slug,
  liveNext.slug,
  `quote froze on ${liveToday.slug} when the pack date changed`,
)
const used = new Set(liveExclude)
for (const picked of [liveToday, liveNext]) {
  assert.ok(!used.has(picked.slug), `${picked.slug} is in the hero or Highlights`)
}
console.log(
  `homepage quote ${pack.briefDate}: ${liveToday.slug} (${liveToday.title}); next day: ${liveNext.slug}`,
)
console.log('homepage quote checks passed')
