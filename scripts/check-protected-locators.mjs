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
 *   - culture evidence JSON tied to a protected story by storySlug (story terms; no locating exemption),
 *   - and, when dist/ exists, the same JSON under dist/ plus each story page's
 *     <title>, meta tags, JSON-LD, h1, summary, body and figure captions.
 * Spaces in a term match any run of whitespace, "_" or "-" (Clarks_River).
 * The story's own slug and its photo file path are removed before matching,
 * because slugs are permanent URLs. Only the URLs in ALLOW_URLS are exempt.
 *
 * The same run also applies the generic locator patterns (direction, distance, near-town,
 * named water, named earthworks, landform, plus per-story terms such as bare Portsmouth
 * on Old Fort) to every protected story. That pass shares scripts/lib/protected-locator-scan.mjs
 * with test-protected-locators, so an allowlisted hit is an exact file|owner|field|match key.
 * A new match fails even when the story or field already has an allowlist entry.
 *
 *   node scripts/check-protected-locators.mjs             # sources + dist if built
 *   node scripts/check-protected-locators.mjs --self-test # detector self-test
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLocators } from './lib/protected-locators.mjs'
import { isProtectedStory } from './lib/unified-story-data.mjs'
import {
  ALLOW as LOCATOR_ALLOW,
  collectLocatorHits,
  key as locatorKey,
  protectedStoryCount,
  rejectUnallowlisted,
  scanJson as scanGeneric,
} from './lib/protected-locator-scan.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const ITEMS = [
  {
    name: 'Muir',
    names: ['Muir site', 'Muir Site'],
    slugs: ['muir-site-early-fort-ancient-on-a-jessamine-ridge', 'muir-site-early-fort-ancient'],
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
  {
    name: 'Buckner Site',
    names: ['Buckner Site', 'Buckner site', '15Bb12'],
    slugs: ['buckner-site-fort-ancient-villages-on-strodes-creek', 'buckner-site-fort-ancient-villages'],
    ids: ['buckner-site-15bb12'],
    terms: ['Paris', "Strode['’]?s Creek"],
  },
  {
    name: 'Lower Shawneetown',
    names: ['Lower Shawneetown'],
    slugs: ['lower-shawneetown-at-the-scioto-mouth', 'lower-shawneetown-greenup-county'],
    ids: ['lower-shawneetown'],
    terms: ['Scioto', 'South Portsmouth'],
  },
  {
    name: 'Cleek-McCabe',
    names: ['Cleek-McCabe'],
    slugs: ['cleek-mccabe-a-circular-fort-ancient-village-in-boone-county'],
    ids: ['cleek-mccabe-fort-ancient-village-boone-county'],
    terms: ['Mud Lick', 'Walton', 'Burlington'],
  },
  // County sweep: own public output only. The wide scan of other pages is a separate pass.
  {
    name: 'Adams',
    names: ['Adams Site'],
    slugs: ['adams-site-15fu4'],
    ids: ['adams-site-15fu4-mississippian-fulton-county'],
    terms: ['Hickman', 'Bayou', 'Wickliffe'],
    ownOnly: true,
  },
  {
    name: 'Andalex',
    names: ['Andalex'],
    slugs: ['andalex-village-15hk22-hopkins-county'],
    ids: ['andalex-village-15hk22-hopkins-county'],
    terms: ['Pond River', 'bluff', 'Wickliffe'],
    ownOnly: true,
  },
  {
    name: 'Indian Knoll',
    names: ['Indian Knoll'],
    slugs: ['indian-knoll-on-the-green-river', 'indian-knoll-ohio-county'],
    ids: ['indian-knoll'],
    terms: ['Green River'],
    ownOnly: true,
  },
  {
    name: 'Rowlandton',
    names: ['Rowlandton'],
    slugs: ['rowlandton-mound-site-15mcn3-paducah', 'rowlandton-mound-site-15mcn3'],
    ids: ['rowlandton-mound-site-15mcn3-mccracken'],
    terms: ['Paducah', 'Ohio River', 'oxbow', '1 km'],
    ownOnly: true,
  },
  {
    name: 'Howard',
    names: ['Howard Site', 'Howard site'],
    slugs: ['howard-site-late-fort-ancient-above-harts-fork', 'howard-site-late-fort-ancient'],
    ids: ['howard-site-15ma427-late-fort-ancient-madison-county'],
    terms: ['Harts Fork', 'Harts-Fork'],
    ownOnly: true,
  },
  {
    name: 'Singer-Hieronymus',
    names: ['Singer-Hieronymus', 'Singer Village'],
    slugs: ['singer-hieronymus-fort-ancient-villages-on-north-elkhorn', 'singer-hieronymus-fort-ancient-villages'],
    ids: ['singer-hieronymus-fort-ancient-scott-county'],
    terms: ['North Elkhorn', 'Elkhorn Creek', 'Lexington', 'north of', 'Maysville'],
    ownOnly: true,
  },
  {
    name: 'Slack Farm',
    names: ['Slack Farm'],
    slugs: ['slack-farm-15un28-union-county'],
    ids: ['slack-farm-15un28-union-county'],
    terms: ['Ohio River', 'Uniontown'],
    ownOnly: true,
  },
  {
    name: 'Slone',
    names: ['Slone Site', 'Slone'],
    slugs: ['slone-site-15pi11-pike-county'],
    ids: ['slone-site-15pi11-pike-county'],
    terms: ['Levisa', 'Fishtrap', 'Big Sandy'],
    ownOnly: true,
  },
  {
    name: 'Sweet Lick Knob',
    names: ['Sweet Lick Knob'],
    slugs: ['sweet-lick-knob-fort-ancient-gathering-place'],
    ids: ['sweet-lick-knob-fort-ancient-estill'],
    terms: ['Irvine', 'Kentucky River'],
    ownOnly: true,
  },
  {
    name: 'C and O Mounds',
    names: ['C. and O. Mounds', 'C. and O. mounds'],
    slugs: ['the-c-and-o-mounds-at-paintsville', 'the-c-and-o-mounds-johnson-county'],
    ids: ['c-and-o-mounds-paintsville-johnson-adena', 'c-and-o-mounds-johnson-county-adena'],
    terms: ['Paintsville', 'Levisa', 'Big Sandy'],
    ownOnly: true,
  },
  {
    name: 'Tinsley Hill',
    names: ['Tinsley Hill'],
    slugs: ['tinsley-hill-15ly18-lyon-county'],
    ids: ['tinsley-hill-15ly18-lyon-1300-1450'],
    terms: ['Lake Barkley', 'Cumberland', 'Kentucky Lake', 'Tinsley Hollow'],
    ownOnly: true,
  },
  {
    name: 'Wright Mounds',
    names: ['Wright Mounds'],
    slugs: ['wright-mounds-montgomery-county'],
    ids: ['wright-mounds-15mm6-8-montgomery-county-adena'],
    terms: ['ridgetop', 'bluff'],
    ownOnly: true,
  },
  {
    name: 'Fox Farm',
    names: ['Fox Farm'],
    slugs: ['fox-farm-mason-county'],
    ids: ['fox-farm-fort-ancient'],
    terms: ['ridgetop', 'Mays Lick', 'near Mays'],
    ownOnly: true,
  },
  {
    name: 'Red Bird',
    names: ['Red Bird'],
    slugs: ['red-bird-petroglyphs-clay-county', 'red-bird-river-petroglyphs-clay-county'],
    ids: ['red-bird-petroglyphs-clay'],
    terms: ['Eriline', 'KY 66', 'Red Bird River', 'Manchester'],
    ownOnly: true,
  },
  {
    name: 'Sassafras Ridge',
    names: ['Sassafras Ridge'],
    slugs: ['sassafras-ridge-15fu3-fulton-county'],
    ids: ['sassafras-ridge-15fu3-fulton-1000-1500'],
    terms: ['Mississippi River', 'near the Mississippi', 'near Hickman', 'western border'],
    ownOnly: true,
  },
  {
    name: 'Twin Mounds',
    names: ['Twin Mounds'],
    slugs: ['twin-mounds-site'],
    ids: ['twin-mounds-site-15ba2-ballard-county'],
    terms: ['Barlow', 'southeast of'],
    ownOnly: true,
  },
  {
    name: 'Dover Mound',
    names: ['Dover Mound'],
    slugs: ['dover-mound-mason-county'],
    ids: ['dover-mound-adena-mason-county'],
    terms: ['near Dover', 'Ohio River', 'Mount Horeb'],
    ownOnly: true,
  },
  {
    name: 'Old Fort',
    names: ['Old Fort Earthworks', 'Old Fort'],
    slugs: ['old-fort-earthworks-15gp1-greenup-county'],
    ids: ['old-fort-earthworks-15gp1-greenup'],
    terms: ['Portsmouth', 'Portsmouth Group'],
    ownOnly: true,
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
  // The culture name is not a river locator. "on the Green River" and a bare "river" still match.
  s = s.replace(/\bGreen River Archaic\b/gi, ' ')
  // Credit links and shared figure files are not the story's prose. A commons filename or a
  // culture-figure id can carry a river name that the caption no longer uses.
  s = s.replace(/https?:\/\/\S+/gi, ' ')
  s = s.replace(/\/content\/photos\/\S+/gi, ' ')
  s = s.replace(/\bculture-[a-z0-9-]+-image-evidence\b/gi, ' ')
  for (const u of ALLOW_URLS) s = s.split(u).join(' ')
  // Own slugs and history ids are permanent identifiers, not public locator copy.
  for (const id of [...item.slugs, ...(item.ids || [])]) s = s.split(id).join(' ')
  return s
}

/** Stories added in the county sweep scan their own public output only (not every other page). */
export function crossPageItems(items) {
  return items.filter((item) => !item.ownOnly)
}

export function hitsIn(text, item) {
  const s = scrub(text, item)
  return item.terms.filter((t) => termRegex(t).test(s))
}

function strings(o, out = [], skip = null) {
  if (typeof o === 'string') out.push(o)
  else if (Array.isArray(o)) for (const v of o) strings(v, out, skip)
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      // Another story's slug is an identifier, not this story's prose.
      if (skip && skip.has(k)) continue
      strings(v, out, skip)
    }
  }
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
export function scanJson(data, file, problems, opts) {
  const walk = (o, where) => {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${where}[${i}]`))
    if (!o || typeof o !== 'object') return
    let owner = null
    for (const f of ['slug', 'id', 'historyId', 'shareId']) if (typeof o[f] === 'string' && itemFor(o[f])) owner = itemFor(o[f])
    if (owner) {
      for (const s of strings(o, [], new Set(['slug']))) {
        const h = hitsIn(s, owner, opts)
        if (h.length) problems.push(`${file} ${where} (${owner.name}): ${h.join(', ')} in "${s.slice(0, 120)}"`)
      }
      return
    }
    for (const [k, v] of Object.entries(o)) {
      const keyed = itemFor(k)
      if (keyed) {
        for (const s of strings(v, [], new Set(['slug']))) {
          const h = hitsIn(s, keyed, opts)
          if (h.length) problems.push(`${file} ${where}.${k} (${keyed.name}): ${h.join(', ')} in "${s.slice(0, 120)}"`)
        }
        continue
      }
      // Search-term maps: { term: { hits: [ids] } } or { term: [ids] }
      const ids = strings(v).filter((s) => itemFor(s))
      if (ids.length && typeof v === 'object' && !(v && (v.slug || v.id))) {
        for (const id of ids) {
          const it = itemFor(id)
          const h = hitsIn(k, it, opts)
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
        if (fs.existsSync(rf)) scanJson(JSON.parse(fs.readFileSync(rf, 'utf8')), `${tag}/content/research/${slug}.json`, problems, { research: true })
        const page = path.join(base, 'stories', slug, 'index.html')
        if (tag === 'dist' && fs.existsSync(page)) {
          const h = hitsIn(pageParts(fs.readFileSync(page, 'utf8')), it)
          if (h.length) problems.push(`dist/stories/${slug}/index.html (${it.name}): ${h.join(', ')}`)
        }
      }
    }
    if (tag === 'dist' && fs.existsSync(path.join(base, 'stories'))) {
      const cross = crossPageItems(ITEMS)
      const own = new Set(cross.flatMap((i) => i.slugs))
      const saved = MENTIONS
      MENTIONS = mentionsFor(cross)
      for (const slug of fs.readdirSync(path.join(base, 'stories'))) {
        const page = path.join(base, 'stories', slug, 'index.html')
        if (own.has(slug) || !fs.existsSync(page)) continue
        for (const h of otherPageHits(fs.readFileSync(page, 'utf8'))) {
          problems.push(`dist/stories/${slug}/index.html mentions ${h.item} with ${h.hits.join(', ')}: "${h.sentence}"`)
        }
      }
      MENTIONS = saved
    }
    for (const rel of JSON_FILES) {
      const f = path.join(base, rel)
      if (!fs.existsSync(f)) continue
      scanJson(JSON.parse(fs.readFileSync(f, 'utf8')), `${tag}/${rel}`, problems)
    }
  }
  // Generic patterns on every protected story. Same keys as test-protected-locators.
  // An exact allowlist entry still passes; any new match fails.
  for (const h of rejectUnallowlisted(collectLocatorHits(ROOT))) {
    problems.push(`generic ${h.file} [${h.owner}] ${h.field}: ${h.id} "${h.match}"`)
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
    terms: ['Demoville', 'Demo Creek', "Sampler['’]?s Creek", 'Demoburg'],
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
    assert(!hitsIn('https://commons.wikimedia.org/wiki/File:Sampletown_view.jpg', ex).length, 'credit URL is not prose')
    assert(hitsIn('Stand-in photo near Sampletown', ex).length, 'prose caption still hits')
    assert(hitsIn('Sample-River', ex).length, 'hyphen form')
    assert(!hitsIn('a small Sampleriveran town', ex).length, 'negative lookahead term')
    assert(hitsIn('the Sampleriver floodplain', ex).length, 'lookahead term base')
    assert(!hitsIn('/stories/example-site-near-sampletown/', ex).length, 'own slug exempt')
    const withTownId = { ...ex, ids: ['sampletown-record-0001'] }
    assert(!hitsIn('sampletown-record-0001', withTownId).length, 'own history id exempt')
    assert(hitsIn('the dig was near Sampletown', withTownId).length, 'prose town still hits when the id is exempt')
    const foreign = []
    scanJson({ related: { 'example-site-15xx999-sample-county': [{ slug: 'sampletown-public-story', label: 'Same era: another town' }] } }, 'fixture', foreign)
    assert(foreign.length === 0, 'another story slug is not prose')
    const demo = FIXTURES[1]
    for (const t of ['Sampler’s Creek', "Sampler's Creek", 'Samplers Creek', 'Samplers_Creek']) assert(hitsIn(`villages on ${t}`, demo).length, `plant: possessive creek term ${t}`)
    for (const t of ['Demoburg', 'Upper Demoburg']) assert(hitsIn(`the village near ${t}`, demo).length, `plant: nearest-town term ${t}`)
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
    assert(crossPageItems([{ ownOnly: true, slugs: ['a'] }, { slugs: ['b'] }]).length === 1, 'ownOnly stories stay off the other-page scan')
    const t0 = Date.now()
    otherPageHits(page('Example Site Co. mi. St. '.repeat(20000)))
    assert(Date.now() - t0 < 2000, 'linear on large input')
  } finally {
    ACTIVE = ITEMS
    MENTIONS = mentionsFor(ITEMS)
  }
  const oldFort = ITEMS.find((i) => i.slugs.includes('old-fort-earthworks-15gp1-greenup-county'))
  assert(oldFort && oldFort.terms.includes('Portsmouth') && oldFort.terms.includes('Portsmouth Group') && oldFort.ownOnly, 'Old Fort lists bare Portsmouth and Portsmouth Group on its own output')
  assert(hitsIn('A square earthwork in Greenup County. Portsmouth.', oldFort).includes('Portsmouth'), 'planted bare Portsmouth fails the Old Fort term')
  for (const phrase of ['Portsmouth Group', 'Portsmouth_Group', 'Portsmouth-Group']) {
    assert(hitsIn(`part of the ${phrase}`, oldFort).includes('Portsmouth Group'), `planted ${phrase} fails the Old Fort term`)
  }
  assert(hitsIn('A square earthwork in Greenup County.', oldFort).length === 0, 'county-only Old Fort prose passes')
  const knoll = ITEMS.find((i) => i.slugs.includes('indian-knoll-ohio-county'))
  const readMidden = ITEMS.find((i) => i.slugs.includes('read-shell-midden-15bt10-butler-county'))
  const cultureCaption = 'Green River Archaic people (reconstruction)'
  assert(hitsIn(cultureCaption, knoll).length === 0, 'culture caption is not a Green River locator on Indian Knoll')
  assert(hitsIn(cultureCaption, readMidden).length === 0, 'culture caption is not a river locator on Read')
  assert(hitsIn('Families camped on the Green River.', knoll).includes('Green River'), 'locating Green River still fails on Indian Knoll')
  assert(hitsIn('a camp by the river', readMidden).includes('river'), 'bare river still fails on Read')
  const cultureHits = []
  scanGeneric({
    slug: 'indian-knoll-ohio-county',
    photo: { title: cultureCaption, image_url: '/content/photos/stories/figures/culture-green-river-archaic__ai-v2.2-1280.jpg' },
  }, 'content/stories/indian-knoll-ohio-county.json', cultureHits)
  assert(!cultureHits.some((h) => h.field === 'photo.title'), 'culture caption is not a named-water hit')
  assert(cultureHits.some((h) => h.field === 'photo.image_url' && h.match === 'green-river' && LOCATOR_ALLOW.has(locatorKey(h))), 'shared culture-figure path stays allowlisted')
  const official = 'The full official National Register title is Portsmouth Earthworks, Group A.'
  assert(hitsIn(official, oldFort).includes('Portsmouth'), 'official title fails in story prose')
  assert(hitsIn(official, oldFort, { research: true }).includes('Portsmouth'), 'official title fails in folded research notes')
  assert(hitsIn('Research note. Portsmouth.', oldFort, { research: true }).includes('Portsmouth'), 'a planted Portsmouth in research still fails')
  assert(hitsIn('Portsmouth Earthworks in the research file.', oldFort, { research: true }).includes('Portsmouth'), 'a shortened official title in research still fails')
  assert(findLocators('A square earthwork in Greenup County. Portsmouth.').length === 0, 'bare Portsmouth is not a generic pattern')
  assert(findLocators('A square earthwork in Greenup County. Portsmouth.', oldFort.slugs[0]).some((h) => h.match === 'Portsmouth'), 'Old Fort term catches bare Portsmouth')
  assert(protectedStoryCount() === 38, `generic pass covers all 38 protected stories (got ${protectedStoryCount()})`)
  const storyFiles = fs.readdirSync(path.join(ROOT, 'public/content/stories')).filter((f) => f.endsWith('.json'))
  const protFiles = storyFiles.filter((f) => isProtectedStory(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/content/stories', f), 'utf8'))))
  assert(protFiles.length === 38, `protected story files: ${protFiles.length}`)
  const planted = []
  scanGeneric({ slug: oldFort.slugs[0], summary: 'A square earthwork in Greenup County. Portsmouth.' }, `content/stories/${oldFort.slugs[0]}.json`, planted)
  const bare = planted.filter((h) => h.match === 'Portsmouth')
  assert(bare.length === 1 && !LOCATOR_ALLOW.has(locatorKey(bare[0])), 'planted bare Portsmouth is not allowlisted')
  const named = []
  scanGeneric({ slug: oldFort.slugs[0], title: 'Old Fort Earthworks' }, `content/stories/${oldFort.slugs[0]}.json`, named)
  assert(named.some((h) => h.match === 'Old Fort Earthworks' && LOCATOR_ALLOW.has(locatorKey(h))), 'exact site-name allowlist entry still passes')
  const widened = []
  scanGeneric({ slug: oldFort.slugs[0], title: 'Old Fort Earthworks near Portsmouth' }, `content/stories/${oldFort.slugs[0]}.json`, widened)
  assert(rejectUnallowlisted(widened).some((h) => /Portsmouth/.test(h.match)), 'a new Portsmouth hit beside an allowlisted name still fails')
  const tolu = 'tolu-site-mississippian-mounds'
  const water = []
  scanGeneric({ slug: tolu, summary: 'The town sat on a bluff above the Ohio River.' }, `content/stories/${tolu}.json`, water)
  assert(rejectUnallowlisted(water).length > 0, 'generic patterns cover a protected story with no ITEMS term list')
  const countyOnly = []
  scanGeneric({ slug: tolu, summary: 'A Mississippian town in Crittenden County.' }, `content/stories/${tolu}.json`, countyOnly)
  assert(countyOnly.length === 0, 'county-only prose has no generic locator')
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
    console.log(`check-protected-locators: OK (${ITEMS.length} named items; generic patterns on ${protectedStoryCount()} protected stories)`)
  }
}
