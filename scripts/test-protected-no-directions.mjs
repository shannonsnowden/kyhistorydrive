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
const BAD = [/maps\.apple\.com/i, /google\.com\/maps/i, /Photos on Google/i, /Find photos/i, /historypin\.org/i]
const pins = JSON.parse(fs.readFileSync(path.join(root, 'public/data/web/protected-pins.json'), 'utf8'))
const ids = new Set(pins.ids || [])
const dist = path.join(root, 'dist')
let checked = 0
if (fs.existsSync(path.join(dist, 'stories'))) {
  for (const id of ids) {
    const f = path.join(dist, 'stories', id, 'index.html')
    if (!fs.existsSync(f)) continue
    const html = fs.readFileSync(f, 'utf8')
    for (const re of BAD) assert.ok(!re.test(html), `protected page ${id} shows a directions/maps link (${re})`)
    checked++
  }
  assert.ok(checked > 0, 'no protected story pages found in dist')
  assert.ok(fs.existsSync(path.join(dist, 'stories/peter-village-enclosure-15fa166/index.html')), 'Peter Village page missing')
}
console.log(`test-protected-no-directions: OK (code guard; ${checked} protected pages clean)`)
