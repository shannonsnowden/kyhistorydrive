#!/usr/bin/env node
/** #348: check-chambers-locating must scan every dist JSON/GeoJSON file, catching underscore variants. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanJsonOutputs, locatingProblems } from './check-chambers-locating.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chambers-'))
const rec = (txt) => ({ id: 'chambers-site-15ml109-marshall-1250-1350', name: 'Chambers Site (15Ml109)', text: txt })
const planted = {
  'data/search-index.json': { items: [rec('cut by a bridge_replacement')] },
  'data/markers.phase1.json': [rec('on the Clarks_River')] ,
  'content/stories-locations.json': { 'chambers-site-15ml109-marshall-county': { matchedPlace: 'Middle_Fork of Clarks_River' } },
  'data/protected-pins.json': { pins: [rec('borrow pit near Clarks-River')] },
  'data/layers/stories.geojson': { type: 'FeatureCollection', features: [{ type: 'Feature', properties: rec('bridge_replacement site') }] },
}
for (const [f, d] of Object.entries(planted)) {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
  fs.writeFileSync(path.join(root, f), JSON.stringify(d))
}
// A clean unrelated file and an unrelated Clarks River mention must not fail.
fs.writeFileSync(path.join(root, 'data/other.json'), JSON.stringify([{ id: 'paducah', text: 'Clarks River' }]))
const problems = scanJsonOutputs(root)
let fail = 0
for (const f of Object.keys(planted)) {
  if (!problems.some((p) => p.startsWith(f + ':'))) { console.error(`not caught: ${f}`); fail++ }
}
if (problems.some((p) => p.startsWith('data/other.json'))) { console.error('false positive: other.json'); fail++ }
if (!locatingProblems('bridge_replacement').length) { console.error('bridge_replacement not caught'); fail++ }
fs.rmSync(root, { recursive: true, force: true })
if (fail) process.exit(1)
console.log(`test-chambers-locating: ok (${Object.keys(planted).length} planted underscore variants caught)`)
