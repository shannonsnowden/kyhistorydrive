#!/usr/bin/env node
// #339 (v2 Phase 4): a map pin tied to a story shows a teaser card (name, optional <=35-word
// teaser from KY History, "Read the story"); phones get a map-first bottom sheet.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pinCardHtml, teaserWordCount, PIN_TEASER_MAX_WORDS, usePhoneSheet, phoneSheetPinY, phoneSheetLayout, isSameOriginStoryHref } from '../src/pin-card.js'
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

// Read-the-story links must stay on the site: same origin AND a /stories/ path.
const base = 'https://kyhistorydrive.com/map/'
assert.equal(isSameOriginStoryHref('/stories/x/', base), true)
assert.equal(isSameOriginStoryHref('https://kyhistorydrive.com/stories/x/', base), true)
assert.equal(isSameOriginStoryHref('//evil.com/stories/x/', base), false, 'protocol-relative off-site link rejected')
assert.equal(isSameOriginStoryHref('https://kyhistorydrive.com.evil.com/stories/x/', base), false, 'look-alike host rejected')
assert.equal(isSameOriginStoryHref('/about/', base), false)
assert.equal(isSameOriginStoryHref('http://[bad', base), false)
assert.equal(isSameOriginStoryHref('javascript:alert(1)//stories/x/', base), false, 'javascript: rejected')
assert.equal(isSameOriginStoryHref('data:text/html,<a href=/stories/x/>', base), false, 'data: rejected')
assert.equal(isSameOriginStoryHref('https://kyhistorydrive.com@evil.com/stories/x/', base), false, 'userinfo host trick rejected')
assert.equal(isSameOriginStoryHref('https://user:pw@kyhistorydrive.com/stories/x/', base), false, 'userinfo on our host rejected')
assert.equal(isSameOriginStoryHref('//evil.com/stories/x/', base), false, '//evil rejected')
assert.equal(isSameOriginStoryHref('http://kyhistorydrive.com/stories/x/', base), false, 'http downgrade rejected')
assert.equal(isSameOriginStoryHref('/\\evil.com/stories/x/', base), false, 'backslash trick rejected')
assert.equal(isSameOriginStoryHref('\\\\evil.com/stories/x/', base), false, 'double backslash rejected')
const cmc = fs.readFileSync(new URL('./check-map-canvas.mjs', import.meta.url), 'utf8')
assert.match(cmc, /isSameOriginStoryHref\(info\.readHref, base\)/, 'check-map-canvas uses the origin+path check')

// Protected story pins (Hardin, Peter Village) keep the 'approximate location' note in the card.
const note = '<p class="popup-protected" data-protected-pin>Approximate location (within ~6 mi) to protect the site.</p>'
const prot = pinCardHtml({ name: 'P', layerLabel: 'History', slug: 'p', protectedNote: note, escapeHtml: esc })
assert.ok(prot.includes(note), 'protected note rendered in the pin card')
assert.ok(prot.indexOf(note) < prot.indexOf('pin-card-read'), 'note sits above Read the story')
assert.doesNotMatch(html, /data-protected-pin/, 'unprotected pins have no note')

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
assert.match(main, /ensureHighlightSource\(map, \{ lon, lat, title: [^}]*layerId: placeLayer \}\)\s*\n\s*await showDetailPopup\(feature, placeLayer/, 'map deep links mark the selected pin in its layer color')
assert.match(main, /protectedNote:\s*protectedPinNoteHtml\(/, 'main.js passes protectedPinNoteHtml into pinCardHtml')
const manifest = JSON.parse(fs.readFileSync(new URL('../public/data/app/ky-history-manifest.json', import.meta.url)))
assert.equal(manifest.data_version, 103, `data_version ${manifest.data_version} must be 103 (merge order after v2 96: #346=97, #347=98, #348=99, #350=100, #355=101, item 88 Turk/Read=102, item 88 next-7=103)`)

// Critiquito fixes on #350.
const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const sheet = css.match(/\.ky-popup\.ky-sheet\s*\{([^}]*)\}/)
assert.ok(sheet, 'phone sheet rule exists')
assert.match(sheet[1], /position:\s*fixed\s*!important/, 'phone sheet is fixed to the viewport so the footer cannot show below it')
assert.match(css, /a\.pin-card-read:focus-visible\s*\{[^}]*outline:\s*3px solid[^}]*outline-offset:\s*0[^}]*box-shadow:\s*none/, 'Read the story has a single clean focus ring')
assert.match(main, /metaBits\.push\(pinEraLabel\(p\.era\)/, 'detail meta uses the capitalized era label (Frontier)')
assert.doesNotMatch(main, /metaBits\.push\(p\.era\)/, 'no raw lowercase era in pin meta')
assert.match(main, /function highlightColor\(focus\)[\s\S]*?DATA_LAYERS\.find/, 'selected pin color follows its layer swatch')

// Critiquito recheck 2 (#350 @9294cec9): on phones the sheet must not hide the map or the pin.
{
  // Deep link: map far below the fold (top 2051px), 506px tall, 844px viewport, 64px sticky header.
  const L = phoneSheetLayout({ mapTop: 2051, mapBottom: 2557, viewportHeight: 844, headerBottom: 64 })
  const top = 2051 - L.scrollBy
  assert.equal(top, 64, 'page scrolls so the map sits just under the header')
  const pinViewportY = top + L.pinY
  assert.ok(pinViewportY > 64 && pinViewportY < 844 * 0.55, `pin (${pinViewportY}) is above the sheet`)
  // Map already in view with room above the sheet: no page jump.
  const K = phoneSheetLayout({ mapTop: 70, mapBottom: 576, viewportHeight: 844, headerBottom: 64 })
  assert.equal(K.scrollBy, 0)
  assert.ok(70 + K.pinY > 64 && 70 + K.pinY < 844 * 0.55)
}
assert.match(main, /phoneSheetLayout\(/, 'main.js lays out the phone sheet with phoneSheetLayout')
assert.match(main, /focusAfterOpen:\s*!storySlug/, 'pin card does not auto-focus Read the story (no dark focus edge on open)')
assert.match(css, /\.pin-card:focus\s*\{[^}]*outline:\s*none/, 'card container takes focus without a ring')
console.log(`test-pin-cards: OK (${entries.length} teasers)`)
