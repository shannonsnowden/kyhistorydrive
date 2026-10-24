#!/usr/bin/env node
/** #348: check-chambers-locating must scan every dist JSON/GeoJSON file, catching underscore variants. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanJsonOutputs as sj, scanTextOutputs as st, locatingProblems as lpx, syntheticSite } from './check-chambers-locating.mjs'
// Synthetic fixtures only (made-up site, made-up places); the real names live only in the checker's pattern list.
const X = syntheticSite()
const scanJsonOutputs = (r) => sj(r, X)
const scanTextOutputs = (r) => st(r, X)
const locatingProblems = (t) => lpx(t, X)

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'example-'))
const rec = (txt) => ({ id: 'example-site-15xx999-sample-1250-1350', name: 'Example Site (15XX999)', text: txt })
const planted = {
  'data/search-index.json': { items: [rec('cut by a bridge_replacement')] },
  'data/markers.phase1.json': [rec('on the Sample_River')] ,
  'content/stories-locations.json': { 'example-site-15xx999-sample-county': { matchedPlace: 'Upper_Fork of Sample_River' } },
  'data/protected-pins.json': { pins: [rec('borrow pit near Sample-River')] },
  'data/layers/stories.geojson': { type: 'FeatureCollection', features: [{ type: 'Feature', properties: rec('bridge_replacement site') }] },
}
for (const [f, d] of Object.entries(planted)) {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
  fs.writeFileSync(path.join(root, f), JSON.stringify(d))
}
// A clean unrelated file and an unrelated Sample River mention must not fail.
fs.writeFileSync(path.join(root, 'data/other.json'), JSON.stringify([{ id: 'sampletown', text: 'Sample River' }]))
// Multi-word terms with underscore separators, in an Example Site geojson record.
fs.writeFileSync(path.join(root, 'data/layers/history.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: rec('above the Upper_Fork') }] }))
planted['data/layers/history.geojson'] = 1
const problems = scanJsonOutputs(root)
let fail = 0
for (const f of Object.keys(planted)) {
  if (!problems.some((p) => p.startsWith(f + ':'))) { console.error(`not caught: ${f}`); fail++ }
}
if (problems.some((p) => p.startsWith('data/other.json'))) { console.error('false positive: other.json'); fail++ }
if (!locatingProblems('bridge_replacement').length) { console.error('bridge_replacement not caught'); fail++ }
for (const t of ['Upper_Fork', 'borrow_pit', 'ridge_top', 'south_western_part', 'south-west part', 'Sample_River', 'bridge_replacement']) {
  if (!locatingProblems(`x ${t} y`).length) { console.error(`term not caught: ${t}`); fail++ }
}
// HTML/MD/XML: story page, a layer page card next to an Example Site mention, and an unrelated control.
const html = {
  'stories/example-site-15xx999-sample-county/index.html': '<h1>Example Site (15XX999)</h1><p>above the Upper_Fork</p>',
  'layers/history/index.html': '<ul><li><a href="/stories/sampletown/">Sampletown</a> near Sample River</li><li><a href="/x/example-site-15xx999-sample-1250-1350/">Example Site</a> on the Sample_River</li></ul>',
  'feed.xml': '<item><title>Example Site (15XX999)</title><description>borrow_pit</description></item>',
  'stories/example-site-15xx999-sample-county/story.md': '# Example Site (15XX999)\n\nOn a ridge_top.',
  'layers/markers/index.html': '<ul><li>Sampletown by Sample River</li><li>Example Site, Sample County</li></ul>',
}
for (const [f, t] of Object.entries(html)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t) }
const tp = scanTextOutputs(root)
for (const f of Object.keys(html).filter((f) => !f.includes('markers'))) if (!tp.some((p) => p.startsWith(f + ':'))) { console.error(`not caught: ${f}`); fail++ }
if (tp.some((p) => p.startsWith('layers/markers'))) { console.error(`false positive: layers/markers ${tp}`); fail++ }
fs.rmSync(root, { recursive: true, force: true })
if (fail) process.exit(1)
console.log(`test-chambers-locating: ok (${Object.keys(planted).length} planted underscore variants caught)`)

// Security (#348): the context window search is bounded at ±2000 chars, so many mentions in a huge text stay fast.
{
  const { chambersSnippets: sn } = await import('./check-chambers-locating.mjs')
  const snip = (t, r) => sn(t, r, X)
  const lp = locatingProblems
  const filler = 'x'.repeat(3000)
  const card = (bad) => `<li>15XX999 ${bad ? 'near the Sample River' : 'in Sample County'}</li>`
  const big = Array.from({ length: 4000 }, (_, k) => card(k === 1234) + filler).join('') + '<li>' + 'y'.repeat(2_000_000)
  const t0 = Date.now()
  const parts = snip(big, 'dist/x.html')
  const ms = Date.now() - t0
  if (parts.length !== 4000) throw new Error(`bounded window: expected 4000 snippets, got ${parts.length}`)
  if (parts.filter((p) => lp(p).length).length !== 1) throw new Error('bounded window: detection changed')
  if (ms > 1500) throw new Error(`bounded window: took ${ms}ms`)
  const near = snip(`<li>15XX999 ${'z'.repeat(2500)} Sample River</li>`, 'dist/y.html')
  if (near[0].length > 2001 + 4) throw new Error('bounded window: snippet exceeds the 2000-char window')
  console.log(`test-chambers-locating: bounded window ok (${ms}ms)`)
}
