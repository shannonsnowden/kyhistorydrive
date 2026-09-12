import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { marked } from 'marked'

/** CARTO Voyager raster (OSM data). Requires VITE_CARTO_API_KEY at build time. */
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY || '').trim()
const cartoTile = (host) => {
  const base = `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`
  return CARTO_KEY ? `${base}?key=${encodeURIComponent(CARTO_KEY)}` : base
}

const OSM_STYLE = {
  version: 8,
  name: 'OSM Voyager',
  sources: {
    osm: {
      type: 'raster',
      tiles: [cartoTile('a'), cartoTile('b'), cartoTile('c')],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
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

/** Match iOS ContentView layer order/labels. Defaults: Markers ON, others OFF. */
const DATA_LAYERS = [
  {
    id: 'markers',
    label: 'Markers',
    icon: { type: 'img', src: '/icons/highway-marker.png' },
    color: '#c9893a',
    defaultOn: true,
    geojson: '/data/markers.geojson',
    yearFilter: false,
  },
  {
    id: 'history',
    label: 'History',
    icon: { type: 'emoji', glyph: '📖' },
    color: '#6b8f71',
    defaultOn: false,
    geojson: '/data/layers/history.geojson',
    yearFilter: true,
  },
  {
    id: 'museums',
    label: 'Museums',
    icon: { type: 'emoji', glyph: '🏛' },
    color: '#8b6b4a',
    defaultOn: false,
    geojson: '/data/layers/museums.geojson',
    yearFilter: false,
  },
  {
    id: 'national',
    label: 'National',
    icon: { type: 'emoji', glyph: '⭐' },
    color: '#d4a017',
    defaultOn: false,
    geojson: '/data/layers/national.geojson',
    yearFilter: false,
  },
  {
    id: 'war',
    label: 'War Sites',
    icon: { type: 'img', src: '/icons/musket-sword.png' },
    color: '#8b3a3a',
    defaultOn: false,
    geojson: '/data/layers/war.geojson',
    yearFilter: false,
  },
  {
    id: 'locals',
    label: 'Good Eats',
    icon: { type: 'img', src: '/icons/locals.png' },
    color: '#c45c26',
    defaultOn: false,
    geojson: '/data/layers/locals.geojson',
    yearFilter: false,
  },
  {
    id: 'bridges',
    label: 'Covered Bridges',
    icon: { type: 'img', src: '/icons/covered-bridge.png' },
    color: '#5c7a4a',
    defaultOn: false,
    geojson: '/data/layers/bridges.geojson',
    yearFilter: false,
  },
  {
    id: 'industry',
    label: 'Industry',
    icon: { type: 'img', src: '/icons/industry.png' },
    color: '#6a5acd',
    defaultOn: false,
    geojson: '/data/layers/industry.geojson',
    yearFilter: false,
  },
  {
    id: 'newspapers',
    label: 'Newspapers',
    icon: { type: 'img', src: '/icons/newspaper.png' },
    color: '#4a6fa5',
    defaultOn: false,
    geojson: '/data/layers/newspapers.geojson',
    yearFilter: false,
  },
  {
    id: 'parks',
    label: 'Parks',
    icon: { type: 'img', src: '/icons/statepark.png' },
    color: '#2d5a3d',
    defaultOn: false,
    geojson: '/data/layers/parks.geojson',
    yearFilter: false,
  },
  {
    id: 'cemeteries',
    label: 'Cemeteries',
    icon: { type: 'img', src: '/icons/cemetery.png' },
    color: '#5a5a5a',
    defaultOn: false,
    geojson: '/data/layers/cemeteries.geojson',
    yearFilter: false,
  },
  {
    id: 'distilleries',
    label: 'Distilleries',
    icon: { type: 'img', src: '/icons/bourbon-glass.png' },
    color: '#a65d2e',
    defaultOn: false,
    geojson: '/data/layers/distilleries.geojson',
    yearFilter: false,
  },
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

async function loadImage(map, id, url) {
  if (map.hasImage(id)) return true
  try {
    const result = await map.loadImage(url)
    const image = result?.data ?? result
    if (!image) return false
    if (!map.hasImage(id)) map.addImage(id, image, { sdf: false })
    return true
  } catch (err) {
    console.warn('icon load failed', url, err)
    return false
  }
}

/* -------------------- Shared timeline filter state -------------------- */
let timelineState = {
  eras: new Set(ERAS.map((e) => e.id)),
  yearMin: null,
  yearMax: null,
  preset: 'all',
}

const layerVisibility = Object.fromEntries(DATA_LAYERS.map((l) => [l.id, l.defaultOn]))

/* -------------------- Map -------------------- */
let map = null
let mapReady = false
let pendingFocus = null // { lon, lat, title, slug? }

function layerCircleId(id) {
  return `${id}-circle`
}
function layerHitId(id) {
  return `${id}-hit`
}
function layerSymbolId(id) {
  return `${id}-symbol`
}

function buildYearEraFilter(layerDef) {
  if (!layerDef.yearFilter) return null
  const parts = []
  const eras = [...timelineState.eras]
  const allEras = eras.length === ERAS.length
  if (!allEras && eras.length) {
    parts.push(['in', ['get', 'era'], ['literal', eras]])
  } else if (!allEras && eras.length === 0) {
    return ['==', ['get', 'id'], '__none__']
  }
  const { yearMin, yearMax } = timelineState
  if (yearMin != null || yearMax != null) {
    // Require yearStart; features without it are omitted from filtered views
    parts.push(['has', 'yearStart'])
    if (yearMin != null) parts.push(['>=', ['to-number', ['get', 'yearStart']], yearMin])
    if (yearMax != null) parts.push(['<=', ['to-number', ['get', 'yearStart']], yearMax])
  }
  if (!parts.length) return null
  return parts.length === 1 ? parts[0] : ['all', ...parts]
}



function applyMapFilters() {
  if (!map || !mapReady) return
  for (const def of DATA_LAYERS) {
    const filter = buildYearEraFilter(def)
    for (const lid of [layerCircleId(def.id), layerHitId(def.id), layerSymbolId(def.id)]) {
      if (map.getLayer(lid)) map.setFilter(lid, filter)
    }
  }
  // stories overlay on main map (always year-filterable when present)
  for (const lid of ['stories-circle', 'stories-hit', 'stories-highlight']) {
    if (!map.getLayer(lid)) continue
    const f = buildYearEraFilter({ yearFilter: true })
    map.setFilter(lid, f)
  }
  updateStats()
}

function setLayerVisible(id, on) {
  layerVisibility[id] = on
  if (!map || !mapReady) return
  const vis = on ? 'visible' : 'none'
  for (const lid of [layerCircleId(id), layerHitId(id), layerSymbolId(id)]) {
    if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', vis)
  }
  syncAllLayersCheckbox()
  updateStats()
}

function syncAllLayersCheckbox() {
  const el = document.getElementById('allLayers')
  if (!el) return
  el.checked = DATA_LAYERS.every((l) => layerVisibility[l.id])
}

function showDetailFromProps(p, layerId) {
  const detailEl = document.getElementById('detail')
  detailEl.classList.remove('empty')
  const name = p.name || p.title || 'Untitled'
  const metaBits = []
  if (layerId === 'markers' || p.marker_number) {
    metaBits.push(`#${p.marker_number || '—'}`)
  }
  if (p.county) metaBits.push(`${p.county} County`)
  if (p.city) metaBits.push(p.city)
  if (p.era) metaBits.push(p.era)
  if (p.yearStart != null || p.yearEnd != null) {
    metaBits.push(formatYearRange(p.yearStart, p.yearEnd))
  }
  if (p.category) metaBits.push(p.category)
  if (p.war) metaBits.push(p.war)
  const desc = p.inscription || p.history || p.description || p.location_text || ''
  const href = p.source_url || p.website || null
  const linkLabel = p.source_url ? 'history.ky.gov' : 'Website'
  const link = href
    ? `<p><a href="${escapeHtml(href)}" target="_blank" rel="noopener">${linkLabel}</a></p>`
    : ''
  const layerLabel = DATA_LAYERS.find((l) => l.id === layerId)?.label || layerId
  detailEl.innerHTML = `
    <div class="detail-layer">${escapeHtml(layerLabel)}</div>
    <h3>${escapeHtml(name)}</h3>
    <div class="meta">${escapeHtml(metaBits.filter(Boolean).join(' · '))}</div>
    <p>${escapeHtml(desc)}</p>
    ${link}
  `
}

function updateStats() {
  const statsEl = document.getElementById('stats')
  if (!statsEl || !map) return
  const bits = []
  for (const def of DATA_LAYERS) {
    if (!layerVisibility[def.id]) continue
    const src = map.getSource(def.id)
    if (!src?._data?.features) continue
    let n = src._data.features.length
    bits.push(`${n.toLocaleString()} ${def.label}`)
  }
  statsEl.textContent = bits.length ? `Showing ${bits.join(' · ')}` : 'No layers enabled'
}

function renderLayerToggles() {
  const box = document.getElementById('layerToggles')
  if (!box || box.dataset.ready) return
  box.dataset.ready = '1'
  box.innerHTML = DATA_LAYERS.map((l) => {
    const icon =
      l.icon.type === 'img'
        ? `<img class="layer-icon" src="${l.icon.src}" alt="" width="18" height="18" />`
        : `<span class="layer-icon emoji" aria-hidden="true">${l.icon.glyph}</span>`
    return `<label class="ctrl layer-row">
      <input type="checkbox" data-layer="${l.id}" ${l.defaultOn ? 'checked' : ''} />
      ${icon}
      <span>${escapeHtml(l.label)}</span>
      <span class="swatch" style="background:${l.color}"></span>
    </label>`
  }).join('')

  box.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-layer]')
    if (!input) return
    setLayerVisible(input.dataset.layer, input.checked)
  })

  document.getElementById('allLayers')?.addEventListener('change', (e) => {
    const on = e.target.checked
    for (const def of DATA_LAYERS) {
      const input = box.querySelector(`input[data-layer="${def.id}"]`)
      if (input) input.checked = on
      setLayerVisible(def.id, on)
    }
  })
}

async function addDataLayer(def) {
  try {
    const res = await fetch(def.geojson)
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    if (map.getSource(def.id)) return
    map.addSource(def.id, { type: 'geojson', data })

    const vis = layerVisibility[def.id] ? 'visible' : 'none'
    map.addLayer({
      id: layerCircleId(def.id),
      type: 'circle',
      source: def.id,
      layout: { visibility: vis },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 12, 7, 16, 11],
        'circle-color': def.color,
        'circle-stroke-width': 1.25,
        'circle-stroke-color': '#101812',
        'circle-opacity': 0.9,
      },
    })
    map.addLayer({
      id: layerHitId(def.id),
      type: 'circle',
      source: def.id,
      layout: { visibility: vis },
      paint: { 'circle-radius': 14, 'circle-opacity': 0 },
    })

    if (def.icon.type === 'img') {
      const imgId = `icon-${def.id}`
      const ok = await loadImage(map, imgId, def.icon.src)
      if (ok) {
        map.addLayer({
          id: layerSymbolId(def.id),
          type: 'symbol',
          source: def.id,
          layout: {
            visibility: vis,
            'icon-image': imgId,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.45, 12, 0.7, 16, 0.95],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
        // Prefer icons: fade circles a bit when symbol present
        map.setPaintProperty(layerCircleId(def.id), 'circle-opacity', 0.35)
        map.setPaintProperty(layerCircleId(def.id), 'circle-radius', [
          'interpolate',
          ['linear'],
          ['zoom'],
          7,
          5,
          12,
          9,
          16,
          12,
        ])
      }
    }

    map.on('mouseenter', layerHitId(def.id), () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layerHitId(def.id), () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('click', layerHitId(def.id), (e) => {
      const f = e.features?.[0]
      if (f) showDetailFromProps(f.properties, def.id)
    })
  } catch (err) {
    console.warn('layer failed', def.id, err)
  }
}

function flyToFocus(targetMap, focus, zoom = 12) {
  if (!targetMap || !focus || focus.lon == null || focus.lat == null) return
  targetMap.flyTo({ center: [focus.lon, focus.lat], zoom, essential: true })
}

function ensureHighlightSource(targetMap, focus) {
  const data = {
    type: 'FeatureCollection',
    features:
      focus?.lon != null
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [focus.lon, focus.lat] },
              properties: { title: focus.title || '' },
            },
          ]
        : [],
  }
  if (targetMap.getSource('highlight')) {
    targetMap.getSource('highlight').setData(data)
  } else {
    targetMap.addSource('highlight', { type: 'geojson', data })
    targetMap.addLayer({
      id: 'highlight-glow',
      type: 'circle',
      source: 'highlight',
      paint: {
        'circle-radius': 18,
        'circle-color': '#c9893a',
        'circle-opacity': 0.25,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#e8d5a8',
      },
    })
    targetMap.addLayer({
      id: 'highlight-core',
      type: 'circle',
      source: 'highlight',
      paint: {
        'circle-radius': 7,
        'circle-color': '#e8d5a8',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#101812',
      },
    })
  }
}

function initMap() {
  if (map) {
    requestAnimationFrame(() => map.resize())
    if (pendingFocus) {
      flyToFocus(map, pendingFocus)
      if (mapReady) ensureHighlightSource(map, pendingFocus)
    }
    return
  }
  renderLayerToggles()
  map = new maplibregl.Map({
    container: 'mapCanvas',
    style: OSM_STYLE,
    center: CENTER,
    zoom: START_ZOOM,
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }))

  map.on('load', async () => {
    try {
      const kyRes = await fetch('/data/kentucky-outline.geojson')
      const ky = await kyRes.json()
      map.addSource('kentucky', { type: 'geojson', data: ky })
      map.addLayer({
        id: 'kentucky-fill',
        type: 'fill',
        source: 'kentucky',
        paint: { 'fill-color': '#2d5a3d', 'fill-opacity': 0.12 },
      })
      map.addLayer({
        id: 'kentucky-outline',
        type: 'line',
        source: 'kentucky',
        paint: {
          'line-color': '#c9893a',
          'line-width': 2.25,
          'line-opacity': 0.95,
        },
      })
    } catch (err) {
      console.warn('Kentucky outline failed to load', err)
    }

    for (const def of DATA_LAYERS) {
      await addDataLayer(def)
    }

    // Optional stories points on main map (for timeline year filter visibility)
    try {
      const sRes = await fetch('/data/layers/stories.geojson')
      if (sRes.ok) {
        const sData = await sRes.json()
        map.addSource('stories', { type: 'geojson', data: sData })
        map.addLayer({
          id: 'stories-circle',
          type: 'circle',
          source: 'stories',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 6,
            'circle-color': '#e8d5a8',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#101812',
          },
        })
      }
    } catch {
      /* optional */
    }

    applyMapFilters()

    mapReady = true
    syncAllLayersCheckbox()
    updateStats()
    if (pendingFocus) {
      ensureHighlightSource(map, pendingFocus)
      flyToFocus(map, pendingFocus)
    }
  })
}

/* -------------------- Stories map (split pane) -------------------- */
let storiesMap = null
let storiesMapReady = false
let selectedStorySlug = null

function initStoriesMap() {
  const el = document.getElementById('storiesMapCanvas')
  if (!el) return
  if (storiesMap) {
    requestAnimationFrame(() => storiesMap.resize())
    return
  }
  storiesMap = new maplibregl.Map({
    container: 'storiesMapCanvas',
    style: OSM_STYLE,
    center: CENTER,
    zoom: 7.2,
  })
  storiesMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  storiesMap.on('load', async () => {
    try {
      const ky = await (await fetch('/data/kentucky-outline.geojson')).json()
      storiesMap.addSource('kentucky', { type: 'geojson', data: ky })
      storiesMap.addLayer({
        id: 'kentucky-fill',
        type: 'fill',
        source: 'kentucky',
        paint: { 'fill-color': '#2d5a3d', 'fill-opacity': 0.12 },
      })
      storiesMap.addLayer({
        id: 'kentucky-outline',
        type: 'line',
        source: 'kentucky',
        paint: { 'line-color': '#c9893a', 'line-width': 2, 'line-opacity': 0.9 },
      })
    } catch {
      /* ignore */
    }
    try {
      const data = await (await fetch('/data/layers/stories.geojson')).json()
      storiesMap.addSource('stories', { type: 'geojson', data })
      storiesMap.addLayer({
        id: 'stories-pts',
        type: 'circle',
        source: 'stories',
        paint: {
          'circle-radius': 5,
          'circle-color': '#6b8f71',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#101812',
          'circle-opacity': 0.75,
        },
      })
    } catch {
      /* ignore */
    }
    ensureHighlightSource(storiesMap, null)
    storiesMapReady = true
    if (pendingFocus) {
      ensureHighlightSource(storiesMap, pendingFocus)
      flyToFocus(storiesMap, pendingFocus, 11)
    }
  })
}

function focusStoryOnMaps(story) {
  const titleEl = document.getElementById('storiesMapTitle')
  const metaEl = document.getElementById('storiesMapMeta')
  const noLoc = document.getElementById('storiesNoLoc')
  const expand = document.getElementById('storiesMapExpand')

  selectedStorySlug = story.slug
  document.querySelectorAll('.story-card').forEach((c) => {
    c.classList.toggle('selected', c.dataset.slug === story.slug)
  })

  if (story.lat == null || story.lon == null) {
    pendingFocus = null
    titleEl.textContent = story.title
    metaEl.textContent = 'No map location yet'
    noLoc.hidden = false
    expand.hidden = true
    if (storiesMapReady) ensureHighlightSource(storiesMap, null)
    return
  }

  const focus = {
    lon: story.lon,
    lat: story.lat,
    title: story.title,
    slug: story.slug,
  }
  pendingFocus = focus
  noLoc.hidden = true
  titleEl.textContent = story.title
  const conf =
    story.mapConfidence === 'exact'
      ? 'Matched History place'
      : story.mapConfidence === 'fuzzy'
        ? 'Approximate History match'
        : story.mapConfidence === 'county'
          ? 'County centroid'
          : 'Located'
  metaEl.textContent = `${conf}${story.matchedPlace ? ` · ${story.matchedPlace}` : ''}`
  expand.hidden = false
  expand.href = '#map'

  initStoriesMap()
  if (storiesMapReady) {
    ensureHighlightSource(storiesMap, focus)
    flyToFocus(storiesMap, focus, 11)
  } else if (storiesMap) {
    storiesMap.once('load', () => {
      ensureHighlightSource(storiesMap, focus)
      flyToFocus(storiesMap, focus, 11)
    })
  }

  // Also prime main map highlight for when user opens full map
  if (mapReady) {
    ensureHighlightSource(map, focus)
  }
}

/* -------------------- Stories / Timeline -------------------- */
let storiesIndex = null

async function loadStories() {
  if (storiesIndex) return storiesIndex
  const res = await fetch('/content/stories.json')
  storiesIndex = await res.json()
  return storiesIndex
}

function storyCard(s) {
  const hasLoc = s.lat != null && s.lon != null
  const locBadge = hasLoc
    ? `<span class="loc-badge" title="${escapeHtml(s.matchedPlace || 'Mapped')}">📍</span>`
    : `<span class="loc-badge muted" title="No map location yet">∅</span>`
  return `
    <article class="story-card" data-slug="${escapeHtml(s.slug)}" tabindex="0" role="button">
      <div class="story-card-icon" aria-hidden="true">📖</div>
      <div class="story-card-body">
        <div class="story-card-meta">
          <span class="era-pill era-${escapeHtml(s.era)}">${escapeHtml(s.era)}</span>
          <span>${escapeHtml(formatYearRange(s.yearStart, s.yearEnd))}</span>
          <span>${escapeHtml(s.briefDate || s.publishedDate || '')}</span>
          ${locBadge}
        </div>
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.summary || '')}</p>
        <div class="story-card-actions">
          <a class="story-read-link" href="#story/${encodeURIComponent(s.slug)}">Read story →</a>
          ${
            hasLoc
              ? `<button type="button" class="btn ghost small story-map-btn" data-map-slug="${escapeHtml(s.slug)}">Show on map</button>`
              : `<span class="muted small">No map location yet</span>`
          }
        </div>
      </div>
    </article>
  `
}

async function renderStoriesList() {
  const idx = await loadStories()
  const list = document.getElementById('storiesList')
  const sorted = [...idx.stories].sort(
    (a, b) =>
      String(b.briefDate || '').localeCompare(String(a.briefDate || '')) ||
      String(a.title).localeCompare(String(b.title))
  )
  list.innerHTML = sorted.map(storyCard).join('') || '<p class="muted">No stories yet.</p>'

  const bySlug = Object.fromEntries(idx.stories.map((s) => [s.slug, s]))

  list.onclick = (e) => {
    const read = e.target.closest('.story-read-link')
    if (read) return // let hash navigation work
    const mapBtn = e.target.closest('[data-map-slug]')
    const card = e.target.closest('.story-card')
    const slug = mapBtn?.dataset.mapSlug || card?.dataset.slug
    if (!slug || !bySlug[slug]) return
    focusStoryOnMaps(bySlug[slug])
    // Mobile: if map pane is stacked/hidden-ish, also offer full map
    if (mapBtn || (window.matchMedia('(max-width: 900px)').matches && bySlug[slug].lat != null)) {
      if (mapBtn) {
        pendingFocus = { lon: bySlug[slug].lon, lat: bySlug[slug].lat, title: bySlug[slug].title, slug }
        // keep on stories on desktop; on small screens jump to map
        if (window.matchMedia('(max-width: 900px)').matches) {
          location.hash = '#map'
        }
      }
    }
  }

  list.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const card = e.target.closest('.story-card')
    if (!card) return
    e.preventDefault()
    const s = bySlug[card.dataset.slug]
    if (s) focusStoryOnMaps(s)
  }

  initStoriesMap()
  if (selectedStorySlug && bySlug[selectedStorySlug]) {
    focusStoryOnMaps(bySlug[selectedStorySlug])
  }
}

async function renderStoryDetail(slug) {
  const el = document.getElementById('storyDetail')
  el.innerHTML = '<p class="muted">Loading…</p>'
  try {
    const res = await fetch(`/content/stories/${encodeURIComponent(slug)}.json`)
    if (!res.ok) throw new Error('not found')
    const s = await res.json()
    const idx = await loadStories()
    const meta = idx.stories.find((x) => x.slug === slug) || {}
    const tags = (s.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')
    const loc =
      meta.lat != null
        ? `<p><button type="button" class="btn" id="storyDetailMapBtn">Show on map</button>
           <span class="muted"> ${escapeHtml(meta.matchedPlace || '')}</span></p>`
        : `<p class="muted">No map location yet</p>`
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
      ${loc}
      <div class="story-body">${marked.parse(s.bodyMarkdown || '')}</div>
      <p class="story-source muted">Source: ${escapeHtml(s.source || 'daily-brief')}</p>
    `
    document.getElementById('storyDetailMapBtn')?.addEventListener('click', () => {
      pendingFocus = { lon: meta.lon, lat: meta.lat, title: s.title, slug }
      location.hash = '#map'
    })
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
    applyMapFilters()
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
    applyMapFilters()
  })

  document.getElementById('yearApply').addEventListener('click', () => {
    const minV = document.getElementById('yearMin').value
    const maxV = document.getElementById('yearMax').value
    timelineState.yearMin = minV === '' ? null : Number(minV)
    timelineState.yearMax = maxV === '' ? null : Number(maxV)
    timelineState.preset = 'custom'
    presetBox.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
    renderTimelineList()
    applyMapFilters()
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
    applyMapFilters()
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
    requestAnimationFrame(() => {
      map?.resize()
      if (pendingFocus && mapReady) {
        ensureHighlightSource(map, pendingFocus)
        flyToFocus(map, pendingFocus)
        // Turn on History so related pins are visible when coming from a story
        if (pendingFocus.slug) {
          const hist = document.querySelector('input[data-layer="history"]')
          if (hist && !hist.checked) {
            hist.checked = true
            setLayerVisible('history', true)
          }
        }
      }
    })
  } else if (view === 'stories') {
    await renderStoriesList()
    requestAnimationFrame(() => storiesMap?.resize())
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
