/**
 * Timeline panel: four events before and after the story year, with duplicates
 * dropped, and markup that never prints a coordinate.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  pickTimelineEvents,
  storyTimelineHtml,
  storyTimelineForStory,
} from '../src/story-tools.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stories = JSON.parse(fs.readFileSync(path.join(root, 'public/content/stories.json'), 'utf8')).stories
const bySlug = new Map(stories.map((story) => [story.slug, story]))
const story = (slug) => {
  const row = bySlug.get(slug)
  assert.ok(row, slug)
  return row
}

const bardstown = pickTimelineEvents(story('bardstown'), stories)
const logan = pickTimelineEvents(story('benjamin-logan'), stories)
const annis = pickTimelineEvents(story('carlston-annis-shell-mound'), stories)

function titles(side) {
  return side.map((event) => event.title)
}

assert.equal(bardstown.current.slug, 'bardstown')
assert.ok(bardstown.before.length >= 3 && bardstown.before.length <= 4, titles(bardstown.before).join(' | '))
assert.ok(bardstown.after.length >= 3 && bardstown.after.length <= 8, titles(bardstown.after).join(' | '))
assert.ok(bardstown.before.length + bardstown.after.length <= 8)
assert.ok(titles(bardstown.before).some((title) => /George Rogers Clark/.test(title)))
assert.ok(titles(bardstown.before).some((title) => /Patterson/.test(title)))
assert.ok(titles(bardstown.after).some((title) => /Elizabethtown|Frankfort|Lawrenceburg/.test(title)))
assert.ok(!titles(bardstown.before).some((title) => title === 'Bardstown'))
assert.ok(!titles(bardstown.after).some((title) => title === 'Bardstown'))

const lawrenceburg = [...bardstown.before, ...bardstown.after].filter((event) => /Lawrenceburg/i.test(event.title))
assert.ok(lawrenceburg.length <= 1, titles(lawrenceburg).join(' | '))

assert.equal(logan.current.title, 'Benjamin Logan')
assert.ok(logan.before.length >= 3 && logan.before.length <= 4, titles(logan.before).join(' | '))
assert.ok(logan.after.length >= 3 && logan.after.length <= 8, titles(logan.after).join(' | '))
assert.ok(logan.before.every((event) => event.cy <= 1775), titles(logan.before).join(' | '))
assert.ok(logan.after.every((event) => event.cy >= 1775), titles(logan.after).join(' | '))
assert.deepEqual(
  logan.before.map((event) => event.cy),
  [...logan.before].map((event) => event.cy).sort((a, b) => a - b),
)

assert.equal(annis.before.length, 0, titles(annis.before).join(' | '))
assert.ok(annis.after.length >= 4 && annis.after.length <= 8, titles(annis.after).join(' | '))
for (const name of ['Chiggerville', 'Indian Knoll', 'Read Shell Midden', 'Cloudsplitter']) {
  assert.ok(titles(annis.after).some((title) => title.includes(name)), `${name} missing from ${titles(annis.after).join(' | ')}`)
}
assert.deepEqual(
  titles(annis.after),
  [...annis.after].sort((a, b) => a.cy - b.cy || String(a.title).localeCompare(String(b.title))).map((event) => event.title),
)

const again = pickTimelineEvents(story('bardstown'), stories)
assert.deepEqual(
  [...bardstown.before, ...bardstown.after].map((event) => event.slug),
  [...again.before, ...again.after].map((event) => event.slug),
)

const undated = { slug: 'no-year', title: 'No year', yearStart: null, yearEnd: null, era: 'other', tags: ['salt'] }
const noPanel = pickTimelineEvents(undated, stories)
assert.equal(noPanel.current, null)
assert.equal(storyTimelineHtml(undated, stories), '')

const here = {
  slug: 'here',
  title: 'Here',
  yearStart: 1800,
  yearEnd: 1800,
  era: 'frontier',
  tags: ['salt'],
  county: 'Nelson',
  lat: 37.8,
  lon: -85.4,
  matchedPlace: 'Here',
}
const markerPick = pickTimelineEvents(here, [here], [
  { id: '1', title: 'Early marker', county: 'Nelson', yearStart: 1790 },
  { id: '2', title: 'Late marker', county: 'Nelson', yearStart: 1810 },
  { id: '3', title: 'Too late', county: 'Nelson', yearStart: 1900 },
  { id: '4', title: 'Other county', county: 'Clark', yearStart: 1802 },
  { id: '9', title: 'Route marker', county: 'Nelson', yearStart: 1795 },
], { excludeMarkerIds: ['9'] })
assert.deepEqual(markerPick.before.map((event) => event.id), ['1'])
assert.deepEqual(markerPick.after.map((event) => event.id), ['2'])
assert.ok(markerPick.before.every((event) => event.kind === 'marker'))
assert.ok(![...markerPick.before, ...markerPick.after].some((event) => event.lat != null || event.lon != null))

const springfieldTitles = ['Springfield Founding and Washington County Seat', 'Springfield, first county seat after statehood']
const anchor = {
  slug: 'anchor',
  title: 'Anchor story',
  yearStart: 1776,
  yearEnd: 1776,
  era: 'frontier',
  tags: ['town-founding'],
  county: 'Washington',
  matchedPlace: 'Somewhere else',
  lat: 37.69,
  lon: -85.22,
}
const springfield = stories.filter((item) => springfieldTitles.includes(item.title))
const springfieldPick = pickTimelineEvents(anchor, [anchor, ...springfield])
const kept = [...springfieldPick.before, ...springfieldPick.after].map((event) => event.title)
assert.equal(kept.filter((title) => springfieldTitles.includes(title)).length, 1, kept.join(' | '))

for (const slug of ['bardstown', 'benjamin-logan', 'carlston-annis-shell-mound']) {
  const panel = storyTimelineForStory(story(slug), stories)
  const html = panel.html
  assert.match(html, /<button type="button" class="story-timeline-toggle" aria-expanded="true"/)
  assert.match(html, /aria-controls="storyTimelineList"/)
  assert.match(html, /Kentucky history around /)
  assert.match(html, /<ol class="st-list" id="storyTimelineList">/)
  assert.doesNotMatch(html, /<ol[^>]*\shidden/)
  assert.match(html, /class="st-pin" rel="nofollow"/)
  assert.doesNotMatch(html, /class="st-link"[^>]*nofollow/)
  assert.match(html, /aria-current="page"/)
  assert.match(html, />This story</)
  assert.doesNotMatch(html, /\d+\.\d{2,}/)
  assert.doesNotMatch(html, /\b(?:lat|lon|latitude|longitude)=|data-lat|data-lon|coordinates/i)
  assert.equal(panel.slugs.includes(slug), false)
  const rowCount = html.match(/<li class="st-item/g).length
  assert.equal(rowCount, panel.slugs.length + panel.markerIds.length + 1)
}

const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8')
assert.match(css, /\.st-link:focus-visible/)
assert.match(css, /\.st-pin:focus-visible/)
assert.match(css, /\.story-timeline-toggle:focus-visible/)
assert.match(css, /min-height:\s*44px/)
assert.match(css, /min-width:\s*44px/)
assert.doesNotMatch(css.slice(css.indexOf('.story-timeline {'), css.indexOf('.videos-page .story-head h1')), /#0b2a5b|#c9a227/)

console.log('test-story-timeline: passed')
console.log('bardstown before:', titles(bardstown.before).join(' · '))
console.log('bardstown after:', titles(bardstown.after).join(' · '))
console.log('logan before:', titles(logan.before).join(' · '))
console.log('logan after:', titles(logan.after).join(' · '))
console.log('annis after:', titles(annis.after).join(' · '))
