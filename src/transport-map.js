/**
 * /roads-and-rails/ and /roads-and-rails/#<year> (item 70; old /#transport links forward there).
 * GeoJSON is fetched only when the map opens.
 * A feature shows when opened <= year && (closed > year || closed is absent).
 */
import * as maplibregl from 'maplibre-gl'
import { TICK_HIT_MIN_H, TIMELINE_MAX_YEAR, groupTicks, layoutTickLabels, openingEvents, sliderMinYear, tickHitAreas } from './transport-timeline.js'
import {
  ERA_COLORS,
  ERA_COLORS_DARK,
  KIND_COLORS,
  LABEL_HALO_DARK,
  LABEL_HALO_LIGHT,
  LINE_GROUPS,
  labelColor,
  labelLayout,
  labelLines,
  labelPaint,
} from './transport-lines.js'

// The start year comes from the data (earliest opening minus TIMELINE_PAD_YEARS), set once sections load.
let minYear = null
const MAX_YEAR = TIMELINE_MAX_YEAR
const DEFAULT_YEAR = 1880

const COLORS = {
  light: {
    bg: '#ffffff',
    land: '#f6eedb',
    landLine: '#2b2620',
    casing: '#2b1d0e',
    lo: '#e0a32e',
    ln: '#c47a17',
    cs: '#8f4a10',
    parkway: '#b5651d',
    bridge: '#fff8ea',
    bridgeStroke: '#2b1d0e',
    future: '#8a7f6a',
  },
  dark: {
    bg: '#100e0c',
    land: '#173028',
    landLine: '#c9893a',
    casing: '#0b0a09',
    future: '#cfc3a6',
    lo: '#f6e7c1',
    ln: '#e2b15a',
    cs: '#c9893a',
    parkway: '#b7d98a',
    bridge: '#f6edd8',
    bridgeStroke: '#e2b15a',
  },
}

const ATTRIBUTION =
  'Rail: <a href="https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0" target="_blank" rel="noopener noreferrer">USDOT/BTS NTAD</a> North American Rail Network (public domain). ' +
  'Roads: <a href="https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Highway_System/FeatureServer/0" target="_blank" rel="noopener noreferrer">FHWA/BTS NTAD</a> National Highway System (public domain). ' +
  'Outline: <a href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/" target="_blank" rel="noopener noreferrer">Natural Earth</a>.'

let map = null
let bootPromise = null
let sources = null
let sections = null
let fitted = false
const sourceById = new Map()

export function clampTransportYear(year) {
  if (year == null || !Number.isFinite(year)) return DEFAULT_YEAR
  return Math.min(MAX_YEAR, Math.max(minYear ?? 0, Math.round(year)))
}

function themeName() {
  return document.documentElement.getAttribute('data-hp-theme') === 'light' ? 'light' : 'dark'
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** opened <= year && (closed > year || !closed) */
export function transportYearFilter(year) {
  return [
    'any',
    // Undated 'Before 1775' trails show from the slider start.
    ['==', ['get', 'undated'], true],
    [
      'all',
      ['has', 'opened'],
      ['<=', ['get', 'opened'], year],
      ['any', ['!', ['has', 'closed']], ['>', ['get', 'closed'], year]],
    ],
  ]
}

/* Decade and kind colours live in transport-lines.js (shared with the left-pane rows and labels).
 * Dark 1880 #5fbf73 and 1970 #d9e86a follow mockup v2. */
export { ERA_COLORS }

function eraList(theme = themeName()) {
  return theme === 'dark' ? ERA_COLORS.map(([d]) => [d, ERA_COLORS_DARK[d]]) : ERA_COLORS
}

function eraColorFor(year, theme) {
  const list = eraList(theme)
  let color = list[0][1]
  for (const [d, c] of list) if (year >= d) color = c
  return color
}

/* Roads and traces before the railroads (#291 follow-up) take a kind colour, not a decade colour. */
function kindColorFor(kind, theme = themeName()) {
  return KIND_COLORS[theme === 'light' ? 'light' : 'dark'][kind] || null
}

function eraColorExpr(theme) {
  const list = eraList(theme)
  const expr = ['step', ['coalesce', ['get', 'opened'], 0], list[0][1]]
  for (const [d, c] of list.slice(1)) expr.push(d, c)
  const k = KIND_COLORS[theme === 'light' ? 'light' : 'dark']
  return ['match', ['get', 'kind'], 'trail', k.trail, 'road', k.road, expr]
}

/* 3px lines (4px from county zoom), parkways a touch thinner, on a 1px casing. */
const LINE_W = ['interpolate', ['linear'], ['zoom'], 7, ['match', ['get', 'kind'], 'parkway', 2.6, 3], 8.5, ['match', ['get', 'kind'], 'parkway', 3.4, 4]]
const CASE_W = ['interpolate', ['linear'], ['zoom'], 7, ['match', ['get', 'kind'], 'parkway', 4.6, 5], 8.5, ['match', ['get', 'kind'], 'parkway', 5.4, 6]]

/* Trails: a 2.2-2.8px row of round dots (dash 0 + round cap), no casing. */
const TRAIL_FILTER = ['==', ['get', 'kind'], 'trail']
const NOT_TRAIL = ['!=', ['get', 'kind'], 'trail']
const TRAIL_W = ['interpolate', ['linear'], ['zoom'], 7, 2.2, 8.5, 2.8]

function futureFilter(year) {
  return ['all', ['has', 'opened'], ['>', ['get', 'opened'], year]]
}

/* ---- Per-line toggles (left pane) ---- */
let hiddenSections = new Set()
let currentYear = DEFAULT_YEAR
function notHidden() {
  return ['!', ['in', ['get', 'id'], ['literal', [...hiddenSections]]]]
}
/** Hide these section ids (the rows switched off in the left pane) and redraw. */
export function setHiddenSections(ids) {
  hiddenSections = new Set(ids)
  if (map && map.isStyleLoaded()) applyYear(currentYear)
}
export function getHiddenSections() {
  return [...hiddenSections]
}

/* ---- Line labels: MapLibre symbol layer along each line (mockup v2) ---- */
const LEXINGTON = [-84.4884, 38.0644]
const LEX_REVEAL_ZOOM = 8
/** One simplified label line per row (labelLines) plus the Lexington-junction flag (client-side only). */
function labelledLines(secs) {
  return {
    type: 'FeatureCollection',
    // Editor #327: every line is named from the default view, so no label waits for zoom 8 any more.
    features: labelLines(secs.features).map((f) => ({ ...f, properties: { ...f.properties, lexJunction: false } })),
  }
}

function labelColorExpr(theme) {
  const list = ERA_COLORS.map(([d]) => [d, labelColor(theme, 'rail', d)])
  const expr = ['step', ['coalesce', ['get', 'opened'], 0], list[0][1]]
  for (const [d, c] of list.slice(1)) expr.push(d, c)
  return ['match', ['get', 'kind'], 'trail', labelColor(theme, 'trail'), 'road', labelColor(theme, 'road'), expr]
}

function labelFilter(year, junction) {
  return ['all', transportYearFilter(year), notHidden(), ['==', ['get', 'lexJunction'], junction]]
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json()
}

function styleFor(theme, ky, rail, roads, counties, secs) {
  const c = COLORS[theme]
  return {
    version: 8,
    name: 'Kentucky transport',
    // Self-hosted glyphs (Open Sans Semibold, OFL) for the along-line labels.
    glyphs: '/fonts/glyphs/{fontstack}/{range}.pbf',
    sources: {
      kentucky: { type: 'geojson', data: ky },
      rail: { type: 'geojson', data: rail },
      parkways: { type: 'geojson', data: roads },
      counties: { type: 'geojson', data: counties },
      sections: { type: 'geojson', data: secs },
      lineLabels: { type: 'geojson', data: labelledLines(secs), buffer: 512, tolerance: 0 },
      lexBlock: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: LEXINGTON } } },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
      { id: 'land', type: 'fill', source: 'kentucky', paint: { 'fill-color': c.land } },
      {
        id: 'land-line',
        type: 'line',
        source: 'kentucky',
        paint: { 'line-color': c.landLine, 'line-width': 1.4 },
      },
      {
        id: 'county-line',
        type: 'line',
        source: 'counties',
        paint: { 'line-color': '#8a7f6a', 'line-width': 0.6, 'line-opacity': 0.55 },
      },
      {
        id: 'sec-future',
        type: 'line',
        source: 'sections',
        filter: futureFilter(DEFAULT_YEAR),
        paint: { 'line-color': c.future, 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [2, 2] },
      },
      {
        id: 'sec-casing',
        type: 'line',
        source: 'sections',
        filter: ['all', NOT_TRAIL, transportYearFilter(DEFAULT_YEAR)],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.casing, 'line-width': CASE_W },
      },
      {
        id: 'sec-line',
        type: 'line',
        source: 'sections',
        filter: ['all', NOT_TRAIL, transportYearFilter(DEFAULT_YEAR)],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': eraColorExpr(theme), 'line-width': LINE_W },
      },
      {
        id: 'sec-trail',
        type: 'line',
        source: 'sections',
        filter: TRAIL_FILTER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': KIND_COLORS[theme === 'light' ? 'light' : 'dark'].trail, 'line-width': TRAIL_W, 'line-dasharray': [0, 2] },
      },
      {
        id: 'bridge-circle',
        type: 'circle',
        source: 'rail',
        filter: ['all', transportYearFilter(DEFAULT_YEAR), ['==', ['get', 'kind'], 'bridge']],
        paint: {
          'circle-radius': 6,
          'circle-color': c.bridge,
          'circle-stroke-color': c.bridgeStroke,
          'circle-stroke-width': 2,
        },
      },
      { id: 'sec-label', type: 'symbol', source: 'lineLabels', filter: labelFilter(DEFAULT_YEAR, false), layout: labelLayout(), paint: labelPaint(theme, labelColorExpr(theme)) },
      {
        id: 'sec-label-lex',
        type: 'symbol',
        source: 'lineLabels',
        minzoom: LEX_REVEAL_ZOOM,
        filter: labelFilter(DEFAULT_YEAR, true),
        layout: { ...labelLayout(), 'symbol-sort-key': ['+', 10, ['get', 'labelRank']] },
        paint: labelPaint(theme, labelColorExpr(theme)),
      },
      {
        // Topmost symbol layer, so it is placed first: below zoom 8 this invisible box keeps line
        // labels clear of the Lexington junction.
        id: 'lex-blocker',
        type: 'symbol',
        source: 'lexBlock',
        maxzoom: LEX_REVEAL_ZOOM,
        layout: { 'text-field': 'MMM', 'text-font': ['Open Sans Semibold'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': false },
        paint: { 'text-opacity': 0 },
      },
    ],
  }
}

function applyColors() {
  if (!map || !map.isStyleLoaded()) return
  const theme = themeName()
  const c = COLORS[theme]
  map.setPaintProperty('bg', 'background-color', c.bg)
  map.setPaintProperty('land', 'fill-color', c.land)
  map.setPaintProperty('land-line', 'line-color', c.landLine)
  map.setPaintProperty('sec-casing', 'line-color', c.casing)
  map.setPaintProperty('sec-line', 'line-color', eraColorExpr(theme))
  if (map.getLayer('sec-trail')) map.setPaintProperty('sec-trail', 'line-color', kindColorFor('trail', theme))
  map.setPaintProperty('sec-future', 'line-color', c.future)
  map.setPaintProperty('bridge-circle', 'circle-color', c.bridge)
  map.setPaintProperty('bridge-circle', 'circle-stroke-color', c.bridgeStroke)
  for (const id of ['sec-label', 'sec-label-lex']) {
    for (const [k, v] of Object.entries(labelPaint(theme, labelColorExpr(theme)))) map.setPaintProperty(id, k, v)
  }
}

function applyYear(year) {
  currentYear = year
  const filter = ['all', transportYearFilter(year), notHidden()]
  for (const id of ['sec-casing', 'sec-line']) {
    if (map.getLayer(id)) map.setFilter(id, ['all', NOT_TRAIL, filter])
  }
  if (map.getLayer('sec-future')) map.setFilter('sec-future', ['all', futureFilter(year), notHidden()])
  if (map.getLayer('sec-label')) map.setFilter('sec-label', labelFilter(year, false))
  if (map.getLayer('sec-label-lex')) map.setFilter('sec-label-lex', labelFilter(year, true))
  const bridge = ['all', filter, ['==', ['get', 'kind'], 'bridge']]
  if (map.getLayer('bridge-circle')) map.setFilter('bridge-circle', bridge)
  const section = document.getElementById('transport')
  if (section) section.dataset.year = String(year)
  const out = document.getElementById('transportYearOut')
  const slider = document.getElementById('transportYear')
  const live = document.getElementById('transportLive')
  if (out) out.textContent = String(year)
  if (slider) {
    slider.value = String(year)
    slider.setAttribute('aria-valuenow', String(year))
  }
  if (live) live.textContent = `Showing lines open in ${year}. Dates are provisional.`
  const canvas = document.getElementById('transportMap')
  if (canvas) canvas.setAttribute('aria-label', `Kentucky transportation map in ${year}`)
  syncEndpoints(year)
  renderLegend(year)
  renderSparseNote(year)
  syncTicks(year)
  window.dispatchEvent(new CustomEvent('transport:year', { detail: year }))
}

/* ---- Opening ticks (#291 follow-up) ---- */
let timelineEvents = []
let tickWidth = 0

function setupTimeline() {
  const slider = document.getElementById('transportYear')
  if (slider && minYear != null) {
    slider.min = String(minYear)
    slider.setAttribute('aria-valuemin', String(minYear))
    slider.setAttribute('aria-valuemax', String(MAX_YEAR))
  }
  const scaleMin = document.getElementById('transportScaleMin')
  if (scaleMin && minYear != null) scaleMin.textContent = String(minYear)
  const wrap = document.getElementById('transportTicks')
  if (!wrap || wrap.dataset.wired) return
  wrap.dataset.wired = '1'
  wrap.addEventListener('click', (event) => {
    const btn = event.target.closest('.transport-tick')
    if (!btn) return
    // Tap or Enter/Space: open its tooltip and move the map to that year.
    showTip(btn)
    const year = clampTransportYear(Number(btn.dataset.year))
    applyYear(year)
    writeHash(year)
    btn.focus()
  })
  wrap.addEventListener('focusin', (event) => {
    const btn = event.target.closest('.transport-tick')
    if (btn) showTip(btn)
  })
  wrap.addEventListener('focusout', (event) => {
    if (!wrap.contains(event.relatedTarget)) hideTips()
  })
  wrap.addEventListener('pointerover', (event) => {
    const btn = event.target.closest('.transport-tick')
    if (btn && event.pointerType === 'mouse') showTip(btn)
  })
  wrap.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !wrap.contains(document.activeElement)) hideTips()
  })
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTips()
  })
  document.addEventListener('pointerdown', (event) => {
    if (!wrap.contains(event.target)) hideTips()
  })
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => renderTicks()).observe(wrap)
  }
  renderTicks()
}

function showTip(btn) {
  hideTips(btn)
  const tip = document.getElementById(btn.getAttribute('aria-describedby'))
  if (!tip) return
  tip.hidden = false
  btn.classList.add('is-tip-open')
  btn.closest('.transport-year')?.classList.add('is-tip-open')
  // Keep the tooltip inside the controls column.
  tip.style.transform = ''
  const box = tip.getBoundingClientRect()
  const host = btn.parentElement.getBoundingClientRect()
  let shift = 0
  if (box.left < host.left) shift = host.left - box.left
  else if (box.right > host.right) shift = host.right - box.right
  if (shift) tip.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`
  syncTicks(Number(document.getElementById('transport')?.dataset.year))
}

function hideTips(except) {
  document.querySelectorAll('#transportTicks .transport-tick.is-tip-open').forEach((b) => {
    if (b === except) return
    b.classList.remove('is-tip-open')
    const tip = document.getElementById(b.getAttribute('aria-describedby'))
    if (tip) tip.hidden = true
  })
  if (!document.querySelector('#transportTicks .transport-tick.is-tip-open')) document.querySelector('.transport-year')?.classList.remove('is-tip-open')
}

let measureCtx = null
function labelWidthFn(wrap) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d')
  const cs = getComputedStyle(wrap)
  measureCtx.font = `700 ${cs.getPropertyValue('--tick-label-size').trim() || '11px'} ${cs.fontFamily}`
  // Text plus 3px padding each side.
  return (t) => Math.ceil(measureCtx.measureText(t.label).width) + 6
}

/* Critiquito #326: one tick per opening year, each with a visible 'year' or 'year · n' label. Labels that
 * would collide stagger onto extra rows under the track, joined to their mark by a leader line. The label
 * is the button (a 24px+ target on touch); the mark is decoration. All ticks share one colour. */
function renderTicks(force = false) {
  const wrap = document.getElementById('transportTicks')
  if (!wrap || minYear == null || !timelineEvents.length) return
  const slider = document.getElementById('transportYear')
  const full = slider?.getBoundingClientRect().width || wrap.getBoundingClientRect().width
  // The thumb centre runs 13px in from each end of the slider.
  const width = Math.max(0, full - 26)
  if (width === tickWidth && wrap.childElementCount && !force) return
  tickWidth = width
  const focusedYear = wrap.contains(document.activeElement) ? document.activeElement.dataset.year : null
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 600
  // Touch: each label row is a 44px band, the label's own tap target (Critiquito: no overlapping targets).
  const rowH = coarse ? TICK_HIT_MIN_H : 22
  const labelH = coarse ? 22 : 20
  const markH = 10
  const lead = 8
  const ticks = groupTicks(timelineEvents, { min: minYear, max: MAX_YEAR })
  // Touch: 4px between labels so each tap area (split at the midpoint) is >= 36px wide (Editor #326).
  const lay = layoutTickLabels(ticks, { widthPx: full, labelWidth: labelWidthFn(wrap), gapPx: coarse ? 4 : 3 })
  // layoutTickLabels works on the full width; map each mark onto the thumb's travel.
  const markX = (t) => 13 + (t.pct / 100) * width
  const hits = tickHitAreas(lay.items, { top0: markH + lead, rowH, widthPx: full })
  let svg = ''
  let html = ''
  ticks.forEach((t, i) => {
    const it = lay.items[i]
    const mx = markX(t)
    const hit = hits[i]
    // Label centred in its band; the leader meets the label's top edge.
    const top = hit.y + Math.round((rowH - labelH) / 2)
    const cx = it.x + it.w / 2
    svg += `<line class="transport-tick-mark" x1="${mx.toFixed(1)}" y1="0" x2="${mx.toFixed(1)}" y2="${markH}"/>`
    svg += `<polyline class="transport-tick-lead" points="${mx.toFixed(1)},${markH} ${mx.toFixed(1)},${markH + 3} ${cx.toFixed(1)},${top}"/>`
    const names = t.events.map((e) => `${e.name}${t.events.length > 1 ? '' : ''}`).join('; ')
    const aria = t.events.length > 1
      ? `${t.year}: ${t.events.length} openings: ${names}. Show ${t.year}.`
      : `${t.year}: ${t.events[0].name} opens. Show ${t.year}.`
    const tipRows = t.events.map((e) => `<li>${esc(e.name)}</li>`).join('')
    html += `<button type="button" class="transport-tick" data-year="${esc(t.year)}" data-count="${esc(t.events.length)}"
      style="left:${hit.x}px;top:${hit.y}px;width:${hit.w}px;height:${hit.h}px" aria-label="${esc(aria)}"
      aria-describedby="transportTip${i}"><span class="transport-tick-label" style="left:${(it.x - hit.x).toFixed(1)}px;top:${top - hit.y}px;width:${it.w}px;height:${labelH}px">${esc(t.label)}</span></button>
      <div id="transportTip${i}" class="transport-tip" role="tooltip" hidden style="left:${cx.toFixed(1)}px;top:${top + labelH + 4}px">
        <p class="transport-tip-head"><span>${esc(t.year)}</span> ${t.events.length > 1 ? `${esc(t.events.length)} openings` : esc(t.events[0].name)}</p>${t.events.length > 1 ? `<ul>${tipRows}</ul>` : ''}</div>`
  })
  const height = markH + lead + lay.rows * rowH
  wrap.style.height = `${height}px`
  wrap.innerHTML = `<svg class="transport-tick-lines" width="${full}" height="${height}" aria-hidden="true" focusable="false">${svg}</svg>${html}`
  wrap.dataset.ticks = String(ticks.length)
  wrap.dataset.events = String(timelineEvents.length)
  wrap.dataset.rows = String(lay.rows)
  if (focusedYear) wrap.querySelector(`.transport-tick[data-year="${CSS.escape(focusedYear)}"]`)?.focus()
}

function syncTicks(year) {
  document.querySelectorAll('#transportTicks .transport-tick').forEach((b) => {
    b.setAttribute('aria-current', Number(b.dataset.year) === year ? 'true' : 'false')
  })
}

/** Early years show only one or two lines; say so, so the map doesn't read as a load failure. */
function renderSparseNote(year) {
  const note = document.getElementById('transportSparse')
  if (!note || !sections) return
  const open = new Set(
    sections.features
      .map((f) => f.properties)
      .filter((p) => p.undated === true || (p.opened <= year && (p.closed == null || p.closed > year)))
      .map((p) => p.routeName || p.id),
  )
  if (open.size > 2) {
    note.hidden = true
    note.textContent = ''
    return
  }
  const next = sections.features.map((f) => f.properties.opened).filter((y) => y > year).sort((a, b) => a - b)[0]
  const count = open.size === 0 ? 'No lines open' : open.size === 1 ? '1 line open' : `${open.size} lines open`
  note.textContent = `${count} in ${year}.${next ? ` The next opens in ${next}.` : ''}`
  note.hidden = false
}

function renderLegend(year) {
  const list = document.getElementById('transportLegend')
  if (!list || !sections) return
  let html = '<p class="transport-legend-label">Completed by decade</p><ul class="transport-era-list">'
  for (const [d, c] of eraList()) {
    html += `<li><i class="transport-swatch" style="background:${esc(c)}" aria-hidden="true"></i>${esc(d)}s</li>`
  }
  html += `<li><i class="transport-swatch" style="background:${esc(kindColorFor('road'))}" aria-hidden="true"></i>Early roads</li>`
  html += `<li><i class="transport-swatch is-trail-swatch" style="color:${esc(kindColorFor('trail'))}" aria-hidden="true"></i>Trails before 1775 (dotted)</li>`
  html += '<li><i class="transport-swatch is-tick-swatch" aria-hidden="true"></i>Timeline tick: openings that year</li>'
  html += '<li><i class="transport-swatch is-future-swatch" aria-hidden="true"></i>Not yet open</li></ul>'
  list.innerHTML = html
}



function writeHash(year) {
  const next = `#${year}`
  if (location.hash === next) return
  const url = new URL(location.href)
  url.hash = String(year)
  history.replaceState(null, '', url.href)
}

function popupHtml(props) {
  if (props.kind === 'bridge') {
    const meta = sourceById.get(props.id)
    return `<div class="transport-popup-card">
    <p class="transport-popup-kicker">Bridge · provisional date</p>
    <h3>${esc(props.name)}</h3>
    <p class="transport-popup-year">Opened ${esc(meta?.openedLabel || props.opened)}</p>
  </div>`
  }
  const kind = { parkway: 'Parkway', road: 'Early road', trail: 'Trail' }[props.kind] || 'Railroad section'
  const label = String(props.openedLabel || props.opened || '')
  const yearLine = /^\d/.test(label) ? `Opened ${label}` : label.charAt(0).toUpperCase() + label.slice(1)
  const undated = props.undated === true || String(props.undated) === 'true'
  let srcs = []
  try {
    srcs = typeof props.sources === 'string' ? JSON.parse(props.sources) : props.sources || []
  } catch {
    srcs = []
  }
  const links = srcs
    .filter((u) => /^https:\/\//.test(String(u)))
    .map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${i + 1}</a>`)
    .join(' ')
  const status = props.dateStatus
  const statusText =
    undated ? 'Undated; sourced route.' : status === 'needs-source' ? 'Date needs source.' : status === 'disputed' ? 'Sources disagree on the year.' : props.provisional === true || String(props.provisional) === 'true' ? 'Provisional date.' : 'Sourced date.'
  const inferred = props.whyInferred === true || String(props.whyInferred) === 'true'
  return `<div class="transport-popup-card">
    <p class="transport-popup-kicker">${esc(kind)}</p>
    <h3>${esc(props.routeName)}</h3>
    <p>${esc(props.from)} to ${esc(props.to)}</p>
    <p class="transport-popup-year">${esc(yearLine)}</p>
    ${props.dateNote ? `<p class="transport-popup-note">${esc(props.dateNote)}</p>` : ''}
    ${props.note && (props.kind === 'road' || props.kind === 'trail') ? `<p class="transport-popup-note">${esc(props.note)}</p>` : ''}
    ${props.why ? `<p class="transport-popup-why"><strong>${props.kind === 'trail' ? 'About it' : 'Why it ran here'}:</strong> ${esc(props.why)}${inferred ? ' <em>(inferred)</em>' : ''}</p>` : ''}
    <p class="transport-popup-note"><strong>${esc(statusText)}</strong>${links ? ` Sources: ${links}` : ''}</p>
  </div>`
}

function onLineClick(e) {
  const feature = e.features && e.features[0]
  if (!feature) return
  const props = feature.properties || {}
  const popup = new maplibregl.Popup({ className: 'transport-popup', maxWidth: window.innerWidth < 600 ? '230px' : '280px', closeButton: true })
    .setLngLat(e.lngLat)
    .setHTML(popupHtml(props))
    .addTo(map)
  fitPopupAboveCredit(popup)
}

/** Keep the popup clear of the attribution strip: cap its height to the free canvas and scroll inside. */
function fitPopupAboveCredit(popup) {
  const content = popup.getElement()?.querySelector('.maplibregl-popup-content')
  if (!content) return
  const canvas = map.getContainer().getBoundingClientRect()
  const attrib = map.getContainer().querySelector('.maplibregl-ctrl-bottom-right')
  const creditH = attrib ? attrib.getBoundingClientRect().height : 0
  content.style.maxHeight = `${Math.max(120, Math.floor(canvas.height / 2 - creditH - 16))}px`
  content.style.overflowY = 'auto'
  // Soft bottom fade while more text is below the fold, so readers know it scrolls.
  const updateFade = () => {
    const more = content.scrollHeight - content.scrollTop - content.clientHeight > 2
    if (more) popup.addClassName('has-more')
    else popup.removeClassName('has-more')
  }
  content.addEventListener('scroll', updateFade, { passive: true })
  requestAnimationFrame(updateFade)
  // Pan so the whole card sits inside the canvas, above the credit.
  requestAnimationFrame(() => {
    const r = popup.getElement().getBoundingClientRect()
    const bottomLimit = canvas.bottom - creditH - 8
    let dy = 0
    if (r.bottom > bottomLimit) dy = r.bottom - bottomLimit
    if (r.top - dy < canvas.top + 8) dy = r.top - canvas.top - 8
    if (dy) map.panBy([0, dy], { duration: 250 })
  })
}

function wireMap() {
  for (const id of ['sec-line', 'sec-trail', 'bridge-circle']) {
    map.on('mouseenter', id, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', id, () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('click', id, onLineClick)
  }
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  // Phones get the collapsed ⓘ credit so it never sits on a popup.
  map.addControl(new maplibregl.AttributionControl({ customAttribution: ATTRIBUTION, compact: window.innerWidth < 600 }), 'bottom-right')
}

async function boot() {
  const [rail, roads, ky, src, counties, secs, labels, ends] = await Promise.all([
    fetchJson('/maps/transport/rail.geojson'),
    { type: 'FeatureCollection', features: [] },
    fetchJson('/data/kentucky-outline.geojson'),
    fetchJson('/maps/transport/sources.json'),
    fetchJson('/maps/transport/county-lines.geojson'),
    fetchJson('/maps/transport/sections.geojson'),
    fetchJson('/maps/transport/county-labels.geojson'),
    fetchJson('/maps/transport/endpoints.geojson'),
  ])
  sections = secs
  timelineEvents = openingEvents(secs.features)
  minYear = sliderMinYear(timelineEvents)
  sources = src
  sourceById.clear()
  for (const f of src.features || []) sourceById.set(f.id, f)
  const container = document.getElementById('transportMap')
  if (!container) throw new Error('transport map container missing')
  map = new maplibregl.Map({
    container,
    style: styleFor(themeName(), ky, rail, roads, counties, secs),
    center: [-85.9, 37.6],
    zoom: 6,
    attributionControl: false,
    fadeDuration: 0,
  })
  wireMap()
  await new Promise((resolve) => map.once('load', resolve))
  window.__khdTransportMap = map // read-only hook for the build's label check
  if (window.innerWidth < 600) {
    container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
  }
  addCountyLabels(labels)
  addEndpointLabels(ends)
  const observer = new MutationObserver(() => {
    applyColors()
    const year = Number(document.getElementById('transport')?.dataset.year || DEFAULT_YEAR)
    renderLegend(year)
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-hp-theme'] })
  const KY_FIT = [
    [-89.58, 36.45],
    [-81.96, 39.17],
  ]
  // Bottom padding clears the credits strip (so 'toward Chattanooga' stays readable) or the open phone sheet.
  const fitKentucky = (sheetH = 0) => {
    const bottom = Math.max(18 + creditsHeight(container), sheetH + 12)
    const h = container.clientHeight
    if (h - bottom - 18 < 60) return
    map.fitBounds(KY_FIT, { padding: { top: 18, left: 18, right: 18, bottom }, duration: 0 })
  }
  if (!fitted) {
    fitKentucky()
    fitted = true
  }
  if (!window.__khdSheetFit) {
    window.__khdSheetFit = true
    // An instant refit: an eased one is cancelled by the sheet's own resize/redraw.
    window.addEventListener('transport:sheet', (e) => fitKentucky(Number(e.detail?.height) || 0))
  }
  const slider = document.getElementById('transportYear')
  const legend = document.getElementById('transportLegend')
  setupTimeline()
  if (slider && !slider.dataset.wired) {
    slider.dataset.wired = '1'
    slider.addEventListener('input', () => {
      const year = clampTransportYear(Number(slider.value))
      applyYear(year)
      writeHash(year)
    })
  }
  for (const el of [legend]) {
  if (el && !el.dataset.wired) {
    el.dataset.wired = '1'
    el.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-year]')
      if (!btn) return
      const year = clampTransportYear(Number(btn.dataset.year))
      applyYear(year)
      writeHash(year)
    })
  }
  }
  window.addEventListener('resize', () => {
    if (map) map.resize()
  })
}

function creditsHeight(container) {
  const strip = container.querySelector('.maplibregl-ctrl-bottom-right')
  return Math.ceil(strip ? strip.getBoundingClientRect().height : 0) + 6
}

let endpointMarkers = []
function syncEndpoints(year) {
  for (const [m, opened, on] of endpointMarkers) {
    const want = opened <= year
    if (want !== on.v) {
      on.v = want
      want ? m.addTo(map) : m.remove()
    }
  }
  declutterEndpoints()
}

/** Hide endpoint names that collide with a higher-priority name (file order = priority); dots stay. */
function declutterEndpoints() {
  const placed = []
  for (const [m, , on] of endpointMarkers) {
    if (!on.v) continue
    const label = m.getElement().querySelector('b')
    if (!label) continue
    label.style.visibility = ''
    const r = label.getBoundingClientRect()
    const hit = placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 1 && r.bottom > p.top - 1)
    if (hit || underLineLabel(r)) label.style.visibility = 'hidden'
    else placed.push(r)
  }
}

/** Line names outrank town names: true when a placed line label overlaps this town name box. */
function underLineLabel(r) {
  if (!map || !map.getLayer('sec-label')) return false
  const box = map.getCanvas().getBoundingClientRect()
  const layers = ['sec-label', 'sec-label-lex'].filter((id) => map.getLayer(id))
  try {
    return map.queryRenderedFeatures([[r.left - box.left, r.top - box.top], [r.right - box.left, r.bottom - box.top]], { layers }).length > 0
  } catch {
    return false
  }
}

function addEndpointLabels(ends) {
  for (const f of ends.features || []) {
    const el = document.createElement('span')
    el.className = 'transport-endpoint'
    el.dataset.place = f.properties.name
    el.innerHTML = `<i aria-hidden="true"></i><b>${esc(f.properties.name)}</b>`
    const m = new maplibregl.Marker({ element: el, anchor: 'left', offset: [-4, 0] }).setLngLat(f.geometry.coordinates)
    endpointMarkers.push([m, Number(f.properties.opened), { v: false }])
  }
}

const COUNTY_LABEL_ZOOM = 8.5
function addCountyLabels(labels) {
  const markers = (labels.features || []).map((f) => {
    const el = document.createElement('span')
    el.className = 'transport-county-label'
    el.textContent = f.properties.NAME
    el.setAttribute('aria-hidden', 'true')
    return new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates)
  })
  let shown = false
  const sync = () => {
    const want = map.getZoom() >= COUNTY_LABEL_ZOOM
    if (want === shown) return
    shown = want
    for (const m of markers) want ? m.addTo(map) : m.remove()
  }
  map.on('zoomend', sync)
  map.on('moveend', declutterEndpoints)
  map.on('idle', declutterEndpoints)
  sync()
}

export async function showTransport(yearInput) {
  let year = clampTransportYear(yearInput)
  const status = document.getElementById('transportStatus')
  if (!bootPromise) {
    bootPromise = boot().catch((err) => {
      bootPromise = null
      throw err
    })
  }
  try {
    if (status) status.textContent = map ? '' : 'Loading lines…'
    await bootPromise
    if (status) status.textContent = ''
  } catch (err) {
    console.error(err)
    if (status) status.textContent = 'The transport lines could not be loaded.'
    return
  }
  // Re-clamp now that the data-driven start year is known.
  year = clampTransportYear(yearInput)
  applyYear(year)
  writeHash(year)
  requestAnimationFrame(() => {
    map.resize()
    requestAnimationFrame(() => map.resize())
  })
}
