/**
 * #transport / #transport/<year>
 * Phase 1 proof of concept. GeoJSON is fetched only when this view opens.
 * A feature shows when opened <= year && (closed > year || closed is absent).
 */
import * as maplibregl from 'maplibre-gl'

const MIN_YEAR = 1800
const MAX_YEAR = 2000
const DEFAULT_YEAR = 1880

const COLORS = {
  light: {
    bg: '#f4efe4',
    land: '#1c3d32',
    landLine: '#e2b15a',
    casing: '#10261c',
    lo: '#f6e7c1',
    ln: '#e2b15a',
    cs: '#d0893a',
    parkway: '#c9e6b0',
    bridge: '#fff8ea',
    bridgeStroke: '#6e4214',
  },
  dark: {
    bg: '#100e0c',
    land: '#173028',
    landLine: '#c9893a',
    casing: '#0b0a09',
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
  'Outline: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>.'

let map = null
let bootPromise = null
let sources = null
let fitted = false
const sourceById = new Map()

export function clampTransportYear(year) {
  if (year == null || !Number.isFinite(year)) return DEFAULT_YEAR
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.round(year)))
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
    'all',
    ['<=', ['get', 'opened'], year],
    ['any', ['!', ['has', 'closed']], ['>', ['get', 'closed'], year]],
  ]
}

function swatchColor(id, kind, theme) {
  const c = COLORS[theme]
  if (id === 'lexington-ohio') return c.lo
  if (id === 'ln-main') return c.ln
  if (id === 'cs-north' || id === 'cs-south') return c.cs
  if (kind === 'bridge') return c.bridge
  return c.parkway
}

function railColorExpr(theme) {
  const c = COLORS[theme]
  return ['match', ['get', 'id'], 'lexington-ohio', c.lo, 'ln-main', c.ln, 'cs-north', c.cs, 'cs-south', c.cs, c.ln]
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json()
}

function styleFor(theme, ky, rail, roads) {
  const c = COLORS[theme]
  return {
    version: 8,
    name: 'Kentucky transport',
    sources: {
      kentucky: { type: 'geojson', data: ky },
      rail: { type: 'geojson', data: rail },
      parkways: { type: 'geojson', data: roads },
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
        id: 'parkway-casing',
        type: 'line',
        source: 'parkways',
        filter: transportYearFilter(DEFAULT_YEAR),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.casing, 'line-width': 4.6 },
      },
      {
        id: 'parkway-line',
        type: 'line',
        source: 'parkways',
        filter: transportYearFilter(DEFAULT_YEAR),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.parkway, 'line-width': 2.4 },
      },
      {
        id: 'rail-casing',
        type: 'line',
        source: 'rail',
        filter: transportYearFilter(DEFAULT_YEAR),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': c.casing,
          'line-width': ['match', ['get', 'id'], 'lexington-ohio', 6.2, 4.8],
        },
      },
      {
        id: 'rail-line',
        type: 'line',
        source: 'rail',
        filter: transportYearFilter(DEFAULT_YEAR),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': railColorExpr(theme),
          'line-width': ['match', ['get', 'id'], 'lexington-ohio', 3.6, 2.6],
        },
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
  map.setPaintProperty('parkway-casing', 'line-color', c.casing)
  map.setPaintProperty('parkway-line', 'line-color', c.parkway)
  map.setPaintProperty('rail-casing', 'line-color', c.casing)
  map.setPaintProperty('rail-line', 'line-color', railColorExpr(theme))
  map.setPaintProperty('bridge-circle', 'circle-color', c.bridge)
  map.setPaintProperty('bridge-circle', 'circle-stroke-color', c.bridgeStroke)
}

function applyYear(year) {
  const filter = transportYearFilter(year)
  for (const id of ['rail-casing', 'rail-line', 'parkway-casing', 'parkway-line']) {
    if (map.getLayer(id)) map.setFilter(id, filter)
  }
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
  renderLegend(year)
}

function renderLegend(year) {
  const list = document.getElementById('transportLegend')
  if (!list || !sources) return
  const theme = themeName()
  const groups = [
    ['rail', 'Railroads'],
    ['parkway', 'Parkways'],
  ]
  const features = sources.features || []
  let html = ''
  for (const [kind, label] of groups) {
    const items = features.filter((f) => (kind === 'rail' ? f.kind !== 'parkway' : f.kind === 'parkway'))
    if (!items.length) continue
    html += `<p class="transport-legend-label">${esc(label)}</p><ul class="transport-legend-list">`
    for (const f of items) {
      const on = f.opened <= year && (f.closed == null || f.closed > year)
      const color = swatchColor(f.id, f.kind, theme)
      const shape = f.kind === 'bridge' ? ' is-bridge' : ''
      html += `<li class="${on ? 'is-on' : 'is-future'}">
          <button type="button" data-year="${esc(f.opened)}">
          <i class="transport-swatch${shape}" style="background:${esc(color)}" aria-hidden="true"></i>
          <span class="transport-legend-name">${esc(f.name)}</span>
          <span class="transport-legend-year">${esc(f.openedLabel || f.opened)}</span>
          <span class="transport-badge">Provisional</span>
        </button>
      </li>`
    }
    html += '</ul>'
  }
  list.innerHTML = html
}

function writeHash(year) {
  const next = `#transport/${year}`
  if (location.hash === next) return
  const url = new URL(location.href)
  url.hash = `transport/${year}`
  history.replaceState(null, '', url.href)
}

function popupHtml(props) {
  const meta = sourceById.get(props.id)
  const label = meta?.openedLabel || props.opened
  const summary = meta?.summary || ''
  const kind = props.kind === 'parkway' ? 'Parkway' : props.kind === 'bridge' ? 'Bridge' : 'Railroad'
  return `<div class="transport-popup-card">
    <p class="transport-popup-kicker">${esc(kind)} · provisional date</p>
    <h3>${esc(props.name)}</h3>
    <p class="transport-popup-year">Opened ${esc(label)}</p>
    ${summary ? `<p>${esc(summary)}</p>` : ''}
    <p class="transport-popup-note">Provisional. Research Bot is still confirming this date.</p>
  </div>`
}

function onLineClick(e) {
  const feature = e.features && e.features[0]
  if (!feature) return
  const props = feature.properties || {}
  new maplibregl.Popup({ className: 'transport-popup', maxWidth: '280px', closeButton: true })
    .setLngLat(e.lngLat)
    .setHTML(popupHtml(props))
    .addTo(map)
}

function wireMap() {
  for (const id of ['rail-line', 'parkway-line', 'bridge-circle']) {
    map.on('mouseenter', id, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', id, () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('click', id, onLineClick)
  }
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.addControl(new maplibregl.AttributionControl({ customAttribution: ATTRIBUTION, compact: false }), 'bottom-right')
}

async function boot() {
  const [rail, roads, ky, src] = await Promise.all([
    fetchJson('/maps/transport/rail.geojson'),
    fetchJson('/maps/transport/parkways.geojson'),
    fetchJson('/data/kentucky-outline.geojson'),
    fetchJson('/maps/transport/sources.json'),
  ])
  sources = src
  sourceById.clear()
  for (const f of src.features || []) sourceById.set(f.id, f)
  const container = document.getElementById('transportMap')
  if (!container) throw new Error('transport map container missing')
  map = new maplibregl.Map({
    container,
    style: styleFor(themeName(), ky, rail, roads),
    center: [-85.9, 37.6],
    zoom: 6,
    attributionControl: false,
    fadeDuration: 0,
  })
  wireMap()
  await new Promise((resolve) => map.once('load', resolve))
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
      { padding: 18, duration: 0 },
    )
    fitted = true
  }
  const slider = document.getElementById('transportYear')
  const legend = document.getElementById('transportLegend')
  if (slider && !slider.dataset.wired) {
    slider.dataset.wired = '1'
    slider.addEventListener('input', () => {
      const year = clampTransportYear(Number(slider.value))
      applyYear(year)
      writeHash(year)
    })
  }
  if (legend && !legend.dataset.wired) {
    legend.dataset.wired = '1'
    legend.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-year]')
      if (!btn) return
      const year = clampTransportYear(Number(btn.dataset.year))
      applyYear(year)
      writeHash(year)
    })
  }
  window.addEventListener('resize', () => {
    if (map) map.resize()
  })
}

export async function showTransport(yearInput) {
  const year = clampTransportYear(yearInput)
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
  applyYear(year)
  writeHash(year)
  requestAnimationFrame(() => {
    map.resize()
    requestAnimationFrame(() => map.resize())
  })
}
