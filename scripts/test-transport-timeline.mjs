#!/usr/bin/env node
/**
 * Roads & Rails timeline (#291 follow-up): the slider start comes from the data, and every
 * opening event has a tick (merged ticks carry all of their events).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TIMELINE_PAD_YEARS,
  TIMELINE_MAX_YEAR,
  openingEvents,
  sliderMinYear,
  groupTicks,
} from '../src/transport-timeline.js'

const secs = JSON.parse(readFileSync(new URL('../public/maps/transport/sections.geojson', import.meta.url), 'utf8'))
const events = openingEvents(secs.features)
// Dated events only: each dated section's opening (unless tick: false) plus its milestones.
const props = secs.features.map((f) => f.properties)
const dated = props.filter((p) => !p.undated)
const expected = dated.filter((p) => p.tick !== false).length + dated.reduce((n, p) => n + (p.milestones || []).length, 0)
assert.equal(events.length, expected, 'one event per dated opening and milestone')
const undated = props.filter((p) => p.undated)
assert.ok(undated.every((p) => !events.some((e) => e.id.split('@')[0] === p.id)), 'undated trails have no tick')
assert.ok(undated.every((p) => p.openedLabel === 'Before 1775'), "undated trails read 'Before 1775'")
// Every section is sourced.
assert.ok(props.every((p) => (p.sources?.length || p.source)), 'every section has a source')
assert.ok(events.length > 0)

const earliest = Math.min(...events.map((e) => e.year))
assert.ok(Number.isInteger(TIMELINE_PAD_YEARS) && TIMELINE_PAD_YEARS >= 0)
assert.equal(sliderMinYear(events), earliest - TIMELINE_PAD_YEARS, 'slider min = earliest event - pad')

assert.equal(sliderMinYear(events), 1775, 'slider starts at 1775 (Boone\'s Trace and the Wilderness Road trace)')
// A synthetic earlier event moves the start on its own.
assert.equal(sliderMinYear([...events, { id: 'x', year: 1760, name: 'X', kind: 'road' }]), 1760 - TIMELINE_PAD_YEARS)

const min = sliderMinYear(events)
for (const [label, widthPx] of [['desktop', 360], ['phone 390', 300], ['very narrow', 120]]) {
  const ticks = groupTicks(events, { min, max: TIMELINE_MAX_YEAR, widthPx })
  const combined = ticks.flatMap((t) => t.events)
  assert.equal(combined.length, events.length, `${label}: tick events == event count`)
  assert.equal(new Set(combined.map((e) => e.id)).size, events.length, `${label}: each event in exactly one tick`)
  for (const t of ticks) {
    assert.ok(t.events.length >= 1)
    assert.equal(t.label, t.events.length > 1 ? `${t.events[0].name} +${t.events.length - 1}` : t.events[0].name)
    assert.ok(t.pct >= 0 && t.pct <= 100)
  }
  const years = new Set(events.map((e) => e.year))
  assert.ok(ticks.length <= years.size, `${label}: same-year events share a tick`)
}
const wide = groupTicks(events, { min, max: TIMELINE_MAX_YEAR, widthPx: 360 })
const narrow = groupTicks(events, { min, max: TIMELINE_MAX_YEAR, widthPx: 120 })
assert.ok(narrow.length < wide.length, 'narrow tracks merge nearby years')

// The page and map script no longer hard-code the old start.
const js = readFileSync(new URL('../src/transport-map.js', import.meta.url), 'utf8')
assert.ok(!/MIN_YEAR\s*=\s*1[78]\d\d/.test(js), 'no hard-coded MIN_YEAR in transport-map.js')
const html = readFileSync(new URL('../roads-and-rails/index.html', import.meta.url), 'utf8')
const sliderTag = /<input[^>]*id="transportYear"[^>]*>/.exec(html)?.[0] || ''
assert.ok(sliderTag && !/\smin="|aria-valuemin="/.test(sliderTag), 'slider min is set from data, not hard-coded in the page')
assert.ok(html.includes('id="transportTicks"'), 'tick container present')
console.log(`test-transport-timeline: OK (${events.length} events, min ${min}, pad ${TIMELINE_PAD_YEARS}, ${wide.length}/${narrow.length} ticks)`)
