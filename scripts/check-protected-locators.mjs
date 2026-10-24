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
    names: ['Muir site', 'Muir Site'],
    slugs: ['muir-site-early-fort-ancient-on-a-jessamine-ridge'],
    ids: ['muir-site-15js86-jessamine-county'],
    terms: ['Nicholasville', 'Bypass', 'ridge', 'upland', 'Jessamine Creek', 'Lexington', 'Main Street', 'west of', 'east of'],
  },
  {
    name: 'Peter Village',
    names: ['Peter Village'],
    slugs: ['peter-village-early-woodland-enclosure-near-lexington', 'peter-village-enclosure-15fa166'],
    ids: ['peter-village-enclosure-15fa166-fayette-county'],
    terms: ['Lexington', 'Mount Horeb', 'Horeb', 'Earthworks Complex', 'Adena Park', 'Elkhorn', 'creek', 'north of', 'near the'],
  },
  {
    name: 'Read Shell Midden',
    names: ['Read Shell Midden', 'Read site'],
    slugs: ['read-shell-midden-15bt10-butler-county'],
    ids: ['read-shell-midden-15bt10'],
    terms: ['Morgantown', 'Green River', 'Big Bend', 'river', 'shoal', 'Indian Knoll', 'Carlston Annis', 'Ward', 'west of'],
  },
  {
    name: 'Turk',
    names: ['Turk site', 'Turk Site'],
    slugs: ['turk-site-carlisle-county'],
    ids: ['turk-site-15ce6-carlisle-county'],
    terms: ['Bardwell', 'bluff', 'bluffs', 'spur', 'Mississippi(?!an)', 'floodplain', 'Wickliffe', 'mouth of the Ohio', 'west of', 'downriver'],
  },
  {
    name: 'Chambers',
    names: ['Chambers site', 'Chambers Site', '15Ml109'],
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
// The self-test swaps in fictional fixture items so plants never pair a real site with a real locator.
let ACTIVE = ITEMS
function itemFor(value) {
  const v = String(value || '').replace(/^(place|story|history):/, '')
  return ACTIVE.find((i) => i.slugs.includes(v) || i.ids.includes(v))
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
  // v2 related cards: why-line, meta (nested nearby-kind span; "Nearby: N miles" distance text is
  // out of scope here), and thumbnail alt text.
  grab(/<span class="usp-rel-why">[^<]*<\/span>/gi)
  for (const m of html.matchAll(/<span class="related-card-meta">((?:[^<]|<span\b[^>]*>[^<]*<\/span>)*)<\/span>/gi)) {
    parts.push(m[1].replace(/<span class="nearby-miles">[^<]*<\/span>/gi, ' ').replace(/<[^>]+>/g, ' '))
  }
  for (const m of html.matchAll(/<img\b[^>]*class="related-card-img"[^>]*>/gi)) {
    const alt = m[0].match(/\balt="([^"]*)"/i)
    if (alt) parts.push(alt[1])
  }
  grab(/<figcaption\b[\s\S]*?<\/figcaption>/gi)
  grab(/<p class="story-summary">[\s\S]*?<\/p>/gi)
  // v2 unified page: the "Kentucky today" section is story prose too.
  grab(/<section class="usp-section usp-today"[\s\S]*?<\/section>/gi)
  const body = html.match(/<div class="story-body">([\s\S]*?)<\/div>\s*(?:<section|<nav|<aside|<footer|<div class="story-)/i)
  // v2 unified page: story-body is followed (inside the same wrapper) by <section> blocks such as
  // usp-related; stop at the first one so related-card titles (same as main's page) aren't read as body text.
  if (body) parts.push(body[1].split(/<section\b/i)[0])
  return parts.join('\n')
}

const mentionsFor = (items) => items.map((it) => ({
  it,
  re: new RegExp(
    [...it.slugs.map((x) => `/stories/${x}/`), ...it.names].map((x) => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/ /g, '[\\s_-]+')).join('|'),
    'i',
  ),
}))
let MENTIONS = mentionsFor(ITEMS)

/** Prose of a non-protected story page: body, "Kentucky today", related why-lines. */
function prose(html) {
  const parts = []
  const body = html.match(/<div class="story-body">([\s\S]*?)<\/div>\s*(?:<section|<nav|<aside|<footer|<div class="story-|$)/i)
  if (body) parts.push(body[1].split(/<section\b/i)[0])
  for (const m of html.matchAll(/<section class="usp-section usp-today"[\s\S]*?<\/section>/gi)) parts.push(m[0])
  for (const m of html.matchAll(/<span class="usp-rel-why">[^<]*<\/span>/gi)) parts.push(m[0])
  return parts.join('\n')
}

/** Sentences on another story's page that mention a protected site and also carry one of its locating terms. */
export function otherPageHits(html) {
  const out = []
  // Keep hrefs as text so slug mentions count, then drop the remaining markup.
  const text = prose(html).replace(/<a\b[^>]*href="([^"]*)"[^>]*>/gi, ' $1 ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
  // True ±NEAR_WORDS window around each mention, ignoring sentence breaks. Linear: one pass to index
  // word starts, one regex scan per protected site, and a fixed-size window per mention.
  const starts = []
  for (const m of text.matchAll(/\S+/g)) starts.push(m.index)
  const wordAt = (pos) => {
    let lo = 0, hi = starts.length - 1, ans = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (starts[mid] <= pos) { ans = mid; lo = mid + 1 } else hi = mid - 1
    }
    return ans
  }
  const words = text.match(/\S+/g) || []
  for (const { it, re } of MENTIONS) {
    const g = new RegExp(re.source, 'gi')
    // Merge mentions that sit within NEAR_WORDS of each other (e.g. link href + its text) into one span.
    const spans = []
    for (const m of text.matchAll(g)) {
      const a = wordAt(m.index)
      const b = wordAt(m.index + Math.max(m[0].length - 1, 0))
      const last = spans[spans.length - 1]
      if (last && a <= last[1] + NEAR_WORDS) last[1] = Math.max(last[1], b)
      else spans.push([a, b])
    }
    for (const [a, b] of spans) {
      const win = words.slice(Math.max(0, a - NEAR_WORDS), b + NEAR_WORDS + 1).join(' ')
      const h = hitsIn(win, it)
      if (h.length) out.push({ item: it.name, hits: h, sentence: win.slice(0, 160) })
    }
  }
  return out
}

/** Words that end in a period but don't end a sentence (lower-cased, without the final dot). */
export const ABBREVIATIONS = new Set(['mi', 'co', 'st', 'mt', 'ft', 'ca', 'e.g', 'i.e', 'etc', 'no', 'rd', 'twp', 'cf', 'vs', 'approx', 'ave', 'blvd', 'hwy', 'jr', 'sr', 'dr', 'mr', 'mrs', 'ms', 'gen', 'col', 'capt', 'lt', 'rev', 'ky', 'n', 's', 'e', 'w', 'km', 'yd', 'yds', 'in', 'c', 'cir', 'pt', 'riv', 'miss', 'cr'])
export const NEAR_WORDS = 15

/** Linear sentence splitter: breaks after . ! ? + whitespace, or at newlines, but not after abbreviations or initials. */
export function splitSentences(text) {
  const out = []
  let cur = ''
  for (const tok of String(text).split(/(\s+)/)) {
    cur += tok
    if (/\n/.test(tok)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
      continue
    }
    if (/^\s+$/.test(tok) || !/[.!?]["'\u201d\u2019)\]]*$/.test(tok)) continue
    if (/[!?]["'\u201d\u2019)\]]*$/.test(tok)) { out.push(cur.trim()); cur = ''; continue }
    const word = tok.replace(/^[("'\u201c\u2018[]+/, '').replace(/["'\u201d\u2019)\]]*$/, '').replace(/\.$/, '').toLowerCase()
    if (ABBREVIATIONS.has(word) || /^[a-z]$/.test(word)) continue
    out.push(cur.trim())
    cur = ''
  }
  if (cur.trim()) out.push(cur.trim())
  return out
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
    if (tag === 'dist' && fs.existsSync(path.join(base, 'stories'))) {
      const own = new Set(ITEMS.flatMap((i) => i.slugs))
      for (const slug of fs.readdirSync(path.join(base, 'stories'))) {
        const page = path.join(base, 'stories', slug, 'index.html')
        if (own.has(slug) || !fs.existsSync(page)) continue
        for (const h of otherPageHits(fs.readFileSync(page, 'utf8'))) {
          problems.push(`dist/stories/${slug}/index.html mentions ${h.item} with ${h.hits.join(', ')}: "${h.sentence}"`)
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

/** Fictional sites and places for the self-test only. Real terms live only in ITEMS above. */
const FIXTURES = [
  {
    name: 'Example Site',
    names: ['Example Site', '15XX999'],
    slugs: ['example-site-15xx999-sample-county', 'example-site-near-sampletown'],
    ids: ['example-site-15xx999-0001'],
    terms: ['Sampletown', 'Sample River', 'Samplemound', 'Sampleriver(?!an)', 'bluff', 'west of', 'near the'],
  },
  {
    name: 'Demo Enclosure',
    names: ['Demo Enclosure'],
    slugs: ['demo-enclosure-15yy000'],
    ids: ['demo-enclosure-15yy000-0001'],
    terms: ['Demoville', 'Demo Creek'],
  },
]

function selfTest() {
  const assert = (c, m) => {
    if (!c) throw new Error(`self-test: ${m}`)
  }
  ACTIVE = FIXTURES
  MENTIONS = mentionsFor(FIXTURES)
  try {
    const ex = FIXTURES[0]
    const page = (t) => `<div class="story-body"><p>${t}</p></div>`
    const exLink = '<a href="/stories/example-site-15xx999-sample-county/">Example Site</a>'
    assert(hitsIn('File:Sample_River_in_the_fall.jpg', ex).length, 'underscore form')
    assert(hitsIn('Sample-River', ex).length, 'hyphen form')
    assert(!hitsIn('a small Sampleriveran town', ex).length, 'negative lookahead term')
    assert(hitsIn('the Sampleriver floodplain', ex).length, 'lookahead term base')
    assert(!hitsIn('/stories/example-site-near-sampletown/', ex).length, 'own slug exempt')
    const p = []
    scanJson({ terms: { sampletown: { hits: ['place:example-site-15xx999-0001'] } } }, 'fixture', p)
    assert(p.length === 1, 'search term key pointing at a protected id')
    const q = []
    scanJson([{ slug: 'example-site-15xx999-sample-county', photo: { title: 'west of Sampletown' } }], 'fixture', q)
    assert(q.length === 1, 'photo caption')
    const r = []
    scanJson({ related: { 'example-site-15xx999-sample-county': [{ slug: 'x', label: 'Same place: part of the Samplemound complex' }] } }, 'fixture', r)
    assert(r.length === 1, 'related-card note keyed by protected slug')
    const r2 = []
    scanJson({ related: { other: [{ slug: 'example-site-15xx999-sample-county', label: 'Same place: the same Sample River shoals' }] } }, 'fixture', r2)
    assert(r2.length === 1, 'related-card note pointing at a protected story')
    assert(hitsIn(pageParts('<span class="related-note">— Same place: sits near Samplemound</span>'), ex).length, 'built related-card note')
    // v2 related cards on protected pages (#354 Security): why-line, meta with nested spans, thumbnail alt.
    assert(hitsIn(pageParts('<li class="related-story"><a class="related-card"><span class="related-card-copy"><span class="related-card-title">X</span><span class="related-card-meta">x</span><span class="usp-rel-why">Same place: beside Samplemound</span></span></a></li>'), ex).length, 'v2 usp-rel-why')
    assert(hitsIn(pageParts('<span class="related-card-meta"><span class="nearby-kind">Story</span> · on the Sample River</span>'), ex).length, 'v2 related-card-meta with nested span')
    assert(hitsIn(pageParts('<span class="related-card-media"><img class="related-card-img" src="/a.webp" alt="Thumbnail for Sampletown named" width="56"></span>'), ex).length, 'v2 related thumbnail alt')
    assert(!hitsIn(pageParts('<span class="related-card-meta"><span class="nearby-kind">Story</span> · <span class="nearby-miles">Nearby: 4 miles</span></span>'), ex).length, 'distance text out of scope')
    // Other stories' text near a protected-site mention.
    const near = otherPageHits(page(`Webb cited enclosures like ${exLink} near Sampletown. Later work moved on.`))
    assert(near.length === 1 && near[0].item === 'Example Site', 'locator in the same sentence')
    const abbr1 = otherPageHits(page('Old towns dotted the region; the Example Site is 5 mi. west of Sampletown on the old road.'))
    assert(abbr1.length === 1 && abbr1[0].item === 'Example Site', 'plant: "site is 5 mi. west of <town>" (abbreviation mi.)')
    const abbr2 = otherPageHits(page(`Webb mapped ${exLink} (Sample Co.) beside Samplemound.`))
    assert(abbr2.length === 1 && abbr2[0].item === 'Example Site', 'plant: "<site> (Sample Co.) <landmark>" (abbreviation Co.)')
    for (const ab of ['St.', 'Mt.', 'ft.', 'ca.', 'e.g.', 'i.e.', 'etc.', 'No.', 'Ft.', 'Rd.', 'Twp.']) {
      assert(otherPageHits(page(`The Example Site sat by ${ab} Sampletown once.`)).length === 1, `plant: abbreviation ${ab}`)
    }
    const across = otherPageHits(page(`Webb cited ${exLink} in Sample County. Sampletown grew later.`))
    assert(across.length === 1 && across[0].item === 'Example Site', 'plant: locator across one sentence boundary')
    const twoAway = otherPageHits(page('Webb dug the Example Site in 1930. The mounds were small. They stand on a bluff near Sampletown.'))
    assert(twoAway.length === 1 && twoAway[0].hits.includes('Sampletown'), 'plant: locator two sentences after the mention, within 15 words')
    const riv = otherPageHits(page('The Example Site sat on the Sample Riv. west of Sampletown.'))
    assert(riv.length === 1 && riv[0].item === 'Example Site', 'plant: "on the Sample Riv. west of <town>"')
    assert(splitSentences('on the Sample Riv. near Miss. Sample, 3 km. from the Cr. mouth.').length === 1, 'riv, miss, cr, km are abbreviations')
    assert(otherPageHits(page('Sampletown grew fast. The Demo Enclosure is in Sample County.')).length === 0, 'locator of a different site is fine')
    const filler = 'Archaeologists in that era surveyed many earthworks across the state with simple tools and notebooks. '.repeat(2)
    assert(!otherPageHits(page(`Webb cited ${exLink} in Sample County. ${filler}Sampletown grew later.`)).length, 'locator beyond ~15 words is fine')
    const t0 = Date.now()
    otherPageHits(page('Example Site Co. mi. St. '.repeat(20000)))
    assert(Date.now() - t0 < 2000, 'linear on large input')
  } finally {
    ACTIVE = ITEMS
    MENTIONS = mentionsFor(ITEMS)
  }
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
