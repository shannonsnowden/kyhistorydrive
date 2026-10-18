#!/usr/bin/env node
// Feeds check-protected-coords fake leaks and asserts it fails while printing no coordinate-like number.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-redact-'))
const w = (rel, body) => { fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true }); fs.writeFileSync(path.join(dist, rel), body) }
// Fake values only: none is a real site.
w('data/web/protected-pins.json', JSON.stringify({ ids: ['fake-site-a', 'fake-site-b', 'fake-site-c'] }))
w('data/web/leak.json', JSON.stringify([{ id: 'fake-site-a', lat: 37.12345, lon: -84.54321 }, { slug: 'fake-site-b', geometry: { coordinates: [-85.98765, 38.24681] } }]))
w('stories/fake/index.html', '<p>fake-site-c</p><script>const p = [37.55555, -83.66666]</script>')
w('routes/fake.gpx', '<wpt lat="38.13579" lon="-84.97531"><name>fake-site-a</name></wpt>')
const r = spawnSync(process.execPath, [path.resolve('scripts/check-protected-coords.mjs'), '--dist', dist], { encoding: 'utf8' })
fs.rmSync(dist, { recursive: true, force: true })
const out = r.stdout + r.stderr
const fail = (msg) => { console.error(`test-protected-coords-redaction: ${msg}\n${out}`); process.exit(1) }
if (r.status === 0) fail('check passed on fake leaks')
for (const id of ['fake-site-a', 'fake-site-b', 'fake-site-c']) if (!out.includes(id)) fail(`missing id ${id}`)
for (const f of ['leak.json', 'index.html', 'fake.gpx']) if (!out.includes(f)) fail(`missing file ${f}`)
const coordLike = out.match(/-?\d{2,3}\.\d{2,}/g)
if (coordLike) fail(`coordinate-like numbers in output: ${coordLike.length}`)
for (const v of ['12345', '54321', '98765', '24681', '55555', '66666', '13579', '97531']) if (out.includes(v)) fail('fake value digits in output')
console.log('test-protected-coords-redaction: failure output names id/file/path only')
