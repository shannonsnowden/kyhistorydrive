#!/usr/bin/env node
/**
 * Roads & Rails left pane (mockup v2, approved Oct 18): one prerendered row per line, grouped into
 * Railroads / Parkways / Early roads and trails, with All/None and "n of N shown". No browser needed.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LABEL_BG,
  buildLineRows,
  linesHtml,
  applyAllNone,
  countShown,
  hiddenIdsFor,
  labelColor,
  contrast,
  shortLabel,
} from '../src/transport-lines.js'

const secs = JSON.parse(readFileSync(new URL('../public/maps/transport/sections.geojson', import.meta.url), 'utf8'))
const html = readFileSync(new URL('../roads-and-rails/index.html', import.meta.url), 'utf8')
const groups = buildLineRows(secs.features)
const rows = groups.flatMap((g) => g.rows)

// Every section id belongs to exactly one row; every row has at least one section.
const ids = [...new Set(secs.features.map((f) => f.properties.id))]
const owned = rows.flatMap((r) => r.ids)
assert.equal(owned.length, new Set(owned).size, 'no section id is in two rows')
assert.deepEqual([...owned].sort(), [...ids].sort(), 'every section id is in a row')
assert.ok(rows.every((r) => r.ids.length > 0 && r.name && r.desc), 'rows have ids, a name and a description')

// Row count == lines on the map: 4 railroads, 9 parkways, 5 early roads + 3 trails.
assert.deepEqual(groups.map((g) => [g.key, g.rows.length]), [['rail', 4], ['parkway', 9], ['early', 8]])
assert.equal(rows.length, 21)
assert.deepEqual(groups.map((g) => g.section), ['rail', 'highways', 'highways'])

const byName = (n) => rows.find((r) => r.name.startsWith(n))
assert.equal(byName('Daniel Boone').label, '1971/74')
assert.equal(byName('Daniel Boone').disputed, true)
assert.equal(byName('Lexington & Ohio').label, '1832')
assert.equal(byName('Louisville & Frankfort').label, '1851')
assert.equal(byName("Warriors' Path").label, 'Before 1775')
assert.equal(byName('Mountain').provisional, true)

// Prerendered: the committed HTML carries exactly the generator's output, so the rows are crawlable.
const start = html.indexOf('<!-- khd-rr-lines:start -->')
const end = html.indexOf('<!-- khd-rr-lines:end -->')
assert.ok(start > 0 && end > start, 'roads-and-rails/index.html has the khd-rr-lines markers')
const block = html.slice(start + '<!-- khd-rr-lines:start -->'.length, end)
assert.equal(block.trim(), linesHtml(groups).trim(), 'prerendered rows match the data (run node scripts/build-transport-rows.mjs)')
for (const r of rows) assert.ok(block.includes(`data-ids="${r.ids.join(' ')}"`), `row ${r.name} is prerendered`)
assert.equal((block.match(/<li class="rr-row"/g) || []).length, rows.length, 'one <li> per line')
assert.equal((block.match(/data-all="1"/g) || []).length, groups.length, 'All per group')
assert.equal((block.match(/data-all="0"/g) || []).length, groups.length, 'None per group')
assert.ok(!/transport-facts|id="transportSections"/.test(html), 'old facts list and separate toggles are gone')
for (const s of ['Timeline', 'Railroads', 'Highways and parkways', 'About this map']) {
  assert.ok(new RegExp(`<summary[^>]*>[\\s\\S]{0,200}?${s}`).test(html), `section ${s} present`)
}

// All / None and the count.
const state = Object.fromEntries(rows.map((r) => [r.key, true]))
const rail = groups[0]
assert.equal(countShown(rail, state), '4 of 4 shown')
const none = applyAllNone(rail, state, false)
assert.equal(countShown(rail, none), '0 of 4 shown')
assert.equal(countShown(groups[1], none), '9 of 9 shown', 'None only touches its own group')
assert.deepEqual(hiddenIdsFor(groups, none).sort(), rail.rows.flatMap((r) => r.ids).sort())
const all = applyAllNone(rail, none, true)
assert.equal(countShown(rail, all), '4 of 4 shown')
assert.deepEqual(hiddenIdsFor(groups, all), [])

// Light-mode labels: darker variant of the line colour, >= 4.5:1 on the darkest cream.
for (const r of rows) {
  const c = labelColor('light', r.kind, r.opened)
  assert.ok(contrast(c, LABEL_BG) >= 4.5, `${r.name} label ${c} is ${contrast(c, LABEL_BG).toFixed(2)}:1`)
}
assert.equal(shortLabel('Cumberland (Louie B. Nunn) Parkway'), 'Cumberland Pkwy')
assert.equal(shortLabel('Louisville & Nashville main line'), 'L&N main line')

console.log(`test-transport-rows: ${rows.length} prerendered rows in ${groups.length} groups; All/None and labels OK`)
