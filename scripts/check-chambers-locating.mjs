#!/usr/bin/env node
/** #348 Editor ruling: the built Chambers Site page stays county level (no river, ridge, refuge or pit terms). */
import fs from 'node:fs'
import path from 'node:path'

// Linear patterns; every multi-word term allows space, underscore or hyphen separators.
// Stored as frozen pattern text ({ source, flags }), never live RegExp objects (lastIndex is mutable even when
// frozen); every scan builds fresh RegExps with re().
const spec = (r) => Object.freeze({ source: r.source, flags: r.flags })
/** A fresh RegExp from pattern text (or a RegExp), so no scan shares state with another. */
export const re = (p, flags) => new RegExp(p.source, flags ?? p.flags)
export const LOCATING_TERMS = Object.freeze([/clarks[\s_-]+river/i, /middle[\s_-]+fork/i, /ridge[\s_-]?top/i, /refuge/i, /borrow[\s_-]+pit/i, /south[\s_-]?west(ern)?[\s_-]+part/i, /\bsouth[\s_-]?west/i, /bridge[\s_-]+replacement/i].map(spec))

// Source JSON (scanned too, so the outputs regenerate clean). Every dist **/*.json and **/*.geojson is globbed.
// Site identity. Tests pass a synthetic config instead, so no fixture pairs the real site with a real place.
export const SITE = Object.freeze({
  terms: LOCATING_TERMS,
  value: spec(/chambers-site|chambers site|15ml109/i),
  key: spec(/chambers-site|15ml109/i),
  mention: spec(/15ml109|chambers[\s_-]site/gi),
  storySlug: spec(/chambers-site-15ml109/i),
})

export const SOURCE_JSON = ['public/data/layers/history.geojson', 'public/data/app/ky-history.json', 'scripts/story-overrides.json', 'scripts/story-photo-curated.json']

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, out)
    else if (/\.(geo)?json$/i.test(e.name)) out.push(p)
  }
  return out
}

/** Scan the Chambers records in every .json/.geojson under root; returns "relpath: term" problems. */
export function scanJsonOutputs(root, site = SITE) {
  return scanFiles(walkFiles(root).map((f) => [path.relative(root, f), f]), site)
}

export function scanFiles(files, site = SITE) {
  const problems = []
  for (const [rel, f] of files) {
    let data
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { continue }
    for (const r of chambersRecords(data, site)) for (const p of locatingProblems(r, site)) problems.push(`${rel}: ${p}`)
  }
  return problems
}

/** Every JSON object (at any depth) that names the Chambers site, serialized for scanning. */
export function chambersRecords(data, site = SITE) {
  const out = []
  const value = re(site.value), key = re(site.key)
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const own = Object.entries(node).filter(([, v]) => typeof v === 'string')
    if (own.some(([k, v]) => value.test(v) || key.test(k))) out.push(JSON.stringify(node))
    for (const [k, v] of Object.entries(node)) {
      if (key.test(k) && v && typeof v === 'object') out.push(JSON.stringify(v))
      walk(v)
    }
  }
  walk(data)
  return out
}

const OPEN = ['<li', '<article', '<item', '<entry', '<tr', '<url>', '\n\n']
const CLOSE = ['</li>', '</article>', '</item>', '</entry>', '</tr>', '</url>', '\n\n']

/** The card/record around each Chambers mention in an HTML, MD or XML text (whole text for a Chambers story file). */
export function chambersSnippets(text, rel = '', site = SITE) {
  if (re(site.storySlug).test(rel)) return [text]
  const MENTION = re(site.mention, 'gi')
  const out = []
  for (const m of text.matchAll(MENTION)) {
    const i = m.index
    // Search only inside the ±2000-char window (never to either end of a large file).
    const lo = Math.max(0, i - 2000)
    const hi = Math.min(text.length, i + 2000)
    const before = text.slice(lo, i)
    const after = text.slice(i, hi)
    let start = lo
    for (const o of OPEN) { const j = before.lastIndexOf(o); if (j !== -1 && lo + j > start) start = lo + j }
    let end = hi
    for (const c of CLOSE) { const j = after.indexOf(c); if (j !== -1 && i + j < end) end = i + j }
    out.push(text.slice(start, end))
  }
  return out
}

function walkText(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkText(p, out)
    else if (/\.(html|md|xml)$/i.test(e.name)) out.push(p)
  }
  return out
}

/** Scan every .html/.md/.xml under root that mentions Chambers; returns "relpath: term" problems. */
export function scanTextOutputs(root, site = SITE) {
  const problems = []
  for (const f of walkText(root)) {
    const rel = path.relative(root, f)
    const text = fs.readFileSync(f, 'utf8')
    if (!re(site.mention, 'i').test(text) && !re(site.storySlug).test(rel)) continue
    const found = new Set()
    for (const s of chambersSnippets(text, rel, site)) for (const p of locatingProblems(s, site)) found.add(p)
    for (const p of found) problems.push(`${rel}: ${p}`)
  }
  return problems
}

export function locatingProblems(html, site = SITE) {
  return site.terms.filter((t) => re(t, t.flags.replace(/[gy]/g, '')).test(html)).map((t) => t.source)
}

/** Made-up site and places for tests: same pattern shapes as SITE, with synthetic names in place of the real ones. */
export function syntheticSite() {
  return {
    terms: [spec(/sample[\s_-]+river/i), spec(/upper[\s_-]+fork/i), ...LOCATING_TERMS.slice(2)],
    value: spec(/example-site|example site|15xx999/i),
    key: spec(/example-site|15xx999/i),
    mention: spec(/15xx999|example[\s_-]site/gi),
    storySlug: spec(/example-site-15xx999/i),
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isMain) {
  if (process.argv.includes('--self-test')) {
    // Synthetic fixtures only: a made-up site and made-up places, never the real site with a real place.
    const X = syntheticSite()
    const bad = locatingProblems('<meta content="on a ridgetop above the Upper Fork of Sample River"><img alt="Sample River Test Refuge"> a borrow pit for a bridge replacement, cemetery in its southwestern part', X)
    const recs = chambersRecords({ a: [{ slug: 'other', t: 'Sample River' }, { slug: 'example-site-15xx999-sample-county', photo: { source_url: 'File:Sample_River_x.jpg' } }], 'example-site-15xx999-sample-county': { n: 'Upper Fork' } }, X)
    if (recs.flatMap((r) => locatingProblems(r, X)).length < 2 || recs.some((r) => r.includes('"other"'))) throw new Error('check-chambers-locating self-test: JSON record scan')
    if (!locatingProblems('<a href="https://commons.wikimedia.org/wiki/File:Sample_River_in_the_fall.jpg">', X).length) throw new Error('check-chambers-locating self-test: credit link filename not caught')
    if (bad.length !== 8) throw new Error(`check-chambers-locating self-test: expected 8, got ${bad.length}`)
    if (locatingProblems('<p>in Sample County</p>', X).length) throw new Error('check-chambers-locating self-test: false positive')
    if (LOCATING_TERMS.length !== 8 || SITE.terms !== LOCATING_TERMS || !Object.isFrozen(LOCATING_TERMS) || !Object.isFrozen(SITE) || !LOCATING_TERMS.every(Object.isFrozen)) throw new Error('check-chambers-locating self-test: real pattern list changed')
    console.log('check-chambers-locating: self-test ok')
  } else {
    const problems = []
    for (const f of ['dist/stories/chambers-site-15ml109-marshall-county/index.html', 'dist/stories/chambers-site-15ml109-marshall-county/story.md']) if (!fs.existsSync(f)) problems.push(`${f} missing`)
    problems.push(...scanTextOutputs('dist').map((p) => `dist/${p}`))
    problems.push(...scanJsonOutputs('dist').map((p) => `dist/${p}`), ...scanFiles(SOURCE_JSON.filter((f) => fs.existsSync(f)).map((f) => [f, f])))
    if (problems.length) {
      console.error(`check-chambers-locating: Chambers must stay county level:\n  ${problems.join('\n  ')}`)
      process.exit(1)
    }
    console.log('check-chambers-locating: Chambers page is county level only')
  }
}
