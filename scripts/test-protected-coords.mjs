#!/usr/bin/env node
/**
 * Fixtures for check-protected-coords: each case writes a tiny dist/ with one leak shaped like a real
 * one found on main (Oct 11, 2026) and expects the check to FAIL; the "clean" twin (same file, 0.1°
 * values) must PASS. The exact coordinates are stored offset (decoded here at run time) to avoid
 * republishing them in plain text; the offset is trivially reversible and is not secret (the repo is going private).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OFF = [1.2345, -0.6789]
const dec = ([la, lo], d = [3, 3]) => [(la - OFF[0]).toFixed(d[0]), (lo - OFF[1]).toFixed(d[1])].map((x) => String(Number(x)))
// Offset-encoded exact pairs (lat + 1.2345, lon - 0.6789).
const LS = dec([39.9115, -83.7859]) // Lower Shawneetown route waypoint (Warriors' Path)
const LS2 = dec([39.9645, -83.6689], [2, 2]) // Lower Shawneetown (Gist route)
const CLEEK = dec([40.1945, -85.4189], [2, 2]) // Cleek-McCabe territory dot
const CARL = dec([38.4445, -87.3589], [2, 2]) // Carlston Annis search-index entry
const ROUND = ['38.7', '-83.1']

const cases = {
  'js-bundle-waypoint': ([la, lo]) => ({ 'assets/main-test.js': `const r=[wp("South Portsmouth / Fullerton, Greenup County, Kentucky","Lower Shawneetown",[${la},${lo}]),wp("Cumberland Gap","Cave Gap",[36.604,-83.674])];` }),
  'gpx-waypoint': ([la, lo]) => ({ 'maps/routes/test/test.gpx': `<?xml version="1.0"?><gpx><wpt lat="${la}" lon="${lo}"><name>Lower Shawneetown</name></wpt><wpt lat="36.604" lon="-83.674"><name>Cave Gap</name></wpt></gpx>` }),
  'kml-waypoint': ([la, lo]) => ({ 'maps/routes/test/test.kml': `<kml><Placemark><name>Lower Shawneetown</name><Point><coordinates>${lo},${la},0</coordinates></Point></Placemark></kml>` }),
  'notes-md-gist': () => ({ 'maps/routes/test/NOTES.md': `| 6 | Jan 29 | Lower Shawneetown ("Shannoah Town"), mouth of the Scioto | Portsmouth OH | Scioto Co., OH | ${LS2[0]}, ${LS2[1]} | high |\n` }),
  'territory-dot-label': () => ({ 'data/web/territories/test.json': JSON.stringify({ slug: 'test', eras: [{ storySlugs: ['cleek-mccabe-fort-ancient-village'] }], geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'site3', label: 'Cleek-McCabe Site', approximate: true }, geometry: { type: 'Point', coordinates: [Number(CLEEK[1]), Number(CLEEK[0])] } }] } }) }),
  'app-search-index': () => ({ 'data/app/search-index.json': JSON.stringify({ version: 1, sites: { 'history:carlston-annis-shell-mound': { name: 'Carlston Annis Shell Mound', latitude: Number(CARL[0]), longitude: Number(CARL[1]) } } }) }),
}
const leakArg = { 'js-bundle-waypoint': LS, 'gpx-waypoint': LS, 'kml-waypoint': LS }

function makeDist(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'khd-pc-'))
  const put = (rel, body) => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), body) }
  put('data/web/protected-pins.json', fs.readFileSync(path.join(root, 'public/data/web/protected-pins.json')))
  for (const f of ['data/layers/stories.geojson', 'data/layers/history.geojson']) put(f, fs.readFileSync(path.join(root, 'public', f)))
  for (const [rel, body] of Object.entries(files)) put(rel, body)
  return d
}
const run = (d) => spawnSync(process.execPath, [path.join(root, 'scripts/check-protected-coords.mjs'), '--dist', d], { encoding: 'utf8' })

let failed = 0
for (const [name, mk] of Object.entries(cases)) {
  const leak = run(makeDist(mk(leakArg[name] || LS)))
  const leakOk = leak.status === 1
  let clean = mk(ROUND)
  // Cases without a pair argument: swap the exact values for 0.1° ones.
  clean = Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, v
    .replaceAll(`${LS2[0]}, ${LS2[1]}`, '38.7, -83')
    .replace(`[${Number(CLEEK[1])},${Number(CLEEK[0])}]`, '[-84.7,39]')
    .replace(`"latitude":${Number(CARL[0])},"longitude":${Number(CARL[1])}`, '"latitude":37.2,"longitude":-86.7')]))
  const pass = run(makeDist(clean))
  const passOk = pass.status === 0
  console.log(`${leakOk && passOk ? 'ok  ' : 'FAIL'} ${name}: leak -> exit ${leak.status}${leakOk ? '' : ' (expected 1)'}; clean -> exit ${pass.status}${passOk ? '' : ' (expected 0)'}`)
  if (!leakOk || !passOk) { failed++; console.log(leak.stderr + pass.stderr) }
}
// Pin thumbnail SVGs (#222): dot must sit on the projected 0.1° point. A stand-in frame module keeps
// these fixtures independent of #222's real projection.
const frameMod = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'khd-frame-')), 'frame.mjs')
fs.writeFileSync(frameMod, 'export function loadMapFrame(){return {frame:{xFit:{scale:100,offset:9000},yFit:{scale:-100,offset:4000}},project:(lon,lat)=>[lon,lat]}}\n')
const runSvg = (d) => spawnSync(process.execPath, [path.join(root, 'scripts/check-protected-pin-svgs.mjs'), '--dist', d, '--frame-module', frameMod], { encoding: 'utf8' })
const pin = (x, y) => `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="32"/></svg>`
const loc = JSON.stringify({ locations: { 'carlston-annis-shell-mound': { lat: 37.2, lon: -86.7 } } })
const at = (lat, lon) => [100 * lon + 9000, -100 * lat + 4000]
const svgCases = [
  ['svg-absent-skips', {}, 0],
  ['svg-on-rounded-point', { 'content/stories-locations.json': loc, 'brand/story-pins/carlston-annis-shell-mound-light.svg': pin(...at(37.2, -86.7)) }, 0],
  ['svg-on-unrounded-point', { 'content/stories-locations.json': loc, 'brand/story-pins/carlston-annis-shell-mound-dark.svg': pin(...at(37.24, -86.73)) }, 1],
]
for (const [name, files, want] of svgCases) {
  const r = runSvg(makeDist(files))
  const ok = r.status === want
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: exit ${r.status}${ok ? '' : ` (expected ${want})`}`)
  if (!ok) { failed++; console.log(r.stdout + r.stderr) }
}

if (failed) { console.error(`test-protected-coords: ${failed} case(s) failed`); process.exit(1) }
console.log(`test-protected-coords: ${Object.keys(cases).length} leak fixtures fail and their 0.1° twins pass; ${svgCases.length} pin-SVG fixtures behave`)
