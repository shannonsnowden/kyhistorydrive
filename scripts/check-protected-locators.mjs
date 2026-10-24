#!/usr/bin/env node
/**
 * Item 105: protected stories stay at county level in every public output.
 *
 * Each protected story below has a list of locating terms (towns, rivers,
 * creeks, landforms, named earthworks complexes, neighboring sites, roads,
 * directions). Site numbers (15xx) are allowed. The check scans:
 *   - the story JSON (title, summary, body, photo caption/credit),
 *   - public/content/stories.json, story-photos.json, stories-locations.json,
 *   - public/data/app/ky-history.json (history, subtitle, geocode_note, photo),
 *   - public/data/search-index.json, public/data/app/search-index.json
 *     (search-term keys that point at the story count too),
 *   - public/data/layers/stories.geojson and history.geojson,
 *   - public/content/research/<slug>.json (research notes),
 *   - and, when dist/ exists, the same JSON under dist/ plus each story page's
 *     <title>, meta tags, JSON-LD, h1, summary, body and figure captions.
 * Spaces in a term match any run of whitespace, "_" or "-" (Clarks_River).
 * The story's own slug and its photo file path are removed before matching,
 * because slugs are permanent URLs. Only the URLs in ALLOW_URLS are exempt.
 *
 *   node scripts/check-protected-locators.mjs             # sources + dist if built
 *   node scripts/check-protected-locators.mjs --self-test # detector self-test
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const ITEMS = [
  {
    name: 'Muir',
    slugs: ['muir-site-early-fort-ancient-on-a-jessamine-ridge'],
    ids: ['muir-site-15js86-jessamine-county'],
    terms: ['Nicholasville', 'Bypass', 'ridge', 'upland', 'Jessamine Creek', 'Lexington', 'Main Street', 'west of', 'east of'],
  },
  {
    name: 'Peter Village',
    slugs: ['peter-village-early-woodland-enclosure-near-lexington', 'peter-village-enclosure-15fa166'],
    ids: ['peter-village-enclosure-15fa166-fayette-county'],
    terms: ['Lexington', 'Mount Horeb', 'Horeb', 'Earthworks Complex', 'Adena Park', 'Elkhorn', 'creek', 'north of', 'near the'],
  },
  {
    name: 'Read Shell Midden',
    slugs: ['read-shell-midden-15bt10-butler-county'],
    ids: ['read-shell-midden-15bt10'],
    terms: ['Morgantown', 'Green River', 'Big Bend', 'river', 'shoal', 'Indian Knoll', 'Carlston Annis', 'Ward', 'west of'],
  },
  {
    name: 'Turk',
    slugs: ['turk-site-carlisle-county'],
    ids: ['turk-site-15ce6-carlisle-county'],
    terms: ['Bardwell', 'bluff', 'bluffs', 'spur', 'Mississippi(?!an)', 'floodplain', 'Wickliffe', 'mouth of the Ohio', 'west of', 'downriver'],
  },
  {
    name: 'Chambers',
    slugs: ['chambers-site-15ml109-marshall-county'],
    ids: ['chambers-site-15ml109-marshall-1250-1350'],
    terms: ['Clarks River', 'Middle Fork', 'southwest', 'southwestern', 'ridgetop', 'Wildlife Refuge', 'borrow pit', 'bridge replacement', 'minor tributary'],
  },
]

/** Required credit URLs that may keep a term. Keep this list specific. */
export const ALLOW_URLS = []

export function termRegex(term) {
  const src = term.replace(/ /g, '[\\s_-]+')
  return new RegExp(`(?<![A-Za-z])${src}(?![A-Za-z])`, 'i')
}

function scrub(text, item) {
  let s = String(text)
  for (const u of ALLOW_URLS) s = s.split(u).join(' ')
  for (const slug of item.slugs) s = s.split(slug).join(' ')
  return s
}

export function hitsIn(text, item) {
  const s = scrub(text, item)
  return item.terms.filter((t) => termRegex(t).test(s))
}

function strings(o, out = []) {
  if (typeof o === 'string') out.push(o)
  else if (Array.isArray(o)) for (const v of o) strings(v, out)
  else if (o && typeof o === 'object') for (const v of Object.values(o)) strings(v, out)
  return out
}

const KEYS = new Set([...ITEMS.flatMap((i) => [...i.slugs, ...i.ids])])
function itemFor(value) {
  const v = String(value || '').replace(/^(place|story|history):/, '')
  return ITEMS.find((i) => i.slugs.includes(v) || i.ids.includes(v))
}

/** Find objects that belong to a protected story and report locating terms. */
export function scanJson(data, file, problems) {
  const walk = (o, where) => {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${where}[${i}]`))
    if (!o || typeof o !== 'object') return
    let owner = null
    for (const f of ['slug', 'id', 'historyId', 'shareId']) if (typeof o[f] === 'string' && itemFor(o[f])) owner = itemFor(o[f])
    if (owner) {
      for (const s of strings(o)) {
        const h = hitsIn(s, owner)
        if (h.length) problems.push(`${file} ${where} (${owner.name}): ${h.join(', ')} in "${s.slice(0, 120)}"`)
      }
      return
    }
    for (const [k, v] of Object.entries(o)) {
      const keyed = itemFor(k)
      if (keyed) {
        for (const s of strings(v)) {
          const h = hitsIn(s, keyed)
          if (h.length) problems.push(`${file} ${where}.${k} (${keyed.name}): ${h.join(', ')} in "${s.slice(0, 120)}"`)
        }
        continue
      }
      // Search-term maps: { term: { hits: [ids] } } or { term: [ids] }
      const ids = strings(v).filter((s) => itemFor(s))
      if (ids.length && typeof v === 'object' && !(v && (v.slug || v.id))) {
        for (const id of ids) {
          const it = itemFor(id)
          const h = hitsIn(k, it)
          if (h.length) problems.push(`${file} ${where} term key "${k}" points at ${id}: ${h.join(', ')}`)
        }
      }
      walk(v, `${where}.${k}`)
    }
  }
  walk(data, '$')
}

const JSON_FILES = [
  'content/stories.json',
  'content/story-photos.json',
  'content/stories-locations.json',
  'data/app/ky-history.json',
  'data/search-index.json',
  'data/app/search-index.json',
  'data/layers/stories.geojson',
  'data/layers/history.geojson',
  // Related-card notes ("Same place: ...") keyed by story slug, plus cards pointing at a protected slug.
  'data/web/related-people.json',
]

function pageParts(html) {
  const parts = []
  const grab = (re) => {
    for (const m of html.matchAll(re)) parts.push(m[0])
  }
  grab(/<title>[\s\S]*?<\/title>/gi)
  grab(/<meta\b[^>]*>/gi)
  grab(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi)
  grab(/<h1\b[\s\S]*?<\/h1>/gi)
  // Related-card notes on the built page.
  grab(/<span class="related-note">[^<]*<\/span>/gi)
  grab(/<span class="related-card-meta">[^<]*<\/span>/gi)
  grab(/<figcaption\b[\s\S]*?<\/figcaption>/gi)
  grab(/<p class="story-summary">[\s\S]*?<\/p>/gi)
  const body = html.match(/<div class="story-body">([\s\S]*?)<\/div>\s*(?:<section|<nav|<aside|<footer|<div class="story-)/i)
  if (body) parts.push(body[1])
  return parts.join('\n')
}

export function runAll() {
  const problems = []
  const roots = [path.join(ROOT, 'public')]
  if (fs.existsSync(path.join(ROOT, 'dist/content'))) roots.push(path.join(ROOT, 'dist'))
  for (const base of roots) {
    const tag = path.relative(ROOT, base)
    for (const it of ITEMS) {
      for (const slug of it.slugs) {
        const f = path.join(base, 'content/stories', `${slug}.json`)
        if (!fs.existsSync(f)) continue
        scanJson(JSON.parse(fs.readFileSync(f, 'utf8')), `${tag}/content/stories/${slug}.json`, problems)
        const rf = path.join(base, 'content/research', `${slug}.json`)
        if (fs.existsSync(rf)) scanJson(JSON.parse(fs.readFileSync(rf, 'utf8')), `${tag}/content/research/${slug}.json`, problems)
        const page = path.join(base, 'stories', slug, 'index.html')
        if (tag === 'dist' && fs.existsSync(page)) {
          const h = hitsIn(pageParts(fs.readFileSync(page, 'utf8')), it)
          if (h.length) problems.push(`dist/stories/${slug}/index.html (${it.name}): ${h.join(', ')}`)
        }
      }
    }
    for (const rel of JSON_FILES) {
      const f = path.join(base, rel)
      if (!fs.existsSync(f)) continue
      scanJson(JSON.parse(fs.readFileSync(f, 'utf8')), `${tag}/${rel}`, problems)
    }
  }
  return problems
}

function selfTest() {
  const assert = (c, m) => {
    if (!c) throw new Error(`self-test: ${m}`)
  }
  const ch = ITEMS.find((i) => i.name === 'Chambers')
  assert(hitsIn('File:Clarks_River_in_the_fall.jpg', ch).length, 'Clarks_River underscore')
  assert(hitsIn('Clarks-River', ch).length, 'Clarks-River hyphen')
  const turk = ITEMS.find((i) => i.name === 'Turk')
  assert(!hitsIn('a small Mississippian town', turk).length, 'Mississippian is not a locator')
  assert(hitsIn('the Mississippi floodplain', turk).length, 'Mississippi river')
  const pv = ITEMS.find((i) => i.name === 'Peter Village')
  assert(!hitsIn('/stories/peter-village-early-woodland-enclosure-near-lexington/', pv).length, 'own slug exempt')
  const p = []
  scanJson({ terms: { morgantown: { hits: ['place:read-shell-midden-15bt10'] } } }, 'fixture', p)
  assert(p.length === 1, 'search term key pointing at a protected id')
  const q = []
  scanJson([{ slug: 'turk-site-carlisle-county', photo: { title: 'west of Bardwell' } }], 'fixture', q)
  assert(q.length === 1, 'photo caption')
  const r = []
  scanJson({ related: { 'peter-village-enclosure-15fa166': [{ slug: 'x', label: 'Same place: part of the Mount Horeb earthwork complex' }] } }, 'fixture', r)
  assert(r.length === 1, 'related-card note keyed by protected slug')
  const r2 = []
  scanJson({ related: { other: [{ slug: 'read-shell-midden-15bt10-butler-county', label: 'Same place: the same Green River mussel-shoal shell middens' }] } }, 'fixture', r2)
  assert(r2.length === 1, 'related-card note pointing at a protected story')
  assert(hitsIn(pageParts('<span class="related-note">— Same place: sits near the Mount Horeb circle</span>'), pv).length, 'built related-card note')
  console.log('check-protected-locators self-test: OK')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  selfTest()
  if (!process.argv.includes('--self-test')) {
    const problems = runAll()
    if (problems.length) {
      console.error(`check-protected-locators: ${problems.length} locating term(s) in protected stories:`)
      for (const p of problems.slice(0, 200)) console.error(`  ${p}`)
      process.exit(1)
    }
    console.log('check-protected-locators: OK (Muir, Peter Village x2, Read Shell Midden, Turk, Chambers; public JSON and story pages)')
  }
}
