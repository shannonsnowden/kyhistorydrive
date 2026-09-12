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
    // Dense statewide set — small orange icons
    circleRadius: ['interpolate', ['linear'], ['zoom'], 6, 1.5, 9, 2.2, 12, 3.2, 16, 5],
    iconSize: ['interpolate', ['linear'], ['zoom'], 6, 0.16, 9, 0.22, 12, 0.3, 16, 0.4],
    hitRadius: 10,
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

function ensureHomeHash() {
  // Empty hash → home map; legacy #stories → #timeline
  const raw = (location.hash || '').replace(/^#/, '')
  if (!raw) {
    history.replaceState(null, '', '#map')
    return
  }
  if (raw === 'stories' || raw === 'story') {
    history.replaceState(null, '', '#timeline')
    return
  }
  if (raw.startsWith('stories/') || raw.startsWith('story/')) {
    const slug = raw.split('/').slice(1).join('/')
    history.replaceState(null, '', `#timeline/${slug}`)
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
  if (['map', 'about', 'app'].includes(path)) return { view: path }
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
    const filter = onTimeline ? buildTimelineMapFilter(def) : buildYearEraFilter(def)
    for (const lid of [layerCircleId(def.id), layerHitId(def.id), layerSymbolId(def.id)]) {
      if (targetMap.getLayer(lid)) targetMap.setFilter(lid, filter)
    }
  }
  for (const lid of ['stories-circle', 'stories-hit', 'stories-highlight']) {
    if (!targetMap.getLayer(lid)) continue
    const f = onTimeline
      ? buildTimelineMapFilter({ yearFilter: true, filterByEra: true })
      : buildYearEraFilter({ yearFilter: true, filterByEra: true })
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

function mapsLinksHtml(lat, lon, label, placeHint) {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return ''
  }
  const la = Number(lat)
  const lo = Number(lon)
  const name = label || `${la},${lo}`
  const q = encodeURIComponent(name)
  const searchBits = [name]
  if (placeHint) searchBits.push(placeHint)
  if (!/kentucky/i.test(searchBits.join(' '))) searchBits.push('Kentucky')
  const searchQ = encodeURIComponent(searchBits.join(' '))
  const apple = `https://maps.apple.com/?ll=${la},${lo}&q=${q}`
  const google = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} @${la},${lo}`)}`
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

function extractGrokipediaLinks(markdown) {
  const links = []
  const seen = new Set()
  const re = /\[([^\]]*)\]\((https?:\/\/grokipedia\.com\/[^)\s]+)\)/gi
  let m
  while ((m = re.exec(String(markdown || '')))) {
    const url = m[2]
    if (seen.has(url)) continue
    seen.add(url)
    links.push({ label: m[1] || 'Grokipedia', url })
  }
  // bare URLs
  const bare = /https?:\/\/grokipedia\.com\/[^\s)"']+/gi
  while ((m = bare.exec(String(markdown || '')))) {
    const url = m[0]
    if (seen.has(url)) continue
    seen.add(url)
    links.push({ label: 'Grokipedia', url })
  }
  return links
}

function grokipediaSearchUrl(title) {
  const slug = String(title || '')
    .trim()
    .replace(/\s+/g, '_')
  if (!slug) return null
  return `https://grokipedia.com/page/${encodeURIComponent(slug)}`
}

function photosForPlace({ lat, lon, name, historyId, layer }) {
  const out = []
  const seen = new Set()
  const push = (p) => {
    const id = p.photo_id || p.id || p.image_url
    if (!id || seen.has(id) || !p.image_url) return
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
      if (d <= 2500) nearby.push({ ...ph, distance_m: Math.round(d), photo_id: ph.id })
      const related = (ph.related_place_names || []).join(' ').toLowerCase()
      if (name && related.includes(String(name).toLowerCase().slice(0, 12))) {
        nearby.push({ ...ph, distance_m: Math.round(d), photo_id: ph.id })
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
      const href = escapeHtml(p.source_url || p.image_url)
      const img = escapeHtml(p.image_url)
      return `<a class="historic-photo-card" href="${href}" target="_blank" rel="noopener noreferrer">
        <img src="${img}" alt="${title}" loading="lazy" />
        <span class="historic-photo-cap">${title}${year ? ` · ${year}` : ''}</span>
      </a>`
    })
    .join('')
  return `<div class="historic-photos"><div class="historic-photos-label">Historic photos</div><div class="historic-photos-grid">${cards}</div></div>`
}

function grokipediaHtml(links, title) {
  const items = [...(links || [])]
  if (!items.length && title) {
    const url = grokipediaSearchUrl(title)
    if (url) items.push({ label: `Grokipedia: ${title}`, url })
  }
  if (!items.length) return ''
  return `<div class="popup-research">
    <div class="historic-photos-label">Grokipedia</div>
    <ul class="grokipedia-list">${items
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

function kyhsSearchUrl(title, placeHint) {
  const q = [title, placeHint].filter(Boolean).join(' ')
  return `https://history.ky.gov/?s=${encodeURIComponent(q)}`
}

function extractWikipediaUrl(markdown) {
  if (!markdown) return null
  const m = String(markdown).match(/https?:\/\/en\.wikipedia\.org\/wiki\/[^\s)"'\]]+/i)
  return m ? m[0].replace(/[.,;:]+$/, '') : null
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
    grokipedia_url: extra.grokipedia_url || grokipediaSearchUrl(title),
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

      const topicTokens = String(title || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^(the|and|for|from|with|near|county|kentucky)$/.test(w))
      const scored = []
      for (const page of pages) {
        const info = page.imageinfo?.[0]
        if (!info) continue
        const mime = info.mime || ''
        if (!/^image\//.test(mime) || /svg\+xml|gif|tiff/i.test(mime)) continue
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
        for (const tok of topicTokens) {
          if (hay.includes(tok)) {
            hits += 1
            score += 14
          }
        }
        if (hits === 0 && topicTokens.length) score -= 25
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
      const pick = scored.find((s) => s.score >= 10) || scored[0]
      if (pick) return pick
    } catch {
      /* try next query */
    }
  }
  return null
}

function topicPhotoScore(photo, title, placeHint) {
  if (!photo?.image_url) return -1
  const tokens = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(the|and|for|from|with|near|county|kentucky)$/.test(w))
  const hay = `${photo.title || ''} ${photo.attribution || ''} ${photo.credit || ''} ${photo.source_label || ''}`.toLowerCase()
  let score = typeof photo.score === 'number' ? photo.score : 0
  for (const tok of tokens) if (hay.includes(tok)) score += 12
  if (placeHint && hay.includes(String(placeHint).toLowerCase().slice(0, 10))) score += 6
  if (/wikipedia/i.test(photo.source_label || '')) score += 4
  return score
}

async function resolveStorySidebarPhoto({ title, lat, lon, placeHint, historyId, bodyMarkdown }) {
  await loadHistoricPhotoData()
  const links = photoSearchLinks(title, placeHint, {
    wikipedia_url: extractWikipediaUrl(bodyMarkdown) || wikipediaSearchUrl(title),
  })

  const candidates = []

  const local = photosForPlace({
    lat,
    lon,
    name: title,
    historyId,
    layer: 'history',
  })
  if (local[0]?.image_url) {
    const rawCredit = local[0].source || local[0].collection || 'Historic photo'
    const institution = inferPhotoInstitution(rawCredit) || rawCredit
    candidates.push({
      ...local[0],
      score: 30,
      source_label: institution,
      attribution: [institution, local[0].collection, local[0].year].filter(Boolean).join(' · '),
      credit: institution,
    })
  }

  const wikiFromBody = extractWikipediaUrl(bodyMarkdown)
  const [wikiPhoto, commonsPhoto] = await Promise.all([
    fetchWikipediaThumbnail(wikiFromBody || title),
    fetchCommonsImage(title, placeHint),
  ])
  if (wikiPhoto) candidates.push({ ...wikiPhoto, score: wikiPhoto.score ?? 18 })
  if (commonsPhoto) candidates.push(commonsPhoto)

  candidates.sort((a, b) => topicPhotoScore(b, title, placeHint) - topicPhotoScore(a, title, placeHint))
  const best = candidates[0]
  if (best?.image_url) {
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
    photo.wikipedia_url && `<a href="${escapeHtml(photo.wikipedia_url)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`,
    photo.grokipedia_url && `<a href="${escapeHtml(photo.grokipedia_url)}" target="_blank" rel="noopener noreferrer">Grokipedia</a>`,
    photo.kyhs_url && `<a href="${escapeHtml(photo.kyhs_url)}" target="_blank" rel="noopener noreferrer">KYHS</a>`,
    // Only when the chosen photo is verified from that institution
    photo.loc_url && `<a href="${escapeHtml(photo.loc_url)}" target="_blank" rel="noopener noreferrer">Library of Congress</a>`,
    photo.nara_url && `<a href="${escapeHtml(photo.nara_url)}" target="_blank" rel="noopener noreferrer">National Archives</a>`,
  ].filter(Boolean)
  const linkRow = bits.length
    ? `<nav class="story-sidebar-photo-links" aria-label="Photo sources">${bits.join(
        '<span aria-hidden="true"> · </span>',
      )}</nav>`
    : 

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

function placeDetailExtrasHtml({ lat, lon, name, placeHint, bodyMarkdown, historyId, layer }) {
  const links = extractGrokipediaLinks(bodyMarkdown)
  const photos = photosForPlace({ lat, lon, name, historyId, layer })
  return `${mapsLinksHtml(lat, lon, name, placeHint)}${photosHtml(photos)}${grokipediaHtml(links, name)}`
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
  const desc = p.inscription || p.history || p.description || p.location_text || ''
  const href = p.source_url || p.website || null
  const linkLabel = p.source_url ? 'history.ky.gov' : 'Website'
  const link = href
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
  const extras = placeDetailExtrasHtml({
    lat,
    lon,
    name,
    placeHint: hint || null,
    bodyMarkdown: p.bodyMarkdown || '',
    historyId: p.id || p.historyId || null,
    layer: layerId === 'markers' ? 'marker' : layerId,
  })
  const layerLabel = DATA_LAYERS.find((l) => l.id === layerId)?.label || layerId
  return `
    <div class="map-popup">
      <div class="detail-layer">${escapeHtml(layerLabel)}</div>
      <h3>${escapeHtml(name)}</h3>
      <div class="meta">${escapeHtml(metaBits.filter(Boolean).join(' · '))}</div>
      ${desc ? `<div class="popup-full-text">${escapeHtml(desc)}</div>` : ''}
      ${link}
      ${extras}
    </div>
  `
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
  activePopup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: '480px',
    offset: 14,
    className: 'ky-popup',
  })
    .setLngLat(coords)
    .setHTML(
      detailHtmlFromProps(enrichFeatureProps(layerId, feature.properties || {}), layerId, coords),
    )
    .addTo(targetMap)
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
    const circleRadius =
      def.circleRadius || ['interpolate', ['linear'], ['zoom'], 7, 3.5, 12, 7, 16, 11]
    const hitRadius = def.hitRadius ?? 14
    targetMap.addLayer({
      id: layerCircleId(def.id),
      type: 'circle',
      source: def.id,
      layout: { visibility: vis },
      paint: {
        'circle-radius': circleRadius,
        'circle-color': def.color,
        'circle-stroke-width': def.id === 'markers' ? 0.75 : 1.25,
        'circle-stroke-color': '#101812',
        'circle-opacity': 0.9,
      },
    })
    targetMap.addLayer({
      id: layerHitId(def.id),
      type: 'circle',
      source: def.id,
      layout: { visibility: vis },
      paint: { 'circle-radius': hitRadius, 'circle-opacity': 0 },
    })

    if (def.icon.type === 'img') {
      const imgId = `icon-${def.id}`
      const ok = await loadImage(targetMap, imgId, def.icon.src)
      if (ok) {
        targetMap.addLayer({
          id: layerSymbolId(def.id),
          type: 'symbol',
          source: def.id,
          layout: {
            visibility: vis,
            'icon-image': imgId,
            'icon-size': def.iconSize || [
              'interpolate',
              ['linear'],
              ['zoom'],
              7,
              0.45,
              12,
              0.7,
              16,
              0.95,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
        targetMap.setPaintProperty(
          layerCircleId(def.id),
          'circle-opacity',
          def.id === 'markers' ? 0.85 : 0.35,
        )
        if (!def.circleRadius) {
          targetMap.setPaintProperty(layerCircleId(def.id), 'circle-radius', [
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
    }

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
      // Returning to Map always shows the whole state
      pendingFocus = null
      if (mapReady) {
        ensureHighlightSource(map, null)
        fitMapToKentucky(map, { duration: 0 })
      }
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
    // Home Map always starts on the whole state
    pendingFocus = null
    ensureHighlightSource(map, null)
    fitMapToKentucky(map, { duration: 0 })
  })
}

/* -------------------- Timeline map (filtered layers) -------------------- */
let timelineMap = null
let timelineMapReady = false
const timelineLayerVisibility = Object.fromEntries(
  // Start with every layer off — user picks a year/era filter, then enables layers
  DATA_LAYERS.map((l) => [l.id, false]),
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
    : 'Map: no places in this filter (try widening years or enabling layers)'
  if (meta) {
    const { yearMin, yearMax } = timelineState
    if (!timelineHasActivePlaceFilter()) {
      meta.textContent = 'Pick a year range or era filter first, then turn layers on.'
    } else {
      const range =
        yearMin != null || yearMax != null
          ? `${formatYear(yearMin ?? '…')} – ${formatYear(yearMax ?? '…')}`
          : 'selected eras'
      meta.textContent = `Showing only places in ${range}. Toggle layers above the story list.`
    }
  }
}

async function initTimelineMap() {
  const el = document.getElementById('timelineMapCanvas')
  if (!el) return
  renderTimelineLayerToggles()
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
    fitMapToKentucky(timelineMap, { duration: 0 })
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

  initTimelineMap()
  if (timelineMapReady) {
    ensureHighlightSource(timelineMap, focus)
    flyToFocus(timelineMap, focus, 11)
  } else if (timelineMap) {
    timelineMap.once('load', () => {
      ensureHighlightSource(timelineMap, focus)
      flyToFocus(timelineMap, focus, 11)
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
      const locIdx = await (await fetch('/content/stories-locations.json')).json()
      const loc = locIdx.locations?.[meta.slug]
      if (loc?.historyId) historyId = loc.historyId
      if (meta.lat == null && loc?.lat != null) {
        meta.lat = loc.lat
        meta.lon = loc.lon
        meta.mapConfidence = loc.mapConfidence
        meta.matchedPlace = loc.matchedPlace
      }
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
        history: s.bodyMarkdown ? s.bodyMarkdown.replace(/[#>*_`\[\]()]/g, ' ') : s.summary || '',
        description: s.summary || '',
        bodyMarkdown: s.bodyMarkdown || '',
        county: meta.county || s.county,
        era: s.era,
        yearStart: s.yearStart,
        yearEnd: s.yearEnd,
        matchedPlace: meta.matchedPlace,
        lat: meta.lat,
        lon: meta.lon,
      }
      focusStoryOnMaps({ ...meta, ...highlightDetailProps, slug: meta.slug, title: s.title })
    }
    const tags = (s.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')
    const countyLine = meta.county
      ? `<span class="story-county">${escapeHtml(meta.county)} County</span>`
      : ''
    const extras = placeDetailExtrasHtml({
      lat: meta.lat ?? s.lat,
      lon: meta.lon ?? s.lon,
      name: s.title,
      placeHint: meta.matchedPlace || meta.county,
      bodyMarkdown: s.bodyMarkdown || '',
      historyId,
      layer: 'history',
    })
    const sidebarPhoto = await resolveStorySidebarPhoto({
      title: s.title,
      lat: meta.lat ?? s.lat,
      lon: meta.lon ?? s.lon,
      placeHint: meta.matchedPlace || meta.county,
      historyId,
      bodyMarkdown: s.bodyMarkdown || '',
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
            <p class="story-summary">${escapeHtml(s.summary || meta.summary || '')}</p>
            <div class="tags">${tags}</div>
          </header>
          <div class="story-body">${marked.parse(s.bodyMarkdown || '')}</div>
          ${extras}
          <p class="muted popup-hint">Tip: tap the highlighted pin on the map for the place popup (full text, maps, photos, Grokipedia).</p>
          <p class="story-source muted">Kentucky History Drive</p>
        </div>
        ${storySidebarPhotoHtml(sidebarPhoto, s.title)}
      </div>
    `
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
    await showStoryInReader(pick, { scroll: false })
  } else if (reader && !selectedStorySlug) {
    reader.classList.add('is-empty')
    reader.innerHTML = ''
    const jumpBar = document.getElementById('timelineReaderJump')
    if (jumpBar) jumpBar.hidden = true
  }
}



function resetTimelineFiltersOff() {
  // Year / era → default (no year range, all eras); layers → all off
  timelineState.yearMin = null
  timelineState.yearMax = null
  timelineState.preset = 'all'
  timelineState.eras = new Set(ERAS.map((e) => e.id))

  const yearMin = document.getElementById('yearMin')
  const yearMax = document.getElementById('yearMax')
  if (yearMin) yearMin.value = ''
  if (yearMax) yearMax.value = ''

  document.querySelectorAll('#eraChips .chip').forEach((c) => c.classList.add('active'))
  document.querySelectorAll('#yearPresets .chip').forEach((c) =>
    c.classList.toggle('active', c.dataset.preset === 'all'),
  )

  for (const id of Object.keys(timelineLayerVisibility)) {
    timelineLayerVisibility[id] = false
    if (timelineMap && timelineMapReady) setTimelineLayerVisible(id, false)
  }
  document.querySelectorAll('input[data-timeline-layer]').forEach((input) => {
    input.checked = false
  })

  applyMapFilters()
  updateTimelineMapCounts()
  if (timelineMapReady) {
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
    // Always open Map on the full state (start or navigating back from Timeline/etc.)
    pendingFocus = null
    initMap()
    requestAnimationFrame(() => {
      map?.resize()
      if (!mapReady) return
      setLayerVisible('markers', true)
      const markersToggle = document.querySelector('input[data-layer="markers"]')
      if (markersToggle) markersToggle.checked = true
      syncAllLayersCheckbox()
      ensureHighlightSource(map, null)
      fitMapToKentucky(map, { duration: 0 })
    })
  } else if (view === 'timeline') {
    setupTimelineFilters()
    resetTimelineFiltersOff()
    await initTimelineMap()
    // Fresh visit: bare #timeline (no story slug), clear prior selection
    if (!slug) selectedStorySlug = null
    await renderTimelineList(slug)
    // Always open Timeline at the top (nav + filters), not mid-story scroll
    requestAnimationFrame(() => scrollTimelineToFilters())
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


ensureHomeHash()
applyRoute().catch(console.error)
