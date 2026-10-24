#!/usr/bin/env node
/**
 * Fixtures for check-protected-coords' keyed proximity scan and list-completeness check. Uses a throwaway
 * test key and FAKE points only (no real protected coordinate is stored here). Each leak case writes a tiny
 * dist/ and expects the check to FAIL; clean output must PASS; a missing or wrong key must FAIL.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildProximityFile } from './lib/coord-pairs.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_KEY = 'test-key-not-the-real-one'
const FAKE_A = [37.4321, -85.6789] // fake protected point A
const FAKE_B = [38.2468, -83.1357] // fake protected point B
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'khd-pc-'))
const hashFile = path.join(tmp, 'hashes.json')
fs.writeFileSync(hashFile, JSON.stringify(buildProximityFile([FAKE_A.join(','), FAKE_B.join(',')], TEST_KEY)))
const near = (p, dLat, dLon) => [+(p[0] + dLat).toFixed(5), +(p[1] + dLon).toFixed(5)] // ~0.0010° ≈ 110 m
const PIDS = { schema: 1, decimals: 1, ids: ['fake-protected-site'] }
const fc = (features) => JSON.stringify({ type: 'FeatureCollection', features })
const pt = (props, [la, lo]) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [lo, la] } })

function makeDist(files) {
  const d = fs.mkdtempSync(path.join(tmp, 'dist-'))
  for (const [rel, body] of Object.entries({ 'data/web/protected-pins.json': JSON.stringify(PIDS), ...files })) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true })
    fs.writeFileSync(path.join(d, rel), body)
  }
  return d
}
const [a1, o1] = near(FAKE_A, 0.001, -0.0008)
const [b1, o2] = near(FAKE_B, -0.0006, 0.0011)
const clean = {
  'data/layers/stories.geojson': fc([pt({ slug: 'fake-protected-site' }, [37.4, -85.7]), pt({ slug: 'public-town' }, [37.81234, -85.01234])]),
  'data/markers.geojson': fc([pt({ marker_number: 9001, title: 'Fake marker' }, [38.01234, -84.51234])]),
  'drives/byod-stops.json': JSON.stringify({ stops: [{ id: 's1', lat: 38.2, lon: -83.1 }, { id: 's2', lat: 37.9876, lon: -84.1234 }] }),
  'assets/route-test.js': 'const STOPS=[[37.4,-85.7],[37.81234,-85.01234]];const line=[[-85.01234,37.81234],[-85.1,37.5]];',
  'maps/routes/t/t.gpx': '<gpx><wpt lat="37.4" lon="-85.7"><name>Somewhere</name></wpt></gpx>',
}
const cases = [
  ['clean-output-passes', clean, { PROTECTED_COORDS_KEY: TEST_KEY }, 0],
  ['missing-key-fails', clean, {}, 1],
  ['wrong-key-fails', clean, { PROTECTED_COORDS_KEY: 'wrong-key' }, 1],
  ['byod-stop-leak', { ...clean, 'drives/byod-stops.json': JSON.stringify({ stops: [{ id: 's9', name: 'Unlabeled stop', lat: b1, lon: o2 }] }) }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ['story-leak-unlisted-slug', { ...clean, 'data/layers/stories.geojson': fc([pt({ slug: 'a-different-slug' }, [a1, o1])]) }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ['marker-leak', { ...clean, 'data/markers.geojson': fc([pt({ marker_number: 9002, title: 'Nearby marker' }, near(FAKE_A, -0.0012, 0.0005))]) }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ['route-line-leak-bare-array', { ...clean, 'assets/route-test.js': `const line=[[-85.1,37.5],[${o2},${b1}],[-83.0,38.3]];` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ['js-stops-leak-lat-lon', { ...clean, 'assets/route-test.js': `const STOPS=[["Stop",${a1},${o1}]];` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ['gpx-leak', { ...clean, 'maps/routes/t/t.gpx': `<gpx><wpt lat="${b1}" lon="${o2}"><name>x</name></wpt></gpx>` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ['outside-200m-passes', { ...clean, 'drives/byod-stops.json': JSON.stringify({ stops: [{ id: 's9', lat: +(FAKE_B[0] + 0.004).toFixed(4), lon: FAKE_B[1] }] }) }, { PROTECTED_COORDS_KEY: TEST_KEY }, 0],
  ['rounded-0.1-near-site-passes', { ...clean, 'drives/byod-stops.json': JSON.stringify({ stops: [{ id: 's9', lat: 38.2, lon: -83.1 }] }) }, { PROTECTED_COORDS_KEY: TEST_KEY }, 0],
  ["clean-md-and-print-css-passes", { ...clean, "stories/fake-protected-site/story.md": "# Fake Protected Site\n\nCoordinates: 37.4° N, 85.7° W (generalized).\n", "assets/story-print.css": "@media print { body { color: #000; } }" }, { PROTECTED_COORDS_KEY: TEST_KEY }, 0],
  ["md-leak-fails", { ...clean, "stories/fake-protected-site/story.md": `# Fake Site\n\nCoordinates: ${a1}, ${o1}\n` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["md-cardinal-leak-fails", { ...clean, "stories/fake-protected-site/story.md": `# Fake Site\n\nCoordinates: ${a1}° N, ${Math.abs(o1)}° W\n` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["print-css-leak-fails", { ...clean, "assets/story-print.css": `@media print { .pin::after { content: "${b1}, ${o2}"; } }` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["print-html-leak-fails", { ...clean, "stories/fake-protected-site/index.html": `<!doctype html><div class="print-only" data-lat="${a1}" data-lon="${o1}"></div>` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["xml-leak-fails", { ...clean, "sitemap.xml": `<url><loc>https://kyhistorydrive.com/?lat=${a1}&amp;lon=${o1}</loc></url>` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["svg-leak-fails", { ...clean, "assets/map.svg": `<svg data-point="${b1},${o2}"></svg>` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["unknown-ext-fails-closed", { ...clean, "stories/fake-protected-site/story.docx": "unknown-format" }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["zip-ext-fails-closed", { ...clean, "stories/fake-protected-site/archive.zip": "PK\u0003\u0004" }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  // Security Watch (#346): the prerender archive.org /details/ exemption does NOT apply here.
  ["archive-id-link-passes", { ...clean, "stories/public-town/index.html": '<a href="https://archive.org/details/in.ernet.dli.2015.58770">book</a>' }, { PROTECTED_COORDS_KEY: TEST_KEY }, 0],
  ["archive-link-near-keyed-point-fails", { ...clean, "stories/public-town/index.html": `<a href="https://archive.org/details/${a1},${o1}">x</a>` }, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ["known-binary-ext-passes", { ...clean, "assets/photo.webp": "RIFF", "fonts/glyphs/0-255.pbf": "pbf" }, { PROTECTED_COORDS_KEY: TEST_KEY }, 0],
]
let failed = 0
for (const [name, files, env, want] of cases) {
  const baseEnv = { ...process.env }
  delete baseEnv.PROTECTED_COORDS_KEY
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/check-protected-coords.mjs'), '--dist', makeDist(files), '--hashes', hashFile], { encoding: 'utf8', env: { ...baseEnv, ...env } })
  const ok = r.status === want
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: exit ${r.status}${ok ? '' : ` (expected ${want})`}`)
  // Redaction: no case may print a coordinate-like number, a fake point's digits or a 32-hex keyed hash.
  const out = r.stdout + r.stderr
  const leak = /-?\d{2,3}\.\d{2,}/.test(out) || /\b[0-9a-f]{32}\b/.test(out) || out.includes(TEST_KEY)
  if (leak) console.log(`FAIL ${name}: output carries a coordinate, hash or key (redaction)`)
  if (!ok || leak) { failed++; if (!ok) console.log(`  (${out.split('\n').length} output lines suppressed)`) }
}
fs.rmSync(tmp, { recursive: true, force: true })
if (failed) { console.error(`test-protected-coords: ${failed} case(s) failed`); process.exit(1) }
console.log(`test-protected-coords: ${cases.length} cases behave (leaks fail, clean output passes, missing/wrong key fails)`)
