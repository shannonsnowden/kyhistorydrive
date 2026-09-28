#!/usr/bin/env node
/**
 * Rewrite legacy KHS marker-search links in public/data/markers.geojson.
 *
 * public/data/markers.geojson has no generator. It is a committed snapshot
 * of the marker records, a subset of public/data/app/markers.phase1.json.
 * Some features still carry the retired
 *   https://secure2.kentucky.gov/kyhs/hmdb/MarkerSearch.aspx?mode=Number&markerNumber=N
 * URL, which lands on an empty search form.
 *
 * Mapping (same as the 2026-09-28 link audit, PR #93): take the OTA pack record
 * in public/data/app/markers.phase1.json with the same marker_number. If its
 * source_url is a history.ky.gov/markers/<slug> page (verified by marker number
 * in PR #93), use it. Markers without such a page are left unchanged and listed.
 *
 * The edit is an exact string replacement of each feature's "source_url" value,
 * so only those values change and the rest of the file stays byte-identical.
 * Idempotent: safe to re-run.
 *
 * Usage: node scripts/fix-markers-geojson-links.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GEO = path.join(root, 'public/data/markers.geojson')
const PACK = path.join(root, 'public/data/app/markers.phase1.json')
const LEGACY = /^https:\/\/secure2\.kentucky\.gov\/kyhs\/hmdb\/MarkerSearch\.aspx\?mode=Number&markerNumber=(\d+)$/
const KHS = /^https:\/\/history\.ky\.gov\/markers\/[a-z0-9-]+$/
const dry = process.argv.includes('--dry-run')

const pack = new Map()
for (const m of JSON.parse(fs.readFileSync(PACK, 'utf8'))) pack.set(String(m.marker_number), m.source_url)

let text = fs.readFileSync(GEO, 'utf8')
const geo = JSON.parse(text)
const fixed = []
const left = []
for (const f of geo.features) {
  const p = f.properties || {}
  const m = LEGACY.exec(p.source_url || '')
  if (!m) continue
  if (m[1] !== String(p.marker_number)) {
    left.push({ marker_number: p.marker_number, title: p.title, county: p.county, reason: 'URL number != marker_number' })
    continue
  }
  const target = pack.get(String(p.marker_number))
  if (!target || !KHS.test(target)) {
    left.push({ marker_number: p.marker_number, title: p.title, county: p.county, reason: 'no verified history.ky.gov marker page' })
    continue
  }
  const needle = `"source_url":${JSON.stringify(p.source_url)}`
  const hits = text.split(needle).length - 1
  if (hits !== 1) throw new Error(`expected 1 occurrence of ${needle}, found ${hits}`)
  text = text.replace(needle, `"source_url":${JSON.stringify(target)}`)
  fixed.push({ marker_number: p.marker_number, title: p.title, old: p.source_url, new: target })
}
JSON.parse(text) // still valid JSON
if (!dry) fs.writeFileSync(GEO, text)
console.log(JSON.stringify({ fixed: fixed.length, left: left.length, leftList: left, fixedList: fixed }, null, 2))
