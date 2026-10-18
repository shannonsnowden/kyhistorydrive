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
  tickLabel,
  layoutTickLabels,
  TICK_MIN_GAP_PX,
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
// Critiquito #326: only same-year events share a tick (no proximity merging); every tick has a visible label.
const distinctYears = [...new Set(events.map((e) => e.year))].sort((a, b) => a - b)
const ticks = groupTicks(events, { min, max: TIMELINE_MAX_YEAR })
assert.equal(ticks.length, distinctYears.length, 'tick count == number of distinct dated years')
assert.deepEqual(ticks.map((t) => t.year), distinctYears, 'one tick per year, in order')
assert.equal(ticks.reduce((n, t) => n + t.events.length, 0), events.length, 'tick events sum to the dated-event count')
assert.equal(new Set(ticks.flatMap((t) => t.events.map((e) => e.id))).size, events.length, 'each event in exactly one tick')
for (const t of ticks) {
  assert.ok(t.events.every((e) => e.year === t.year), `${t.year}: a tick holds only its own year`)
  assert.equal(t.label, t.events.length > 1 ? `${t.year} · ${t.events.length}` : String(t.year))
  assert.equal(t.label, tickLabel(t))
  assert.ok(t.pct >= 0 && t.pct <= 100)
}
assert.equal(tickLabel({ year: 1963, events: new Array(12).fill({}) }), '1963 · 12')
assert.equal(tickLabel({ year: 1851, events: [{}] }), '1851')

// Labels never overlap and stay on the track: ~194px track in the 220px sidebar at 1440, wider panes at 390.
const estWidth = (t) => Math.ceil(t.label.length * 6.4) + 8
for (const [name, widthPx] of [['sidebar 1440', 194], ['phone 390', 330], ['narrow', 150]]) {
  const lay = layoutTickLabels(ticks, { widthPx, labelWidth: estWidth })
  assert.equal(lay.items.length, ticks.length, `${name}: one label per tick`)
  for (const it of lay.items) {
    assert.ok(it.x >= 0 && it.x + it.w <= widthPx + 0.5, `${name}: ${it.label} stays on the track`)
    assert.ok(it.row >= 0 && it.row < lay.rows)
  }
  for (let r = 0; r < lay.rows; r++) {
    const row = lay.items.filter((it) => it.row === r).sort((a, b) => a.x - b.x)
    for (let i = 1; i < row.length; i++) assert.ok(row[i].x >= row[i - 1].x + row[i - 1].w, `${name}: row ${r} labels do not overlap`)
  }
  const crowded = ticks.some((t, i) => i && ((t.pct - ticks[i - 1].pct) / 100) * widthPx < TICK_MIN_GAP_PX)
  if (crowded) assert.ok(lay.rows >= 2, `${name}: close ticks stagger onto two or more rows`)
}
// Two far-apart ticks need only one row; two close ones stagger.
const two = (a, b) => groupTicks([{ id: 'a', year: a, name: 'A' }, { id: 'b', year: b, name: 'B' }], { min: 1775, max: 2000 })
assert.equal(layoutTickLabels(two(1800, 1950), { widthPx: 194, labelWidth: estWidth }).rows, 1)
assert.equal(layoutTickLabels(two(1800, 1802), { widthPx: 194, labelWidth: estWidth }).rows, 2)

// The page and map script no longer hard-code the old start.
const js = readFileSync(new URL('../src/transport-map.js', import.meta.url), 'utf8')
assert.ok(!/MIN_YEAR\s*=\s*1[78]\d\d/.test(js), 'no hard-coded MIN_YEAR in transport-map.js')
const html = readFileSync(new URL('../roads-and-rails/index.html', import.meta.url), 'utf8')
const sliderTag = /<input[^>]*id="transportYear"[^>]*>/.exec(html)?.[0] || ''
assert.ok(sliderTag && !/\smin="|aria-valuemin="/.test(sliderTag), 'slider min is set from data, not hard-coded in the page')
assert.ok(html.includes('id="transportTicks"'), 'tick container present')
console.log(`test-transport-timeline: OK (${events.length} events, ${ticks.length} ticks, min ${min}, pad ${TIMELINE_PAD_YEARS})`)
