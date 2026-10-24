#!/usr/bin/env node
// #339 (v2 Phase 4): a map pin tied to a story shows a teaser card (name, optional <=35-word
// teaser from KY History, "Read the story"); phones get a map-first bottom sheet.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pinCardHtml, teaserWordCount, PIN_TEASER_MAX_WORDS, usePhoneSheet, phoneSheetPinY } from '../src/pin-card.js'
import { PIN_TEASERS } from '../src/pin-teasers.js'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const html = pinCardHtml({ name: 'Fort <Boonesborough>', layerLabel: 'History', meta: 'Madison Co. · 1775', slug: 'fort-boonesborough', teaser: '', escapeHtml: esc })
assert.match(html, /<h3>Fort &lt;Boonesborough&gt;<\/h3>/)
assert.match(html, /<a class="btn pin-card-read" href="\/stories\/fort-boonesborough\/">Read the story<\/a>/)
assert.doesNotMatch(html, /pin-card-teaser/, 'no teaser paragraph when there is none')
assert.doesNotMatch(html, /popup-full-text/, 'story pins no longer carry the full text')
const t = pinCardHtml({ name: 'X', layerLabel: 'History', meta: '', slug: 'x', teaser: 'A short teaser.', escapeHtml: esc })
assert.match(t, /<p class="pin-card-teaser">A short teaser\.<\/p>/)
assert.throws(() => pinCardHtml({ name: 'X', slug: 'bad/../slug', escapeHtml: esc }), /slug/)

assert.equal(PIN_TEASER_MAX_WORDS, 35)
assert.equal(teaserWordCount('one two  three'), 3)
assert.equal(usePhoneSheet(390), true)
assert.equal(usePhoneSheet(600), true)
assert.equal(usePhoneSheet(1024), false)
assert.ok(phoneSheetPinY(800) < 800 * 0.4, 'phone sheet parks the pin in the upper map, above the sheet')

// KY History teasers: each <= 35 words, keyed by a real story slug, at most 16.
const stories = JSON.parse(fs.readFileSync(new URL('../public/content/stories.json', import.meta.url))).stories
const known = new Set(stories.map((s) => s.slug))
const entries = Object.entries(PIN_TEASERS)
assert.ok(entries.length <= 16, 'Phase 4 scope is 16 teasers')
for (const [slug, text] of entries) {
  assert.ok(known.has(slug), `teaser for unknown story ${slug}`)
  assert.ok(teaserWordCount(text) <= PIN_TEASER_MAX_WORDS, `${slug} teaser is over ${PIN_TEASER_MAX_WORDS} words`)
}

// Wiring: main.js uses the card for story pins; data_version bumped past v2's.
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert.match(main, /pinCardHtml\(/, 'main.js renders story pins with pinCardHtml')
assert.match(main, /ky-sheet/, 'main.js opens the phone bottom sheet')
const manifest = JSON.parse(fs.readFileSync(new URL('../public/data/app/ky-history-manifest.json', import.meta.url)))
assert.ok(manifest.data_version >= 92, `data_version ${manifest.data_version} must be bumped for Phase 4 (v2 has 90, #345 has 91)`)
console.log(`test-pin-cards: OK (${entries.length} teasers)`)
