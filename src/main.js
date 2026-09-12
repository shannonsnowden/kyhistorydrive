import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

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

// Bagdad, KY
const CENTER = [-85.058, 38.258]
const START_ZOOM = 9

const map = new maplibregl.Map({
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

  // larger hit target
  map.addLayer({
    id: 'markers-hit',
    type: 'circle',
    source: 'markers',
    paint: {
      'circle-radius': 14,
      'circle-opacity': 0,
    },
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
})
