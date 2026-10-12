#!/usr/bin/env node
/**
 * Fixtures for check-protected-coords: each case writes a tiny dist/ with one leak shaped like a real
 * one found on main (Oct 11, 2026) and expects the check to FAIL; the "clean" twin (same file, 0.1°
 * values) must PASS. All coordinates here are FAKE test values; no real protected coordinate is stored.
 * The keyed-hash cases use a throwaway test key and a temporary hash list, never the real ones.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildHashFile } from './lib/coord-pairs.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Fake test values (central Kentucky, nowhere near the real sites): each fixture only needs a pair
// finer than 0.1° next to a protected name/id. No real coordinates are stored here.
const LS = ['37.61234', '-84.98765'] // stands in for a Lower Shawneetown route waypoint (Warriors' Path)
const LS2 = ['37.63', '-85.03'] // stands in for Lower Shawneetown (Gist route NOTES row)
const CLEEK = ['37.55', '-85.11'] // stands in for a Cleek-McCabe territory dot
const CARL = ['37.57', '-85.22'] // stands in for a Carlston Annis search-index entry
const ROUND = ['38.7', '-83.1']

const cases = {
  'js-bundle-waypoint': ([la, lo]) => ({ 'assets/main-test.js': `const r=[wp("South Portsmouth / Fullerton, Greenup County, Kentucky","Lower Shawneetown",[${la},${lo}]),wp("Cumberland Gap","Cave Gap",[36.604,-83.674])];` }),
  'gpx-waypoint': ([la, lo]) => ({ 'maps/routes/test/test.gpx': `<?xml version="1.0"?><gpx><wpt lat="${la}" lon="${lo}"><name>Lower Shawneetown</name></wpt><wpt lat="36.604" lon="-83.674"><name>Cave Gap</name></wpt></gpx>` }),
  'kml-waypoint': ([la, lo]) => ({ 'maps/routes/test/test.kml': `<kml><Placemark><name>Lower Shawneetown</name><Point><coordinates>${lo},${la},0</coordinates></Point></Placemark></kml>` }),
  'notes-md-gist': () => ({ 'maps/routes/test/NOTES.md': `| 6 | Jan 29 | Lower Shawneetown ("Shannoah Town"), mouth of the Scioto | Portsmouth OH | Scioto Co., OH | ${LS2[0]}, ${LS2[1]} | high |\n` }),
  'territory-dot-label': () => ({ 'data/web/territories/test.json': JSON.stringify({ slug: 'test', eras: [{ storySlugs: ['cleek-mccabe-fort-ancient-village'] }], geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'site3', label: 'Cleek-McCabe Site', approximate: true }, geometry: { type: 'Point', coordinates: [Number(CLEEK[1]), Number(CLEEK[0])] } }] } }) }),
  'app-search-index': () => ({ 'data/app/search-index.json': JSON.stringify({ version: 1, sites: { 'history:carlston-annis-shell-mound': { name: 'Carlston Annis Shell Mound', latitude: Number(CARL[0]), longitude: Number(CARL[1]) } } }) }),
}
// Keyed (HMAC) known-pair list: a throwaway key and a temp list holding FAKE pairs. keyed-* cases put a
// pair in a file with no protected name/id, so only the keyed list can catch it. territory-dot-label
// (a dot labeled "Cleek-McCabe Site" with no slug) is also only caught by the keyed list.
const TEST_KEY = 'test-key-not-the-real-one'
const FAKE = '37.4321,-85.6789'
const hashDir = fs.mkdtempSync(path.join(os.tmpdir(), 'khd-hash-'))
const hashFile = path.join(hashDir, 'hashes.json')
fs.writeFileSync(hashFile, JSON.stringify(buildHashFile([FAKE, `${Number(CLEEK[0])},${Number(CLEEK[1])}`], TEST_KEY)))
const leakArg = { 'js-bundle-waypoint': LS, 'gpx-waypoint': LS, 'kml-waypoint': LS }

function makeDist(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'khd-pc-'))
  const put = (rel, body) => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), body) }
  put('data/web/protected-pins.json', fs.readFileSync(path.join(root, 'public/data/web/protected-pins.json')))
  for (const f of ['data/layers/stories.geojson', 'data/layers/history.geojson']) put(f, fs.readFileSync(path.join(root, 'public', f)))
  for (const [rel, body] of Object.entries(files)) put(rel, body)
  return d
}
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !['PROTECTED_COORDS_KEY', 'AWS_APP_ID', 'AWS_BRANCH'].includes(k)))
const run = (d, env = {}, extra = []) => spawnSync(process.execPath, [path.join(root, 'scripts/check-protected-coords.mjs'), '--dist', d, ...extra], { encoding: 'utf8', env: { ...baseEnv, ...env } })

let failed = 0
for (const [name, mk] of Object.entries(cases)) {
  const keyArgs = [{ PROTECTED_COORDS_KEY: TEST_KEY }, ['--hashes', hashFile]]
  const leak = run(makeDist(mk(leakArg[name] || LS)), ...keyArgs)
  const leakOk = leak.status === 1
  let clean = mk(ROUND)
  // Cases without a pair argument: swap the exact values for 0.1° ones.
  clean = Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, v
    .replaceAll(`${LS2[0]}, ${LS2[1]}`, '38.7, -83')
    .replace(`[${Number(CLEEK[1])},${Number(CLEEK[0])}]`, '[-84.7,39]')
    .replace(`"latitude":${Number(CARL[0])},"longitude":${Number(CARL[1])}`, '"latitude":37.2,"longitude":-86.7')]))
  const pass = run(makeDist(clean), ...keyArgs)
  const passOk = pass.status === 0
  console.log(`${leakOk && passOk ? 'ok  ' : 'FAIL'} ${name}: leak -> exit ${leak.status}${leakOk ? '' : ' (expected 1)'}; clean -> exit ${pass.status}${passOk ? '' : ' (expected 0)'}`)
  if (!leakOk || !passOk) { failed++; console.log(leak.stderr + pass.stderr) }
}
const keyed = makeDist({ 'data/other.csv': `name,lat,lon\nSomewhere,${FAKE}\n` })
const keyedClean = makeDist({ 'data/other.csv': 'name,lat,lon\nSomewhere,37.4,-85.7\n' })
const keyCases = [
  ['keyed-pair-found', keyed, { PROTECTED_COORDS_KEY: TEST_KEY }, 1],
  ['keyed-pair-clean-twin', keyedClean, { PROTECTED_COORDS_KEY: TEST_KEY }, 0],
  ['keyed-no-key-local-skips', keyed, {}, 0],
  ['keyed-no-key-amplify-fails-closed', keyedClean, { AWS_APP_ID: 'd123test' }, 1],
  ['keyed-no-key-amplify-branch-fails-closed', keyedClean, { AWS_BRANCH: 'main' }, 1],
  ['keyed-wrong-key-fails', keyedClean, { PROTECTED_COORDS_KEY: 'wrong-key' }, 1],
]
for (const [name, d, env, want] of keyCases) {
  const r = run(d, env, ['--hashes', hashFile])
  const ok = r.status === want
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: exit ${r.status}${ok ? '' : ` (expected ${want})`}`)
  if (!ok) { failed++; console.log(r.stdout + r.stderr) }
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
console.log(`test-protected-coords: ${Object.keys(cases).length} leak fixtures fail and their 0.1° twins pass; ${keyCases.length} keyed-list cases; ${svgCases.length} pin-SVG fixtures behave`)
