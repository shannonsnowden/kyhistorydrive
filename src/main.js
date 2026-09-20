import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { marked } from 'marked'
import { initSiteSearch } from './site-search.js'
import { initThemeToggle } from './theme.js'

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


// Statewide Kentucky (not Bagdad close-up)
const CENTER = [-85.76, 37.84]
const START_ZOOM = 6.4
const KY_BOUNDS = [
  [-89.58, 36.5], // SW
  [-81.97, 39.15], // NE
]

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
    icon: { type: 'img', src: '/icons/highway-marker-orange.png' },
    color: '#e87722',
    defaultOn: true,
    geojson: '/data/markers.geojson',
    yearFilter: true,
  },
  {
    id: 'history',
    label: 'History',
    icon: { type: 'emoji', glyph: '📖' },
    color: '#6b8f71',
    defaultOn: false,
    geojson: '/data/layers/history.geojson',
    yearFilter: true,
    filterByEra: true,
  },
  {
    id: 'museums',
    label: 'Museums',
    icon: { type: 'emoji', glyph: '🏛' },
    color: '#8b6b4a',
    defaultOn: false,
    geojson: '/data/layers/museums.geojson',
    yearFilter: true,
  },
  {
    id: 'national',
    label: 'National',
    icon: { type: 'emoji', glyph: '⭐' },
    color: '#d4a017',
    defaultOn: false,
    geojson: '/data/layers/national.geojson',
    yearFilter: true,
  },
  {
    id: 'war',
    label: 'War Sites',
    icon: { type: 'img', src: '/icons/musket-sword.png' },
    color: '#8b3a3a',
    defaultOn: false,
    geojson: '/data/layers/war.geojson',
    yearFilter: true,
  },
  {
    id: 'locals',
    label: 'Good Eats',
    icon: { type: 'img', src: '/icons/locals.png' },
    color: '#c45c26',
    defaultOn: false,
    geojson: '/data/layers/locals.geojson',
    yearFilter: true,
  },
  {
    id: 'bridges',
    label: 'Covered Bridges',
    icon: { type: 'img', src: '/icons/covered-bridge.png' },
    color: '#5c7a4a',
    defaultOn: false,
    geojson: '/data/layers/bridges.geojson',
    yearFilter: true,
  },
  {
    id: 'industry',
    label: 'Industry',
    icon: { type: 'img', src: '/icons/industry.png' },
    color: '#6a5acd',
    defaultOn: false,
    geojson: '/data/layers/industry.geojson',
    yearFilter: true,
  },
  {
    id: 'newspapers',
    label: 'Newspapers',
    icon: { type: 'img', src: '/icons/newspaper.png' },
    color: '#4a6fa5',
    defaultOn: false,
    geojson: '/data/layers/newspapers.geojson',
    yearFilter: true,
  },
  {
    id: 'parks',
    label: 'Parks',
    icon: { type: 'img', src: '/icons/statepark.png' },
    color: '#2d5a3d',
    defaultOn: false,
    geojson: '/data/layers/parks.geojson',
    yearFilter: true,
  },
  {
    id: 'cemeteries',
    label: 'Cemeteries',
    icon: { type: 'img', src: '/icons/cemetery.png' },
    color: '#5a5a5a',
    defaultOn: false,
    geojson: '/data/layers/cemeteries.geojson',
    yearFilter: true,
  },
  {
    id: 'distilleries',
    label: 'Distilleries',
    icon: { type: 'img', src: '/icons/bourbon-glass.png' },
    color: '#a65d2e',
    defaultOn: false,
    geojson: '/data/layers/distilleries.geojson',
    yearFilter: true,
  },
]

marked.setOptions({ breaks: true })
marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      const t = title ? ` title="${title}"` : ''
      const safeHref = String(href || '').replace(/"/g, '&quot;')
      return `<a href="${safeHref}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
    },
  },
})

/** Turn plain http(s) URLs in already-escaped text into new-tab links. */
function linkifyPlainUrls(escapedText) {
  return String(escapedText || '').replace(
    /(https?:\/\/[^\s<]+[^.,;:!?)\]\s])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  )
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absoluteShareUrl(hashPath) {
  const path = String(hashPath || '').replace(/^#/, '')
  // Include ?d= as well — some apps strip the #hash when sharing
  const url = new URL(location.origin + location.pathname)
  url.searchParams.set('d', path)
  url.hash = path
  return url.toString()
}

/** Recover deep link from ?d= when the hash was stripped by a share target. */
function syncDeepLinkFromQuery() {
  const params = new URLSearchParams(location.search)
  const d = params.get('d')
  if (!d) return
  const want = d.replace(/^#/, '')
  const raw = (location.hash || '').replace(/^#/, '')
  // Only restore when the hash is missing. Do NOT override an explicit #map / #timeline
  // home (stale ?d= from a prior share was sending people back to Timeline on refresh).
  if (!raw) {
    history.replaceState(null, '', `${location.pathname}?d=${encodeURIComponent(want)}#${want}`)
  }
}

/** Map is the site home until a dedicated homepage exists. Clear stale ?d= share params. */
function goHomeMap() {
  history.replaceState(null, '', `${location.pathname}#map`)
  applyRoute().catch(console.error)
}

function featureShareId(props, layerId) {
  const p = props || {}
  if (layerId === 'markers' && p.marker_number != null && p.marker_number !== '') {
    return String(p.marker_number)
  }
  if (p.id != null && p.id !== '') return String(p.id)
  if (p.slug) return String(p.slug)
  const name = p.name || p.title || ''
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function placeShareHash(layerId, props) {
  const id = featureShareId(props, layerId)
  if (!layerId || !id) return '#map'
  return `#map/${encodeURIComponent(layerId)}/${encodeURIComponent(id)}`
}

function storyShareHash(slug) {
  if (!slug) return '#timeline'
  return `#timeline/${encodeURIComponent(slug)}`
}

const STORY_MAP_LAYERS = new Set(['stories', 'story', 'timeline'])

/** Home-map deep link for a story that already has a pin. Never invents coordinates. */
function storyPlaceHash({ historyId, slug, lat, lon } = {}) {
  if (historyId) return `#map/history/${encodeURIComponent(historyId)}`
  if (lat != null && lon != null && slug) return `#map/stories/${encodeURIComponent(slug)}`
  return null
}

let storiesLocationsCache = null
async function loadStoriesLocations() {
  if (storiesLocationsCache) return storiesLocationsCache
  try {
    const loc = await (await fetch('/content/stories-locations.json')).json()
    storiesLocationsCache = loc.locations || {}
  } catch {
    storiesLocationsCache = {}
  }
  return storiesLocationsCache
}

function locationForSlug(locations, slug) {
  return (locations && slug && locations[slug]) || {}
}

async function resolveStoryPlace(slugOrId) {
  if (!slugOrId) return null
  const [idx, locations] = await Promise.all([loadStories(), loadStoriesLocations()])
  let loc = locationForSlug(locations, slugOrId)
  let meta = idx?.stories?.find((s) => s.slug === slugOrId) || null
  if (!loc.historyId && loc.lat == null) {
    const byHistory = Object.values(locations).find((row) => row.historyId === slugOrId)
    if (byHistory) {
      loc = byHistory
      meta = idx?.stories?.find((s) => s.slug === byHistory.slug) || meta
    }
  }
  const slug = meta?.slug || loc.slug || slugOrId
  const historyId = loc.historyId || meta?.historyId || null
  const lat = loc.lat ?? meta?.lat ?? null
  const lon = loc.lon ?? meta?.lon ?? null
  if (historyId == null && (lat == null || lon == null)) return null
  return {
    slug,
    meta,
    loc,
    historyId,
    lat,
    lon,
    title: meta?.title || loc.matchedPlace || slug,
    matchedPlace: loc.matchedPlace || meta?.matchedPlace || null,
    mapConfidence: loc.mapConfidence || meta?.mapConfidence || null,
    county: meta?.county || null,
    era: meta?.era || null,
    yearStart: meta?.yearStart ?? null,
    yearEnd: meta?.yearEnd ?? null,
    summary: meta?.summary || '',
    photo: meta?.photo || null,
  }
}

function shareControlHtml(url, title) {
  const hashPath = String(url || '').includes('#') ? String(url).split('#').slice(1).join('#') : String(url || '').replace(/^#/, '')
  return `<div class="share-row">
    <button type="button" class="share-btn" data-share-hash="${escapeHtml(hashPath)}" data-share-title="${escapeHtml(title || 'Kentucky History Drive')}" aria-label="Share link">
      Share
    </button>
    <span class="share-status muted" aria-live="polite"></span>
  </div>`
}

async function shareDetailUrl(url, title, statusEl) {
  const setStatus = (msg) => {
    if (statusEl) {
      statusEl.textContent = msg
      window.setTimeout(() => {
        if (statusEl.textContent === msg) statusEl.textContent = ''
      }, 2000)
    }
  }
  try {
    if (navigator.share) {
      await navigator.share({ title: title || 'Kentucky History Drive', url })
      setStatus('Shared')
      return
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return
  }
  try {
    await navigator.clipboard.writeText(url)
    setStatus('Link copied')
  } catch {
    // Fallback prompt
    window.prompt('Copy this link:', url)
    setStatus('Copy link')
  }
}

function wireShareButtons(root = document) {
  root.querySelectorAll('.share-btn').forEach((btn) => {
    if (btn.dataset.shareWired) return
    btn.dataset.shareWired = '1'
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const hashPath = btn.dataset.shareHash || ''
      const url = absoluteShareUrl(hashPath)
      const title = btn.dataset.shareTitle
      const statusEl = btn.parentElement?.querySelector('.share-status')
      shareDetailUrl(url, title, statusEl).catch(console.error)
    })
  })
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

function ensureHomeHash() {
  // Empty hash → home map; legacy #stories → #timeline
  // Map remains the homepage until Shannon ships a dedicated home page.
  const raw = (location.hash || '').replace(/^#/, '')
  if (!raw) {
    history.replaceState(null, '', `${location.pathname}#map`)
    return
  }
  if (raw === 'stories' || raw === 'story') {
    history.replaceState(null, '', `${location.pathname}#timeline`)
    return
  }
  if (raw.startsWith('stories/') || raw.startsWith('story/')) {
    const slug = raw.split('/').slice(1).join('/')
    history.replaceState(null, '', `${location.pathname}#timeline/${slug}`)
  }
}

function parseHash() {
  const raw = (location.hash || '#map').replace(/^#/, '')
  const [path, ...rest] = raw.split('/')
  // Old #stories / #story links redirect into Timeline
  if (path === 'story' || path === 'stories') {
    const slug = rest[0] ? decodeURIComponent(rest[0]) : null
    return { view: 'timeline', slug }
  }
  if (path === 'timeline') {
    return { view: 'timeline', slug: rest[0] ? decodeURIComponent(rest[0]) : null }
  }
  if (path === 'map') {
    const placeLayer = rest[0] ? decodeURIComponent(rest[0]) : null
    const placeId = rest[1] ? decodeURIComponent(rest.slice(1).join('/')) : null
    return { view: 'map', placeLayer, placeId }
  }
  if (['about', 'app'].includes(path)) return { view: path }
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


/* Full GeoJSON props — MapLibre truncates long strings on queryRenderedFeatures */
const layerFeatureCache = Object.create(null)
const layerGeojsonCache = Object.create(null)

function featureLookupKey(props) {
  if (!props) return null
  if (props.id != null && props.id !== '') return `id:${props.id}`
  if (props.marker_number != null && props.marker_number !== '') return `mn:${props.marker_number}`
  if (props.slug) return `slug:${props.slug}`
  const title = props.title || props.name
  if (title) return `t:${String(title).toLowerCase()}`
  return null
}

function cacheLayerFeatures(layerId, collection) {
  const map = Object.create(null)
  for (const f of collection?.features || []) {
    const k = featureLookupKey(f.properties)
    if (k) map[k] = f.properties
  }
  layerFeatureCache[layerId] = map
  layerGeojsonCache[layerId] = collection
}

function enrichFeatureProps(layerId, props) {
  const thin = props || {}
  const cache = layerFeatureCache[layerId]
  if (!cache) return { ...thin }
  const k = featureLookupKey(thin)
  const full = k ? cache[k] : null
  // Prefer cached full text fields (MapLibre often truncates these)
  return full ? { ...thin, ...full } : { ...thin }
}

/* -------------------- Map -------------------- */
let map = null
let mapReady = false
let activePopup = null
let pendingFocus = null // { lon, lat, title, slug? }
let highlightDetailProps = null // rich props for highlight pin popup
let storyPhotoIndex = null
let storyPhotoIndexPromise = null

async function loadStoryPhotoIndex() {
  if (storyPhotoIndex) return storyPhotoIndex
  if (storyPhotoIndexPromise) return storyPhotoIndexPromise
  storyPhotoIndexPromise = (async () => {
    try {
      const res = await fetch('/content/story-photos.json')
      if (res.ok) {
        storyPhotoIndex = await res.json()
        return storyPhotoIndex
      }
    } catch {
      /* empty index */
    }
    storyPhotoIndex = { bySlug: {}, byHistoryId: {} }
    return storyPhotoIndex
  })()
  return storyPhotoIndexPromise
}

async function storyPhotoForProps(p = {}) {
  const idx = await loadStoryPhotoIndex()
  if (p.photo?.image_url) return p.photo
  if (p.storyPhoto?.image_url) return p.storyPhoto
  const historyId = p.historyId || p.id
  if (historyId && idx.byHistoryId?.[historyId]?.photo?.image_url) {
    return idx.byHistoryId[historyId].photo
  }
  if (p.slug && idx.bySlug?.[p.slug]?.photo?.image_url) {
    return idx.bySlug[p.slug].photo
  }
  return null
}

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
  if (layerDef.filterByEra) {
    if (!allEras && eras.length) {
      parts.push(['in', ['get', 'era'], ['literal', eras]])
    } else if (!allEras && eras.length === 0) {
      return ['==', ['get', 'id'], '__none__']
    }
  }
  const { yearMin, yearMax } = timelineState
  if (yearMin != null || yearMax != null) {
    // Overlap: feature [yearStart, yearEnd||yearStart] intersects [yearMin, yearMax]
    parts.push(['has', 'yearStart'])
    if (yearMax != null) {
      parts.push(['<=', ['to-number', ['get', 'yearStart']], yearMax])
    }
    if (yearMin != null) {
      parts.push([
        '>=',
        ['to-number', ['coalesce', ['get', 'yearEnd'], ['get', 'yearStart']]],
        yearMin,
      ])
    }
  }
  if (!parts.length) return null
  return parts.length === 1 ? parts[0] : ['all', ...parts]
}



function timelineHasActivePlaceFilter() {
  const hasYear = timelineState.yearMin != null || timelineState.yearMax != null
  const erasNarrowed = timelineState.eras.size > 0 && timelineState.eras.size !== ERAS.length
  return hasYear || erasNarrowed
}

function buildTimelineMapFilter(layerDef) {
  // Timeline map: never show a full unfiltered layer — wait for year/era filter
  if (!timelineHasActivePlaceFilter()) {
    return ['==', ['get', 'id'], '__none__']
  }
  const filter = buildYearEraFilter({ ...layerDef, yearFilter: true })
  // Year range selected but this layer has no yearFilter logic / no match → still require year overlap
  if (filter) return filter
  const { yearMin, yearMax } = timelineState
  if (yearMin != null || yearMax != null) {
    const parts = [['has', 'yearStart']]
    if (yearMax != null) parts.push(['<=', ['to-number', ['get', 'yearStart']], yearMax])
    if (yearMin != null) {
      parts.push([
        '>=',
        ['to-number', ['coalesce', ['get', 'yearEnd'], ['get', 'yearStart']]],
        yearMin,
      ])
    }
    return parts.length === 1 ? parts[0] : ['all', ...parts]
  }
  // Era-only and layer isn't era-aware → show nothing (don't dump whole layer)
  if (!layerDef.filterByEra) {
    return ['==', ['get', 'id'], '__none__']
  }
  return ['==', ['get', 'id'], '__none__']
}

function applyFiltersToMapInstance(targetMap) {
  if (!targetMap) return
  const onTimeline = targetMap === timelineMap
  for (const def of DATA_LAYERS) {
    // Home map: show all enabled-layer dots. Year/era filters only affect Timeline.
    const filter = onTimeline ? buildTimelineMapFilter(def) : null
    for (const lid of [layerCircleId(def.id), layerHitId(def.id), layerSymbolId(def.id)]) {
      if (targetMap.getLayer(lid)) targetMap.setFilter(lid, filter)
    }
  }
  for (const lid of ['stories-circle', 'stories-hit', 'stories-highlight']) {
    if (!targetMap.getLayer(lid)) continue
    const f = onTimeline
      ? buildTimelineMapFilter({ yearFilter: true, filterByEra: true })
      : null
    targetMap.setFilter(lid, f)
  }
}

function applyMapFilters() {
  if (map && mapReady) applyFiltersToMapInstance(map)
  if (timelineMap && timelineMapReady) applyFiltersToMapInstance(timelineMap)
  updateStats()
  updateTimelineMapCounts()
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

/** Compact "lat,lon" for map URLs — no spaces, degree symbols, or N/W letters. */
function compactLatLonQuery(lat, lon) {
  const la = Number(lat)
  const lo = Number(lon)
  if (Number.isNaN(la) || Number.isNaN(lo)) return null
  return `${la},${lo}`
}

function mapsLinksHtml(lat, lon, label, placeHint) {
  const coords = compactLatLonQuery(lat, lon)
  if (!coords) return ''
  const name = label || coords
  const q = encodeURIComponent(name)
  const searchBits = [name]
  if (placeHint) searchBits.push(placeHint)
  if (!/kentucky/i.test(searchBits.join(' '))) searchBits.push('Kentucky')
  const searchQ = encodeURIComponent(searchBits.join(' '))
  const apple = `https://maps.apple.com/?ll=${coords}&q=${q}`
  const google = `https://www.google.com/maps?q=${coords}`
  const photos = `https://www.google.com/search?tbm=isch&q=${searchQ}`
  return `<div class="popup-links-block">
    <p class="popup-maps">
      <a href="${apple}" target="_blank" rel="noopener noreferrer">Apple Maps</a>
      <span class="popup-maps-sep" aria-hidden="true">·</span>
      <a href="${google}" target="_blank" rel="noopener noreferrer">Google Maps</a>
    </p>
    <p class="popup-maps">
      <a href="${photos}" target="_blank" rel="noopener noreferrer">Photos on Google</a>
    </p>
  </div>`
}

let historicPhotosCache = null
let siteHistoricPhotosCache = null

async function loadHistoricPhotoData() {
  if (historicPhotosCache && siteHistoricPhotosCache) {
    return { photos: historicPhotosCache, siteLinks: siteHistoricPhotosCache }
  }
  try {
    const [pRes, sRes] = await Promise.all([
      fetch('/data/historic-photos.json'),
      fetch('/data/site-historic-photos.json'),
    ])
    historicPhotosCache = pRes.ok ? await pRes.json() : []
    siteHistoricPhotosCache = sRes.ok ? await sRes.json() : []
  } catch {
    historicPhotosCache = []
    siteHistoricPhotosCache = []
  }
  return { photos: historicPhotosCache, siteLinks: siteHistoricPhotosCache }
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function extractMarkdownLinks(markdown) {
  const links = []
  const s = String(markdown || '')
  const startRe = /\[([^\]]*)\]\(/g
  let m
  while ((m = startRe.exec(s))) {
    const start = m.index + m[0].length
    let i = start
    let depth = 1
    while (i < s.length && depth > 0) {
      if (s[i] === '(') depth += 1
      else if (s[i] === ')') depth -= 1
      if (depth > 0) i += 1
    }
    const url = s.slice(start, i)
    if (/^https?:\/\//i.test(url)) links.push({ label: m[1] || '', url })
  }
  return links
}

function labelForResearchUrl(url, fallback) {
  const u = String(url || '')
  if (/en\.wikipedia\.org/i.test(u)) return 'Wikipedia'
  if (/explorekyhistory\.ky\.gov/i.test(u)) return 'ExploreKYHistory'
  if (/history\.ky\.gov/i.test(u)) return 'Kentucky Historical Society'
  if (/archaeology\.ky\.gov/i.test(u)) return 'Kentucky Archaeology'
  if (/nps\.gov/i.test(u)) return 'National Park Service'
  if (/parks\.ky\.gov/i.test(u)) return 'Kentucky State Parks'
  if (/grokipedia\.com/i.test(u)) return 'Grokipedia'
  return fallback || 'Source'
}

function isGrokipediaUrl(url) {
  return /grokipedia\.com/i.test(String(url || ''))
}

function isWikipediaUrl(url) {
  return /wikipedia\.org/i.test(String(url || ''))
}

function isWikipediaSearchUrl(url) {
  return /wikipedia\.org\/wiki\/Special:Search/i.test(String(url || ''))
}

function hostnameOf(url) {
  try {
    return new URL(String(url || '')).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isKyhsUrl(url) {
  const h = hostnameOf(url)
  return h === 'history.ky.gov' || h.endsWith('.history.ky.gov')
}

function isResearchUrl(url) {
  return /wikipedia\.org|history\.ky\.gov|explorekyhistory\.ky\.gov|archaeology\.ky\.gov|nps\.gov|parks\.ky\.gov/i.test(
    String(url || ''),
  )
}

function researchUrlFamily(url) {
  const u = String(url || '')
  if (isWikipediaUrl(u)) return 'wikipedia'
  if (/explorekyhistory\.ky\.gov/i.test(u)) return 'exploreky'
  if (isKyhsUrl(u)) return 'kyhs'
  if (/archaeology\.ky\.gov/i.test(u)) return 'archaeology'
  if (/nps\.gov/i.test(u)) return 'nps'
  if (/parks\.ky\.gov/i.test(u)) return 'kyparks'
  return ''
}

/** Daily-brief `Source:` lines are extracted into Learn more — don't also render them in the body. */
function stripSourceAttribution(markdown) {
  return String(markdown || '')
    .replace(/^[ \t]*source:[ \t]*.+$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Drop markdown-wrapper parens so `](https://example.com/Foo_(bar))` keeps one trailing `)`. */
function trimUnbalancedTrailingParens(url) {
  let u = String(url || '')
  while (u.endsWith(')')) {
    const open = (u.match(/\(/g) || []).length
    const close = (u.match(/\)/g) || []).length
    if (close <= open) break
    u = u.slice(0, -1)
  }
  return u
}

/** Decode, strip junk, and close truncated Wikipedia titles like John_Todd_(Virginia */
function normalizeResearchUrl(url) {
  let u = trimUnbalancedTrailingParens(String(url || '').trim().replace(/[.,;:]+$/g, ''))
  try {
    u = decodeURI(u)
  } catch {
    /* keep raw */
  }
  u = trimUnbalancedTrailingParens(u)
  if (isWikipediaUrl(u)) {
    const open = (u.match(/\(/g) || []).length
    const close = (u.match(/\)/g) || []).length
    if (open > close) u += ')'.repeat(open - close)
  }
  try {
    const parsed = new URL(u)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return u
  }
}

function extractBareHttpUrls(text) {
  const s = String(text || '')
  const out = []
  // Allow apostrophes (Basil_Hayden's); stop at quotes, brackets, whitespace.
  const re = /https?:\/\/[^\s"<>\]]+/gi
  let m
  while ((m = re.exec(s))) {
    out.push(trimUnbalancedTrailingParens(m[0].replace(/[.,;:]+$/g, '')))
  }
  return out
}

function urlsInText(text) {
  return [
    ...extractBareHttpUrls(text || ''),
    ...extractMarkdownLinks(text || '').map((l) => l.url),
  ]
    .map(normalizeResearchUrl)
    .filter(Boolean)
}

function collectResearchItems(linkList, extra = {}) {
  const items = []
  const seenUrl = new Set()
  const add = (label, url) => {
    const normalized = normalizeResearchUrl(url)
    if (!normalized || isGrokipediaUrl(normalized) || seenUrl.has(normalized)) return
    seenUrl.add(normalized)
    items.push({ label: labelForResearchUrl(normalized, label), url: normalized })
  }
  for (const l of linkList || []) add(l.label, l.url)
  add('Kentucky Historical Society', extra.source_url)
  add('Website', extra.website)

  const wikiArticles = items.filter((i) => isWikipediaUrl(i.url) && !isWikipediaSearchUrl(i.url))
  const wikiSearch = items.filter((i) => isWikipediaSearchUrl(i.url))
  let wikiKeep = wikiArticles[0] || wikiSearch[0] || null
  let kyhsKeep = items.find((i) => isKyhsUrl(i.url)) || null

  const rest = items.filter((i) => !isWikipediaUrl(i.url) && !isKyhsUrl(i.url))
  const out = [...rest]

  // Standing QA: never invent Wikipedia Special:Search or history.ky.gov/?s=
  // fallbacks — only keep topic-specific article/marker URLs already present.
  // Search-root links dump users on site homes or empty result shells.
  if (wikiKeep?.url && !isWikipediaSearchUrl(wikiKeep.url)) out.push(wikiKeep)
  if (kyhsKeep?.url && !isKyhsSearchUrl(kyhsKeep.url)) out.push(kyhsKeep)
  return out
}

function extractResearchLinks(markdown) {
  const links = []
  const seen = new Set()
  const add = (label, url) => {
    const normalized = normalizeResearchUrl(url)
    if (!normalized || isGrokipediaUrl(normalized) || seen.has(normalized)) return
    seen.add(normalized)
    links.push({ label: labelForResearchUrl(normalized, label), url: normalized })
  }
  for (const link of extractMarkdownLinks(markdown)) add(link.label, link.url)
  for (const url of extractBareHttpUrls(markdown)) {
    if (isResearchUrl(url)) add('', url)
  }
  return links
}

function topicTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !/^(the|and|for|from|with|near|county|kentucky|history|historic|photo|image|german|long|hunter|capt|col|builds|claims|ohio|run)$/.test(
          w,
        ),
    )
}

/** Prefer distinctive name tokens (e.g. stoner, abraham) over generic words. */
function strongTopicTokens(text) {
  return topicTokens(text).filter((w) => w.length >= 5 || /^[a-z]{4,}$/.test(w))
}

function photoHaystack(photo) {
  return [
    photo?.title,
    photo?.attribution,
    photo?.credit,
    photo?.source_label,
    photo?.source,
    photo?.collection,
    photo?.description,
    photo?.city,
    photo?.county,
    (photo?.related_place_names || []).join(' '),
    (photo?.tags || []).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Require title/topic overlap so geo-nearby Louisville street photos don't attach to people stories. */
function photoTopicHits(photo, topicText) {
  const tokens = topicTokens(topicText)
  if (!tokens.length) return 0
  const hay = photoHaystack(photo)
  let hits = 0
  for (const tok of tokens) if (hay.includes(tok)) hits += 1
  const strong = strongTopicTokens(topicText)
  if (strong.length) {
    const strongHits = strong.filter((tok) => hay.includes(tok)).length
    // Zero strong hits → treat as irrelevant even if a weak leftover matched
    if (strongHits === 0) return 0
  }
  return hits
}

function photosForPlace({ lat, lon, name, historyId, layer, requireTopic = false }) {
  const out = []
  const seen = new Set()
  const push = (p) => {
    const id = p.photo_id || p.id || p.image_url
    if (!id || seen.has(id) || !p.image_url) return
    if (requireTopic && name && photoTopicHits(p, name) < 1) return
    seen.add(id)
    out.push(p)
  }
  if (siteHistoricPhotosCache?.length) {
    for (const link of siteHistoricPhotosCache) {
      if (historyId && link.site_id === historyId) {
        for (const ph of link.photos || []) push(ph)
      }
      if (layer && link.layer === layer && link.site_id === historyId) {
        for (const ph of link.photos || []) push(ph)
      }
      const siteName = String(link.site_name || '').toLowerCase()
      if (name && siteName && siteName.includes(String(name).toLowerCase().slice(0, 18))) {
        for (const ph of link.photos || []) push(ph)
      }
    }
  }
  if (historicPhotosCache?.length && lat != null && lon != null) {
    const nearby = []
    for (const ph of historicPhotosCache) {
      if (ph.latitude == null || ph.longitude == null || !ph.image_url) continue
      const d = haversineM(lat, lon, ph.latitude, ph.longitude)
      // Geo proximity alone is not enough for story sidebars (requireTopic).
      if (d <= 2500) {
        const related = (ph.related_place_names || []).join(' ').toLowerCase()
        const nameHit = name && related.includes(String(name).toLowerCase().slice(0, 12))
        const topicOk = !requireTopic || photoTopicHits(ph, name) >= 1 || nameHit
        if (topicOk) nearby.push({ ...ph, distance_m: Math.round(d), photo_id: ph.id })
      } else if (name) {
        const related = (ph.related_place_names || []).join(' ').toLowerCase()
        if (related.includes(String(name).toLowerCase().slice(0, 12))) {
          nearby.push({ ...ph, distance_m: Math.round(d), photo_id: ph.id })
        }
      }
    }
    nearby.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0))
    for (const ph of nearby.slice(0, 6)) push(ph)
  }
  return out.slice(0, 6)
}

function photosHtml(photos) {
  if (!photos?.length) return ''
  const cards = photos
    .map((p) => {
      const title = escapeHtml(p.title || 'Historic photo')
      const year = p.year ? escapeHtml(String(p.year)) : ''
      const credit = escapeHtml(p.attribution || p.source_label || p.credit || '')
      const href = escapeHtml(p.source_url || p.image_url)
      const img = escapeHtml(p.image_url)
      return `<a class="historic-photo-card" href="${href}" target="_blank" rel="noopener noreferrer">
        <img src="${img}" alt="${title}" loading="lazy" />
        <span class="historic-photo-cap">${title}${year ? ` · ${year}` : ''}</span>
        ${credit ? `<span class="historic-photo-attr">Source: ${credit}</span>` : ''}
      </a>`
    })
    .join('')
  return `<div class="historic-photos"><div class="historic-photos-label">Historic photos</div><div class="historic-photos-grid">${cards}</div></div>`
}

function researchLinksHtml(links, title, extra = {}) {
  const displayed = extra.displayMarkdown ?? extra.bodyMarkdown ?? ''
  const alreadyInBody = new Set(urlsInText(displayed))
  const alreadyFamilies = new Set([...alreadyInBody].map(researchUrlFamily).filter(Boolean))
  const items = collectResearchItems(links, { ...extra, title }).filter((i) => {
    const normalized = normalizeResearchUrl(i.url)
    if (alreadyInBody.has(normalized)) return false
    const fam = researchUrlFamily(normalized)
    return !(fam && alreadyFamilies.has(fam))
  })
  if (!items.length) return ''
  return `<div class="popup-research">
    <div class="historic-photos-label">Learn more</div>
    <ul class="research-list">${items
      .map(
        (l) =>
          `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a></li>`,
      )
      .join('')}</ul>
  </div>`
}


function googleImagesSearchUrl(name, placeHint) {
  const bits = [name]
  if (placeHint) bits.push(placeHint)
  if (!/kentucky/i.test(bits.join(' '))) bits.push('Kentucky')
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(bits.filter(Boolean).join(' '))}`
}

function wikipediaSearchUrl(title) {
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title || '')}`
}

function locSearchUrl(title, placeHint) {
  const q = [title, placeHint, 'Kentucky'].filter(Boolean).join(' ')
  return `https://www.loc.gov/search/?q=${encodeURIComponent(q)}&fa=online-format:image`
}

function naraSearchUrl(title, placeHint) {
  const q = [title, placeHint, 'Kentucky'].filter(Boolean).join(' ')
  return `https://catalog.archives.gov/search?q=${encodeURIComponent(q)}`
}

function isKyhsSearchUrl(url) {
  try {
    const u = new URL(String(url || ''))
    if (!(u.hostname === 'history.ky.gov' || u.hostname.endsWith('.history.ky.gov'))) return false
    // homepage or bare ?s= site search — not a topic page
    if (u.pathname === '/' || u.pathname === '') return true
    if (u.searchParams.has('s')) return true
    return false
  } catch {
    return false
  }
}

function kyhsSearchUrl(title, placeHint) {
  const q = [title, placeHint].filter(Boolean).join(' ')
  return `https://history.ky.gov/?s=${encodeURIComponent(q)}`
}

function extractWikipediaUrl(markdown) {
  if (!markdown) return null
  const fromBare = extractBareHttpUrls(markdown).find((u) => isWikipediaUrl(u) && !isWikipediaSearchUrl(u))
  if (fromBare) return normalizeResearchUrl(fromBare)
  const m = String(markdown).match(/https?:\/\/en\.wikipedia\.org\/wiki\/[^\s"'<>]+/i)
  return m ? normalizeResearchUrl(m[0]) : null
}

function wikipediaTitleFromUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    const i = parts.indexOf('wiki')
    if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1].replace(/_/g, ' '))
  } catch {
    /* ignore */
  }
  return null
}

function stripHtmlCredits(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferPhotoInstitution(text) {
  const t = String(text || '').toLowerCase()
  if (/library of congress|loc\.gov|\bloc\b/.test(t)) return 'Library of Congress'
  if (/national archives|archives\.gov|\bnara\b|u\.s\. national archive/.test(t)) return 'National Archives'
  if (/kentucky historical society|history\.ky\.gov|\bkyhs\b/.test(t)) {
    return 'Kentucky Historical Society'
  }
  if (/smithsonian/.test(t)) return 'Smithsonian'
  if (/historypin/.test(t)) return 'Historypin'
  if (/university of louisville|ulpa/.test(t)) return 'University of Louisville (ULPA)'
  if (/wikimedia commons/.test(t)) return 'Wikimedia Commons'
  if (/wikipedia/.test(t)) return 'Wikipedia'
  return null
}

function photoSearchLinks(title, placeHint, extra = {}) {
  // LOC / NARA only when verified against the selected photo (see resolveStorySidebarPhoto)
  return {
    google_url: extra.google_url || googleImagesSearchUrl(title, placeHint),
    wikipedia_url: extra.wikipedia_url || wikipediaSearchUrl(title),
    loc_url: extra.loc_url || null,
    nara_url: extra.nara_url || null,
    kyhs_url: extra.kyhs_url || kyhsSearchUrl(title, placeHint),
  }
}

function verifiedGovPhotoLinks(photo, title, placeHint) {
  const label = String(photo?.source_label || photo?.attribution || photo?.credit || '')
  const out = { loc_url: null, nara_url: null }
  if (/Library of Congress/i.test(label)) {
    out.loc_url = photo.source_url || locSearchUrl(title, placeHint)
  }
  if (/National Archives/i.test(label)) {
    out.nara_url = photo.source_url || naraSearchUrl(title, placeHint)
  }
  return out
}

async function fetchWikipediaThumbnail(titleOrUrl) {
  if (!titleOrUrl) return null
  let title = titleOrUrl
  if (/^https?:\/\//i.test(titleOrUrl)) {
    title = wikipediaTitleFromUrl(titleOrUrl) || titleOrUrl
  }
  title = String(title).trim()
  if (!title) return null
  const candidates = [title]
  if (!/,?\s*kentucky$/i.test(title)) candidates.push(`${title}, Kentucky`)
  for (const cand of candidates) {
    try {
      const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand.replace(/ /g, '_'))}`
      const res = await fetch(api, { headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const data = await res.json()
      const src = data?.thumbnail?.source || data?.originalimage?.source
      if (!src) continue
      return {
        image_url: src,
        title: data.title || cand,
        source_url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(cand.replace(/ /g, '_'))}`,
        source_label: 'Wikipedia',
        attribution: 'Wikipedia',
        credit: 'Wikipedia',
        year: null,
      }
    } catch {
      /* try next */
    }
  }
  return null
}

async function fetchCommonsImage(title, placeHint) {
  const queries = [
    `${title} Kentucky`,
    `${title} Kentucky "Library of Congress"`,
    `${title} Kentucky "National Archives"`,
    `${title} "Kentucky Historical Society"`,
    title,
  ]
  for (const q of queries) {
    try {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: q,
        gsrlimit: '8',
        prop: 'imageinfo',
        iiprop: 'url|mime|extmetadata|size',
        iiurlwidth: '640',
        format: 'json',
        origin: '*',
      })
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
      if (!res.ok) continue
      const data = await res.json()
      const pages = Object.values(data?.query?.pages || {})
      if (!pages.length) continue

      const toks = topicTokens(title)
      const strongToks = strongTopicTokens(title)
      const scored = []
      for (const page of pages) {
        const info = page.imageinfo?.[0]
        if (!info) continue
        const mime = info.mime || ''
        // Skip non-photos (pdf/djvu/svg) and huge document scans
        if (!/^image\//.test(mime) || /svg\+xml|gif|tiff|pdf/i.test(mime)) continue
        if (/\.djvu|\.pdf/i.test(page.title || '')) continue
        const meta = info.extmetadata || {}
        const artist = stripHtmlCredits(meta.Artist?.value)
        const credit = stripHtmlCredits(meta.Credit?.value)
        const license = stripHtmlCredits(meta.LicenseShortName?.value)
        const desc = stripHtmlCredits(meta.ImageDescription?.value)
        const objectName = stripHtmlCredits(meta.ObjectName?.value) || String(page.title || '').replace(/^File:/, '')
        const blob = [artist, credit, license, desc, objectName, page.title].join(' | ')
        // Skip logos, icons, maps-as-diagrams, coats of arms unless topic asks for them
        if (/\b(logo|icon|coat of arms|seal of|flag icon|pictogram|spacer|placeholder)\b/i.test(blob)) {
          continue
        }
        const institution = inferPhotoInstitution(blob)
        let score = 0
        if (institution === 'Library of Congress') score += 40
        else if (institution === 'National Archives') score += 38
        else if (institution === 'Kentucky Historical Society') score += 36
        else if (institution) score += 12
        // Topic relevance beats institution alone
        const hay = blob.toLowerCase()
        let hits = 0
        for (const tok of toks) {
          if (hay.includes(tok)) {
            hits += 1
            score += 14
          }
        }
        const strongHits = strongToks.filter((tok) => hay.includes(tok)).length
        if (strongToks.length && strongHits === 0) score -= 40
        if (hits === 0 && toks.length) score -= 25
        if (/kentucky/i.test(blob) || /kentucky/i.test(page.title || '')) score += 10
        if (placeHint && new RegExp(String(placeHint).slice(0, 12), 'i').test(blob)) score += 8
        // Prefer photographic / historic looks over diagrams
        if (/\b(photograph|photo|historic|monument|battlefield|mound|fort|station)\b/i.test(blob)) score += 6
        if (/\b(map of|locator|diagram|schematic)\b/i.test(blob)) score -= 12
        const img = info.thumburl || info.url
        if (!img) continue
        scored.push({
          score,
          image_url: img,
          title: objectName,
          source_url: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          source_label: institution || 'Wikimedia Commons',
          attribution: [institution || 'Wikimedia Commons', artist || credit, license]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(' · '),
          credit: institution || artist || credit || 'Wikimedia Commons',
          year: null,
        })
      }
      scored.sort((a, b) => b.score - a.score)
      // Need real topic overlap — institution fame alone is not enough
      const pick = scored.find((s) => s.score >= 20) || null
      if (pick) return pick
    } catch {
      /* try next query */
    }
  }
  return null
}

function topicPhotoScore(photo, title, placeHint) {
  if (!photo?.image_url) return -1
  const tokens = topicTokens(title)
  const hay = photoHaystack(photo)
  let score = typeof photo.score === 'number' ? photo.score : 0
  let hits = 0
  for (const tok of tokens) {
    if (hay.includes(tok)) {
      hits += 1
      score += 12
    }
  }
  if (placeHint && hay.includes(String(placeHint).toLowerCase().slice(0, 10))) score += 6
  if (/wikipedia/i.test(photo.source_label || '')) score += 4
  // Hard penalty: no topic overlap → never preferred over an empty state
  if (tokens.length && hits === 0) score -= 80
  return score
}

const MIN_STORY_PHOTO_SCORE = 8

async function resolveStorySidebarPhoto({ title, lat, lon, placeHint, historyId, bodyMarkdown, existingPhoto }) {
  await loadHistoricPhotoData()
  const links = photoSearchLinks(title, placeHint, {
    wikipedia_url: extractWikipediaUrl(bodyMarkdown) || wikipediaSearchUrl(title),
  })

  if (existingPhoto?.image_url) {
    return {
      ...existingPhoto,
      ...links,
      ...verifiedGovPhotoLinks(existingPhoto, title, placeHint),
    }
  }

  const candidates = []

  // Story sidebars require topic overlap — nearby city photos alone are not enough
  const local = photosForPlace({
    lat,
    lon,
    name: title,
    historyId,
    layer: 'history',
    requireTopic: true,
  })
  if (local[0]?.image_url) {
    const rawCredit = local[0].source || local[0].collection || 'Historic photo'
    const institution = inferPhotoInstitution(rawCredit) || rawCredit
    const hits = photoTopicHits(local[0], title)
    candidates.push({
      ...local[0],
      score: 20 + hits * 10,
      source_label: institution,
      attribution: [institution, local[0].collection, local[0].year].filter(Boolean).join(' · '),
      credit: institution,
    })
  }

  const wikiFromBody = extractWikipediaUrl(bodyMarkdown)
  // Prefer Wikipedia page for the person/topic; do not fall back to placeHint-only pages
  const [wikiPhoto, commonsPhoto] = await Promise.all([
    fetchWikipediaThumbnail(wikiFromBody || title),
    fetchCommonsImage(title, placeHint),
  ])
  if (wikiPhoto) candidates.push({ ...wikiPhoto, score: wikiPhoto.score ?? 18 })
  if (commonsPhoto) candidates.push(commonsPhoto)

  candidates.sort((a, b) => topicPhotoScore(b, title, placeHint) - topicPhotoScore(a, title, placeHint))
  const best = candidates[0]
  const bestScore = best ? topicPhotoScore(best, title, placeHint) : -1
  // Prefer no photo over an off-topic Louisville street scene
  if (best?.image_url && bestScore >= MIN_STORY_PHOTO_SCORE) {
    return {
      ...best,
      ...links,
      ...verifiedGovPhotoLinks(best, title, placeHint),
    }
  }

  return {
    image_url: null,
    title,
    source_label: null,
    attribution: null,
    credit: null,
    source_url: null,
    ...links,
    loc_url: null,
    nara_url: null,
  }
}

function storySidebarPhotoHtml(photo, title) {
  if (!photo) return ''
  const caption = escapeHtml(photo.title || title || 'Related photo')
  const sourceLabel = escapeHtml(photo.source_label || photo.credit || '')
  const attribution = escapeHtml(photo.attribution || photo.source_label || photo.credit || '')
  const year = photo.year ? escapeHtml(String(photo.year)) : ''

  const bits = [
    photo.google_url && `<a href="${escapeHtml(photo.google_url)}" target="_blank" rel="noopener noreferrer">Google</a>`,
    // Wikipedia / KYHS already appear once under Learn more
    // Only when the chosen photo is verified from that institution
    photo.loc_url && `<a href="${escapeHtml(photo.loc_url)}" target="_blank" rel="noopener noreferrer">Library of Congress</a>`,
    photo.nara_url && `<a href="${escapeHtml(photo.nara_url)}" target="_blank" rel="noopener noreferrer">National Archives</a>`,
  ].filter(Boolean)
  const linkRow = bits.length
    ? `<nav class="story-sidebar-photo-links" aria-label="Photo sources">${bits.join(
        '<span aria-hidden="true"> · </span>',
      )}</nav>`
    : ''

  let thumb = ''
  if (photo.image_url) {
    const href = escapeHtml(photo.source_url || photo.image_url)
    const img = escapeHtml(photo.image_url)
    thumb = `<a class="story-sidebar-photo-frame story-sidebar-photo-thumb" href="${href}" target="_blank" rel="noopener noreferrer">
        <img src="${img}" alt="${caption}" loading="lazy" />
      </a>
      <p class="story-sidebar-photo-cap">${caption}${year ? ` <span class="muted">(${year})</span>` : ''}</p>
      <p class="story-sidebar-photo-attr"><span class="story-photo-source-label">Source:</span> ${attribution || sourceLabel || 'Unknown'}</p>`
  } else {
    thumb = `<p class="story-sidebar-photo-attr muted">No matching thumbnail yet — use a source link above.</p>`
  }

  return `<aside class="story-sidebar-photo" aria-label="Story photo">
      <p class="story-sidebar-photo-heading">Photos</p>
      ${linkRow}
      ${thumb}
    </aside>`
}

function placeDetailExtrasHtml({
  lat,
  lon,
  name,
  placeHint,
  bodyMarkdown,
  historyId,
  layer,
  source_url,
  website,
  storyPhoto,
}) {
  const displayMarkdown = stripSourceAttribution(bodyMarkdown)
  const links = extractResearchLinks(bodyMarkdown)
  const photos = photosForPlace({ lat, lon, name, historyId, layer, requireTopic: true })
  if (storyPhoto?.image_url && !photos.some((p) => p.image_url === storyPhoto.image_url)) {
    photos.unshift(storyPhoto)
  }
  return `${mapsLinksHtml(lat, lon, name, placeHint)}${photosHtml(photos)}${researchLinksHtml(links, name, {
    placeHint,
    source_url,
    website,
    bodyMarkdown: displayMarkdown,
    displayMarkdown,
  })}`
}


function detailHtmlFromProps(p, layerId, coords) {
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
  const desc = stripSourceAttribution(p.inscription || p.history || p.description || p.location_text || '')
  const href = p.source_url || p.website || null
  const linkLabel = p.source_url ? 'history.ky.gov' : isWikipediaUrl(href) ? 'Wikipedia' : 'Website'
  // Research URLs also appear under Learn more — don't show the same link twice.
  const link =
    href && !isResearchUrl(href)
      ? `<p class="popup-link"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a></p>`
      : ''
  let lat = null
  let lon = null
  if (coords) {
    const c = Array.isArray(coords) ? coords : [coords.lng, coords.lat]
    lon = c[0]
    lat = c[1]
  } else if (p.lat != null && p.lon != null) {
    lat = p.lat
    lon = p.lon
  } else if (p.latitude != null && p.longitude != null) {
    lat = p.latitude
    lon = p.longitude
  }
  const hint = [p.city, p.county ? `${p.county} County` : '', p.subtitle].filter(Boolean).join(', ')
  const bodyMarkdown = p.bodyMarkdown || p.history || p.description || p.inscription || ''
  const extras = placeDetailExtrasHtml({
    lat,
    lon,
    name,
    placeHint: hint || null,
    bodyMarkdown,
    historyId: p.id || p.historyId || null,
    layer: layerId === 'markers' ? 'marker' : layerId,
    source_url: p.source_url || null,
    website: p.website || null,
    storyPhoto: p.photo || p.storyPhoto || null,
  })
  const layerLabel = DATA_LAYERS.find((l) => l.id === layerId)?.label || layerId
  const shareUrl = absoluteShareUrl(placeShareHash(layerId, p))
  return `
    <div class="map-popup">
      <div class="detail-layer">${escapeHtml(layerLabel)}</div>
      <h3>${escapeHtml(name)}</h3>
      <div class="meta">${escapeHtml(metaBits.filter(Boolean).join(' · '))}</div>
      ${shareControlHtml(shareUrl, name)}
      ${desc ? `<div class="popup-full-text">${linkifyPlainUrls(escapeHtml(desc))}</div>` : ''}
      ${link}
      ${extras}
    </div>
  `
}


/** Pick popup anchor + max height so content stays inside the map canvas. */
function popupPlacement(targetMap, lngLat) {
  const el = targetMap?.getContainer?.()
  if (!el || !lngLat) {
    return { anchor: 'bottom', maxHeightPx: 420, maxWidth: 'min(92vw, 480px)' }
  }
  const pt = Array.isArray(lngLat)
    ? targetMap.project(lngLat)
    : targetMap.project([lngLat.lng ?? lngLat.lon, lngLat.lat])
  const w = el.clientWidth
  const h = el.clientHeight
  const pad = 12
  const spaceAbove = Math.max(0, pt.y - pad)
  const spaceBelow = Math.max(0, h - pt.y - pad)
  const spaceLeft = Math.max(0, pt.x - pad)
  const spaceRight = Math.max(0, w - pt.x - pad)

  // Prefer the vertical side with more room (lower pins → open upward)
  const openUp = spaceAbove >= spaceBelow
  let anchor = openUp ? 'bottom' : 'top'
  let avail = openUp ? spaceAbove : spaceBelow

  // Nudge horizontally when near left/right edges
  const nearLeft = spaceLeft < 140
  const nearRight = spaceRight < 140
  if (nearLeft && !nearRight) {
    anchor = openUp ? 'bottom-left' : 'top-left'
  } else if (nearRight && !nearLeft) {
    anchor = openUp ? 'bottom-right' : 'top-right'
  }

  // Leave room for tip + close control; keep a usable scroll area
  const maxHeightPx = Math.max(140, Math.min(Math.floor(avail - 28), Math.floor(h * 0.72), 560))
  return { anchor, maxHeightPx, maxWidth: 'min(92vw, 480px)' }
}

async function showDetailPopup(feature, layerId, lngLat, targetMap = map) {
  if (!targetMap || !feature) return
  if (activePopup) {
    activePopup.remove()
    activePopup = null
  }
  const coords =
    lngLat ||
    (feature.geometry?.type === 'Point'
      ? feature.geometry.coordinates
      : null)
  if (!coords) return
  await loadHistoricPhotoData()
  const props = enrichFeatureProps(layerId, feature.properties || {})
  const storyPhoto = await storyPhotoForProps(props)
  if (storyPhoto) props.photo = storyPhoto
  const shareHash = placeShareHash(layerId, props)
  // Keep a shareable deep link in the address bar (home map only)
  if (targetMap === map && shareHash.startsWith('#map/')) {
    history.replaceState(null, '', shareHash)
  }
  const place = popupPlacement(targetMap, coords)
  activePopup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: place.maxWidth,
    offset: 14,
    anchor: place.anchor,
    className: 'ky-popup',
  })
    .setLngLat(coords)
    .setHTML(detailHtmlFromProps(props, layerId, coords))
    .addTo(targetMap)
  const popupEl = activePopup.getElement()
  const content = popupEl?.querySelector('.maplibregl-popup-content')
  if (content) {
    content.style.maxHeight = `${place.maxHeightPx}px`
    content.style.overflowY = 'auto'
    content.style.webkitOverflowScrolling = 'touch'
  }
  wireShareButtons(popupEl)
  activePopup.on('close', () => {
    if (activePopup) activePopup = null
    // Clear place deep link when popup closes on home map
    if (targetMap === map && parseHash().view === 'map' && parseHash().placeId) {
      history.replaceState(null, '', '#map')
    }
  })
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

async function addDataLayerOn(targetMap, def, visMap) {
  try {
    const res = await fetch(def.geojson)
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    cacheLayerFeatures(def.id, data)
    if (targetMap.getSource(def.id)) return
    targetMap.addSource(def.id, { type: 'geojson', data })

    const vis = visMap[def.id] ? 'visible' : 'none'
    // Same size for every layer (including Markers)
    const circleRadius = def.circleRadius || [
      'interpolate',
      ['linear'],
      ['zoom'],
      6,
      4,
      9,
      6,
      12,
      8,
      16,
      11,
    ]
    const hitRadius = def.hitRadius ?? 16
    targetMap.addLayer({
      id: layerCircleId(def.id),
      type: 'circle',
      source: def.id,
      layout: { visibility: vis },
      paint: {
        'circle-radius': circleRadius,
        'circle-color': def.color,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#f3ead8',
        'circle-opacity': 0.95,
      },
    })
    targetMap.addLayer({
      id: layerHitId(def.id),
      type: 'circle',
      source: def.id,
      layout: { visibility: vis },
      paint: { 'circle-radius': hitRadius, 'circle-opacity': 0 },
    })

    // Map uses colored dots only (layer color). Icons stay in the Layers list UI.

    targetMap.on('mouseenter', layerHitId(def.id), () => {
      targetMap.getCanvas().style.cursor = 'pointer'
    })
    targetMap.on('mouseleave', layerHitId(def.id), () => {
      targetMap.getCanvas().style.cursor = ''
    })
    targetMap.on('click', layerHitId(def.id), (e) => {
      const f = e.features?.[0]
      if (!f) return
      e.originalEvent?.stopPropagation?.()
      showDetailPopup(f, def.id, e.lngLat, targetMap)
    })
  } catch (err) {
    console.warn('layer failed', def.id, err)
  }
}

async function addDataLayer(def) {
  return addDataLayerOn(map, def, layerVisibility)
}

function fitMapToKentucky(targetMap = map, opts = {}) {
  if (!targetMap) return
  targetMap.fitBounds(KY_BOUNDS, {
    padding: opts.padding ?? 48,
    maxZoom: opts.maxZoom ?? 7.5,
    duration: opts.duration ?? 700,
    essential: true,
  })
  if (activePopup && targetMap === map) {
    activePopup.remove()
    activePopup = null
  }
}

function flyToFocus(targetMap, focus, zoom = 12) {
  if (!targetMap || !focus || focus.lon == null || focus.lat == null) return
  // Skip no-op flies (filter re-renders used to re-call this and race on iPad Safari)
  try {
    const curZoom = targetMap.getZoom()
    const c = targetMap.getCenter()
    if (
      Math.abs(curZoom - zoom) < 0.08 &&
      Math.abs(c.lng - Number(focus.lon)) < 1e-5 &&
      Math.abs(c.lat - Number(focus.lat)) < 1e-5
    ) {
      return
    }
  } catch {
    /* map not ready */
  }
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
    targetMap.addLayer({
      id: 'highlight-hit',
      type: 'circle',
      source: 'highlight',
      paint: { 'circle-radius': 22, 'circle-opacity': 0 },
    })
    targetMap.on('mouseenter', 'highlight-hit', () => {
      targetMap.getCanvas().style.cursor = 'pointer'
    })
    targetMap.on('mouseleave', 'highlight-hit', () => {
      targetMap.getCanvas().style.cursor = ''
    })
    targetMap.on('click', 'highlight-hit', (e) => {
      const f = e.features?.[0]
      if (!f) return
      e.originalEvent?.stopPropagation?.()
      const props = {
        ...(highlightDetailProps || {}),
        ...(f.properties || {}),
        title: (highlightDetailProps || f.properties || {}).title || f.properties?.title,
        name: (highlightDetailProps || f.properties || {}).name || f.properties?.name,
      }
      showDetailPopup(
        { type: 'Feature', geometry: f.geometry, properties: props },
        highlightDetailProps?.layerId || 'history',
        e.lngLat,
        targetMap,
      )
    })
  }
}

function initMap() {
  if (map) {
    requestAnimationFrame(() => {
      map.resize()
      pendingFocus = null
      if (!mapReady) return
      const place = parseHash()
      if (place.view === 'map' && place.placeLayer && place.placeId) {
        openPlaceFromHash({ placeLayer: place.placeLayer, placeId: place.placeId }).catch(console.error)
        return
      }
      ensureHighlightSource(map, null)
      fitMapToKentucky(map, { duration: 0 })
    })
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

  const zoomFull = () => fitMapToKentucky(map)
  document.getElementById('zoomFullState')?.addEventListener('click', zoomFull)
  document.getElementById('zoomFullStateMap')?.addEventListener('click', zoomFull)
  document.getElementById('heroZoomFullState')?.addEventListener('click', zoomFull)

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
      if (!pendingFocus) {
        fitMapToKentucky(map, { duration: 0 })
      }
    } catch (err) {
      console.warn('Kentucky outline failed to load', err)
      if (!pendingFocus) {
        fitMapToKentucky(map, { duration: 0 })
      }
    }

    for (const def of DATA_LAYERS) {
      await addDataLayer(def)
    }

    // Home defaults: Markers on + whole-state view
    setLayerVisible('markers', true)
    const markersToggle = document.querySelector('input[data-layer="markers"]')
    if (markersToggle) markersToggle.checked = true
    syncAllLayersCheckbox()
    if (!pendingFocus) {
      map.resize()
      fitMapToKentucky(map, { duration: 0 })
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
    pendingFocus = null
    ensureHighlightSource(map, null)
    const place = parseHash()
    if (place.view === 'map' && place.placeLayer && place.placeId) {
      const tryOpen = async (attempt = 0) => {
        const ok = await openPlaceFromHash({
          placeLayer: place.placeLayer,
          placeId: place.placeId,
        })
        if (!ok && attempt < 5) {
          window.setTimeout(() => tryOpen(attempt + 1), 200)
        }
      }
      tryOpen().catch(console.error)
    } else {
      fitMapToKentucky(map, { duration: 0 })
    }
  })
}

/* -------------------- Timeline map (filtered layers) -------------------- */
let timelineMap = null
let timelineMapReady = false
const timelineLayerVisibility = Object.fromEntries(
  // Always on — year/era filters decide what shows; no layer toggles in the UI
  DATA_LAYERS.map((l) => [l.id, true]),
)

function setTimelineLayerVisible(id, on) {
  timelineLayerVisibility[id] = on
  if (!timelineMap || !timelineMapReady) return
  const vis = on ? 'visible' : 'none'
  for (const lid of [layerCircleId(id), layerHitId(id), layerSymbolId(id)]) {
    if (timelineMap.getLayer(lid)) timelineMap.setLayoutProperty(lid, 'visibility', vis)
  }
  updateTimelineMapCounts()
}

function renderTimelineLayerToggles() {
  const box = document.getElementById('timelineLayerToggles')
  if (!box || box.dataset.ready) return
  box.dataset.ready = '1'
  box.innerHTML = DATA_LAYERS.map((l) => {
    const icon =
      l.icon.type === 'img'
        ? `<img class="layer-icon" src="${l.icon.src}" alt="" width="18" height="18" />`
        : `<span class="layer-icon emoji" aria-hidden="true">${l.icon.glyph}</span>`
    const on = timelineLayerVisibility[l.id]
    return `<label class="ctrl layer-row">
      <input type="checkbox" data-timeline-layer="${l.id}" ${on ? 'checked' : ''} />
      ${icon}
      <span>${escapeHtml(l.label)}</span>
      <span class="swatch" style="background:${l.color}"></span>
    </label>`
  }).join('')
  box.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-timeline-layer]')
    if (!input) return
    setTimelineLayerVisible(input.dataset.timelineLayer, input.checked)
  })
}

function featureMatchesTimelineFilter(props, layerDef) {
  if (!props) return false
  if (!timelineHasActivePlaceFilter()) return false
  if (layerDef.filterByEra) {
    const eras = timelineState.eras
    if (eras.size !== ERAS.length) {
      if (!eras.size) return false
      if (!eras.has(props.era)) return false
    }
  }
  const { yearMin, yearMax } = timelineState
  if (yearMin == null && yearMax == null) {
    // Era-only: non-era layers don't match
    return Boolean(layerDef.filterByEra && props.era)
  }
  if (props.yearStart == null) return false
  const start = Number(props.yearStart)
  const end = Number(props.yearEnd != null ? props.yearEnd : props.yearStart)
  if (Number.isNaN(start)) return false
  if (yearMax != null && start > yearMax) return false
  if (yearMin != null && end < yearMin) return false
  return true
}

function updateTimelineMapCounts() {
  const el = document.getElementById('timelineMapCounts')
  const meta = document.getElementById('timelineMapMeta')
  if (!el) return
  if (!timelineMap || !timelineMapReady) {
    el.textContent = ''
    return
  }
  const bits = []
  let total = 0
  for (const def of DATA_LAYERS) {
    if (!timelineLayerVisibility[def.id]) continue
    const src = timelineMap.getSource(def.id)
    const feats = src?._data?.features
    if (!feats) continue
    const n = feats.filter((f) => featureMatchesTimelineFilter(f.properties || {}, def)).length
    if (n) {
      bits.push(`${n.toLocaleString()} ${def.label}`)
      total += n
    }
  }
  el.textContent = bits.length
    ? `Map showing ${total.toLocaleString()} places · ${bits.join(' · ')}`
    : 'Map: no places in this filter (try another timeframe or era)'
  if (meta && !pendingFocus) {
    const { yearMin, yearMax } = timelineState
    if (!timelineHasActivePlaceFilter()) {
      meta.textContent = 'Pick an era or timeframe to see matching places.'
    } else {
      const range =
        yearMin != null || yearMax != null
          ? `${formatYear(yearMin ?? '…')} – ${formatYear(yearMax ?? '…')}`
          : 'selected eras'
      meta.textContent = `Showing places in ${range}.`
    }
  }
}

async function initTimelineMap() {
  const el = document.getElementById('timelineMapCanvas')
  if (!el) return
  if (timelineMap) {
    requestAnimationFrame(() => {
      timelineMap.resize()
      applyFiltersToMapInstance(timelineMap)
      updateTimelineMapCounts()
    })
    return
  }
  timelineMap = new maplibregl.Map({
    container: 'timelineMapCanvas',
    style: OSM_STYLE,
    center: CENTER,
    zoom: START_ZOOM,
  })
  timelineMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  document.getElementById('timelineZoomFullState')?.addEventListener('click', () => {
    fitMapToKentucky(timelineMap, { duration: 600 })
  })
  timelineMap.on('load', async () => {
    try {
      const ky = await (await fetch('/data/kentucky-outline.geojson')).json()
      timelineMap.addSource('kentucky', { type: 'geojson', data: ky })
      timelineMap.addLayer({
        id: 'kentucky-fill',
        type: 'fill',
        source: 'kentucky',
        paint: { 'fill-color': '#2d5a3d', 'fill-opacity': 0.1 },
      })
      timelineMap.addLayer({
        id: 'kentucky-outline',
        type: 'line',
        source: 'kentucky',
        paint: { 'line-color': '#c9893a', 'line-width': 2, 'line-opacity': 0.9 },
      })
    } catch {
      /* ignore */
    }
    await loadHistoricPhotoData()
    for (const def of DATA_LAYERS) {
      await addDataLayerOn(timelineMap, def, timelineLayerVisibility)
    }
    timelineMapReady = true
    applyFiltersToMapInstance(timelineMap)
    if (pendingFocus) {
      ensureHighlightSource(timelineMap, pendingFocus)
      flyToFocus(timelineMap, pendingFocus, 11)
    } else {
      fitMapToKentucky(timelineMap, { duration: 0 })
    }
    updateTimelineMapCounts()
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
    zoom: START_ZOOM,
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
        paint: { 'fill-color': '#2d5a3d', 'fill-opacity': 0.1 },
      })
      storiesMap.addLayer({
        id: 'kentucky-outline',
        type: 'line',
        source: 'kentucky',
        paint: { 'line-color': '#c9893a', 'line-width': 2, 'line-opacity': 0.9 },
      })
      if (!pendingFocus) {
        storiesMap.fitBounds(KY_BOUNDS, { padding: 36, maxZoom: 7.2, duration: 0 })
      }
    } catch {
      /* ignore */
    }
    // Location map shows only the selected story pin (via highlight), not home layers or all stories.
    ensureHighlightSource(storiesMap, null)
    storiesMapReady = true
    if (pendingFocus) {
      ensureHighlightSource(storiesMap, pendingFocus)
      flyToFocus(storiesMap, pendingFocus, 11)
    }
  })
}

function focusStoryOnMaps(story) {
  selectedStorySlug = story.slug
  const metaEl = document.getElementById('timelineMapMeta')

  if (story.lat == null || story.lon == null) {
    pendingFocus = null
    highlightDetailProps = null
    if (metaEl) metaEl.textContent = `${story.title} — no map location yet`
    if (timelineMapReady) {
      ensureHighlightSource(timelineMap, null)
    }
    return
  }

  const focus = {
    lon: story.lon,
    lat: story.lat,
    title: story.title,
    slug: story.slug,
  }
  pendingFocus = focus
  highlightDetailProps = {
    layerId: 'history',
    id: story.historyId || story.matchedPlace || story.slug,
    historyId: story.historyId || null,
    name: story.title,
    title: story.title,
    history: story.summary || '',
    description: story.summary || '',
    bodyMarkdown: story.bodyMarkdown || '',
    county: story.county,
    era: story.era,
    yearStart: story.yearStart,
    yearEnd: story.yearEnd,
    matchedPlace: story.matchedPlace,
    lat: story.lat,
    lon: story.lon,
    photo: story.photo || null,
    slug: story.slug,
  }
  const conf =
    story.mapConfidence === 'exact'
      ? 'Matched History place'
      : story.mapConfidence === 'fuzzy'
        ? 'Approximate History match'
        : story.mapConfidence === 'county'
          ? 'County centroid'
          : 'Located'
  if (metaEl) {
    metaEl.textContent = `${story.title} · ${conf}${story.matchedPlace ? ` · ${story.matchedPlace}` : ''}`
  }

  applyPendingStoryFocus()
}

function applyPendingStoryFocus() {
  if (!pendingFocus) return
  initTimelineMap()
  if (timelineMapReady) {
    ensureHighlightSource(timelineMap, pendingFocus)
    flyToFocus(timelineMap, pendingFocus, 11)
    return
  }
  if (timelineMap) {
    timelineMap.once('load', () => {
      if (!pendingFocus) return
      ensureHighlightSource(timelineMap, pendingFocus)
      flyToFocus(timelineMap, pendingFocus, 11)
    })
  }
}

/* -------------------- Stories / Timeline -------------------- */
let storiesIndex = null
let storiesCountyReady = false
let storiesSortMode = 'brief-desc'
let timelineStoriesSortMode = 'year-asc'
let storiesBySlug = {}

async function loadStories() {
  if (storiesIndex) return storiesIndex
  const res = await fetch('/content/stories.json')
  storiesIndex = await res.json()
  await enrichStoriesCounties(storiesIndex.stories)
  return storiesIndex
}

async function loadStoryBody(slug) {
  const res = await fetch(`/content/stories/${encodeURIComponent(slug)}.json`)
  if (!res.ok) throw new Error('not found')
  return res.json()
}

function primaryStoryTag(story) {
  const tags = story.tags || []
  const skip = new Set(['kentucky', 'ky'])
  return tags.find((t) => !skip.has(String(t).toLowerCase())) || tags[0] || ''
}

async function enrichStoriesCounties(stories) {
  if (storiesCountyReady) return
  let centroids = {}
  let historyFeatures = []
  let locations = {}
  try {
    centroids = await (await fetch('/data/county-centroids.json')).json()
  } catch {
    /* ignore */
  }
  try {
    const hist = await (await fetch('/data/layers/history.geojson')).json()
    historyFeatures = hist.features || []
  } catch {
    /* ignore */
  }
  try {
    const loc = await (await fetch('/content/stories-locations.json')).json()
    locations = loc.locations || {}
  } catch {
    /* ignore */
  }

  const countyNames = Object.keys(centroids).sort((a, b) => b.length - a.length)
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const countyRe = countyNames.length
    ? new RegExp('\\b(' + countyNames.map(escapeRe).join('|') + ')(?:\\s+County)?\\b', 'i')
    : null

  const historyById = new Map()
  const historyByName = new Map()
  for (const f of historyFeatures) {
    const p = f.properties || {}
    if (p.id) historyById.set(p.id, p)
    if (p.name) historyByName.set(String(p.name).toLowerCase(), p)
    if (p.county && f.geometry && f.geometry.coordinates) {
      /* keep for nearest */
    }
  }

  function countyFromText(blob) {
    if (!countyRe || !blob) return ''
    const m = String(blob).match(countyRe)
    return m ? m[1].replace(/\b\w/g, (ch) => ch.toUpperCase()) : ''
  }

  function nearestHistoryCounty(lat, lon) {
    if (lat == null || lon == null || !historyFeatures.length) return ''
    let best = null
    let bestD = Infinity
    for (const f of historyFeatures) {
      const p = f.properties || {}
      if (!p.county || !f.geometry || f.geometry.type !== 'Point') continue
      const [x, y] = f.geometry.coordinates
      const d = (x - lon) ** 2 + (y - lat) ** 2
      if (d < bestD) {
        bestD = d
        best = p.county
      }
    }
    // ~0.35 deg^2 ≈ rough local match; still use nearest if nothing closer needed
    return best || ''
  }

  for (const s of stories) {
    if (s.county) continue
    const loc = locations[s.slug] || {}
    let county = ''
    const histId = loc.historyId || s.historyId
    if (histId && historyById.get(histId)?.county) {
      county = historyById.get(histId).county
    }
    if (!county && s.matchedPlace && historyByName.get(String(s.matchedPlace).toLowerCase())?.county) {
      county = historyByName.get(String(s.matchedPlace).toLowerCase()).county
    }
    if (!county) {
      county = countyFromText(
        [s.matchedPlace, s.title, s.summary, s.slug?.replace(/-/g, ' '), loc.matchedPlace]
          .filter(Boolean)
          .join(' '),
      )
    }
    if (!county && (s.mapConfidence === 'county' || loc.mapConfidence === 'county')) {
      // matchedPlace often is the county name for centroid pins
      const guess = countyFromText(`${s.matchedPlace || loc.matchedPlace || ''} County`)
      county = guess || countyFromText(s.matchedPlace || loc.matchedPlace || '')
    }
    if (!county) county = nearestHistoryCounty(s.lat, s.lon)
    s.county = county || ''
  }
  storiesCountyReady = true
}

function sortStoriesList(stories, mode) {
  const list = [...stories]
  const titleCmp = (a, b) => String(a.title || '').localeCompare(String(b.title || ''))
  const missingLast = (val) => (val ? 0 : 1)
  switch (mode) {
    case 'brief-asc':
      list.sort(
        (a, b) =>
          String(a.briefDate || '').localeCompare(String(b.briefDate || '')) || titleCmp(a, b),
      )
      break
    case 'year-asc':
      list.sort(
        (a, b) =>
          (Number(a.yearStart) || 0) - (Number(b.yearStart) || 0) || titleCmp(a, b),
      )
      break
    case 'year-desc':
      list.sort(
        (a, b) =>
          (Number(b.yearStart) || 0) - (Number(a.yearStart) || 0) || titleCmp(a, b),
      )
      break
    case 'county':
      list.sort(
        (a, b) =>
          missingLast(a.county) - missingLast(b.county) ||
          String(a.county || '').localeCompare(String(b.county || '')) ||
          titleCmp(a, b),
      )
      break
    case 'tag':
      list.sort(
        (a, b) =>
          missingLast(primaryStoryTag(a)) - missingLast(primaryStoryTag(b)) ||
          String(primaryStoryTag(a)).localeCompare(String(primaryStoryTag(b))) ||
          titleCmp(a, b),
      )
      break
    case 'title':
      list.sort(titleCmp)
      break
    case 'brief-desc':
    default:
      list.sort(
        (a, b) =>
          String(b.briefDate || '').localeCompare(String(a.briefDate || '')) || titleCmp(a, b),
      )
  }
  return list
}

function storyCardHtml(s) {
  const years = formatYearRange(s.yearStart, s.yearEnd)
  const loc = s.lat != null ? '' : '<span class="muted"> · no map yet</span>'
  const county = s.county
    ? `<span class="story-county">${escapeHtml(s.county)} Co.</span>`
    : ''
  const tag = primaryStoryTag(s)
  const tagHtml = tag ? `<span class="muted">#${escapeHtml(tag)}</span>` : ''
  return `<button type="button" class="story-card" data-slug="${escapeHtml(s.slug)}">
        <span class="story-card-icon" aria-hidden="true">📖</span>
        <span class="story-card-body">
          <span class="story-card-meta">
            ${county}
            <span class="era-pill era-${escapeHtml(s.era || 'unknown')}">${escapeHtml(s.era || '')}</span>
            <span>${escapeHtml(years)}</span>
            ${tagHtml}${loc}
          </span>
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.summary || '')}</p>
        </span>
      </button>`
}

function paintStoriesList(sorted) {
  const list = document.getElementById('storiesList')
  const meta = document.getElementById('storiesSortMeta')
  storiesBySlug = Object.fromEntries(sorted.map((s) => [s.slug, s]))
  list.innerHTML =
    sorted.map(storyCardHtml).join('') || '<p class="muted">No stories yet.</p>'
  if (meta) {
    const withCounty = sorted.filter((s) => s.county).length
    meta.textContent = `${sorted.length} stories · ${withCounty} with county`
  }
  if (selectedStorySlug) {
    list.querySelectorAll('.story-card').forEach((el) => {
      el.classList.toggle('selected', el.dataset.slug === selectedStorySlug)
    })
  }
}

function setupStoriesScrollControls() {
  const topBtn = document.getElementById('storiesScrollTop')
  const upBtn = document.getElementById('storiesScrollUp')
  const downBtn = document.getElementById('storiesScrollDown')
  if (!topBtn || topBtn.dataset.ready) return
  topBtn.dataset.ready = '1'
  const pane = document.querySelector('.stories-list-pane')
  topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    pane?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  })
  upBtn.addEventListener('click', () => {
    window.scrollBy({ top: -Math.max(280, window.innerHeight * 0.7), behavior: 'smooth' })
  })
  downBtn.addEventListener('click', () => {
    window.scrollBy({ top: Math.max(280, window.innerHeight * 0.7), behavior: 'smooth' })
  })
}

function setupStoriesSortControl() {
  const select = document.getElementById('storiesSort')
  if (!select || select.dataset.ready) return
  select.dataset.ready = '1'
  select.value = storiesSortMode
  select.addEventListener('change', () => {
    storiesSortMode = select.value
    if (!storiesIndex) return
    const sorted = sortStoriesList(storiesIndex.stories, storiesSortMode)
    paintStoriesList(sorted)
  })
}


/** Daily briefs store summary as a truncated copy of bodyMarkdown — don't show both. */
function summaryDuplicatesBody(summary, bodyMarkdown) {
  const sum = String(summary || '')
    .replace(/\s+/g, ' ')
    .replace(/[…\.]+$/u, '')
    .trim()
    .toLowerCase()
  const body = String(bodyMarkdown || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!sum || !body) return false
  const prefix = sum.slice(0, Math.min(sum.length, 100))
  return prefix.length >= 24 && body.startsWith(prefix)
}

async function showStoryInReader(meta, { scroll = true } = {}) {
  const reader = document.getElementById('timelineStoryReader')
  if (!reader || !meta) return
  reader.classList.remove('is-empty')
  reader.innerHTML = '<p class="muted">Loading…</p>'
  const jumpBar = document.getElementById('timelineReaderJump')
  if (jumpBar) jumpBar.hidden = false
  setupTimelineJumpControls()
  focusStoryOnMaps(meta)
  document.querySelectorAll('#timelineList .timeline-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.slug === meta.slug)
  })
  try {
    await loadHistoricPhotoData()
    const s = await loadStoryBody(meta.slug)
    let historyId = meta.historyId || null
    try {
      const locations = await loadStoriesLocations()
      const loc = locationForSlug(locations, meta.slug)
      if (loc?.historyId) historyId = loc.historyId
      if (meta.lat == null && loc?.lat != null) {
        meta.lat = loc.lat
        meta.lon = loc.lon
        meta.mapConfidence = loc.mapConfidence
        meta.matchedPlace = loc.matchedPlace
      }
      if (!historyId && loc?.historyId) historyId = loc.historyId
    } catch {
      /* ignore */
    }
    // Enrich highlight popup with full story text for map pin clicks
    if (meta.lat != null && meta.lon != null) {
      highlightDetailProps = {
        layerId: 'history',
        id: historyId || meta.slug,
        historyId,
        name: s.title,
        title: s.title,
        history: stripSourceAttribution(s.bodyMarkdown) || s.summary || '',
        description: s.summary || '',
        bodyMarkdown: s.bodyMarkdown || '',
        county: meta.county || s.county,
        era: s.era,
        yearStart: s.yearStart,
        yearEnd: s.yearEnd,
        matchedPlace: meta.matchedPlace,
        lat: meta.lat,
        lon: meta.lon,
        photo: s.photo || null,
        slug: meta.slug,
      }
      focusStoryOnMaps({ ...meta, ...highlightDetailProps, slug: meta.slug, title: s.title })
    }
    const tags = (s.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')
    const countyLine = meta.county
      ? `<span class="story-county">${escapeHtml(meta.county)} County</span>`
      : ''
    const mapHash = storyPlaceHash({
      historyId,
      slug: meta.slug,
      lat: meta.lat ?? s.lat,
      lon: meta.lon ?? s.lon,
    })
    const extras = placeDetailExtrasHtml({
      lat: meta.lat ?? s.lat,
      lon: meta.lon ?? s.lon,
      name: s.title,
      placeHint: meta.matchedPlace || meta.county,
      bodyMarkdown: s.bodyMarkdown || '',
      historyId,
      layer: 'history',
      storyPhoto: s.photo || null,
    })
    const sidebarPhoto = await resolveStorySidebarPhoto({
      title: s.title,
      lat: meta.lat ?? s.lat,
      lon: meta.lon ?? s.lon,
      placeHint: meta.matchedPlace || meta.county,
      historyId,
      bodyMarkdown: s.bodyMarkdown || '',
      existingPhoto: s.photo || null,
    })
    reader.innerHTML = `
      <div class="story-reader-layout">
        <div class="story-reader-main">
          <header class="story-head">
            <div class="story-card-meta">
              <span class="story-card-icon inline" aria-hidden="true">📖</span>
              ${countyLine}
              <span class="era-pill era-${escapeHtml(s.era)}">${escapeHtml(s.era)}</span>
              <span>${escapeHtml(formatYearRange(s.yearStart, s.yearEnd))}</span>
            </div>
            <h2>${escapeHtml(s.title)}</h2>
            ${shareControlHtml(absoluteShareUrl(storyShareHash(meta.slug)), s.title)}
            ${
              summaryDuplicatesBody(s.summary || meta.summary, s.bodyMarkdown)
                ? ''
                : `<p class="story-summary">${escapeHtml(s.summary || meta.summary || '')}</p>`
            }
            <div class="tags">${tags}</div>
            ${
              mapHash
                ? `<div class="story-card-actions">
              <a class="btn" href="${escapeHtml(mapHash)}">Open on the map</a>
            </div>`
                : ''
            }
          </header>
          <div class="story-body">${marked.parse(stripSourceAttribution(s.bodyMarkdown || ''))}</div>
          ${extras}
          ${
            mapHash
              ? `<p class="muted popup-hint">The Timeline map highlights this place. Open on the map to fly to the pin and see the full popup.</p>`
              : ''
          }
          <p class="story-source muted">Kentucky History Drive</p>
        </div>
        ${storySidebarPhotoHtml(sidebarPhoto, s.title)}
      </div>
    `
    wireShareButtons(reader)
    if (scroll) reader.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } catch {
    reader.innerHTML = `<p class="muted">Could not load this story.</p>`
  }
}

async function renderStoriesPage(preferredSlug) {
  const idx = await loadStories()
  const list = document.getElementById('storiesList')
  const reader = document.getElementById('storyReader')
  setupStoriesSortControl()
  setupStoriesScrollControls()
  const sortEl = document.getElementById('storiesSort')
  if (sortEl) sortEl.value = storiesSortMode

  const sorted = sortStoriesList(idx.stories, storiesSortMode)
  paintStoriesList(sorted)

  list.onclick = (e) => {
    const card = e.target.closest('.story-card')
    if (!card) return
    const s = storiesBySlug[card.dataset.slug]
    if (!s) return
    selectedStorySlug = s.slug
    history.replaceState(null, '', `#stories/${encodeURIComponent(s.slug)}`)
    showStoryInReader(s)
  }

  initStoriesMap()

  const pick =
    (preferredSlug && storiesBySlug[preferredSlug]) ||
    (selectedStorySlug && storiesBySlug[selectedStorySlug]) ||
    sorted.find((s) => s.lat != null) ||
    sorted[0]

  if (pick) {
    await showStoryInReader(pick)
  } else if (reader) {
    reader.classList.add('is-empty')
    reader.innerHTML = ''
  }

  requestAnimationFrame(() => storiesMap?.resize())
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
    presetBox.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === btn))
    renderTimelineList()
    applyMapFilters()
  })

  document.getElementById('yearClear')?.addEventListener('click', () => {
    timelineState.yearMin = null
    timelineState.yearMax = null
    timelineState.preset = 'all'
    timelineState.eras = new Set(ERAS.map((e) => e.id))
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
  const { yearMin, yearMax } = timelineState
  if (yearMin != null || yearMax != null) {
    if (s.yearStart == null) return false
    const start = Number(s.yearStart)
    const end = Number(s.yearEnd != null ? s.yearEnd : s.yearStart)
    // Overlap: story [start, end] intersects filter [yearMin, yearMax]
    if (yearMax != null && start > yearMax) return false
    if (yearMin != null && end < yearMin) return false
  }
  return true
}

function setupTimelineJumpControls() {
  const wire = (id, target) => {
    const btn = document.getElementById(id)
    if (!btn || btn.dataset.ready) return
    btn.dataset.ready = '1'
    btn.addEventListener('click', () => {
      const el =
        target === 'top'
          ? document.getElementById('timeline')
          : target === 'filters'
            ? document.getElementById('timelineFilters')
            : document.getElementById('timelineList')
      if (!el) return
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }
  wire('timelineJumpFilters', 'filters')
  wire('timelineJumpStories', 'stories')
  wire('timelineJumpFiltersBottom', 'filters')
  wire('timelineJumpStoriesBottom', 'stories')
  wire('timelineJumpTop', 'top')

  const wireReset = (id) => {
    const btn = document.getElementById(id)
    if (!btn || btn.dataset.ready) return
    btn.dataset.ready = '1'
    btn.addEventListener('click', () => resetTimelineShowAllStories())
  }
  wireReset('timelineJumpReset')
  wireReset('timelineJumpResetBottom')
}

function setupTimelineStoriesSort() {
  const select = document.getElementById('timelineStoriesSort')
  if (!select || select.dataset.ready) return
  select.dataset.ready = '1'
  select.value = timelineStoriesSortMode
  select.addEventListener('change', () => {
    timelineStoriesSortMode = select.value
    renderTimelineList().catch(console.error)
  })
}

async function renderTimelineList(preferredSlug) {
  setupTimelineFilters()
  setupTimelineStoriesSort()
  setupTimelineJumpControls()
  const idx = await loadStories()
  const list = document.getElementById('timelineList')
  const stats = document.getElementById('timelineStats')
  const sortMeta = document.getElementById('timelineStoriesSortMeta')
  const sortEl = document.getElementById('timelineStoriesSort')
  const reader = document.getElementById('timelineStoryReader')
  if (sortEl) sortEl.value = timelineStoriesSortMode

  const filtered = sortStoriesList(
    idx.stories.filter(storyMatchesFilters),
    timelineStoriesSortMode,
  )
  const bySlug = Object.fromEntries(filtered.map((s) => [s.slug, s]))
  // Prefer full index for deep links that are filtered out of the current list
  const allBySlug = Object.fromEntries(idx.stories.map((s) => [s.slug, s]))
  storiesBySlug = allBySlug

  stats.textContent = `Showing ${filtered.length} of ${idx.stories.length} stories`
  if (sortMeta) {
    const withCounty = filtered.filter((s) => s.county).length
    sortMeta.textContent = `${filtered.length} in this filter · ${withCounty} with county`
  }
  list.innerHTML =
    filtered
      .map((s) => {
        const county = s.county
          ? `<span class="story-county">${escapeHtml(s.county)} Co.</span>`
          : ''
        const tag = primaryStoryTag(s)
        const tagHtml = tag ? `<span class="muted">#${escapeHtml(tag)}</span>` : ''
        const selected = selectedStorySlug === s.slug ? ' selected' : ''
        return `
      <li class="timeline-item${selected}" data-slug="${escapeHtml(s.slug)}" role="button" tabindex="0">
        <div class="timeline-year">${escapeHtml(formatYearRange(s.yearStart, s.yearEnd))}</div>
        <div class="timeline-body">
          <strong>${escapeHtml(s.title)}</strong>
          <div class="story-card-meta">
            ${county}
            <span class="era-pill era-${escapeHtml(s.era)}">${escapeHtml(s.era)}</span>
            ${tagHtml}
          </div>
          <p>${escapeHtml(s.summary || '')}</p>
        </div>
      </li>`
      })
      .join('') || '<li class="muted">No stories match these filters.</li>'

  const openStory = (slug) => {
    const s = allBySlug[slug]
    if (!s) return
    selectedStorySlug = s.slug
    history.replaceState(null, '', `#timeline/${encodeURIComponent(s.slug)}`)
    showStoryInReader(s)
  }

  list.onclick = (e) => {
    const item = e.target.closest('.timeline-item[data-slug]')
    if (!item) return
    openStory(item.dataset.slug)
  }
  list.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const item = e.target.closest('.timeline-item[data-slug]')
    if (!item) return
    e.preventDefault()
    openStory(item.dataset.slug)
  }

  const pick =
    (preferredSlug && allBySlug[preferredSlug]) ||
    (selectedStorySlug && (bySlug[selectedStorySlug] || allBySlug[selectedStorySlug])) ||
    null

  if (pick) {
    // Filter/sort re-renders must not re-open the same story (re-fly + map.resize races on iPad Safari)
    const alreadyShowing =
      !preferredSlug &&
      selectedStorySlug === pick.slug &&
      reader &&
      !reader.classList.contains('is-empty')
    if (!alreadyShowing) {
      await showStoryInReader(pick, { scroll: false })
    }
  } else if (reader && !selectedStorySlug) {
    reader.classList.add('is-empty')
    reader.innerHTML = ''
    const jumpBar = document.getElementById('timelineReaderJump')
    if (jumpBar) jumpBar.hidden = true
  }
}



function resetTimelineFiltersOff({ keepFocus = false } = {}) {
  // Year / era → default; map layers stay on (filtered by timeframe)
  timelineState.yearMin = null
  timelineState.yearMax = null
  timelineState.preset = 'all'
  timelineState.eras = new Set(ERAS.map((e) => e.id))

  document.querySelectorAll('#eraChips .chip').forEach((c) => c.classList.add('active'))
  document.querySelectorAll('#yearPresets .chip').forEach((c) =>
    c.classList.toggle('active', c.dataset.preset === 'all'),
  )

  for (const id of Object.keys(timelineLayerVisibility)) {
    timelineLayerVisibility[id] = true
    if (timelineMap && timelineMapReady) setTimelineLayerVisible(id, true)
  }

  applyMapFilters()
  updateTimelineMapCounts()
  if (timelineMapReady && !keepFocus) {
    ensureHighlightSource(timelineMap, null)
    fitMapToKentucky(timelineMap, { duration: 0 })
  }
}


function resetTimelineShowAllStories() {
  resetTimelineFiltersOff()
  selectedStorySlug = null
  history.replaceState(null, '', '#timeline')
  const reader = document.getElementById('timelineStoryReader')
  if (reader) {
    reader.classList.add('is-empty')
    reader.innerHTML = ''
  }
  const jumpBar = document.getElementById('timelineReaderJump')
  if (jumpBar) jumpBar.hidden = true
  if (timelineMapReady) ensureHighlightSource(timelineMap, null)
  renderTimelineList(null).catch(console.error)
  scrollTimelineToFilters()
}

function scrollPageToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function scrollTimelineToFilters() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  const filters = document.getElementById('timelineFilters')
  const section = document.getElementById('timeline')
  const target = filters || section
  if (target) {
    // Keep site header visible; land on Timeline filters
    target.scrollIntoView({ block: 'start', behavior: 'auto' })
  }
  // Sticky header offset: nudge so nav + filters aren't under the top bar
  const header = document.querySelector('header.top')
  const offset = header ? header.getBoundingClientRect().height + 8 : 0
  if (offset && (filters || section)) {
    const y = window.scrollY - offset
    if (y > 0) window.scrollTo({ top: y, left: 0, behavior: 'auto' })
  }
}


function featureMatchesShareId(props, layerId, placeId) {
  if (!placeId) return false
  const want = String(placeId)
  return featureShareId(props, layerId) === want || String(props?.id || '') === want || String(props?.marker_number || '') === want
}

async function loadLayerFeatures(layerId) {
  if (layerGeojsonCache[layerId]?.features?.length) return layerGeojsonCache[layerId].features
  const def = DATA_LAYERS.find((l) => l.id === layerId)
  if (!def?.geojson) return []
  try {
    const res = await fetch(def.geojson)
    if (!res.ok) return []
    const data = await res.json()
    cacheLayerFeatures(layerId, data)
    return data.features || []
  } catch {
    return []
  }
}

async function openStoryHighlightOnHomeMap(place) {
  if (!place || place.lat == null || place.lon == null || !map || !mapReady) return false
  const focus = {
    lon: place.lon,
    lat: place.lat,
    title: place.title || place.matchedPlace || place.slug,
    slug: place.slug,
  }
  pendingFocus = focus
  highlightDetailProps = {
    layerId: place.historyId ? 'history' : 'stories',
    id: place.historyId || place.slug,
    historyId: place.historyId || null,
    name: place.title,
    title: place.title,
    history: place.summary || '',
    description: place.summary || '',
    county: place.county,
    era: place.era,
    yearStart: place.yearStart,
    yearEnd: place.yearEnd,
    matchedPlace: place.matchedPlace,
    lat: place.lat,
    lon: place.lon,
    photo: place.photo || null,
    slug: place.slug,
  }
  ensureHighlightSource(map, focus)
  flyToFocus(map, focus, 12)
  await showDetailPopup(
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lon, place.lat] },
      properties: highlightDetailProps,
    },
    highlightDetailProps.layerId,
    [place.lon, place.lat],
    map,
  )
  return true
}

async function openPlaceFromHash({ placeLayer, placeId }) {
  if (!placeLayer || !placeId || !map || !mapReady) return false

  if (STORY_MAP_LAYERS.has(placeLayer)) {
    const resolved = await resolveStoryPlace(placeId)
    if (!resolved) {
      console.warn('Share link story place not found', placeLayer, placeId)
      return false
    }
    if (resolved.historyId) {
      const fromHistory = await openPlaceFromHash({
        placeLayer: 'history',
        placeId: resolved.historyId,
      })
      if (fromHistory) return true
    }
    return openStoryHighlightOnHomeMap(resolved)
  }

  const def = DATA_LAYERS.find((l) => l.id === placeLayer)
  if (!def) return false
  setLayerVisible(placeLayer, true)
  const input = document.querySelector(`input[data-layer="${placeLayer}"]`)
  if (input) input.checked = true
  syncAllLayersCheckbox()

  const features = await loadLayerFeatures(placeLayer)
  let feature = features.find((f) => featureMatchesShareId(f.properties || {}, placeLayer, placeId))
  if ((!feature || feature.geometry?.type !== 'Point') && placeLayer === 'history') {
    const resolved = await resolveStoryPlace(placeId)
    if (resolved?.historyId && resolved.historyId !== placeId) {
      const retry = features.find((f) =>
        featureMatchesShareId(f.properties || {}, placeLayer, resolved.historyId),
      )
      if (retry) feature = retry
    }
    if (!feature || feature.geometry?.type !== 'Point') {
      if (resolved) return openStoryHighlightOnHomeMap(resolved)
      console.warn('Share link place not found', placeLayer, placeId)
      return false
    }
  }
  if (!feature || feature.geometry?.type !== 'Point') {
    console.warn('Share link place not found', placeLayer, placeId)
    return false
  }
  const [lon, lat] = feature.geometry.coordinates
  map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 12), duration: 600 })
  await showDetailPopup(feature, placeLayer, [lon, lat], map)
  return true
}


/* -------------------- Router -------------------- */
function setActiveNav(view) {
  document.querySelectorAll('#mainNav a').forEach((a) => {
    const r = a.dataset.route
    a.classList.toggle('active', r === view)
  })
}

async function applyRoute() {
  const { view, slug } = parseHash()
  document.querySelectorAll('.view').forEach((el) => {
    const v = el.dataset.view
    el.hidden = v !== view
  })
  const hero = document.getElementById('hero')
  if (hero) hero.hidden = view !== 'map'

  setActiveNav(view)

  if (view === 'map') {
    const { placeLayer, placeId } = parseHash()
    // Always open Map on the full state (start or navigating back from Timeline/etc.)
    // unless a shared place deep link is present
    pendingFocus = null
    initMap()
    requestAnimationFrame(() => {
      scrollPageToTop()
      map?.resize()
      if (!mapReady) return
      if (placeLayer && placeId) {
        openPlaceFromHash({ placeLayer, placeId }).catch(console.error)
        return
      }
      setLayerVisible('markers', true)
      const markersToggle = document.querySelector('input[data-layer="markers"]')
      if (markersToggle) markersToggle.checked = true
      syncAllLayersCheckbox()
      ensureHighlightSource(map, null)
      fitMapToKentucky(map, { duration: 0 })
    })
  } else if (view === 'timeline') {
    setupTimelineFilters()
    resetTimelineFiltersOff({ keepFocus: Boolean(slug) })
    await initTimelineMap()
    // Fresh visit: bare #timeline (no story slug), clear prior selection
    if (!slug) selectedStorySlug = null
    else selectedStorySlug = slug
    await renderTimelineList(slug)
    applyPendingStoryFocus()
    const scrollToStoryDetail = () => {
      const reader = document.getElementById('timelineStoryReader')
      if (!reader || reader.classList.contains('is-empty')) return false
      reader.scrollIntoView({ block: 'start', behavior: 'auto' })
      const header = document.querySelector('header.top')
      const offset = header ? header.getBoundingClientRect().height + 8 : 0
      if (offset) {
        const y = window.scrollY - offset
        if (y > 0) window.scrollTo({ top: y, left: 0, behavior: 'auto' })
      }
      return true
    }
    requestAnimationFrame(() => {
      if (slug) {
        if (scrollToStoryDetail()) return
        window.setTimeout(() => {
          if (!scrollToStoryDetail()) scrollTimelineToFilters()
        }, 100)
        return
      }
      scrollTimelineToFilters()
    })
  } else if (view === 'about' || view === 'app') {
    // Hash #about can land mid-page after Timeline; force true top so logo shows
    // (native hash scrolling races us — retry a couple frames + short timeout)
    const pinTop = () => scrollPageToTop()
    requestAnimationFrame(() => {
      pinTop()
      requestAnimationFrame(pinTop)
    })
    setTimeout(pinTop, 50)
    setTimeout(pinTop, 150)
  }
}

window.addEventListener('hashchange', () => {
  applyRoute().catch(console.error)
})

document.querySelector('#mainNav a[data-route="timeline"]')?.addEventListener('click', () => {
  // Same-hash navigations skip hashchange; still reset filters + scroll
  requestAnimationFrame(() => {
    if (parseHash().view !== 'timeline') return
    resetTimelineFiltersOff()
    selectedStorySlug = null
    renderTimelineList(null).catch(console.error)
    scrollTimelineToFilters()
  })
})


document.querySelector('#mainNav a[data-route="about"]')?.addEventListener('click', () => {
  requestAnimationFrame(() => {
    if (parseHash().view !== 'about') return
    scrollPageToTop()
  })
})



if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

document.querySelector('a.brand-home')?.addEventListener('click', (e) => {
  e.preventDefault()
  goHomeMap()
})
document.querySelector('#mainNav a[data-route="map"]')?.addEventListener('click', (e) => {
  // Always land on clean map home (drop stale ?d= from shares)
  e.preventDefault()
  goHomeMap()
})

syncDeepLinkFromQuery()
ensureHomeHash()
initThemeToggle()
initSiteSearch()
applyRoute().catch(console.error)
