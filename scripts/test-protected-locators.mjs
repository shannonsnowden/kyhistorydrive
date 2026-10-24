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
import { isProtectedStory } from './lib/unified-story-data.mjs'
import { loadMerges } from './lib/story-merges.mjs'
import { STORY_MERGES } from '../src/story-url.js'
import { pickRelatedStories, relatedAndNearbyForStory } from '../src/story-tools.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_ROOT = process.env.KH_LOCATOR_ROOT || ROOT
const PETER = 'peter-village-enclosure-15fa166'
const EMIT = process.argv.includes('--emit-allowlist')

// ---------- owners: every protected story, with its slug, historyId and retired merged slugs ----------
const storyDir = path.join(ROOT, 'public/content/stories')
const alias = new Map() // any id -> owner slug
const aliasesOf = new Map() // owner -> [ids]
const add = (owner, id) => {
  if (!id) return
  alias.set(String(id), owner)
  aliasesOf.set(owner, [...new Set([...(aliasesOf.get(owner) || []), String(id)])])
}
const allStories = []
for (const f of fs.readdirSync(storyDir).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(storyDir, f), 'utf8'))
  allStories.push(s)
  if (!isProtectedStory(s)) continue
  add(s.slug, s.slug)
  add(s.slug, s.historyId)
  add(s.slug, s.id)
}
for (const { retired, kept } of loadMerges(ROOT)) if (alias.has(kept)) add(alias.get(kept), retired)
// Map place records: historyIds live in story-overrides.json and stories-locations.json.
const overrides = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/story-overrides.json'), 'utf8'))
const locs = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/content/stories-locations.json'), 'utf8'))
const walkIds = (o) => {
  if (!o || typeof o !== 'object') return
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && alias.has(k) && v.historyId) add(alias.get(k), v.historyId)
    else walkIds(v)
  }
}
walkIds(overrides)
walkIds(locs)
const ownerOf = (v) => alias.get(String(v || '').replace(/^(place|story|history|marker):/, ''))

function scrub(text, owner) {
  let s = String(text)
  for (const id of [...(aliasesOf.get(owner) || [])].sort((a, b) => b.length - a.length)) s = s.split(id).join(' ')
  return s
}

// ---------- scanning ----------
/** hits: { file, owner, field, match, id } */
export function scanJson(data, file, hits) {
  const report = (owner, field, text) => {
    for (const h of findLocators(scrub(text, owner), owner)) hits.push({ file, owner, field, match: h.match, id: h.id })
  }
  const strings = (o, field, owner) => {
    if (typeof o === 'string') return report(owner, field, o)
    if (Array.isArray(o)) return o.forEach((v) => strings(v, `${field}[]`, owner))
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) strings(v, field ? `${field}.${k}` : k, owner)
  }
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk)
    if (!o || typeof o !== 'object') return
    let owner = null
    for (const f of ['slug', 'id', 'historyId', 'shareId']) if (typeof o[f] === 'string' && ownerOf(o[f])) owner = ownerOf(o[f])
    if (!owner && o.properties && typeof o.properties.id === 'string' && ownerOf(o.properties.id)) owner = ownerOf(o.properties.id)
    if (owner) return strings(o, '', owner)
    for (const [k, v] of Object.entries(o)) {
      const keyed = ownerOf(k)
      if (keyed) strings(v, '', keyed)
      else walk(v)
    }
  }
  walk(data)
}

const JSON_FILES = [
  'content/stories.json',
  'content/story-photos.json',
  'content/stories-locations.json',
  'data/app/ky-history.json',
  'data/search-index.json',
  'data/layers/history.geojson',
  'data/layers/stories.geojson',
  'data/web/related-people.json',
]

function pageParts(html) {
  const parts = []
  // Related-card notes are scanned; the other stories' own titles and links in those cards are not.
  for (const m of html.matchAll(/<span class="(?:usp-rel-why|related-note)">[\s\S]*?<\/span>/gi)) parts.push(['note', m[0]])
  // #345: a protected page shows no nearby cards at all; their titles name nearby towns and rivers.
  for (const m of html.matchAll(/<li class="nearby-place[^"]*">[\s\S]*?<\/li>/gi)) parts.push(['nearby-card', m[0]])
  // Related-story cards on a protected page: same county only, never a distance ("Nearby: 8.4 miles").
  for (const m of html.matchAll(/<li class="related-story[^"]*">[\s\S]*?<\/li>/gi)) {
    if (/\bmiles?\b|\bNearby:/i.test(m[0].replace(/<[^>]+>/g, ' '))) parts.push(['nearby-card', m[0]])
  }
  html = html.replace(/<li class="(?:related-story|nearby-place|related-person|related-row)[^"]*">[\s\S]*?<\/li>/gi, ' ')
  html = html.replace(/\shref="[^"]*"/gi, ' ') // link targets (source PDFs, other stories) are not prose
  // Timeline prev/next buttons carry the neighbouring stories' titles, not this site's location.
  html = html.replace(/<a class="(?:usp-wf-btn|usp-pn-card)[^"]*"[\s\S]*?<\/a>/gi, ' ')
  // Kentucky today box (protected pages named nearby towns and earthworks there; Editor 10/24).
  for (const m of html.matchAll(/<section\b[^>]*\bid="today"[\s\S]*?<\/section>/gi)) parts.push(['today', m[0]])
  const labelled = [['title', /<title>[\s\S]*?<\/title>/gi], ['meta', /<meta\b[^>]*>/gi], ['ld', /<script type="application\/ld\+json">[\s\S]*?<\/script>/gi], ['h1', /<h1\b[\s\S]*?<\/h1>/gi], ['figcaption', /<figcaption\b[\s\S]*?<\/figcaption>/gi], ['article', /<article\b[\s\S]*?<\/article>/gi]]
  for (const [label, re] of labelled) for (const m of html.matchAll(re)) parts.push([label, m[0]])
  // Image alt text anywhere on the page (outside <article> too).
  const outside = html.replace(/<article\b[\s\S]*?<\/article>/gi, ' ')
  for (const m of outside.matchAll(/\salt="([^"]*)"/gi)) parts.push(['img-alt', m[1]])
  return parts
}

function scanTree(base) {
  const hits = []
  const owners = [...aliasesOf.keys()]
  for (const owner of owners) {
    for (const slug of aliasesOf.get(owner)) {
      const f = path.join(base, 'content/stories', `${slug}.json`)
      if (fs.existsSync(f)) scanJson(JSON.parse(fs.readFileSync(f, 'utf8')), `content/stories/${slug}.json`, hits)
    }
  }
  for (const rel of JSON_FILES) {
    const f = path.join(base, rel)
    if (fs.existsSync(f)) scanJson(JSON.parse(fs.readFileSync(f, 'utf8')), rel, hits)
  }
  return hits
}

const key = (h) => `${h.file}|${h.owner}|${h.field}|${h.match}`

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
]) assert.ok(findLocators(bad).length, `should flag: ${bad}`)
for (const ok of [
  'an early earthwork in Fayette County',
  'Peter Village (site 15Fa166)',
  'a lead ore found in the region',
  'Adena is an archaeologists’ name for a shared way of life',
]) assert.deepEqual(findLocators(ok), [], `should pass: ${ok}`)
// Fixtures never pair a real protected site with a real town; the term comes from the pattern list.
assert.ok(findLocators(`the ${STORY_TERMS[PETER][0]} plan`, PETER).length, 'Peter Village terms apply to Peter Village')

// ---------- detector stays linear: 40k capitalised words in well under a second ----------
{
  const long = Array.from({ length: 40000 }, (_, i) => (i % 2 ? 'Big' : 'Old_Hill')).join(' ')
  const t0 = performance.now(); findLocators(long); findLocators(long.replace(/ /g, '_'))
  const ms = performance.now() - t0
  assert.ok(ms < 1000, `findLocators took ${ms.toFixed(0)} ms on 40k words`)
}

// ---------- allowlist is exact: a new term in an allowlisted story still fails ----------
const allowFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/protected-locators-allowlist.json'), 'utf8'))
const ALLOW = new Set([...(allowFile.entries || []), ...(allowFile.derived || []), ...(allowFile.page || [])])
assert.ok(![...ALLOW].some((e) => e.split('|')[1] === PETER || e.includes('peter-village')), 'Peter Village may not be allowlisted')
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
function pageHits(html, owner) {
  const out = []
  for (const [label, text] of pageParts(html)) {
    if (label === 'nearby-card') {
      const title = (text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'nearby card').slice(0, 80)
      out.push({ file: `stories/${owner}/index.html`, owner, field: 'page:nearby-card', match: title, id: 'nearby-card' })
      continue
    }
    for (const h of findLocators(scrub(text, owner), owner)) out.push({ file: `stories/${owner}/index.html`, owner, field: `page:${label}`, match: h.match, id: h.id })
  }
  return out
}
{
  // An allowlisted body string (Adams Site bodyMarkdown, origin/v2) planted in <title> or in alt text
  // outside <article> is a new page hit and must fail.
  const ADAMS = 'adams-site-15fu4'
  const body = [...ALLOW].map((e) => e.split('|')).find(([f, o, fld]) => f === `content/stories/${ADAMS}.json` && o === ADAMS && fld === 'bodyMarkdown')
  assert.ok(body, 'fixture needs an allowlisted adams-site-15fu4 bodyMarkdown entry')
  const term = body[3]
  for (const html of [`<title>Adams Site by ${term}</title>`, `<header><img src="x.webp" alt="View by ${term}"></header><article><p>ok</p></article>`]) {
    const bad = pageHits(html, ADAMS).filter((h) => !ALLOW.has(key(h)))
    assert.ok(bad.length >= 1, `planted allowlisted body text must fail on the page: ${html}`)
  }
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
  const control = relatedAndNearbyForStory({ ...site, slug: 'unprotected-fixture', coordinatesProtected: false }, [site, ...pool], markers, { limit: 3, isProtected: () => false })
  assert.ok(/class="nearby-place/.test(control), 'control: an unprotected story with markers shows nearby cards')
}

// ---------- scan ----------
const hits = scanTree(path.join(ROOT, 'public'))
if (fs.existsSync(path.join(ROOT, 'dist/content'))) {
  for (const h of scanTree(path.join(ROOT, 'dist'))) hits.push(h) // same keys as public: built copies must match
  for (const owner of aliasesOf.keys()) {
    const page = path.join(ROOT, 'dist/stories', owner, 'index.html')
    if (fs.existsSync(page)) hits.push(...pageHits(fs.readFileSync(page, 'utf8'), owner))
  }
}
// ---------- shipped JS bundles: no protected-site alias slug that itself carries a locator ----------
const RETIRED = new Set(loadMerges().map((m) => m.retired))
function scanAssetText(text, file) {
  const out = []
  for (const [owner, slugs] of aliasesOf) for (const slug of slugs) {
    // Retired (merged) slugs only: live canonical slugs are the public URLs themselves.
    if (RETIRED.has(slug) && findLocators(slug, owner).length && text.includes(slug)) out.push({ file, owner, field: 'bundle', match: slug, id: 'alias-slug' })
  }
  return out
}
assert.ok(scanAssetText('const m={"peter-village-early-woodland-enclosure-near-lexington":"x"}', 'planted.js').length, 'planted old slug in a bundle must fail')
assert.ok(!Object.keys(STORY_MERGES).some((s) => [...aliasesOf.values()].some((a) => a.includes(s) && findLocators(s).length)), 'src/story-url.js ships a protected locator slug')
const assetsDir = path.join(ROOT, 'dist/assets')
if (fs.existsSync(assetsDir)) {
  for (const f of fs.readdirSync(assetsDir).filter((n) => n.endsWith('.js'))) hits.push(...scanAssetText(fs.readFileSync(path.join(assetsDir, f), 'utf8'), `assets/${f}`))
}
if (process.argv.includes('--emit-page-hits')) {
  // Prints current page hits; scripts/emit-page-allowlist keeps only text byte-identical on origin/v2.
  console.log(JSON.stringify(hits.filter((h) => h.field.startsWith('page:')).map(key)))
  process.exit(0)
}
const problems = [...new Set(hits.filter((h) => !ALLOW.has(key(h))).map((h) => `${h.file} [${h.owner}] ${h.field}: ${h.id} "${h.match}"`))]
if (problems.length) {
  console.error(`test-protected-locators: ${problems.length} locator hit(s) in protected stories:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`test-protected-locators: OK (${aliasesOf.size} protected stories; ${ALLOW.size} exact pre-existing entries allowlisted with TODO)`)
