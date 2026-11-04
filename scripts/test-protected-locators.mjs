#!/usr/bin/env node
/**
 * test-protected-locators (#345 Security/SEO; generalises #351's check-protected-locators to every
 * protected story). Protected stories stay at county level in every public output:
 *   - public/content/stories/<slug>.json (title, summary, body, photo caption/credit),
 *   - content/stories.json, story-photos.json, stories-locations.json,
 *   - data/app/ky-history.json (history, subtitle, geocode_note, website, photo),
 *   - data/search-index.json (text + snippet), data/layers/history.geojson and stories.geojson,
 *   - and, when dist/ is built, the same JSON under dist/ plus each story page's title, meta,
 *     JSON-LD, h1, figure captions and body.
 * Every hit is reported per file, record and field. The story's own slugs and ids are removed first.
 *
 * Allowlist (scripts/protected-locators-allowlist.json): EXACT entries "file|owner|field|match" for
 * pre-existing text byte-identical to origin/v2 in other protected stories (TODO: protected-stories
 * cleanup PR). A new hit in an allowlisted story still fails. Peter Village can never be allowlisted.
 * Also: Peter Village must not show the neighbouring Mount Horeb story as a related card.
 *
 *   node scripts/test-protected-locators.mjs
 *   KH_LOCATOR_ROOT=/tmp/v2 node scripts/test-protected-locators.mjs --emit-allowlist   # regenerate from origin/v2
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLocators, STORY_TERMS } from './lib/protected-locators.mjs'
import { timelineNeighbor } from './lib/unified-story-data.mjs'
import { STORY_MERGES } from '../src/story-url.js'
import { pickRelatedStories, nearbyPlaces, relatedAndNearbyForStory } from '../src/story-tools.js'
import {
  ALLOW,
  aliasesOf,
  allStories,
  collectLocatorHits,
  key,
  pageHits,
  rejectUnallowlisted,
  scanAssetText,
  researchTermHits,
  scanJson,
  scanTree,
} from './lib/protected-locator-scan.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_ROOT = process.env.KH_LOCATOR_ROOT || ROOT
const PETER = 'peter-village-enclosure-15fa166'
const EMIT = process.argv.includes('--emit-allowlist')

if (EMIT) {
  const hits = scanTree(path.join(DATA_ROOT, 'public')).filter((h) => h.owner !== PETER)
  const entries = [...new Set(hits.map(key))].sort()
  const out = {
    _todo: 'TODO(protected-stories cleanup PR): pre-existing locator text in other protected stories, byte-identical to origin/v2. Exact file|owner|field|match entries; fix the text and delete the entry. Never add Peter Village.',
    entries,
  }
  fs.writeFileSync(path.join(ROOT, 'scripts/protected-locators-allowlist.json'), JSON.stringify(out, null, 1) + '\n')
  console.log(`test-protected-locators: wrote ${entries.length} allowlist entries from ${DATA_ROOT}`)
  process.exit(0)
}

// ---------- detector fixtures ----------
for (const bad of [
  'an early earthwork north of Lexington',
  'North of Lexington in Fayette County',
  'about 3 miles from Paris',
  '5 km northeast of Winchester',
  'a mound near Lexington',
  'It sits near the better-known Mount Horeb circle',
  'in the Elkhorn Creek country',
  'File:Clarks_River_in_the_fall.jpg',
  'Clarks-River',
  '/photos/example-site-near-sampletown.jpg',
  'part of the Mount Horeb Earthworks Complex',
  'https://en.wikipedia.org/wiki/Mount_Horeb_Earthworks_Complex',
  // Landforms that place a protected site below county (#351 county sweep).
  'on a broad ridgetop in Sample County',
  'the village sat on a bluff',
  'houses along the bluffs',
]) assert.ok(findLocators(bad).length, `should flag: ${bad}`)
for (const ok of [
  'an early earthwork in Fayette County',
  'Peter Village (site 15Fa166)',
  'a lead ore found in the region',
  'Adena is an archaeologists’ name for a shared way of life',
  // A bare "ridge" is not a landform term: it is the site's own name (Sassafras Ridge).
  'Sassafras Ridge (15Fu3) is in Fulton County',
]) assert.deepEqual(findLocators(ok), [], `should pass: ${ok}`)
// Fixtures never pair a real protected site with a real town; the term comes from the pattern list.
assert.ok(findLocators(`the ${STORY_TERMS[PETER][0]} plan`, PETER).length, 'Peter Village terms apply to Peter Village')
// Bare "Portsmouth" is not a generic pattern. It fails only as an Old Fort term, and that hit is not allowlisted.
const OLD_FORT = 'old-fort-earthworks-15gp1-greenup-county'
assert.deepEqual(findLocators('A square earthwork in Greenup County. Portsmouth.'), [], 'bare Portsmouth is not a generic pattern')
assert.ok(findLocators('A square earthwork in Greenup County. Portsmouth.', OLD_FORT).some((h) => h.match === 'Portsmouth'), 'bare Portsmouth is an Old Fort term')
for (const phrase of ['Portsmouth Group', 'Portsmouth_Group', 'Portsmouth-Group']) {
  const hits = findLocators(`part of the ${phrase}.`, OLD_FORT)
  assert.ok(hits.some((h) => h.id === 'term:Portsmouth Group'), `${phrase} is an Old Fort term`)
  const planted = []
  scanJson({ slug: 'culture-hopewell-image-evidence', storySlug: OLD_FORT, summary: `part of the ${phrase}` }, 'content/research/culture-hopewell-image-evidence.json', planted)
  assert.equal(planted.length, 0, 'a culture-page slug alone is not the protected story')
  const tied = researchTermHits({ slug: 'culture-hopewell-image-evidence', storySlug: OLD_FORT, summary: `part of the ${phrase}` }, 'content/research/culture-hopewell-image-evidence.json')
  assert.ok(tied.some((h) => h.id === 'term:Portsmouth Group'), `${phrase} on a culture page tied by storySlug fails`)
  assert.ok(tied.every((h) => !ALLOW.has(key(h))), `${phrase} on a culture page is not allowlisted`)
}
{
  const planted = []
  scanJson({ slug: OLD_FORT, summary: 'A square earthwork in Greenup County. Portsmouth.' }, `content/stories/${OLD_FORT}.json`, planted)
  const bare = planted.filter((h) => h.match === 'Portsmouth')
  assert.equal(bare.length, 1)
  assert.ok(!ALLOW.has(key(bare[0])), 'planted bare Portsmouth is not allowlisted')
}
// #348: a full stop ends a name. Fictional plant: two adjacent sentences give two separate matches (each
// exact-allowlistable), never one joined match; abbreviations (St.) and initials (J.R.) still join a name.
{
  const plant = 'builders raised part of the Sampleton Earthworks. Demo Fort Earthworks (site 15Xx1) is square.'
  const got = findLocators(plant).map((h) => h.match)
  assert.ok(!got.includes('Sampleton Earthworks. Demo Fort Earthworks'), 'joined concat must not match as one name')
  assert.deepEqual(got, ['Sampleton Earthworks', 'Demo Fort Earthworks'], 'sentence break splits earthworks names')
  assert.deepEqual(findLocators('the Sample Creek. Demo River camp').map((h) => h.match), ['Sample Creek', 'Demo River'])
  assert.ok(findLocators('the St. Sample River camp').some((h) => h.match === 'St. Sample River'), 'St. still joins a name')
  assert.ok(findLocators('the J.R. Demo Earthworks').some((h) => h.match === 'J.R. Demo Earthworks'), 'initials still join a name')
}

// ---------- detector stays linear: 40k capitalised words in well under a second ----------
{
  const long = Array.from({ length: 40000 }, (_, i) => (i % 2 ? 'Big' : 'Old_Hill')).join(' ')
  const t0 = performance.now(); findLocators(long); findLocators(long.replace(/ /g, '_'))
  const ms = performance.now() - t0
  assert.ok(ms < 1000, `findLocators took ${ms.toFixed(0)} ms on 40k words`)
}

// ---------- allowlist is exact: a new term in an allowlisted story still fails ----------
assert.ok(![...ALLOW].some((e) => e.split('|')[1] === PETER || e.includes('peter-village')), 'Peter Village may not be allowlisted')
// SEO (Oct 24): these locator phrases are emptied from the allowlist. A hit must fail the build.
const FORBIDDEN_ALLOW = [
  'west of Bardwell',
  'west of Nicholasville',
  'nearby Nicholasville',
  'near Nicholasville',
  'north of Lexington',
  'near Eriline',
  'Levisa Fork',
  'at Paintsville',
  'Jessamine Creek',
  'Strodes Creek',
  'Near Paris',
  'southeast of Twin',
]
for (const entry of ALLOW) {
  const match = entry.split('|').slice(3).join('|')
  for (const phrase of FORBIDDEN_ALLOW) {
    assert.ok(!match.includes(phrase), `allowlist must not keep ${JSON.stringify(phrase)} (${entry})`)
  }
}
{
  const sample = [...ALLOW][0]
  if (sample) {
    const [file, owner, field] = sample.split('|')
    const fake = { file, owner, field, match: 'near Faketown' }
    assert.ok(!ALLOW.has(key(fake)), 'a new term in an allowlisted story/field must not be allowed')
  }
  const fx = []
  scanJson({ bySlug: { [PETER]: { photo: { title: 'Earthwork north of Sampletown' } } } }, 'fixture', fx)
  assert.ok(fx.length >= 1 && fx.every((h) => !ALLOW.has(key(h))), 'Peter Village fixture hit is reported and never allowed')
}

// Timeline prev/next must skip the same reference sites. A chronological neighbor is still a public link.
{
  const ordered = [
    { slug: 'older-story' },
    { slug: 'mount-horeb-earthworks' },
    { slug: 'peter-village-enclosure-15fa166' },
    { slug: 'later-story' },
  ]
  assert.equal(timelineNeighbor(ordered, 2, -1, 'peter-village-enclosure-15fa166').slug, 'older-story')
  assert.equal(timelineNeighbor(ordered, 2, 1, 'peter-village-enclosure-15fa166').slug, 'later-story')
  assert.equal(timelineNeighbor(ordered, 1, 1, 'mount-horeb-earthworks').slug, 'peter-village-enclosure-15fa166')
  assert.equal(timelineNeighbor(ordered, 0, -1, 'older-story'), null)
}

// ---------- related cards: Peter Village never points at the neighbouring Mount Horeb site ----------
const related = pickRelatedStories(allStories.find((s) => s.slug === PETER), allStories).map((s) => s.slug)
assert.ok(!related.includes('mount-horeb-earthworks'), `Peter Village related cards include mount-horeb-earthworks: ${related.join(', ')}`)
const relatedPeople = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/web/related-people.json'), 'utf8'))
assert.ok(!JSON.stringify(relatedPeople).match(new RegExp(`"${PETER}":\\s*\\[[^\\]]*mount-horeb-earthworks`)), 'related-people.json gives Peter Village a Mount Horeb card')
const peterPage = path.join(ROOT, 'dist/stories', PETER, 'index.html')
if (fs.existsSync(peterPage)) {
  assert.ok(!fs.readFileSync(peterPage, 'utf8').includes('/stories/mount-horeb-earthworks/'), 'Peter Village page links Mount Horeb')
}
// #346 (KY History/SEO): protected sites never point at a well-known reference site that places them.
for (const [site, ref] of [
  ['twin-mounds-site', 'wickliffe-mounds-mississippian-village-ballard-county'],
  ['dover-mound-mason-county', 'mount-horeb-earthworks'],
]) {
  const s = allStories.find((x) => x.slug === site)
  if (!s) continue
  const rel = pickRelatedStories(s, allStories).map((x) => x.slug)
  assert.ok(!rel.includes(ref), `${site} related cards include reference site ${ref}`)
  const page = path.join(ROOT, 'dist/stories', site, 'index.html')
  if (fs.existsSync(page)) assert.ok(!fs.readFileSync(page, 'utf8').includes(`/stories/${ref}/`), `${site} page links ${ref}`)
}

// ---------- built pages: a hit passes only on an exact file|owner|page:<label>|match entry ----------
{
  // An allowlisted body string (Adams Site bodyMarkdown, origin/v2) planted in <title> or in alt text
  // outside <article> is a new page hit and must fail.
  const body = [...ALLOW].map((e) => e.split('|')).find((parts) => parts[2] === 'bodyMarkdown')
  assert.ok(body, 'fixture needs an allowlisted bodyMarkdown entry')
  const owner = body[1]
  const term = body.slice(3).join('|')
  for (const html of [`<title>Planted by ${term}</title>`, `<header><img src="x.webp" alt="View by ${term}"></header><article><p>ok</p></article>`]) {
    const bad = pageHits(html, owner).filter((h) => !ALLOW.has(key(h)))
    assert.ok(bad.length >= 1, `planted allowlisted body text must fail on the page: ${html}`)
  }
  const figure = `<article><img src="/figures/culture-green-river-archaic.jpg" srcset="/figures/culture-green-river-archaic.webp" alt="Ohio County"></article>`
  assert.ok(!pageHits(figure, 'indian-knoll-ohio-county').length, 'a figure path is not prose')
  const folded = `<article><p>In Greenup County.</p><details id="research-notes"><p>Portsmouth Earthworks, Group A.</p><details><p>nested</p></details></details><p>still public</p></article>`
  assert.ok(pageHits(folded, 'old-fort-earthworks-15gp1-greenup-county').some((h) => /Portsmouth/.test(h.match)), 'folded research notes are public prose')
}

// ---------- nearby cards and Kentucky today on protected pages (fictional fixtures only) ----------
// Security 10/24: plants never pair a real protected site with a real town or river.
{
  const FAKE = 'example-site-15xx999'
  const plant = `<section><ul><li class="nearby-place"><a href="/stories/sampletown-first-seat/">Sampletown: first seat on the Sample River</a><span class="nearby-miles">4 mi</span></li></ul></section>`
  assert.ok(pageHits(plant, FAKE).some((h) => h.field === 'page:nearby-card'), 'planted nearby card on a protected page must fail')
  const plant2 = `<ul><li class="related-story"><a class="related-card" href="/stories/sampletown/">Sampletown: first seat on the Sample River<span class="related-note">Nearby: 8.4 miles</span></a></li></ul>`
  assert.ok(pageHits(plant2, FAKE).some((h) => h.field === 'page:nearby-card'), 'planted distance-picked related card on a protected page must fail')
  const okCard = `<ul><li class="related-story"><a class="related-card" href="/stories/x/">A Sample County story<span class="related-note">Same county (Sample County)</span></a></li></ul>`
  assert.ok(!pageHits(okCard, FAKE).length, 'a same-county related card with no distance passes')
  const today = `<section class="usp-section usp-today" id="today"><h2 id="h-today">Kentucky today</h2><div class="usp-prose"><p>Visitors can see earthworks at <a href="/stories/x/">Sampleville</a> and the Example Earthworks near Sampletown.</p></div></section>`
  assert.ok(pageHits(today, FAKE).some((h) => h.field === 'page:today'), 'planted "near Sampletown" in a protected Kentucky today box must fail')

  // Builder: a fictional protected story at a fictional point shows no nearby cards and only same-county related cards.
  const site = { slug: FAKE, title: 'Example Site 15XX999', county: 'Sample', era: 'prehistoric', tags: ['archaeology'], coordinatesProtected: true, lat: 37.5, lon: -85.5 }
  const pool = [
    { slug: 'sample-county-story', title: 'A Sample County story', county: 'Sample', tags: ['frontier'], lat: 37.51, lon: -85.5 },
    // #346: a public archaeological site in the same county is a reference site; it must not be carded.
    { slug: 'sample-reference-mounds', title: 'Sample Reference Mounds', county: 'Sample', tags: ['archaeology'], lat: 37.505, lon: -85.5 },
    { slug: 'sampletown-story', title: 'Sampletown on the Sample River', county: 'Other', tags: ['archaeology'], lat: 37.52, lon: -85.5 },
    { slug: 'sampleville-story', title: 'Sampleville', county: 'Other', tags: [], lat: 37.53, lon: -85.5 },
    { slug: 'samplefield-story', title: 'Samplefield', county: 'Other', tags: [], lat: 37.54, lon: -85.5 },
  ]
  const markers = [0, 1, 2, 3].map((i) => ({ id: `m${i}`, title: `Sample marker ${i}`, lat: 37.5 + 0.01 * i, lon: -85.5 }))
  const prot = (s) => s.slug === FAKE
  const rel = pickRelatedStories(site, [site, ...pool], [], { isProtected: prot })
  assert.deepEqual(rel.map((s) => s.slug), ['sample-county-story'], `protected related cards must be same-county only: ${rel.map((s) => s.slug).join(', ')}`)
  const html = relatedAndNearbyForStory(site, [site, ...pool], markers, { limit: 3, isProtected: prot })
  assert.ok(!/class="nearby-place/.test(html), 'relatedAndNearbyForStory must omit nearby cards for a protected story')
  assert.ok(!/nearby-miles|Sampletown/.test(html), 'protected story shows no nearby distances or other-county towns')
  // #346 (Critiquito): a public story never cards a protected site with a distance.
  const pub = { slug: 'sample-public-story', title: 'Sample Public Story', county: 'Other', tags: [], lat: 37.5, lon: -85.51 }
  const near = nearbyPlaces(pub, [pub, site, ...pool], markers, { limit: 3, isProtected: prot })
  assert.ok(!near.some((r) => r.slug === FAKE), 'nearbyPlaces must never return a protected site')
  const pubHtml = relatedAndNearbyForStory(pub, [pub, site, ...pool], markers, { limit: 3, isProtected: prot })
  assert.ok(!pubHtml.includes(`/stories/${FAKE}/`), 'a public story page never cards a protected site in Related and nearby')
  const control = relatedAndNearbyForStory({ ...site, slug: 'unprotected-fixture', coordinatesProtected: false }, [site, ...pool], markers, { limit: 3, isProtected: () => false })
  assert.ok(/class="nearby-place/.test(control), 'control: an unprotected story with markers shows nearby cards')
}

// ---------- shipped JS bundles: no protected-site alias slug that itself carries a locator ----------
assert.ok(scanAssetText('const m={"peter-village-early-woodland-enclosure-near-lexington":"x"}', 'planted.js').length, 'planted old slug in a bundle must fail')
assert.ok(!Object.keys(STORY_MERGES).some((s) => [...aliasesOf.values()].some((a) => a.includes(s) && findLocators(s).length)), 'src/story-url.js ships a protected locator slug')
if (process.argv.includes('--emit-page-hits')) {
  // Prints current page hits; scripts/emit-page-allowlist keeps only text byte-identical on origin/v2.
  const hits = collectLocatorHits()
  console.log(JSON.stringify(hits.filter((h) => h.field.startsWith('page:')).map(key)))
  process.exit(0)
}
const problems = [...new Set(rejectUnallowlisted(collectLocatorHits()).map((h) => `${h.file} [${h.owner}] ${h.field}: ${h.id} "${h.match}"`))]
if (problems.length) {
  console.error(`test-protected-locators: ${problems.length} locator hit(s) in protected stories:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`test-protected-locators: OK (${aliasesOf.size} protected stories; ${ALLOW.size} exact pre-existing entries allowlisted with TODO)`)
