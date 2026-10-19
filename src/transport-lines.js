/**
 * Roads & Rails left pane (mockup v2, approved by Shannon Oct 18): one row per line on the map.
 * Pure module, shared by the page (src/transport-pane.js), the prerender script
 * (scripts/build-transport-rows.mjs) and the tests. Names and descriptions are the page's existing
 * facts text; years come from sections.geojson.
 */

/* Decade and kind colours for the lines (light / dark). Dark 1880 follows mockup v2; dark 1970 and the trail colours follow Critiquito's #326 fixes so the
 * deeper green and the yellower lime stay apart (ΔE76 28 -> 41). */
export const ERA_COLORS = [
  [1830, '#9a6f00'],
  [1850, '#a0461b'],
  [1870, '#5c4033'],
  [1880, '#2f6b3a'],
  [1960, '#0c8599'],
  [1970, '#5c940d'],
]
export const ERA_COLORS_DARK = {
  1830: '#ffd43b',
  1850: '#f4a46a',
  1870: '#d9c2a0',
  1880: '#5fbf73',
  1960: '#3bc9db',
  1970: '#d4f06a',
}
export const KIND_COLORS = {
  light: { road: '#b4610f', trail: '#6e5a1e' },
  dark: { road: '#f0b45a', trail: '#f2ecd8' },
}

export function eraKey(year) {
  let key = ERA_COLORS[0][0]
  for (const [d] of ERA_COLORS) if (Number(year) >= d) key = d
  return key
}

/** The colour a line is drawn in: early roads and trails by kind, everything else by decade. */
export function lineColor(theme, kind, opened) {
  const t = theme === 'light' ? 'light' : 'dark'
  if (KIND_COLORS[t][kind]) return KIND_COLORS[t][kind]
  const key = eraKey(opened)
  return t === 'light' ? ERA_COLORS.find(([d]) => d === key)[1] : ERA_COLORS_DARK[key]
}

/* ---- Label contrast (WCAG) ---- */
export const LABEL_BG = '#f3ead8' // darkest cream behind the map labels
export const LABEL_HALO_LIGHT = '#f6eedb'
export const LABEL_HALO_DARK = '#100e0c'
function lum(hex) {
  const v = hex.match(/\w\w/g).map((h) => {
    const c = parseInt(h, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** Darken a colour in 6% steps until it reaches `target` on `bg` (mockup v2 rule). */
export function darkerFor(hex, target = 4.6, bg = LABEL_BG) {
  let [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16))
  let out = hex
  while (contrast(out, bg) < target) {
    r *= 0.94
    g *= 0.94
    b *= 0.94
    out = '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
  }
  return out
}
/** Light mode: darker variant of the line colour (>= 4.5:1 on cream). Dark mode: the line colour. */
export function labelColor(theme, kind, opened) {
  const c = lineColor(theme, kind, opened)
  if (theme !== 'light') return c
  // Roads and trails (amber/olive on cream): darker than the line, at >= 6.5:1 (Critiquito #327).
  if (KIND_COLORS.light[kind]) return darkerFor(c, 6.5)
  return darkerFor(c)
}

/* ---- Map line labels (MapLibre symbol layer; shared with src/transport-map.js) ---- */
export function labelLayout() {
  return {
    'symbol-placement': 'line',
    'symbol-spacing': 120,
    'symbol-sort-key': ['get', 'labelRank'],
    'text-field': ['step', ['zoom'], ['get', 'labelShort'], LABEL_FULL_ZOOM, ['get', 'label']],
    'text-font': ['Open Sans Semibold'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 7.5, 11.5, 9, 13],
    'text-letter-spacing': 0.02,
    'text-max-angle': 35,
    'text-padding': 1,
    // Set the name beside its line, not on top of it (Critiquito #327).
    'text-offset': ['case', ['==', ['get', 'labelSide'], 1], ['literal', [0, 0.95]], ['literal', [0, -0.95]]],
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'text-keep-upright': true,
  }
}
/** Paint for the labels; `colorExpr` is the MapLibre colour expression built by the map. */
export function labelPaint(theme, colorExpr) {
  return {
    ...(colorExpr ? { 'text-color': colorExpr } : {}),
    'text-halo-color': theme === 'light' ? LABEL_HALO_LIGHT : LABEL_HALO_DARK,
    'text-halo-width': 2.5,
    'text-halo-blur': 0,
  }
}

/* ---- Phone bottom sheet ---- */
export const SHEET_TITLE = 'Lines'
/** Opens at 46% of the map height (mockup v2; Editor caps it at half), leaving the top of the map in view. */
export const SHEET_OPEN_FRAC = 0.46
export function sheetOpenHeight(viewportH, mapH) {
  return Math.round(mapH * SHEET_OPEN_FRAC)
}
/** Dragging can take the sheet up to the full map height. */
export function sheetMaxHeight(mapH) {
  return Math.round(mapH)
}

/** Short map label: no parenthetical, "Pkwy", "L&N", no "Railroad/Railway". */
export function shortLabel(name) {
  return String(name)
    .replace(/\s*\(.*?\)/g, '')
    .replace(/Louisville & Nashville/, 'L&N')
    .replace(/ Parkway$/, ' Pkwy')
    .replace(/ (Railroad|Railway)$/, '')
    .trim()
}

/* ---- Rows ---- */
// One entry per line, in display order; ids are the sections.geojson section ids it draws.
export const LINE_GROUPS = [
  {
    key: 'rail',
    section: 'rail',
    title: 'Railroads',
    rows: [
      { key: 'lexington-ohio', name: 'Lexington & Ohio Railroad', ids: ['lexington-ohio-0', 'lexington-ohio-1'],
        desc: "Kentucky's first railroad, chartered 27 January 1830. About 1.5 miles of track from Lexington were laid by August 1832. Horse-drawn cars reached Frankfort from Lexington on 31 January 1834; the first steam run followed in January 1835. The line was chartered to carry Bluegrass goods toward the Ohio River." },
      { key: 'louisville-frankfort', name: 'Louisville & Frankfort Railroad', ids: ['lexington-ohio-2'],
        desc: 'Closed the gap from Frankfort to the Ohio River at Louisville, with through service in 1851 after the Kentucky River bridge was finished.' },
      { key: 'ln-main', name: 'Louisville & Nashville main line', ids: ['ln-main-1', 'ln-main-2', 'ln-main-3'],
        desc: "Opened south from Louisville in stages from 1855, climbing Muldraugh's Hill to reach Elizabethtown in June 1858. Track met at Bowling Green on 10 August 1859, and the first through train to Nashville ran on 27 October 1859." },
      { key: 'cincinnati-southern', name: 'Cincinnati Southern Railway', ids: ['cs-north-1', 'cs-south-1', 'cs-south-2'],
        desc: 'Built by the city of Cincinnati for a direct route to Southern markets that bypassed Louisville and the L&N. It was open to Somerset by 23 July 1877, crossing the Kentucky River on High Bridge, and through service to Chattanooga began in 1880.' },
    ],
  },
  {
    key: 'parkway',
    section: 'highways',
    title: 'Parkways',
    rows: [
      { key: 'mountain', name: 'Mountain Parkway', ids: ['mountain-1', 'mountain-2'],
        desc: 'Winchester to Campton opened 14 January 1963, and Campton to Salyersville was dedicated 1 November 1963. It was built to open up eastern Kentucky.' },
      { key: 'western-kentucky', name: 'Western Kentucky Parkway', ids: ['western-kentucky-1', 'western-kentucky-2'],
        desc: 'Elizabethtown to near Eddyville opened in 1963, and the extension to I-24 at Eddyville followed in 1968.' },
      { key: 'bluegrass', name: 'Bluegrass Parkway', ids: ['bluegrass-1'],
        desc: 'Opened 27 October 1965 between Elizabethtown and the Bluegrass at Versailles.' },
      { key: 'purchase', name: 'Purchase Parkway', ids: ['purchase-1'],
        desc: 'Opened in 1966 (provisional) through the Jackson Purchase, from Calvert City to Fulton.' },
      { key: 'pennyrile', name: 'Pennyrile Parkway', ids: ['pennyrile-1', 'pennyrile-2'],
        desc: 'Opened in 1969 (provisional) between Henderson and Hopkinsville.' },
      { key: 'audubon', name: 'Audubon Parkway', ids: ['audubon-1'],
        desc: 'Opened 18 December 1970 between Henderson and Owensboro.' },
      // The page's own facts say sources disagree (1971 or 1974): show both with a Disputed badge.
      { key: 'daniel-boone', name: 'Daniel Boone (Hal Rogers) Parkway', ids: ['daniel-boone-1'], label: '1971/74', disputed: true,
        desc: 'London to Hazard. Sources disagree on the opening year: 1971 or 1974.' },
      { key: 'green-river', name: 'Green River (Natcher) Parkway', ids: ['green-river-1'],
        desc: 'Opened in 1972 (provisional) between Bowling Green and Owensboro.' },
      { key: 'cumberland', name: 'Cumberland (Louie B. Nunn) Parkway', ids: ['cumberland-1'],
        desc: 'Opened in 1973 (provisional) from I-65 near Glasgow east to Somerset.' },
    ],
  },
  {
    // Pre-1834 roads and the 'Before 1775' trails (#326): the highways' ancestors, so they sit under
    // Highways and parkways rather than in a fifth section.
    key: 'early',
    section: 'highways',
    title: 'Early roads and trails',
    rows: [
      { key: 'warriors-path', name: "Warriors' Path (Athiamiowee)", ids: ['warriors-path'],
        desc: 'A Native trail used for centuries before settlers came. Cherokee and Shawnee travelled it through Cumberland Gap, by Flat Lick and Manchester, and down Station Camp Creek to the Kentucky River.' },
      { key: 'alanant-o-wamiowee', name: 'Alanant-o-wamiowee (Great Buffalo Path)', ids: ['alanant-o-wamiowee'],
        desc: 'A buffalo trace centuries old that linked the salt licks, from the Ohio River fords at Covington by Big Bone Lick, Drennon Lick, Georgetown, Paris and the Blue Licks to Limestone (Maysville).' },
      { key: 'skaggs-trace', name: "Skaggs' Trace", ids: ['skaggs-trace'],
        desc: "A long hunters' trail in use before 1775. At Hazel Patch it turned west toward Crab Orchard, and Boone left it at that fork." },
      { key: 'boone-trace', name: "Boone's Trace", ids: ['boone-trace'],
        desc: 'Blazed March–April 1775 from the Long Island of the Holston through Cumberland Gap and Hazel Patch to Fort Boonesborough. It was a marked trace, not a wagon road.' },
      { key: 'wilderness-road', name: 'Wilderness Road', ids: ['wilderness-road'], label: '1775',
        desc: 'A trace in 1775 through Cumberland Gap, Hazel Patch and Crab Orchard toward the Falls of the Ohio. It was a wagon road by 1796, and Kentucky made it a toll road in 1797.' },
      { key: 'limestone-trace', name: "Limestone Trace (Smith's Wagon Road)", ids: ['limestone-trace'],
        desc: 'Maysville to Lexington by Washington, Mayslick, the Blue Licks and Paris. A wagon first crossed it in summer 1783.' },
      { key: 'zanes-trace', name: "Zane's Trace", ids: ['zanes-trace'],
        desc: 'Cut in 1796–97 from Wheeling through Chillicothe to the Ohio River opposite Maysville, where a ferry crossed. It is shown on the map from 1797.' },
      { key: 'maysville-turnpike', name: 'Maysville–Lexington Turnpike', ids: ['maysville-turnpike'], label: 'by 1835',
        desc: 'President Jackson vetoed federal stock in the road on 27 May 1830. State and private money finished the macadam road by 1835.' },
    ],
  },
]

export const SECTION_TITLES = { rail: 'Railroads', highways: 'Highways and parkways' }

/** Rows with their data-derived year, label, kind and status. */
export function buildLineRows(features) {
  const byId = new Map()
  for (const f of features || []) {
    const p = f?.properties || f
    if (p?.id && !byId.has(p.id)) byId.set(p.id, p)
  }
  return LINE_GROUPS.map((g) => ({
    ...g,
    rows: g.rows
      .map((r) => {
        const props = r.ids.map((id) => byId.get(id)).filter(Boolean)
        if (!props.length) return null
        const undated = props.every((p) => p.undated === true)
        const years = props.map((p) => Number(p.opened)).filter(Number.isFinite)
        const opened = years.length ? Math.min(...years) : null
        const first = props.find((p) => Number(p.opened) === opened) || props[0]
        return {
          ...r,
          ids: props.map((p) => p.id),
          kind: first.kind,
          opened,
          undated,
          label: r.label || first.openedLabel || String(opened),
          disputed: !!r.disputed || props.some((p) => p.dateStatus === 'disputed'),
          provisional: props.some((p) => p.provisional === true),
        }
      })
      .filter(Boolean),
  }))
}

const esc = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

/** Colour class key for a row: the decade, or the kind for early roads and trails. */
export function colorKey(row) {
  return row.kind === 'road' || row.kind === 'trail' ? row.kind : String(eraKey(row.opened))
}

export function countShown(group, state) {
  const on = group.rows.filter((r) => state[r.key] !== false).length
  return `${on} of ${group.rows.length} shown`
}
export function applyAllNone(group, state, on) {
  const next = { ...state }
  for (const r of group.rows) next[r.key] = !!on
  return next
}
export function hiddenIdsFor(groups, state) {
  return groups.flatMap((g) => g.rows.filter((r) => state[r.key] === false).flatMap((r) => r.ids))
}

function rowHtml(r) {
  return `<li class="rr-row" data-key="${esc(r.key)}" data-ids="${esc(r.ids.join(' '))}" data-c="${esc(colorKey(r))}"${r.opened != null ? ` data-opened="${esc(r.opened)}"` : ''}>
            <i class="rr-swatch" aria-hidden="true"></i>
            <div class="rr-row-text">
              <p class="rr-row-top"><span class="rr-row-name" id="rrName-${esc(r.key)}">${esc(r.name)}</span> <span class="rr-row-year"><span class="visually-hidden">, ${r.undated ? '' : 'opened '}</span>${esc(r.label)}${r.provisional ? '<abbr title="Provisional year" aria-label="provisional">*</abbr>' : ''}</span>${r.disputed ? ' <span class="transport-badge rr-badge">Disputed</span>' : ''}</p>
              <div class="rr-desc-line"><p class="rr-row-desc" id="rrDesc-${esc(r.key)}">${esc(r.desc)}</p><button type="button" class="rr-more" aria-expanded="false" aria-controls="rrDesc-${esc(r.key)}" hidden>More<span class="visually-hidden"> about ${esc(r.name)}</span></button></div>
            </div>
            <label class="rr-switch"><input type="checkbox" role="switch" checked aria-label="Show ${esc(r.name)} on the map"><span aria-hidden="true"></span></label>
          </li>`
}

function groupHtml(g, heading) {
  return `${heading ? `<h3 class="rr-group-title" id="rrGroup-${esc(g.key)}">${esc(g.title)}</h3>\n        ` : ''}<div class="rr-group" data-group="${esc(g.key)}">
          <div class="rr-allnone" role="group" aria-label="${esc(g.title)}: show all or none">
            <button type="button" data-all="1">All</button><button type="button" data-all="0">None</button>
            <span class="rr-count" aria-live="polite">${esc(countShown(g, {}))}</span>
          </div>
          <ul class="rr-rows" aria-label="${esc(g.title)}">
          ${g.rows.map(rowHtml).join('\n          ')}
          </ul>
        </div>`
}

/** The prerendered Railroads and Highways and parkways sections (between the khd-rr-lines markers). */
export function linesHtml(groups) {
  const out = []
  for (const section of ['rail', 'highways']) {
    const gs = groups.filter((g) => g.section === section)
    const n = gs.reduce((k, g) => k + g.rows.length, 0)
    const body = gs.map((g) => groupHtml(g, gs.length > 1)).join('\n        ')
    const note = section === 'highways'
      ? '\n        <p class="muted rr-note">Early road and trail lines are generalized through public waypoint towns, not surveyed routes. Parkway years marked * are provisional.</p>'
      : ''
    out.push(`<details class="rr-sec rr-lines" id="rrSec-${section}" open>
      <summary><h2 class="rr-sec-title">${esc(SECTION_TITLES[section])}</h2><span class="rr-sec-meta">${n} lines</span><span class="rr-chev" aria-hidden="true"></span></summary>
      <div class="rr-sec-body">
        ${body}${note}
      </div>
    </details>`)
  }
  return '\n    ' + out.join('\n    ') + '\n    '
}

/* ---- One label line per row (Editor #327: every line is named on the map) ----
 * The drawn sections are detailed and split, so MapLibre's line placement rejects most of them. Each row
 * gets one chained, simplified line with no sharp turns, used only for its name. */
const LABEL_PRIORITY = { rail: 0, parkway: 1, road: 2, trail: 3 }
function dpSimplify(pts, tol) {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-12
  let max = 0, at = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len
    if (d > max) { max = d; at = i }
  }
  if (max <= tol) return [a, b]
  return [...dpSimplify(pts.slice(0, at + 1), tol).slice(0, -1), ...dpSimplify(pts.slice(at), tol)]
}
function turnDeg(a, b, c) {
  const d = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])) * 180 / Math.PI
  return d > 180 ? 360 - d : d
}
function chain(lines) {
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.03
  const left = lines.map((l) => [...l])
  let out = left.shift()
  let grew = true
  while (grew && left.length) {
    grew = false
    for (let i = 0; i < left.length; i++) {
      const l = left[i], s = out[0], e = out[out.length - 1]
      let add = null
      if (near(e, l[0])) add = () => { out = [...out, ...l.slice(1)] }
      else if (near(e, l[l.length - 1])) add = () => { out = [...out, ...l.slice(0, -1).reverse()] }
      else if (near(s, l[l.length - 1])) add = () => { out = [...l.slice(0, -1), ...out] }
      else if (near(s, l[0])) add = () => { out = [...l.slice(1).reverse(), ...out] }
      if (add) { add(); left.splice(i, 1); grew = true; break }
    }
  }
  return out
}
/* Below zoom 7.5 short lines carry a compact name so it fits along them; the full name shows from 7.5. */
export const LABEL_FULL_ZOOM = 7.5
const COMPACT_LABELS = {
  'lexington-ohio': 'L&O', 'louisville-frankfort': 'L&F', 'daniel-boone': 'Boone Pkwy', 'green-river': 'Green River',
  'cincinnati-southern': 'Cin. Southern', mountain: 'Mountain', purchase: 'Purchase', audubon: 'Audubon', pennyrile: 'Pennyrile', 'western-kentucky': 'W. Ky. Pkwy',
  'alanant-o-wamiowee': 'Buffalo Path', 'maysville-turnpike': 'Turnpike', 'limestone-trace': 'Limestone', 'skaggs-trace': "Skaggs'",
}
/* Lines that share a corridor with another named line put their name on the other side of it. */
const BELOW_LINE = new Set(['maysville-turnpike', 'skaggs-trace', 'boone-trace', 'audubon', 'alanant-o-wamiowee', 'warriors-path'])
export function compactLabel(key, name) {
  return COMPACT_LABELS[key] || shortLabel(name)
}
export function labelLines(features) {
  const byId = new Map((features || []).map((f) => [f.properties?.id, f]))
  const out = []
  for (const g of buildLineRows(features)) {
    for (const r of g.rows) {
      const fs = r.ids.map((id) => byId.get(id)).filter((f) => f?.geometry?.type === 'LineString')
      if (!fs.length) continue
      // Simplify, then keep the longest run without a sharp turn, so the name stays on the drawn line.
      const dp = dpSimplify(chain(fs.map((f) => f.geometry.coordinates)), 0.1)
      const seg = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])
      let best = [dp[0], dp[1]], cur = [dp[0], dp[1]]
      const len = (run) => run.slice(1).reduce((n, p, i) => n + seg(run[i], p), 0)
      for (let i = 2; i < dp.length; i++) {
        if (turnDeg(dp[i - 2], dp[i - 1], dp[i]) < 30) cur.push(dp[i])
        else cur = [dp[i - 1], dp[i]]
        if (len(cur) > len(best)) best = [...cur]
      }
      const pts = best
      const first = fs.find((f) => Number(f.properties.opened) === r.opened) || fs[0]
      out.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: pts },
        properties: { ...first.properties, row: r.key, label: shortLabel(r.name), labelShort: compactLabel(r.key, r.name), labelSide: BELOW_LINE.has(r.key) ? 1 : -1, labelRank: LABEL_PRIORITY[r.kind] ?? 4 },
      })
    }
  }
  return out
}
