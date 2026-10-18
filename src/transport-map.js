/**
 * /roads-and-rails/ and /roads-and-rails/#<year> (item 70; old /#transport links forward there).
 * GeoJSON is fetched only when the map opens.
 * A feature shows when opened <= year && (closed > year || closed is absent).
 */
import * as maplibregl from 'maplibre-gl'
import { TIMELINE_MAX_YEAR, groupTicks, openingEvents, sliderMinYear } from './transport-timeline.js'

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

/* Decade hues are spaced around the wheel so neighbours never share a family
 * (on-palette since Critiquito #291: gold / burnt sienna / umber / forest green / teal / olive green). Dark 1960 is
 * cyan (#3bc9db) so it stays clear of the 1880 mint, and dark 1970 is lime
 * (#c0eb75) so it stays clear of that cyan. Light 1830 is #9a6f00 for 3:1+ on the land. Dark mode uses lighter
 * tints of the same hues so every line clears 3:1 on the dark green land. */
export const ERA_COLORS = [
  [1830, '#9a6f00'],
  [1850, '#a0461b'],
  [1870, '#5c4033'],
  [1880, '#2f6b3a'],
  [1960, '#0c8599'],
  [1970, '#5c940d'],
]
const ERA_COLORS_DARK = {
  1830: '#ffd43b',
  1850: '#f4a46a',
  1870: '#d9c2a0',
  1880: '#7fd18b',
  1960: '#3bc9db',
  1970: '#c0eb75',
}

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
const KIND_COLORS = {
  light: { road: '#b4610f', trail: '#3f6b35' },
  dark: { road: '#f0b45a', trail: '#9fd08a' },
}

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

function futureFilter(year) {
  return ['all', ['has', 'opened'], ['>', ['get', 'opened'], year]]
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
    sources: {
      kentucky: { type: 'geojson', data: ky },
      rail: { type: 'geojson', data: rail },
      parkways: { type: 'geojson', data: roads },
      counties: { type: 'geojson', data: counties },
      sections: { type: 'geojson', data: secs },
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
        filter: transportYearFilter(DEFAULT_YEAR),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.casing, 'line-width': CASE_W },
      },
      {
        id: 'sec-line',
        type: 'line',
        source: 'sections',
        filter: transportYearFilter(DEFAULT_YEAR),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': eraColorExpr(theme), 'line-width': LINE_W },
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
  map.setPaintProperty('sec-future', 'line-color', c.future)
  map.setPaintProperty('bridge-circle', 'circle-color', c.bridge)
  map.setPaintProperty('bridge-circle', 'circle-stroke-color', c.bridgeStroke)
}

function applyYear(year) {
  const filter = transportYearFilter(year)
  for (const id of ['sec-casing', 'sec-line']) {
    if (map.getLayer(id)) map.setFilter(id, filter)
  }
  if (map.getLayer('sec-future')) map.setFilter('sec-future', futureFilter(year))
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
  // Keep the tooltip inside the controls column.
  tip.style.transform = ''
  const box = tip.getBoundingClientRect()
  const host = btn.parentElement.getBoundingClientRect()
  let shift = 0
  if (box.left < host.left) shift = host.left - box.left
  else if (box.right > host.right) shift = host.right - box.right
  if (shift) tip.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`
}

function hideTips(except) {
  document.querySelectorAll('#transportTicks .transport-tick.is-tip-open').forEach((b) => {
    if (b === except) return
    b.classList.remove('is-tip-open')
    const tip = document.getElementById(b.getAttribute('aria-describedby'))
    if (tip) tip.hidden = true
  })
}

function renderTicks(force = false) {
  const wrap = document.getElementById('transportTicks')
  if (!wrap || minYear == null || !timelineEvents.length) return
  const slider = document.getElementById('transportYear')
  const width = Math.max(0, (slider?.getBoundingClientRect().width || wrap.getBoundingClientRect().width) - 26)
  if (width === tickWidth && wrap.childElementCount && !force) return
  tickWidth = width
  const focusedYear = wrap.contains(document.activeElement) ? document.activeElement.dataset.year : null
  // Mouse users get tighter ticks (14px apart); touch and phone widths keep 24px targets apart.
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 600
  const ticks = groupTicks(timelineEvents, { min: minYear, max: MAX_YEAR, widthPx: width, minGapPx: coarse ? 24 : 14 })
  let html = ''
  ticks.forEach((t, i) => {
    const years = t.year === t.lastYear ? String(t.year) : `${t.year}–${t.lastYear}`
    const names = t.events.map((e) => `${e.name} (${e.year})`).join('; ')
    const aria = t.events.length > 1
      ? `${years}: ${t.events.length} openings: ${names}. Show ${t.year}.`
      : `${t.year}: ${t.events[0].name} opens. Show ${t.year}.`
    const tipRows = t.events.map((e) => `<li><span class="transport-tip-year">${esc(e.year)}</span> ${esc(e.name)}</li>`).join('')
    html += `<button type="button" class="transport-tick${t.events.length > 1 ? ' is-merged' : ''}" data-year="${esc(t.year)}"
      data-count="${esc(t.events.length)}" style="left:calc(13px + (100% - 26px) * ${(t.pct / 100).toFixed(4)})"
      aria-label="${esc(aria)}" aria-describedby="transportTip${i}"><span class="transport-tick-mark" aria-hidden="true"></span>${t.events.length > 1 ? `<span class="transport-tick-count" aria-hidden="true">+${t.events.length - 1}</span>` : ''}</button>
      <div id="transportTip${i}" class="transport-tip" role="tooltip" hidden style="left:calc(13px + (100% - 26px) * ${(t.pct / 100).toFixed(4)})">
        <p class="transport-tip-head">${esc(t.label)} <span>${esc(years)}</span></p>${t.events.length > 1 ? `<ul>${tipRows}</ul>` : ''}</div>`
  })
  wrap.innerHTML = html
  wrap.dataset.ticks = String(ticks.length)
  wrap.dataset.events = String(timelineEvents.length)
  const current = Number(document.getElementById('transport')?.dataset.year || DEFAULT_YEAR)
  syncTicks(current)
  if (focusedYear) wrap.querySelector(`.transport-tick[data-year="${CSS.escape(focusedYear)}"]`)?.focus()
}

function syncTicks(year) {
  document.querySelectorAll('#transportTicks .transport-tick').forEach((b) => {
    b.classList.toggle('is-past', Number(b.dataset.year) <= year)
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
  html += `<li><i class="transport-swatch" style="background:${esc(kindColorFor('trail'))}" aria-hidden="true"></i>Trails before 1775</li>`
  html += '<li><i class="transport-swatch is-future-swatch" aria-hidden="true"></i>Not yet open</li></ul>'
  list.innerHTML = html
  renderSections(year)
}

function renderSections(year) {
  const wrap = document.getElementById('transportSections')
  if (!wrap || !sections) return
  let html = ''
  const groups = [
    ['trail', 'Before 1775'],
    ['road', 'Early roads and traces'],
    ['rail', 'Railroad sections'],
    ['parkway', 'Parkways'],
  ]
  for (const [kind, label] of groups) {
    const items = sections.features.map((f) => f.properties).filter((f) => f.kind === kind)
    const seen = new Set()
    let rows = ''
    for (const f of items) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      const on = f.undated === true || f.opened <= year
      const title = `${f.routeName}: ${f.from} to ${f.to}`
      const jump = f.undated === true ? (minYear ?? year) : f.opened > 2000 ? 2000 : f.opened
      rows += `<li class="${on ? 'is-on' : 'is-future'}">
          <button type="button" data-year="${esc(jump)}">
          <i class="transport-swatch" style="background:${esc(kindColorFor(f.kind) || eraColorFor(f.opened))}" aria-hidden="true"></i>
          <span class="transport-legend-name">${esc(title)}</span>
          <span class="transport-legend-year">${esc(f.openedLabel || f.opened)}</span>
          ${f.dateStatus === 'needs-source' ? '<span class="transport-badge is-needs-source">Needs source</span>' : f.dateStatus === 'disputed' ? '<span class="transport-badge">Disputed</span>' : f.provisional ? '<span class="transport-badge">Provisional</span>' : ''}
        </button>
      </li>`
    }
    if (kind === 'rail') {
      html += `<details class="transport-rail-details" data-k="rail"><summary>${esc(label)} (${seen.size})</summary><ul class="transport-legend-list">${rows}</ul></details>`
    } else {
      html += `<p class="transport-legend-label">${esc(label)}</p><ul class="transport-legend-list">${rows}</ul>`
    }
  }
  // Editor #291: never rebuild on (or around) a toggle. The open state lives in railSectionsOpen,
  // updated from the toggle event (fired after the browser flips it), and an unchanged list is left alone.
  if (!wrap.dataset.toggleWired) {
    wrap.dataset.toggleWired = '1'
    wrap.addEventListener('toggle', (event) => {
      if (event.target.matches?.('details.transport-rail-details')) railSectionsOpen = event.target.open
    }, true)
  }
  if (html === lastSectionsHtml && wrap.querySelector('details.transport-rail-details')) return
  lastSectionsHtml = html
  wrap.innerHTML = html
  if (railSectionsOpen) wrap.querySelector('details.transport-rail-details').open = true
}
let railSectionsOpen = false
let lastSectionsHtml = ''


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
  for (const id of ['sec-line', 'bridge-circle']) {
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
  if (!fitted) {
    map.fitBounds(
      [
        [-89.58, 36.45],
        [-81.96, 39.17],
      ],
      // Bottom padding clears the credits strip so 'toward Chattanooga' stays readable.
      { padding: { top: 18, left: 18, right: 18, bottom: 18 + creditsHeight(container) }, duration: 0 },
    )
    fitted = true
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
  for (const el of [legend, document.getElementById('transportSections')]) {
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
    if (hit) label.style.visibility = 'hidden'
    else placed.push(r)
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
