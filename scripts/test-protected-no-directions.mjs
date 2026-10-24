#!/usr/bin/env node
/**
 * Protected sites never get directions (the /about/ promise; Critiquito #345).
 * 1) Popup/story-detail code: the Apple Maps / Google Maps / Photos on Google block
 *    is only rendered when no candidate id is a protected pin.
 * 2) Built output: every protected story's page has no maps.apple, google.com/maps
 *    or "Photos on Google" link.
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { takeADriveHtml } from '../src/take-a-drive.js'
import { isProtectedStory } from './lib/unified-story-data.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8')

// --- 1) code guard ---
const fnStart = main.indexOf('function placeDetailExtrasHtml(')
assert.ok(fnStart > 0, 'placeDetailExtrasHtml not found')
const fnBody = main.slice(fnStart, main.indexOf('\n}\n', fnStart))
assert.match(fnBody, /protectedIds/, 'placeDetailExtrasHtml must take protectedIds')
assert.match(fnBody, /isProtectedPin\(/, 'placeDetailExtrasHtml must check isProtectedPin before mapsLinksHtml')
const calls = [...main.matchAll(/(?<!function )placeDetailExtrasHtml\(\{([\s\S]*?)\}\)/g)].map((m) => m[1])
assert.ok(calls.length >= 2, 'expected popup and story callers')
for (const c of calls) assert.match(c, /protectedIds:/, 'every placeDetailExtrasHtml caller must pass protectedIds')

// --- 2) built output ---
// Editor 10/24: no 'Find photos ↗' (Historypin at the rounded point) on protected pages either.
// Critiquito 10/24: no route-builder entry either (Plan a drive card, add-to-route, /drives/build deep links).
const ROUTE_BAD = [/drives\/build/i, /Plan a drive/i, /route builder/i, /class="[^"]*usp-drive/i, /add-to-route|add-to-drive|data-add-stop/i]
const BAD = [/maps\.apple\.com/i, /google\.com\/maps/i, /Photos on Google/i, /Find photos/i, /historypin\.org/i, ...ROUTE_BAD]
const badOn = (html) => BAD.filter((re) => re.test(html))

// plant (fictional site): a route-builder card on a protected page must fail
{
  const plant = `<aside class="usp-section usp-drive" id="drive"><p class="usp-drive-kicker">Plan a drive</p><h2>Build a route from Sampletown</h2><a class="usp-btn" href="/drives/build/#start=Sampletown">Open route builder →</a></aside>`
  assert.ok(badOn(plant).length >= 3, 'planted Plan a drive / route builder card on Example Site 15XX999 must fail')
  assert.ok(badOn('<button class="add-to-route" data-add-stop="example-site-15xx999">Add</button>').length, 'planted add-to-route button must fail')
}
// popup code: the map popup/detail builder never offers a route-builder entry
for (const re of ROUTE_BAD) assert.ok(!re.test(fnBody), `placeDetailExtrasHtml offers a route-builder entry (${re})`)
const pins = JSON.parse(fs.readFileSync(path.join(root, 'public/data/web/protected-pins.json'), 'utf8'))
const ids = new Set(pins.ids || [])
const dist = path.join(root, 'dist')
let checked = 0
if (fs.existsSync(path.join(dist, 'stories'))) {
  for (const id of ids) {
    const f = path.join(dist, 'stories', id, 'index.html')
    if (!fs.existsSync(f)) continue
    const html = fs.readFileSync(f, 'utf8')
    const hit = badOn(html)
    assert.ok(!hit.length, `protected page ${id} shows a directions/maps/route-builder link (${hit.join(', ')})`)
    checked++
  }
  assert.ok(checked > 0, 'no protected story pages found in dist')
  assert.ok(fs.existsSync(path.join(dist, 'stories/peter-village-enclosure-15fa166/index.html')), 'Peter Village page missing')
  // unprotected control: an ordinary story page still shows the Plan a drive card
  const control = fs.readFileSync(path.join(dist, 'stories/jack-jouett-kentuckys-midnight-rider/index.html'), 'utf8')
  assert.ok(/class="usp-section usp-drive"/.test(control) && /Plan a drive/.test(control), 'control: unprotected story lost its Plan a drive card')
}
// --- 3) popup / story-photos data: protected entries carry no directions link and no site plan ---
const DATA_BAD = [/maps\.apple\.com/i, /google\.com\/maps/i, /historypin\.org/i, /drives\/build/i, /[?&](daddr|destination)=/i]
function dataHits(entries, isProt) {
  const out = []
  for (const [k, v] of entries) {
    if (!isProt(k)) continue
    const txt = JSON.stringify(v)
    for (const re of DATA_BAD) if (re.test(txt)) out.push(`${k}: ${re}`)
  }
  return out
}
const protKey = (k) => ids.has(String(k).replace(/-[a-z]+-county$/, '')) || ids.has(k)
{
  // fictional plant: a directions link in a protected popup/story-photos entry must fail; unprotected control passes
  const plant = [['example-site-15xx999', { photo: { image_url: '/x.jpg', source_url: 'https://maps.apple.com/?daddr=Sampletown' } }]]
  assert.ok(dataHits(plant, (k) => k === 'example-site-15xx999').length, 'planted directions link in a protected story-photos entry must fail')
  assert.ok(!dataHits(plant, () => false).length, 'control: the same entry on an unprotected story is out of scope')
  // fictional plant on a built protected page
  const page = '<article><a href="https://www.google.com/maps/dir/?api=1&destination=Sampletown">Directions</a></article>'
  assert.ok(badOn(page).length, 'planted directions link on a protected built page must fail')
}
let dataChecked = 0
for (const rel of ['public/content/story-photos.json', 'dist/content/story-photos.json']) {
  const f = path.join(root, rel)
  if (!fs.existsSync(f)) continue
  const j = JSON.parse(fs.readFileSync(f, 'utf8'))
  const entries = Object.entries(j.bySlug || j.stories || j)
  const hits = dataHits(entries, protKey)
  assert.ok(!hits.length, `${rel}: protected entry has a directions link: ${hits.join('; ')}`)
  assert.ok(!fs.readFileSync(f, 'utf8').includes('peter-village-enclosure-15fa166.jpg'), `${rel}: Peter Village plan image is back`)
  dataChecked++
}
for (const rel of ['public/content/photos/stories/peter-village-enclosure-15fa166.jpg', 'dist/content/photos/stories/peter-village-enclosure-15fa166.jpg']) {
  assert.ok(!fs.existsSync(path.join(root, rel)), `${rel} must not exist (protected site plan)`)
}

// --- 4) Take a Drive: the reader path and story-drives.json never offer a drive for a protected story ---
{
  const data = { drives: { 'sample-trail': { name: 'Sample Trail' } }, stories: { 'example-site-15xx999': ['sample-trail'], 'sampletown-story': ['sample-trail'] } }
  assert.equal(takeADriveHtml(data, 'example-site-15xx999', { isProtected: true }), '', 'takeADriveHtml must return no drive markup for a protected story (Example Site 15XX999)')
  assert.match(takeADriveHtml(data, 'sampletown-story', { isProtected: false }), /take-a-drive-btn/, 'control: an unprotected story still gets its Take a Drive button')
  // fail closed: no isProtected (or an unknown value) means no drive markup
  assert.equal(takeADriveHtml(data, 'sampletown-story'), '', 'takeADriveHtml with no isProtected must fail closed (no drive markup)')
  assert.equal(takeADriveHtml(data, 'sampletown-story', {}), '', 'takeADriveHtml with isProtected undefined must fail closed')
  assert.equal(takeADriveHtml(data, 'sampletown-story', { isProtected: undefined }), '', 'takeADriveHtml with isProtected undefined must fail closed')
  // the reader only says "not protected" once the protected list actually loaded
  assert.match(main, /protectedPinsLoaded\(\)/, 'src/main.js must check protectedPinsLoaded() before offering Take a Drive')
  // the in-app reader (src/main.js) passes the protected check
  const callers = [...main.matchAll(/takeADriveHtml\(([^\n]*)\)/g)].map((m) => m[1])
  assert.ok(callers.length >= 1 && callers.every((c) => /isProtected:/.test(c)), `every takeADriveHtml call in src/main.js must pass isProtected: ${callers.join(' | ')}`)
}
let drivesChecked = 0
for (const rel of ['public/data/web/story-drives.json', 'dist/data/web/story-drives.json']) {
  const f = path.join(root, rel)
  if (!fs.existsSync(f)) continue
  const sd = JSON.parse(fs.readFileSync(f, 'utf8'))
  const bad = Object.keys(sd.stories || {}).filter((slug) => {
    const sf = path.join(root, 'public/content/stories', `${slug}.json`)
    return ids.has(slug) || isProtectedStory(fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : { slug })
  })
  assert.ok(!bad.length, `${rel} maps protected stories to drives: ${bad.join(', ')}`)
  drivesChecked++
}

console.log(`test-protected-no-directions: OK (code guard; ${checked} protected pages clean; ${dataChecked} story-photos files clean; ${drivesChecked} story-drives files clean)`)
