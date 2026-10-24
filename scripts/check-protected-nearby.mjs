#!/usr/bin/env node
/**
 * Item 105: "Related and nearby" distances on a protected story page must be
 * computed from 0.1°-rounded points, never from a precise site point.
 *
 * Protected = same rule as apply-story-overrides.mjs pin rounding: era
 * "prehistoric" or tag "archaeology", minus pin-rounding.json skipSlugs,
 * plus forceSlugs. For each protected story, the point that the page hands
 * to nearbyPlaces()/pickRelatedStories() (stories-locations.json lat/lon,
 * public/ and dist/) must sit on the 0.1° grid. We then run nearbyStories()
 * for each one and check every distance equals the distance recomputed from
 * the rounded origin. Prints counts only, never coordinates.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nearbyStories, haversineMiles } from '../src/story-tools.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/pin-rounding.json'), 'utf8'))
const skip = new Set(rules.skipSlugs || [])
const force = new Set(rules.forceSlugs || [])
const dir = path.join(ROOT, 'public/content/stories')
const stories = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
const protectedSlugs = new Set(
  stories
    .filter((s) => !skip.has(s.slug) && (force.has(s.slug) || s.era === 'prehistoric' || (s.tags || []).includes('archaeology')))
    .map((s) => s.slug),
)

const onGrid = (v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9
const r1 = (v) => Math.round(v * 10) / 10
const problems = []
let checked = 0
for (const base of ['public', 'dist']) {
  const f = path.join(ROOT, base, 'content/stories-locations.json')
  if (!fs.existsSync(f)) continue
  const locs = JSON.parse(fs.readFileSync(f, 'utf8')).locations || {}
  const all = Object.values(locs).map((l) => ({ ...l, title: l.slug }))
  for (const slug of protectedSlugs) {
    const l = locs[slug]
    if (!l || l.lat == null || l.lon == null) continue
    checked++
    if (!onGrid(l.lat) || !onGrid(l.lon)) {
      problems.push(`${base}: ${slug} nearby origin is not 0.1°-rounded`)
      continue
    }
    for (const row of nearbyStories(l, all, { limit: 5 })) {
      const o = locs[row.slug]
      const want = haversineMiles(r1(l.lat), r1(l.lon), o.lat, o.lon)
      if (Math.abs(want - row.miles) > 1e-9) problems.push(`${base}: ${slug} nearby distance not from the rounded point`)
      if (protectedSlugs.has(row.slug) && (!onGrid(o.lat) || !onGrid(o.lon))) problems.push(`${base}: ${slug} lists protected ${row.slug} at an unrounded point`)
    }
  }
}
if (!checked) problems.push('no protected stories with pins found (stories-locations.json missing?)')
if (problems.length) {
  console.error(`check-protected-nearby: ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`check-protected-nearby: OK (${checked} protected story origins on the 0.1° grid; nearby distances recomputed from rounded points)`)
