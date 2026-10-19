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
  TICK_HIT_MIN_H,
  tickHitAreas,
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
// Editor #326 + Critiquito: the button is the tap target (>=44px tall on touch, sized by tickHitAreas);
// the small visible label is a span inside it.
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
assert.match(css, /\.transport-tick-label\s*\{[^}]*position:\s*absolute/, 'visible label is an inner span')
assert.match(js, /tickHitAreas\(/, 'the map sizes tick buttons with tickHitAreas')
// Editor #326 source fixes. CodeQL js/incomplete-url-substring-sanitization: parse URLs and compare host + path exactly, never substrings.
const parseUrl = (u) => { try { return new URL(u) } catch { return null } }
const isHostPath = (u, host, path) => !!u && u.hostname === host && u.pathname === path
const isSearchResults = (u) => !!u && (u.hostname === 'resources.ohiohistory.org' && u.pathname.startsWith('/ohj/search/') || u.pathname.split('/').includes('search'))
const lime = (secs.features.find((f) => f.properties.id === 'limestone-trace')?.properties.sources || []).map(parseUrl)
assert.ok(lime.length && lime.every(Boolean), 'Limestone Trace sources parse as URLs')
assert.ok(!lime.some(isSearchResults), 'no search-results URLs in Limestone Trace sources')
const mays = (secs.features.find((f) => f.properties.id === 'maysville-turnpike')?.properties.sources || []).map(parseUrl)
assert.ok(isHostPath(mays[0], 'grokipedia.com', '/page/Maysville_Road_veto'), 'Maysville sources lead with Grokipedia')
const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => parseUrl(m[1].replace(/&amp;/g, '&'))).filter(Boolean)
assert.ok(!hrefs.some((u) => u.hostname === 'resources.ohiohistory.org' && u.pathname.startsWith('/ohj/search/')), 'page source list has no Ohio History search-results URL')
const grokIdx = hrefs.findIndex((u) => isHostPath(u, 'grokipedia.com', '/page/Maysville_Road_veto'))
const wikiIdx = hrefs.findIndex((u) => isHostPath(u, 'en.wikipedia.org', '/wiki/Maysville_Road_veto'))
assert.ok(grokIdx > -1 && (wikiIdx === -1 || grokIdx < wikiIdx), 'page lists Grokipedia before Wikipedia for the Maysville Road')

// Critiquito #326/#327: at 390 every staggered label is its own >=44px-tall tap target, and no two overlap.
{
  const ticks390 = groupTicks(events, { min: sliderMinYear(events), max: TIMELINE_MAX_YEAR })
  const widthPx = 342 // slider width at 390 (390 - page and card padding)
  const lay = layoutTickLabels(ticks390, { widthPx, labelWidth: (t) => Math.ceil(t.label.length * 7.2) + 6 })
  const hits = tickHitAreas(lay.items, { top0: 18, rowH: TICK_HIT_MIN_H, widthPx })
  assert.equal(TICK_HIT_MIN_H, 44)
  assert.equal(hits.length, lay.items.length)
  hits.forEach((h, i) => {
    const it = lay.items[i]
    assert.ok(h.h >= 44, `${it.year} hit area is ${h.h}px tall`)
    assert.ok(h.x <= it.x + 0.01 && h.x + h.w >= it.x + it.w - 0.01, `${it.year} hit area covers its label`)
  })
  for (let i = 0; i < hits.length; i++)
    for (let j = i + 1; j < hits.length; j++) {
      const a = hits[i], b = hits[j]
      const ov = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01
      assert.ok(!ov, `tick hit areas ${lay.items[i].year} and ${lay.items[j].year} overlap at 390`)
    }
  assert.ok(!/\.transport-tick::before\s*\{[^}]*min-width:\s*44px/.test(css), 'no centred 44px ::before (it overlapped neighbours)')
}
console.log(`test-transport-timeline: OK (${events.length} events, ${ticks.length} ticks, min ${min}, pad ${TIMELINE_PAD_YEARS})`)
