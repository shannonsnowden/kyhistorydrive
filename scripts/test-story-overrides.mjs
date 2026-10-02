#!/usr/bin/env node
/** Tests for apply-story-overrides.mjs on a temp copy of the data (never touches the repo). Run: npm run test-overrides */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..')
const APPLY = path.join(HERE, 'apply-story-overrides.mjs')
const REAL = path.join(HERE, 'story-overrides.json')
const FILES = [
  'public/content/stories.json',
  'public/content/stories-locations.json',
  'public/data/layers/stories.geojson',
  'public/data/layers/history.geojson',
  'public/data/app/ky-history.json',
  'public/data/search-index.json',
]
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ky-overrides-'))
for (const f of FILES) {
  fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true })
  fs.copyFileSync(path.join(REPO, f), path.join(tmp, f))
}
fs.cpSync(path.join(REPO, 'public/content/stories'), path.join(tmp, 'public/content/stories'), { recursive: true })

const run = (args = [], file = REAL) => spawnSync('node', [APPLY, '--root', tmp, '--file', file, ...args], { encoding: 'utf8' })
const all = () => [...FILES, ...fs.readdirSync(path.join(tmp, 'public/content/stories')).map((f) => `public/content/stories/${f}`)]
const snap = () => Object.fromEntries(all().map((f) => [f, fs.readFileSync(path.join(tmp, f), 'utf8')]))
const read = (f) => JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8'))
const write = (f, d, indent) => fs.writeFileSync(path.join(tmp, f), JSON.stringify(d, null, indent) + (indent ? '\n' : ''))
const tmpOverrides = (obj) => { const p = path.join(tmp, 'o.json'); fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj)); return p }
const N = Object.keys(JSON.parse(fs.readFileSync(REAL, 'utf8')).overrides).length
const ok = (name) => console.log(`ok - ${name}`)

// 1. no-op on current data
const before = snap()
let r = run()
assert.equal(r.status, 0, r.stderr)
assert.match(r.stdout, new RegExp(`0 applied, ${N} already in place, 0 stale`))
assert.deepEqual(snap(), before)
ok('committed overrides and pin rounding are a no-op on current data (files byte-identical)')

// 2. simulate an old pack: revert Ward pin + years, Ashland/Innes text in every copy, then re-apply
const W = 'ward-site-15mcl11-mclean-county'
const WH = 'ward-site-15mcl11-mclean-county-late-archaic'
let d = read(FILES[0]); Object.assign(d.stories.find((s) => s.slug === W), { lat: 37.1, lon: -87.1 }); write(FILES[0], d, 2)
d = read(FILES[1]); Object.assign(d.locations[W], { lat: 37.1, lon: -87.1 }); write(FILES[1], d, 2)
d = read(FILES[2]); d.features.find((f) => f.properties.slug === W).geometry.coordinates = [-87.1, 37.1]; write(FILES[2], d)
d = read(FILES[3]); d.features.find((f) => f.properties.id === WH).geometry.coordinates = [-87.1, 37.1]; write(FILES[3], d)
d = read(FILES[4]); Object.assign(d.find((p) => p.id === WH), { latitude: 37.1, longitude: -87.1 }); write(FILES[4], d, 2)
d = read(FILES[5]); for (const x of d.documents) if (x.id === `story:${W}` || x.id === `place:${WH}`) Object.assign(x, { lat: 37.1, lon: -87.1 }); write(FILES[5], d)
const revertText = (s) =>
  s.replaceAll('burial mounds survive in Ashland', 'burial mounds still sit in Ashland')
    .replaceAll('he was sworn in at Crow’s Station, Virginia (near present-day Danville, Virginia), in November 1782', 'he was sworn near present-day Danville in November 1782')
    .replaceAll('he was sworn in at Crow’s Station, Virginia…', 'he was sworn near present-day…')
for (const f of all()) { const p = path.join(tmp, f); const s = fs.readFileSync(p, 'utf8'); if (revertText(s) !== s) fs.writeFileSync(p, revertText(s)) }
assert.notDeepEqual(snap(), before)
r = run(['--check'])
assert.equal(r.status, 2, 'check should flag drift')
assert.match(r.stdout, /DRIFT/)
r = run()
assert.equal(r.status, 0, r.stderr)
assert.match(r.stdout, new RegExp(`3 applied, ${N - 3} already in place`))
assert.deepEqual(snap(), before)
ok('re-ingesting an old pack is repaired: every copy restored byte-for-byte; --check flags the drift first')

// 3. idempotent
const afterOnce = snap()
r = run()
assert.match(r.stdout, new RegExp(`0 applied, ${N} already in place`))
assert.deepEqual(snap(), afterOnce)
ok('applying twice is idempotent')

// 4. stale overrides are reported, not fatal
const stale = tmpOverrides({ version: 1, overrides: {
  'no-such-story': { reason: 'x', date: '2026-01-01', county: 'Fayette' },
  harry: undefined,
  'harry-innes': { reason: 'x', date: '2026-01-01', replace: [{ old: 'text that never existed', new: 'other' }] },
} })
r = run([], stale)
assert.equal(r.status, 0, r.stderr)
assert.match(r.stdout, /2 stale/)
assert.match(r.stdout, /no records found/)
assert.equal(run(['--check'], stale).status, 2)
assert.deepEqual(snap(), before)
ok('stale overrides are reported (exit 0); --check exits 2')

// 5. county/years apply on all relevant copies, then restore
const cy = tmpOverrides({ version: 1, overrides: { 'harry-innes': { reason: 'x', date: '2026-01-01', historyId: 'harry-innes-frankfort-1783-1816', county: 'Fayette', yearStart: 1790, yearEnd: 1800 } } })
r = run([], cy)
assert.equal(r.status, 0, r.stderr)
assert.equal(read(FILES[0]).stories.find((s) => s.slug === 'harry-innes').county, 'Fayette')
const hp = read(FILES[3]).features.find((f) => f.properties.id === 'harry-innes-frankfort-1783-1816').properties
assert.deepEqual([hp.county, hp.yearStart, hp.year_start, hp.yearEnd, hp.year_end], ['Fayette', 1790, 1790, 1800, 1800])
assert.equal(read(FILES[4]).find((p) => p.id === 'harry-innes-frankfort-1783-1816').year_end, 1800)
assert.equal(read('public/content/stories/harry-innes.json').yearStart, 1790)
ok('county and years update story json, index, geojson, History layer and ky-history')

// 5b. pin-rounding rule (#141): prehistoric/archaeological pins rounded; allowlist, county-level and modern places untouched
const none = tmpOverrides({ version: 1, overrides: {} })
const setPin = (slug, hid, lat, lon) => {
  let d = read(FILES[0]); Object.assign(d.stories.find((x) => x.slug === slug), { lat, lon }); write(FILES[0], d, 2)
  d = read(FILES[1]); Object.assign(d.locations[slug], { lat, lon }); write(FILES[1], d, 2)
  d = read(FILES[2]); d.features.find((f) => f.properties.slug === slug).geometry.coordinates = [lon, lat]; write(FILES[2], d)
  if (hid) {
    d = read(FILES[3]); d.features.find((f) => f.properties.id === hid).geometry.coordinates = [lon, lat]; write(FILES[3], d)
    d = read(FILES[4]); Object.assign(d.find((x) => x.id === hid), { latitude: lat, longitude: lon }); write(FILES[4], d, 2)
  }
}
const pinOf = (slug) => { const x = read(FILES[0]).stories.find((y) => y.slug === slug); return [x.lat, x.lon] }
const historyPin = (hid) => read(FILES[3]).features.find((f) => f.properties.id === hid).geometry.coordinates
const DOVER = 'dover-mound-mason-county'
const DOVER_H = 'dover-mound-adena-mason-county'
setPin(DOVER, DOVER_H, 38.756412, -83.884411) // prehistoric, not allowlisted
setPin('harry-innes', 'harry-innes-frankfort-1783-1816', 38.193912, -84.865812) // modern (frontier): must stay
setPin('page-site-lost-city-15lo1', null, 36.824611, -86.848911) // county-level allowlist: must stay
setPin('mount-horeb-earthworks', 'mount-horeb-adena-park', 38.1588727, -84.4652044) // tier C: must stay
r = run([], none)
assert.equal(r.status, 0, r.stderr)
assert.match(r.stdout, /pin-rounding: 1 prehistoric\/archaeological story pin\(s\) rounded: dover-mound-mason-county/)
assert.deepEqual(pinOf(DOVER), [38.76, -83.88])
assert.deepEqual(historyPin(DOVER_H), [-83.88, 38.76])
assert.deepEqual(pinOf('harry-innes'), [38.193912, -84.865812])
assert.deepEqual(historyPin('harry-innes-frankfort-1783-1816'), [-84.865812, 38.193912])
assert.deepEqual(pinOf('page-site-lost-city-15lo1'), [36.824611, -86.848911])
assert.deepEqual(pinOf('mount-horeb-earthworks'), [38.1588727, -84.4652044])
const rounded = snap()
r = run([], none)
assert.match(r.stdout, /pin-rounding: 0 /)
assert.deepEqual(snap(), rounded)
assert.equal(run(['--check'], none).status, 0)
ok('pin rounding: prehistoric rounded in every copy; tier C, county-level and modern places untouched; idempotent')

// 6. malformed files fail clearly (exit 1)
const bad = [
  ['invalid JSON', '{ nope', /cannot read\/parse/],
  ['no overrides key', '{"version":1}', /"overrides" object/],
  ['missing reason', { overrides: { a: { date: '2026-01-01', county: 'X' } } }, /"reason"/],
  ['bad date', { overrides: { a: { reason: 'r', date: 'yesterday', county: 'X' } } }, /"date"/],
  ['lat without lon', { overrides: { a: { reason: 'r', date: '2026-01-01', lat: 1 } } }, /together/],
  ['unknown field', { overrides: { a: { reason: 'r', date: '2026-01-01', zoom: 3 } } }, /unknown field "zoom"/],
  ['identical replace', { overrides: { a: { reason: 'r', date: '2026-01-01', replace: [{ old: 'x', new: 'x' }] } } }, /identical/],
  ['nothing to apply', { overrides: { a: { reason: 'r', date: '2026-01-01' } } }, /nothing to apply/],
]
for (const [name, content, re] of bad) {
  r = run([], tmpOverrides(content))
  assert.equal(r.status, 1, `${name}: expected exit 1, got ${r.status}`)
  assert.match(r.stderr, re, name)
}
ok(`malformed overrides file exits 1 with a clear message (${bad.length} cases)`)
fs.rmSync(tmp, { recursive: true, force: true })
console.log('all story-override tests passed')
