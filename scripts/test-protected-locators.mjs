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
import { findLocators } from './lib/protected-locators.mjs'
import { isProtectedStory } from './lib/unified-story-data.mjs'
import { loadMerges } from './lib/story-merges.mjs'
import { pickRelatedStories } from '../src/story-tools.js'

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
  for (const m of html.matchAll(/<span class="(?:usp-rel-why|related-note)">[\s\S]*?<\/span>/gi)) parts.push(m[0])
  html = html.replace(/<li class="(?:related-story|nearby-place|related-person|related-row)[^"]*">[\s\S]*?<\/li>/gi, ' ')
  // Timeline prev/next buttons carry the neighbouring stories' titles, not this site's location.
  html = html.replace(/\shref="[^"]*"/gi, ' ') // link targets (source PDFs, other stories) are not prose
  html = html.replace(/<a class="(?:usp-wf-btn|usp-pn-card)[^"]*"[\s\S]*?<\/a>/gi, ' ')
  for (const re of [/<title>[\s\S]*?<\/title>/gi, /<meta\b[^>]*>/gi, /<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, /<h1\b[\s\S]*?<\/h1>/gi, /<figcaption\b[\s\S]*?<\/figcaption>/gi, /<article\b[\s\S]*?<\/article>/gi]) {
    for (const m of html.matchAll(re)) parts.push(m[0])
  }
  return parts.join('\n')
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
  '/photos/peter-village-near-lexington.jpg',
  'part of the Mount Horeb Earthworks Complex',
  'https://en.wikipedia.org/wiki/Mount_Horeb_Earthworks_Complex',
]) assert.ok(findLocators(bad).length, `should flag: ${bad}`)
for (const ok of [
  'an early earthwork in Fayette County',
  'Peter Village (site 15Fa166)',
  'a lead ore found in the region',
  'Adena is an archaeologists’ name for a shared way of life',
]) assert.deepEqual(findLocators(ok), [], `should pass: ${ok}`)
assert.ok(findLocators('the Lexington plan', PETER).length, 'Peter Village terms apply to Peter Village')

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
  scanJson({ bySlug: { [PETER]: { photo: { title: 'Earthwork north of Lexington' } } } }, 'fixture', fx)
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

// ---------- scan ----------
const hits = scanTree(path.join(ROOT, 'public'))
if (fs.existsSync(path.join(ROOT, 'dist/content'))) {
  for (const h of scanTree(path.join(ROOT, 'dist'))) hits.push(h) // same keys as public: built copies must match
  // Page text is built from the source records, so a page hit passes only if that exact owner+match is already allowlisted from origin/v2 data.
  const storyMatches = new Set([...ALLOW].map((e) => e.split('|')).map(([, o, , m]) => `${o}|${m}`))
  for (const owner of aliasesOf.keys()) {
    const page = path.join(ROOT, 'dist/stories', owner, 'index.html')
    if (!fs.existsSync(page)) continue
    for (const h of findLocators(scrub(pageParts(fs.readFileSync(page, 'utf8')), owner), owner)) {
      if (!storyMatches.has(`${owner}|${h.match}`)) hits.push({ file: `stories/${owner}/index.html`, owner, field: 'page', match: h.match, id: h.id })
    }
  }
}
const problems = [...new Set(hits.filter((h) => !ALLOW.has(key(h))).map((h) => `${h.file} [${h.owner}] ${h.field}: ${h.id} "${h.match}"`))]
if (problems.length) {
  console.error(`test-protected-locators: ${problems.length} locator hit(s) in protected stories:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`test-protected-locators: OK (${aliasesOf.size} protected stories; ${ALLOW.size} exact pre-existing entries allowlisted with TODO)`)
