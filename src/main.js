import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { marked } from 'marked'

/** Default free OSM-friendly style (CARTO Voyager via openstreetmap.fr-compatible raster). */
const OSM_STYLE = {
  version: 8,
  name: 'OSM Voyager',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

const OHM_SOURCE = {
  type: 'raster',
  tiles: ['https://tiles.openhistoricalmap.org/map/ohm/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution: '&copy; <a href="https://www.openhistoricalmap.org/">OpenHistoricalMap</a>',
  maxzoom: 19,
}

const CENTER = [-85.058, 38.258]
const START_ZOOM = 9

const ERAS = [
  { id: 'prehistoric', label: 'Prehistoric' },
  { id: 'native', label: 'Native' },
  { id: 'frontier', label: 'Frontier' },
  { id: 'early-commonwealth', label: 'Early commonwealth' },
  { id: 'other', label: 'Other' },
]

const YEAR_PRESETS = [
  { id: 'before-1000', label: 'Before 1000', min: null, max: 999 },
  { id: '1000-1600', label: '1000–1600', min: 1000, max: 1600 },
  { id: '1600-1750', label: '1600–1750', min: 1600, max: 1750 },
  { id: '1750-1792', label: '1750–1792', min: 1750, max: 1792 },
  { id: '1792-1820', label: '1792–1820', min: 1792, max: 1820 },
  { id: '1820-1860', label: '1820–1860', min: 1820, max: 1860 },
  { id: 'all', label: 'All', min: null, max: null },
]

marked.setOptions({ breaks: true })

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatYear(y) {
  if (y == null || Number.isNaN(y)) return '—'
  if (y < 0) return `${Math.abs(y)} BCE`
  return String(y)
}

function formatYearRange(start, end) {
  if (start == null && end == null) return 'Year unknown'
  if (start != null && end != null && start !== end) {
    return `${formatYear(start)} – ${formatYear(end)}`
  }
  return formatYear(start ?? end)
}

function parseHash() {
  const raw = (location.hash || '#map').replace(/^#/, '')
  const [path, ...rest] = raw.split('/')
  if (path === 'story' && rest[0]) return { view: 'story', slug: decodeURIComponent(rest[0]) }
  if (['map', 'timeline', 'stories', 'about', 'app'].includes(path)) return { view: path }
  return { view: 'map' }
}

/* -------------------- Map -------------------- */
let map = null
let mapReady = false

function initMap() {
  if (map) {
    requestAnimationFrame(() => map.resize())
    return
  }
  map = new maplibregl.Map({
    container: 'mapCanvas',
    style: OSM_STYLE,
    center: CENTER,
    zoom: START_ZOOM,
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }))

  const detailEl = document.getElementById('detail')
  const statsEl = document.getElementById('stats')
  const phase1Only = document.getElementById('phase1Only')
  const layerOhm = document.getElementById('layerOhm')

  function showDetail(p) {
    detailEl.classList.remove('empty')
    const link = p.source_url
      ? `<p><a href="${p.source_url}" target="_blank" rel="noopener">history.ky.gov</a></p>`
      : ''
    detailEl.innerHTML = `
      <h3>${escapeHtml(p.title)}</h3>
      <div class="meta">#${escapeHtml(String(p.marker_number || '—'))} · ${escapeHtml(p.county || '')} County</div>
      <p>${escapeHtml(p.location_text || '')}</p>
      <p>${escapeHtml(p.inscription || '')}</p>
      ${link}
    `
  }

  function applyPhaseFilter() {
    const only = phase1Only.checked
    map.setFilter('markers-circle', only ? ['==', ['get', 'phase1'], true] : null)
    map.setFilter('markers-hit', only ? ['==', ['get', 'phase1'], true] : null)
    updateStats()
  }

  function updateStats() {
    const src = map.getSource('markers')
    if (!src || !src._data) return
    const feats = src._data.features || []
    const shown = phase1Only.checked ? feats.filter((f) => f.properties.phase1) : feats
    statsEl.textContent = `Showing ${shown.length.toLocaleString()} of ${feats.length.toLocaleString()} geocoded markers`
  }

  map.on('load', async () => {
    const res = await fetch('/data/markers.geojson')
    const data = await res.json()
    map.addSource('markers', { type: 'geojson', data })
    map.addLayer({
      id: 'markers-circle',
      type: 'circle',
      source: 'markers',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3, 12, 7, 16, 10],
        'circle-color': '#e87722',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#1a1208',
        'circle-opacity': 0.9,
      },
    })
    map.addLayer({
      id: 'markers-hit',
      type: 'circle',
      source: 'markers',
      paint: { 'circle-radius': 14, 'circle-opacity': 0 },
    })
    applyPhaseFilter()
    map.on('mouseenter', 'markers-hit', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'markers-hit', () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('click', 'markers-hit', (e) => {
      const f = e.features?.[0]
      if (f) showDetail(f.properties)
    })
    phase1Only.addEventListener('change', applyPhaseFilter)
    layerOhm.addEventListener('change', () => {
      if (layerOhm.checked) {
        if (!map.getSource('ohm')) {
          map.addSource('ohm', OHM_SOURCE)
          map.addLayer(
            {
              id: 'ohm',
              type: 'raster',
              source: 'ohm',
              paint: { 'raster-opacity': 0.55 },
            },
            'markers-circle'
          )
        } else {
          map.setLayoutProperty('ohm', 'visibility', 'visible')
        }
      } else if (map.getLayer('ohm')) {
        map.setLayoutProperty('ohm', 'visibility', 'none')
      }
    })
    mapReady = true
  })
}

/* -------------------- Stories / Timeline -------------------- */
let storiesIndex = null
let timelineState = {
  eras: new Set(ERAS.map((e) => e.id)),
  yearMin: null,
  yearMax: null,
  preset: 'all',
}

async function loadStories() {
  if (storiesIndex) return storiesIndex
  const res = await fetch('/content/stories.json')
  storiesIndex = await res.json()
  return storiesIndex
}

function storyCard(s) {
  return `
    <a class="story-card" href="#story/${encodeURIComponent(s.slug)}">
      <div class="story-card-meta">
        <span class="era-pill era-${escapeHtml(s.era)}">${escapeHtml(s.era)}</span>
        <span>${escapeHtml(formatYearRange(s.yearStart, s.yearEnd))}</span>
        <span>${escapeHtml(s.briefDate || s.publishedDate || '')}</span>
      </div>
      <h3>${escapeHtml(s.title)}</h3>
      <p>${escapeHtml(s.summary || '')}</p>
    </a>
  `
}

async function renderStoriesList() {
  const idx = await loadStories()
  const list = document.getElementById('storiesList')
  const sorted = [...idx.stories].sort((a, b) =>
    String(b.briefDate || '').localeCompare(String(a.briefDate || '')) ||
    String(a.title).localeCompare(String(b.title))
  )
  list.innerHTML = sorted.map(storyCard).join('') || '<p class="muted">No stories yet.</p>'
}

async function renderStoryDetail(slug) {
  const el = document.getElementById('storyDetail')
  el.innerHTML = '<p class="muted">Loading…</p>'
  try {
    const res = await fetch(`/content/stories/${encodeURIComponent(slug)}.json`)
    if (!res.ok) throw new Error('not found')
    const s = await res.json()
    const tags = (s.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')
    el.innerHTML = `
      <header class="story-head">
        <div class="story-card-meta">
          <span class="era-pill era-${escapeHtml(s.era)}">${escapeHtml(s.era)}</span>
          <span>${escapeHtml(formatYearRange(s.yearStart, s.yearEnd))}</span>
          <span>Brief ${escapeHtml(s.briefDate || '')}</span>
        </div>
        <h2>${escapeHtml(s.title)}</h2>
        <div class="tags">${tags}</div>
      </header>
      <div class="story-body">${marked.parse(s.bodyMarkdown || '')}</div>
      <p class="story-source muted">Source: ${escapeHtml(s.source || 'daily-brief')}</p>
    `
  } catch {
    el.innerHTML = `<p>Story not found. <a href="#stories">Back to stories</a></p>`
  }
}

function setupTimelineFilters() {
  const eraBox = document.getElementById('eraChips')
  const presetBox = document.getElementById('yearPresets')
  if (eraBox.dataset.ready) return
  eraBox.dataset.ready = '1'

  eraBox.innerHTML = ERAS.map(
    (e) =>
      `<button type="button" class="chip active" data-era="${e.id}">${escapeHtml(e.label)}</button>`
  ).join('')

  presetBox.innerHTML = YEAR_PRESETS.map(
    (p) =>
      `<button type="button" class="chip preset ${p.id === 'all' ? 'active' : ''}" data-preset="${p.id}">${escapeHtml(p.label)}</button>`
  ).join('')

  eraBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-era]')
    if (!btn) return
    const id = btn.dataset.era
    if (timelineState.eras.has(id)) timelineState.eras.delete(id)
    else timelineState.eras.add(id)
    btn.classList.toggle('active')
    renderTimelineList()
  })

  presetBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]')
    if (!btn) return
    const preset = YEAR_PRESETS.find((p) => p.id === btn.dataset.preset)
    if (!preset) return
    timelineState.preset = preset.id
    timelineState.yearMin = preset.min
    timelineState.yearMax = preset.max
    document.getElementById('yearMin').value = preset.min ?? ''
    document.getElementById('yearMax').value = preset.max ?? ''
    presetBox.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === btn))
    renderTimelineList()
  })

  document.getElementById('yearApply').addEventListener('click', () => {
    const minV = document.getElementById('yearMin').value
    const maxV = document.getElementById('yearMax').value
    timelineState.yearMin = minV === '' ? null : Number(minV)
    timelineState.yearMax = maxV === '' ? null : Number(maxV)
    timelineState.preset = 'custom'
    presetBox.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
    renderTimelineList()
  })

  document.getElementById('yearClear').addEventListener('click', () => {
    timelineState.yearMin = null
    timelineState.yearMax = null
    timelineState.preset = 'all'
    timelineState.eras = new Set(ERAS.map((e) => e.id))
    document.getElementById('yearMin').value = ''
    document.getElementById('yearMax').value = ''
    eraBox.querySelectorAll('.chip').forEach((c) => c.classList.add('active'))
    presetBox.querySelectorAll('.chip').forEach((c) =>
      c.classList.toggle('active', c.dataset.preset === 'all')
    )
    renderTimelineList()
  })
}

function storyMatchesFilters(s) {
  if (!timelineState.eras.has(s.era)) return false
  const y = s.yearStart
  if (timelineState.yearMin != null || timelineState.yearMax != null) {
    if (y == null) return false
    if (timelineState.yearMin != null && y < timelineState.yearMin) return false
    if (timelineState.yearMax != null && y > timelineState.yearMax) return false
  }
  return true
}

async function renderTimelineList() {
  setupTimelineFilters()
  const idx = await loadStories()
  const list = document.getElementById('timelineList')
  const stats = document.getElementById('timelineStats')
  const filtered = idx.stories
    .filter(storyMatchesFilters)
    .sort((a, b) => {
      const ya = a.yearStart ?? 99999
      const yb = b.yearStart ?? 99999
      if (ya !== yb) return ya - yb
      return String(a.title).localeCompare(String(b.title))
    })
  stats.textContent = `Showing ${filtered.length} of ${idx.stories.length} stories`
  list.innerHTML =
    filtered
      .map(
        (s) => `
      <li class="timeline-item">
        <div class="timeline-year">${escapeHtml(formatYearRange(s.yearStart, s.yearEnd))}</div>
        <div class="timeline-body">
          <a href="#story/${encodeURIComponent(s.slug)}"><strong>${escapeHtml(s.title)}</strong></a>
          <div class="story-card-meta">
            <span class="era-pill era-${escapeHtml(s.era)}">${escapeHtml(s.era)}</span>
            <span>${escapeHtml(s.briefDate || '')}</span>
          </div>
          <p>${escapeHtml(s.summary || '')}</p>
        </div>
      </li>`
      )
      .join('') || '<li class="muted">No stories match these filters.</li>'
}

/* -------------------- Router -------------------- */
function setActiveNav(view) {
  document.querySelectorAll('#mainNav a').forEach((a) => {
    const r = a.dataset.route
    a.classList.toggle('active', r === view || (view === 'story' && r === 'stories'))
  })
}

async function applyRoute() {
  const { view, slug } = parseHash()
  document.querySelectorAll('.view').forEach((el) => {
    const v = el.dataset.view
    const show = v === view || (view === 'map' && v === 'map')
    el.hidden = !show
  })
  const hero = document.getElementById('hero')
  if (hero) hero.hidden = view !== 'map'

  setActiveNav(view)

  if (view === 'map') {
    initMap()
    requestAnimationFrame(() => map?.resize())
  } else if (view === 'stories') {
    await renderStoriesList()
  } else if (view === 'timeline') {
    await renderTimelineList()
  } else if (view === 'story') {
    await renderStoryDetail(slug)
  }
}

window.addEventListener('hashchange', () => {
  applyRoute().catch(console.error)
})

applyRoute().catch(console.error)
