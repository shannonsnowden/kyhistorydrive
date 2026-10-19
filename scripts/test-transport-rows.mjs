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
  lineColor,
  LABEL_HALO_LIGHT,
  labelLayout,
  labelPaint,
  SHEET_TITLE,
  sheetOpenHeight,
  sheetMaxHeight,
  labelLines,
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

// Critiquito #327: trace labels (light) darker than the line, a cream halo, and set off the line.
for (const kind of ['road', 'trail']) {
  const c = labelColor('light', kind)
  assert.ok(contrast(c, LABEL_BG) >= 5, `${kind} label ${c} is ${contrast(c, LABEL_BG).toFixed(2)}:1 on cream (want >= 5)`)
  assert.ok(contrast(c, LABEL_HALO_LIGHT) >= 4.5, `${kind} label ${c} on its halo`)
  assert.notEqual(c, lineColor('light', kind), `${kind} label is darker than its line`)
}
const lp = labelPaint('light')
assert.equal(lp['text-halo-color'], LABEL_HALO_LIGHT, 'cream halo in light mode')
assert.ok(lp['text-halo-width'] >= 2.5, 'halo at least 2.5px')
assert.equal(lp['text-halo-blur'], 0, 'crisp halo')
const ll = labelLayout()
assert.match(ll['symbol-placement'], /^line(-center)?$/, 'labels follow their line')
assert.ok(/\[0,-0\.9\d*\]/.test(JSON.stringify(ll['text-offset'])) && /\[0,0\.9\d*\]/.test(JSON.stringify(ll['text-offset'])), 'labels offset from their own line (above, or below where lines share a corridor)')

// Phone sheet: opens at half the viewport, drags up to the full map; its own scroll; titled "Lines".
assert.equal(SHEET_TITLE, 'Lines')
assert.equal(sheetOpenHeight(844, 614), 282, 'opens at 46% of the map (mockup v2)')
assert.ok(sheetOpenHeight(844, 440) / 440 <= 0.5, 'never more than half the map')
assert.equal(sheetMaxHeight(614), 614, 'drag up to full')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const pane = readFileSync(new URL('../src/transport-pane.js', import.meta.url), 'utf8')
assert.ok(!/Railroads and highways/.test(pane), 'old sheet header is gone')
assert.match(css, /\.rr-sheet\.is-open\s*\{[^}]*height:\s*46%/, 'sheet opens at 46% of the map')
assert.match(css, /\.rr-sheet-body\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/, 'sheet body scrolls on its own')
assert.match(pane, /\['rrSec-rail', 'rrSec-highways'\]/, 'only the line groups move into the sheet (About and stories stay on the page)')
const mapSrc = readFileSync(new URL('../src/transport-map.js', import.meta.url), 'utf8')
assert.match(pane, /new CustomEvent\('transport:sheet'/, 'the sheet tells the map its height')
assert.match(mapSrc, /addEventListener\('transport:sheet'/, 'the map refits Kentucky above the open sheet')
// Editor #327: every line is named on the map. One simplified label line per row (all 21), smooth enough
// for symbol-placement line, carrying the row's id, kind and earliest opening year for the filters.
{
  const labels = labelLines(secs.features)
  assert.equal(labels.length, rows.length, 'one label line per row')
  const turn = (a, b, c) => {
    const d1 = Math.atan2(b[1] - a[1], b[0] - a[0]), d2 = Math.atan2(c[1] - b[1], c[0] - b[0])
    let d = Math.abs(d2 - d1) * 180 / Math.PI
    return d > 180 ? 360 - d : d
  }
  for (const r of rows) {
    const f = labels.find((l) => l.properties.row === r.key)
    assert.ok(f, `${r.name} has a label line`)
    const cs = f.geometry.coordinates
    assert.equal(f.geometry.type, 'LineString')
    assert.ok(cs.length >= 2 && cs.length <= 40, `${r.name} label line simplified (${cs.length} points)`)
    const drawn = r.ids.flatMap((id) => secs.features.find((x) => x.properties.id === id).geometry.coordinates)
    const off = (p) => Math.min(...drawn.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))
    for (const p of cs) assert.ok(off(p) < 0.12, `${r.name} label line stays on the drawn line`)
    assert.ok(r.ids.includes(f.properties.id), `${r.name} label carries a section id for the row toggle`)
    assert.equal(f.properties.label, shortLabel(r.name))
    assert.ok(f.properties.labelShort && f.properties.labelShort.length <= f.properties.label.length, `${r.name} compact label`)
    if (r.kind === 'rail' || r.kind === 'parkway') {
      const span = Math.hypot(cs[cs.length - 1][0] - cs[0][0], cs[cs.length - 1][1] - cs[0][1])
      assert.ok(span > 0.15, `${r.name} label line long enough to hold its name`)
      for (let i = 1; i < cs.length - 1; i++) assert.ok(turn(cs[i - 1], cs[i], cs[i + 1]) < 31, `${r.name} label line has no sharp turn`)
    }
  }
  assert.match(readFileSync(new URL('../src/transport-map.js', import.meta.url), 'utf8'), /source:\s*'lineLabels'/, 'label layers read the per-line label source')
}
// Long names truncate so the year stays on the right.
assert.match(css, /\.rr-row-top\s*\{[^}]*flex-wrap:\s*nowrap/, 'row top never wraps')
assert.match(css, /\.rr-row-name\s*\{[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/, 'names ellipsize')

console.log(`test-transport-rows: ${rows.length} prerendered rows in ${groups.length} groups; All/None and labels OK`)
