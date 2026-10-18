#!/usr/bin/env node
// Feeds check-protected-coords fake leaks and asserts it fails while printing no coordinate-like number.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildProximityFile } from './lib/coord-pairs.mjs'

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-redact-'))
const w = (rel, body) => { fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true }); fs.writeFileSync(path.join(dist, rel), body) }
// Fake values only: none is a real site.
w('data/web/protected-pins.json', JSON.stringify({ ids: ['fake-site-a', 'fake-site-b', 'fake-site-c'] }))
w('data/web/leak.json', JSON.stringify([{ id: 'fake-site-a', lat: 37.12345, lon: -84.54321 }, { slug: 'fake-site-b', geometry: { coordinates: [-85.98765, 38.24681] } }]))
w('stories/fake/index.html', '<p>fake-site-c</p><script>const p = [37.55555, -83.66666]</script>')
w('routes/fake.gpx', '<wpt lat="38.13579" lon="-84.97531"><name>fake-site-a</name></wpt>')
// Throwaway key + hash list keyed on the fake leak points, so the keyed 200 m scan and list-completeness check fire too.
const TEST_KEY = 'redaction-test-key-not-real'
const leakJson = JSON.parse(fs.readFileSync(path.join(dist, 'data/web/leak.json'), 'utf8'))
const hashFile = path.join(dist, '..', path.basename(dist) + '-hashes.json')
fs.writeFileSync(hashFile, JSON.stringify(buildProximityFile([`${leakJson[0].lat},${leakJson[0].lon}`], TEST_KEY)))
w('data/layers/stories.geojson', JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { slug: 'unlisted-near-site' }, geometry: { type: 'Point', coordinates: [leakJson[0].lon, leakJson[0].lat] } }] }))
const r = spawnSync(process.execPath, [path.resolve('scripts/check-protected-coords.mjs'), '--dist', dist, '--hashes', hashFile], { encoding: 'utf8', env: { ...process.env, PROTECTED_COORDS_KEY: TEST_KEY } })
fs.rmSync(hashFile, { force: true })
fs.rmSync(dist, { recursive: true, force: true })
const out = r.stdout + r.stderr
const fail = (msg) => { console.error(`test-protected-coords-redaction: ${msg}\n${out}`); process.exit(1) }
if (r.status === 0) fail('check passed on fake leaks')
for (const id of ['fake-site-a', 'fake-site-b', 'fake-site-c']) if (!out.includes(id)) fail(`missing id ${id}`)
for (const f of ['leak.json', 'index.html', 'fake.gpx']) if (!out.includes(f)) fail(`missing file ${f}`)
const coordLike = out.match(/-?\d{2,3}\.\d{2,}/g)
if (!/within \d+ m of a protected site/.test(out)) fail('keyed scan did not fire')
if (!out.includes('not in protected-pins.json')) fail('list-completeness check did not fire')
if (/\b[0-9a-f]{32}\b/.test(out) || out.includes(TEST_KEY)) fail('hash or key material in output')
if (coordLike) fail(`coordinate-like numbers in output: ${coordLike.length}`)
for (const v of ['12345', '54321', '98765', '24681', '55555', '66666', '13579', '97531']) if (out.includes(v)) fail('fake value digits in output')
console.log('test-protected-coords-redaction: failure output names id/file/path only')
