#!/usr/bin/env node
/** #348: check-chambers-locating must scan every dist JSON/GeoJSON file, catching underscore variants. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanJsonOutputs, scanTextOutputs, locatingProblems } from './check-chambers-locating.mjs'

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
// Multi-word terms with underscore separators, in a Chambers geojson record.
fs.writeFileSync(path.join(root, 'data/layers/history.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: rec('above the Middle_Fork') }] }))
planted['data/layers/history.geojson'] = 1
const problems = scanJsonOutputs(root)
let fail = 0
for (const f of Object.keys(planted)) {
  if (!problems.some((p) => p.startsWith(f + ':'))) { console.error(`not caught: ${f}`); fail++ }
}
if (problems.some((p) => p.startsWith('data/other.json'))) { console.error('false positive: other.json'); fail++ }
if (!locatingProblems('bridge_replacement').length) { console.error('bridge_replacement not caught'); fail++ }
for (const t of ['Middle_Fork', 'borrow_pit', 'ridge_top', 'south_western_part', 'south-west part', 'Clarks_River', 'bridge_replacement']) {
  if (!locatingProblems(`x ${t} y`).length) { console.error(`term not caught: ${t}`); fail++ }
}
// HTML/MD/XML: story page, a layer page card next to a Chambers mention, and an unrelated control.
const html = {
  'stories/chambers-site-15ml109-marshall-county/index.html': '<h1>Chambers Site (15Ml109)</h1><p>above the Middle_Fork</p>',
  'layers/history/index.html': '<ul><li><a href="/stories/paducah/">Paducah</a> near Clarks River</li><li><a href="/x/chambers-site-15ml109-marshall-1250-1350/">Chambers Site</a> on the Clarks_River</li></ul>',
  'feed.xml': '<item><title>Chambers Site (15Ml109)</title><description>borrow_pit</description></item>',
  'stories/chambers-site-15ml109-marshall-county/story.md': '# Chambers Site (15Ml109)\n\nOn a ridge_top.',
  'layers/markers/index.html': '<ul><li>Paducah by Clarks River</li><li>Chambers Site, Marshall County</li></ul>',
}
for (const [f, t] of Object.entries(html)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t) }
const tp = scanTextOutputs(root)
for (const f of Object.keys(html).filter((f) => !f.includes('markers'))) if (!tp.some((p) => p.startsWith(f + ':'))) { console.error(`not caught: ${f}`); fail++ }
if (tp.some((p) => p.startsWith('layers/markers'))) { console.error(`false positive: layers/markers ${tp}`); fail++ }
fs.rmSync(root, { recursive: true, force: true })
if (fail) process.exit(1)
console.log(`test-chambers-locating: ok (${Object.keys(planted).length} planted underscore variants caught)`)
