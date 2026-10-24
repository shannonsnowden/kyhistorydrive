#!/usr/bin/env node
/** #348 Editor ruling: the built Chambers Site page stays county level (no river, ridge, refuge or pit terms). */
import fs from 'node:fs'

export const LOCATING_TERMS = [/clarks[\s_-]+river/i, /middle fork/i, /ridge ?top/i, /refuge/i, /borrow pit/i, /south-?west(ern)? part/i, /\bsouthwest/i, /bridge[\s-]+replacement/i]

// Files that may legitimately have no Chambers record (the story has no photo for now).
export const MAY_LACK_RECORD = new Set(['dist/content/story-photos.json', 'scripts/story-photo-curated.json'])

// Public JSON outputs that carry the Chambers record (scan only the Chambers objects inside them).
export const JSON_OUTPUTS = [
  'dist/content/stories.json',
  'dist/content/stories/chambers-site-15ml109-marshall-county.json',
  'dist/content/research/chambers-site-15ml109-marshall-county.json',
  'dist/content/story-photos.json',
  'dist/data/app/ky-history.json',
  'dist/data/search-index.json',
  'dist/data/layers/history.geojson',
  'public/data/layers/history.geojson',
  'scripts/story-overrides.json',
  'scripts/story-photo-curated.json',
  'public/data/app/ky-history.json',
]

/** Every JSON object (at any depth) that names the Chambers site, serialized for scanning. */
export function chambersRecords(data) {
  const out = []
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const own = Object.entries(node).filter(([, v]) => typeof v === 'string')
    if (own.some(([k, v]) => /chambers-site|15ml109/i.test(v) || /chambers-site|15ml109/i.test(k))) out.push(JSON.stringify(node))
    for (const [k, v] of Object.entries(node)) {
      if (/chambers-site|15ml109/i.test(k) && v && typeof v === 'object') out.push(JSON.stringify(v))
      walk(v)
    }
  }
  walk(data)
  return out
}

export function locatingProblems(html) {
  return LOCATING_TERMS.filter((re) => re.test(html)).map((re) => re.source)
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isMain) {
  if (process.argv.includes('--self-test')) {
    const bad = locatingProblems('<meta content="on a ridgetop above the Middle Fork of Clarks River"><img alt="Clarks River National Wildlife Refuge"> a borrow pit for a bridge replacement, cemetery in its southwestern part')
    const recs = chambersRecords({ a: [{ slug: 'other', t: 'Clarks River' }, { slug: 'chambers-site-15ml109-marshall-county', photo: { source_url: 'File:Clarks_River_x.jpg' } }], 'chambers-site-15ml109-marshall-county': { n: 'Middle Fork' } })
    if (recs.flatMap(locatingProblems).length < 2 || recs.some((r) => r.includes('"other"'))) throw new Error('check-chambers-locating self-test: JSON record scan')
    if (!locatingProblems('<a href="https://commons.wikimedia.org/wiki/File:Clarks_River_in_the_fall.jpg">').length) throw new Error('check-chambers-locating self-test: credit link filename not caught')
    if (bad.length !== 8) throw new Error(`check-chambers-locating self-test: expected 8, got ${bad.length}`)
    if (locatingProblems('<p>in Marshall County</p>').length) throw new Error('check-chambers-locating self-test: false positive')
    console.log('check-chambers-locating: self-test ok')
  } else {
    const files = ['dist/stories/chambers-site-15ml109-marshall-county/index.html', 'dist/stories/chambers-site-15ml109-marshall-county/story.md']
    const problems = []
    for (const f of files) {
      if (!fs.existsSync(f)) { problems.push(`${f} missing`); continue }
      for (const p of locatingProblems(fs.readFileSync(f, 'utf8'))) problems.push(`${f}: ${p}`)
    }
    for (const f of JSON_OUTPUTS) {
      if (!fs.existsSync(f)) { problems.push(`${f} missing`); continue }
      const recs = chambersRecords(JSON.parse(fs.readFileSync(f, 'utf8')))
      if (!recs.length && !MAY_LACK_RECORD.has(f)) problems.push(`${f}: no Chambers record found (check the scan)`)
      for (const r of recs) for (const p of locatingProblems(r)) problems.push(`${f}: ${p}`)
    }
    if (problems.length) {
      console.error(`check-chambers-locating: Chambers must stay county level:\n  ${problems.join('\n  ')}`)
      process.exit(1)
    }
    console.log('check-chambers-locating: Chambers page is county level only')
  }
}
