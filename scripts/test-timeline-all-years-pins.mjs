#!/usr/bin/env node
// Timeline All years / first load must show story place pins.
// The story list already includes every story in that state. Pins are the
// stories that have coordinates (stories.geojson), kept in sync with the list.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  timelineLayerFilter,
  placeMatchesTimelineFilter,
  storyMatchesTimelineFilters,
} from '../src/timeline-map-filter.js'

const ERAS = ['prehistoric', 'native', 'frontier', 'early-commonwealth', 'other']
const NONE = ['==', ['get', 'id'], '__none__']
const STORY = { yearFilter: true, filterByEra: true, storyPlaces: true }
const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'))

const allYears = { eras: new Set(ERAS), yearMin: null, yearMax: null }

// All years shows every story place. Catalog layers stay hidden so All does not dump markers.
assert.equal(timelineLayerFilter(allYears, ERAS, STORY), null)
assert.deepEqual(timelineLayerFilter(allYears, ERAS, { yearFilter: true }), NONE)
assert.deepEqual(
  timelineLayerFilter(allYears, ERAS, { yearFilter: true, filterByEra: true }),
  NONE,
)

// A narrower year still uses the overlap filter the timeline map already applies.
const narrow = { eras: new Set(ERAS), yearMin: 1820, yearMax: 1860 }
const yearOverlap = [
  'all',
  ['has', 'yearStart'],
  ['<=', ['to-number', ['get', 'yearStart']], 1860],
  ['>=', ['to-number', ['coalesce', ['get', 'yearEnd'], ['get', 'yearStart']]], 1820],
]
assert.deepEqual(timelineLayerFilter(narrow, ERAS, { yearFilter: true }), yearOverlap)
assert.deepEqual(timelineLayerFilter(narrow, ERAS, STORY), yearOverlap)

// Era-only catalog layers keep the raw era property. Story places fold
// revolution → frontier and modern → other, same as the story list.
const frontierOnly = { eras: new Set(['frontier']), yearMin: null, yearMax: null }
assert.deepEqual(timelineLayerFilter(frontierOnly, ERAS, { yearFilter: true, filterByEra: true }), [
  'in',
  ['get', 'era'],
  ['literal', ['frontier']],
])
assert.deepEqual(timelineLayerFilter(frontierOnly, ERAS, STORY), [
  'in',
  [
    'case',
    ['==', ['get', 'era'], 'revolution'],
    'frontier',
    ['==', ['get', 'era'], 'modern'],
    'other',
    ['get', 'era'],
  ],
  ['literal', ['frontier']],
])

const noEras = { eras: new Set(), yearMin: null, yearMax: null }
assert.deepEqual(timelineLayerFilter(noEras, ERAS, STORY), NONE)
assert.equal(storyMatchesTimelineFilters({ era: 'frontier', yearStart: 1800 }, noEras), false)

const stories = read('public/content/stories.json').stories
const places = read('public/data/layers/stories.geojson').features

function pinSlugs(state) {
  return new Set(
    places
      .filter((f) => placeMatchesTimelineFilter(f.properties, state, ERAS.length, STORY))
      .map((f) => f.properties.slug),
  )
}
function listedPlaceSlugs(state) {
  return new Set(
    stories
      .filter((s) => storyMatchesTimelineFilters(s, state) && s.lat != null && s.lon != null)
      .map((s) => s.slug),
  )
}

// All years: every listed story that has a place is a pin. County labels are a
// different tally (a story can have a county and no coordinates, or the reverse).
assert.equal(stories.filter((s) => storyMatchesTimelineFilters(s, allYears)).length, stories.length)
assert.deepEqual(pinSlugs(allYears), listedPlaceSlugs(allYears))
assert.equal(pinSlugs(allYears).size, places.length)
assert.ok(pinSlugs(allYears).size > 0)

assert.deepEqual(pinSlugs(narrow), listedPlaceSlugs(narrow))
assert.ok(pinSlugs(narrow).size < pinSlugs(allYears).size)
assert.deepEqual(pinSlugs(frontierOnly), listedPlaceSlugs(frontierOnly))
assert.ok(pinSlugs(frontierOnly).has('battle-of-blue-licks'))

// A story with no year still has a place on All, and drops out of a year window.
const undated = { era: 'other', yearStart: null, yearEnd: null, slug: 'undated', lat: 37, lon: -85 }
assert.equal(storyMatchesTimelineFilters(undated, allYears), true)
assert.equal(placeMatchesTimelineFilter(undated, allYears, ERAS.length, STORY), true)
assert.equal(storyMatchesTimelineFilters(undated, narrow), false)
assert.equal(placeMatchesTimelineFilter(undated, narrow, ERAS.length, STORY), false)

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert.match(main, /from '\.\/timeline-map-filter\.js'/)
assert.match(main, /storyPlaces:\s*true/)
assert.match(main, /function addTimelineStoryPlaces\(/)
assert.match(main, /await addTimelineStoryPlaces\(timelineMap\)/)
assert.match(main, /Showing each story’s place\./)

console.log(`test-timeline-all-years-pins: OK (${pinSlugs(allYears).size} story places on All years)`)
