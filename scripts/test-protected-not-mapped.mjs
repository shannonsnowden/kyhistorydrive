#!/usr/bin/env node
/**
 * Editor ruling 10/24 (#345): protected sites ARE mapped, by an approximate county-level area.
 * No protected entry may say it "is not mapped"; the wording is
 * "shown only by an approximate area, at the county level."
 * Scans story JSON, ky-history.json, history.geojson, stories.geojson, both search indexes and
 * territory files (public/ and, when built, dist/).
 *   node scripts/test-protected-not-mapped.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isProtectedStory } from './lib/unified-story-data.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BAD = /\bis not mapped\b/i
const pins = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/web/protected-pins.json'), 'utf8'))
const pinIds = new Set((pins.ids || []).map(String))
const isProt = (v) => {
  if (typeof v !== 'string' || !v) return false
  const id = v.replace(/^(place|story|history|marker):/, '')
  return pinIds.has(id) || isProtectedStory({ slug: id }) || isProtectedStory({ id, historyId: id })
}

export function scan(data, file, out) {
  const walk = (o, owned) => {
    if (typeof o === 'string') {
      if (owned && BAD.test(o)) out.push(`${file} [${owned}]`)
      return
    }
    if (Array.isArray(o)) return o.forEach((v) => walk(v, owned))
    if (!o || typeof o !== 'object') return
    let own = owned
    for (const f of ['slug', 'id', 'historyId', 'shareId']) if (!own && isProt(o[f])) own = o[f]
    if (!own && o.properties && isProt(o.properties.id)) own = o.properties.id
    for (const [k, v] of Object.entries(o)) walk(v, own || (isProt(k) ? k : null))
  }
  walk(data, null)
}

// plant: a protected entry saying "is not mapped" must fail; an unprotected one is out of scope.
{
  const out = []
  scan([{ id: 'peter-village-enclosure-15fa166-fayette-county', history: 'so it is named at the county level and is not mapped.' }], 'plant', out)
  assert.ok(out.length === 1, 'planted protected "is not mapped" must fail')
  const ok = []
  scan([{ id: 'col-john-hardin-of-pleasant-run', history: 'the exact house site is not mapped.' }], 'plant', ok)
  assert.equal(ok.length, 0, 'unprotected entries are out of scope')
}

const files = []
for (const base of ['public', 'dist']) {
  const b = path.join(ROOT, base)
  if (!fs.existsSync(b)) continue
  const sd = path.join(b, 'content/stories')
  if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd)) if (f.endsWith('.json')) files.push(path.join(sd, f))
  for (const rel of ['data/app/ky-history.json', 'data/layers/history.geojson', 'data/layers/stories.geojson', 'data/search-index.json', 'data/app/search-index.json']) {
    if (fs.existsSync(path.join(b, rel))) files.push(path.join(b, rel))
  }
  const td = path.join(b, 'data/web/territories')
  if (fs.existsSync(td)) for (const f of fs.readdirSync(td)) if (f.endsWith('.json')) files.push(path.join(td, f))
}
const hits = []
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  if (!BAD.test(text)) continue
  const data = JSON.parse(text)
  const before = hits.length
  scan(data, path.relative(ROOT, f), hits)
  // Story JSON files are owned by their own slug.
  if (hits.length === before && f.includes('/content/stories/') && isProt(data.slug)) hits.push(`${path.relative(ROOT, f)} [${data.slug}]`)
}
if (hits.length) {
  console.error(`test-protected-not-mapped: ${hits.length} protected entr(ies) say "is not mapped":\n  ${[...new Set(hits)].join('\n  ')}`)
  process.exit(1)
}
console.log(`test-protected-not-mapped: OK (${files.length} files; no protected entry says "is not mapped")`)
