/**
 * Shared locator scan for every protected story (#345 / #355).
 *
 * check-protected-locators and test-protected-locators both use this so a hit is
 * allowlisted only on an exact "file|owner|field|match" key (no public/ prefix).
 * A new match in an allowlisted story still fails. Peter Village is never allowlisted.
 * The story's own slugs and ids are removed before matching. URLs are not stripped:
 * a filename in a source_url is prose for this scan.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLocators, STORY_TERMS, termRegex } from './protected-locators.mjs'
import { isProtectedStory } from './unified-story-data.mjs'
import { loadMerges } from './story-merges.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const storyDir = path.join(ROOT, 'public/content/stories')
const alias = new Map() // any id -> owner slug
export const aliasesOf = new Map() // owner -> [ids]
const add = (owner, id) => {
  if (!id) return
  alias.set(String(id), owner)
  aliasesOf.set(owner, [...new Set([...(aliasesOf.get(owner) || []), String(id)])])
}
export const allStories = []
for (const f of fs.readdirSync(storyDir).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(storyDir, f), 'utf8'))
  allStories.push(s)
  if (!isProtectedStory(s)) continue
  add(s.slug, s.slug)
  add(s.slug, s.historyId)
  add(s.slug, s.id)
}
for (const { retired, kept } of loadMerges(ROOT)) if (alias.has(kept)) add(alias.get(kept), retired)
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
  for (const m of html.matchAll(/<span class="(?:usp-rel-why|related-note)">[\s\S]*?<\/span>/gi)) parts.push(['note', m[0]])
  for (const m of html.matchAll(/<li class="nearby-place[^"]*">[\s\S]*?<\/li>/gi)) parts.push(['nearby-card', m[0]])
  for (const m of html.matchAll(/<li class="related-story[^"]*">[\s\S]*?<\/li>/gi)) {
    if (/\bmiles?\b|\bNearby:/i.test(m[0].replace(/<[^>]+>/g, ' '))) parts.push(['nearby-card', m[0]])
  }
  html = html.replace(/<li class="(?:related-story|nearby-place|related-person|related-row)[^"]*">[\s\S]*?<\/li>/gi, ' ')
  html = html.replace(/\shref="[^"]*"/gi, ' ')
  html = html.replace(/\s(?:src|srcset)="[^"]*"/gi, ' ')
  html = html.replace(/<a class="(?:usp-wf-btn|usp-pn-card)[^"]*"[\s\S]*?<\/a>/gi, ' ')
  for (const m of html.matchAll(/<section\b[^>]*\bid="today"[\s\S]*?<\/section>/gi)) parts.push(['today', m[0]])
  const labelled = [['title', /<title>[\s\S]*?<\/title>/gi], ['meta', /<meta\b[^>]*>/gi], ['ld', /<script type="application\/ld\+json">[\s\S]*?<\/script>/gi], ['h1', /<h1\b[\s\S]*?<\/h1>/gi], ['figcaption', /<figcaption\b[\s\S]*?<\/figcaption>/gi], ['article', /<article\b[\s\S]*?<\/article>/gi]]
  for (const [label, re] of labelled) for (const m of html.matchAll(re)) parts.push([label, m[0]])
  const outside = html.replace(/<article\b[\s\S]*?<\/article>/gi, ' ')
  for (const m of outside.matchAll(/\salt="([^"]*)"/gi)) parts.push(['img-alt', m[1]])
  return parts
}

/**
 * Story-term hits in one research note. Culture evidence pages keep their own filename;
 * `storySlug` is what ties them to a protected story. Generic landform patterns are not
 * applied here. Folded notes and these pages are public: a locating term is not exempt.
 */
export function researchTermHits(data, file) {
  const hits = []
  const owner = ownerOf(data?.storySlug) || ownerOf(data?.slug)
  const terms = STORY_TERMS[owner] || []
  if (!owner || !terms.length) return hits
  const walk = (o, field) => {
    if (typeof o === 'string') {
      const s = scrub(o, owner)
      for (const t of terms) for (const m of s.matchAll(termRegex(t))) hits.push({ file, owner, field, match: m[0], id: `term:${t}` })
    } else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${field}[${i}]`))
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, field ? `${field}.${k}` : k)
  }
  walk(data, '')
  return hits
}

export function scanTree(base) {
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
  const researchDir = path.join(base, 'content/research')
  if (fs.existsSync(researchDir)) {
    for (const name of fs.readdirSync(researchDir)) {
      if (!name.endsWith('.json')) continue
      const file = `content/research/${name}`
      hits.push(...researchTermHits(JSON.parse(fs.readFileSync(path.join(researchDir, name), 'utf8')), file))
    }
  }
  return hits
}

export function key(h) {
  return `${h.file}|${h.owner}|${h.field}|${h.match}`
}

const allowFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/protected-locators-allowlist.json'), 'utf8'))
export const ALLOW = new Set([...(allowFile.entries || []), ...(allowFile.derived || []), ...(allowFile.page || [])])

export function pageHits(html, owner) {
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

const RETIRED = new Set(loadMerges().map((m) => m.retired))
export function scanAssetText(text, file) {
  const out = []
  for (const [owner, slugs] of aliasesOf) for (const slug of slugs) {
    if (RETIRED.has(slug) && findLocators(slug, owner).length && text.includes(slug)) out.push({ file, owner, field: 'bundle', match: slug, id: 'alias-slug' })
  }
  return out
}

export function protectedStoryCount() {
  return aliasesOf.size
}

/** Hits whose exact file|owner|field|match key is not on the allowlist. */
export function rejectUnallowlisted(hits) {
  return hits.filter((h) => !ALLOW.has(key(h)))
}

/** Public tree, plus dist JSON, story pages, and bundles when a build is present. Dist uses the same keys as public. */
export function collectLocatorHits(root = ROOT) {
  const hits = scanTree(path.join(root, 'public'))
  if (fs.existsSync(path.join(root, 'dist/content'))) {
    for (const h of scanTree(path.join(root, 'dist'))) hits.push(h)
    for (const owner of aliasesOf.keys()) {
      const page = path.join(root, 'dist/stories', owner, 'index.html')
      if (fs.existsSync(page)) hits.push(...pageHits(fs.readFileSync(page, 'utf8'), owner))
    }
  }
  const assetsDir = path.join(root, 'dist/assets')
  if (fs.existsSync(assetsDir)) {
    for (const f of fs.readdirSync(assetsDir).filter((n) => n.endsWith('.js'))) {
      hits.push(...scanAssetText(fs.readFileSync(path.join(assetsDir, f), 'utf8'), `assets/${f}`))
    }
  }
  return hits
}
