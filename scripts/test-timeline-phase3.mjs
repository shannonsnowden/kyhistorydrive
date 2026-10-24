#!/usr/bin/env node
// #338 (v2 Phase 3): the Timeline in-page reader is retired. Rows link to /stories/<slug>/,
// the #about / #app hash views are gone, and old /#timeline/<slug> links still forward.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { timelineForwardUrl } from '../src/story-url.js'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const html = read('index.html')
const main = read('src/main.js')

for (const id of ['timelineStoryReader', 'timelineReaderJump', 'timelineJumpHome']) {
  assert.ok(!html.includes(`id="${id}"`), `index.html still has #${id}`)
}
assert.doesNotMatch(html, /<section id="about"/, 'index.html still has the #about view')
assert.doesNotMatch(html, /<section id="app"/, 'index.html still has the #app view')

for (const fn of ['showStoryInReader', 'closeTimelineReader', 'openNextTimelineStory', 'placeTimelineReaderAfter', 'timelineReaderBarHtml']) {
  assert.ok(!new RegExp(`\\b${fn}\\b`).test(main), `main.js still has ${fn}`)
}
assert.doesNotMatch(main, /[`'"]\/?#timeline\/\$\{/, 'main.js still builds #timeline/<slug>')
assert.match(main, /class="timeline-link" href="\$\{escapeHtml\(storyUrl\(s\.slug\)\)\}"/, 'timeline rows must link to the story page')
assert.match(main, /view === 'about' \|\| view === 'app'\) \{\s*location\.replace\('\/about\/'\)/, 'old #about/#app must forward to /about/')

// Old shared links keep landing on the story page.
const fwd = timelineForwardUrl('#timeline/battle-of-blue-licks', '/')
assert.equal(new URL(fwd, 'https://kyhistorydrive.com').pathname, '/stories/battle-of-blue-licks/')
assert.equal(timelineForwardUrl('#timeline', '/'), null)
console.log('test-timeline-phase3: OK')

// Critiquito #347 follow-ups: one count line, labeled jump buttons, Era/Years labels.
{
  const fs2 = await import('node:fs')
  const html = fs2.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const js = fs2.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  if (!/nav-jump-label">Back to filters</.test(html)) throw new Error('jump button must read "Back to filters"')
  if (!/nav-jump-label">Jump to stories</.test(html)) throw new Error('jump button must read "Jump to stories"')
  if (!/filter-label[^>]*>Era</.test(html) || !/filter-label[^>]*>Years</.test(html)) throw new Error('Era / Years labels missing')
  if (/in this filter · \$\{withCounty\}/.test(js)) throw new Error('duplicate count line still rendered')
  if (!/stories · \$\{withCounty\} with county`/.test(js)) throw new Error('merged count line missing')
  console.log('test-timeline-phase3: Critiquito follow-ups OK')
}
