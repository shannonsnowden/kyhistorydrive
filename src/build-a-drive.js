/**
 * Build your own drive (mockup, /drive-preview/build/).
 *
 * Privacy: everything runs in this browser. The page fetches only static files from this site
 * (byod-stops.json, ky-places.json) plus basemap tiles. A position from navigator.geolocation is
 * requested only when the visitor presses "Use my location"; it lives in a local variable, is
 * never written to storage, a URL, a cookie or a request, and is never put in the maps links.
 *
 * Safety: byod-stops.json is pre-filtered at build time (scripts/build-byod-stops.mjs): no
 * protected/archaeological pins, no rounded pins, no private-land stops.
 */
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

const ROAD_FACTOR = 1.3
const MPH = 40
const DWELL = 10 // minutes at each stop
const MAX_STOPS = { 60: 3, 120: 6 }

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Theme: follows the system; the button toggles for this visit only (nothing stored).
const root = document.documentElement
const q = new URLSearchParams(location.search).get('theme')
const setTheme = (t) => { root.dataset.hpTheme = t; $('themeBtn').setAttribute('aria-pressed', String(t === 'dark')); $('themeBtn').textContent = t === 'dark' ? 'Light mode' : 'Dark mode' }
setTheme(q === 'dark' || q === 'light' ? q : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
$('themeBtn').addEventListener('click', () => setTheme(root.dataset.hpTheme === 'dark' ? 'light' : 'dark'))

function miles(a, b) {
  const R = 3958.8, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const roadMi = (a, b) => miles(a, b) * ROAD_FACTOR
const driveMin = (mi) => (mi / MPH) * 60

function loopCost(start, order) {
  let mi = 0, prev = start
  for (const s of order) { mi += roadMi(prev, s); prev = s }
  mi += roadMi(prev, start)
  return { mi, min: driveMin(mi) + order.length * DWELL }
}

/** Cheapest-insertion loop: add the stop with the best value per added minute while it fits the budget. */
export function planLoop(start, stops, budget) {
  const reach = (budget / 2 / 60) * MPH / ROAD_FACTOR // straight-line miles we could get out and back
  let pool = stops.filter((s) => miles(start, s) <= reach && miles(start, s) > 0.3)
  let order = []
  const max = MAX_STOPS[budget] || 4
  while (order.length < max && pool.length) {
    const base = loopCost(start, order).min
    let best = null
    for (const s of pool) {
      for (let i = 0; i <= order.length; i++) {
        const trial = order.slice(0, i).concat(s, order.slice(i))
        const c = loopCost(start, trial).min
        if (c > budget) continue
        const score = s.w / (c - base + 1)
        if (!best || score > best.score) best = { score, trial, s }
      }
    }
    if (!best) break
    order = best.trial
    pool = pool.filter((p) => p !== best.s && miles(p, best.s) > 0.15)
  }
  return { order, ...loopCost(start, order) }
}

const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min` : `${Math.round(m)} min`)

async function main() {
const data = await fetch('/drive-preview/byod-stops.json').then((r) => r.json())
$('dist').innerHTML = data.distilleries.map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join('')
let places = null
const loadPlaces = async () => {
  if (!places) {
    places = await fetch('/drive-preview/ky-places.json').then((r) => r.json())
    $('townList').innerHTML = places.places.map((p) => `<option value="${esc(p[0])}">`).join('')
  }
  return places
}
$('town').addEventListener('focus', loadPlaces, { once: true })

// Basemap (same keyless CARTO vector style the dev site uses; fixed local credits).
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  center: [-85.3, 37.8],
  zoom: 6.2,
  attributionControl: false,
  cooperativeGestures: matchMedia('(max-width: 860px)').matches,
})
map.on('styledata', () => {
  for (const id of Object.keys(map.getStyle()?.sources || {})) { const s = map.getSource(id); if (s && s.attribution) s.attribution = '' }
})
map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>' }))
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
const mapReady = new Promise((res) => map.on('load', res))
let markers = []

async function draw(start, order) {
  await mapReady
  markers.forEach((m) => m.remove())
  markers = []
  const pin = (cls, text, ll, label) => {
    const el = document.createElement('div')
    el.className = `pin ${cls}`
    el.textContent = text
    el.setAttribute('aria-hidden', 'true')
    el.title = label
    markers.push(new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map))
  }
  const line = [[start.lon, start.lat], ...order.map((s) => [s.lon, s.lat]), [start.lon, start.lat]]
  const gj = { type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} }
  if (map.getSource('loop')) map.getSource('loop').setData(gj)
  else {
    map.addSource('loop', { type: 'geojson', data: gj })
    map.addLayer({ id: 'loop-under', type: 'line', source: 'loop', paint: { 'line-color': '#fffdf6', 'line-width': 6, 'line-opacity': 0.9 } })
    map.addLayer({ id: 'loop', type: 'line', source: 'loop', paint: { 'line-color': '#c9893a', 'line-width': 3.5, 'line-dasharray': [2, 1.5] } })
  }
  pin('start', '★', [start.lon, start.lat], 'Start')
  order.forEach((s, i) => pin('', String(i + 1), [s.lon, s.lat], `${i + 1}. ${s.n}`))
  const b = new maplibregl.LngLatBounds()
  line.forEach((c) => b.extend(c))
  map.fitBounds(b, { padding: 50, maxZoom: 12, duration: 0 })
}

function render(start, budget) {
  const { order, mi, min } = planLoop(start, data.stops, budget)
  if (!order.length) {
    $('status').textContent = `No public history stops fit in about ${budget / 60} hour${budget > 60 ? 's' : ''} of ${start.label}. Try 2 hours or another start.`
    $('stops').innerHTML = ''
    $('facts').innerHTML = ''
    $('dirs').innerHTML = ''
    draw(start, [])
    return
  }
  $('status').textContent = `Suggested loop from ${start.label}: ${order.length} stops, about ${fmt(min)} (estimate).`
  $('facts').innerHTML = `<span><b>${order.length}</b> stops</span><span>About <b>${Math.round(mi)} miles</b> round trip</span><span>About <b>${fmt(min)}</b> with stops (estimate)</span>`
  let prev = start
  const rows = [`<li><span class="num start" aria-hidden="true">★</span><div><p class="stop-name">Start: ${esc(start.label)}</p></div></li>`]
  order.forEach((s, i) => {
    const legMi = roadMi(prev, s)
    prev = s
    const story = s.slug ? `<a href="/stories/${encodeURIComponent(s.slug)}/">Read the story →</a>` : ''
    rows.push(`<li><span class="num" aria-hidden="true">${i + 1}</span>
      <div><p class="stop-name">${i + 1}. ${esc(s.n)}</p><p class="stop-meta"><span class="tag">${esc(data.kinds[s.k])}</span>${s.c ? esc(s.c) + '. ' : ''}About ${Math.round(legMi)} mi, ${Math.round(driveMin(legMi))} min from the ${i ? 'last stop' : 'start'} (estimate)</p></div>
      <div class="links">${story}<a href="${google([s])}" target="_blank" rel="noopener noreferrer" aria-label="Directions to ${esc(s.n)} in Google Maps">Google Maps</a></div></li>`)
  })
  const back = roadMi(prev, start)
  rows.push(`<li><span class="num start" aria-hidden="true">★</span><div><p class="stop-name">Back to ${esc(start.label)}</p><p class="stop-meta">About ${Math.round(back)} mi, ${Math.round(driveMin(back))} min (estimate)</p></div></li>`)
  $('stops').innerHTML = rows.join('')
  // Stops only: the start (possibly the visitor's own position) is never put in a link.
  $('dirs').innerHTML = `<a class="btn" href="${google(order)}" target="_blank" rel="noopener noreferrer">Open stops in Google Maps</a>`
  draw(start, order)
}

function google(list) {
  const ll = (s) => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`
  const way = list.slice(0, -1).map(ll).join('|')
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(ll(list[list.length - 1]))}` + (way ? `&waypoints=${encodeURIComponent(way)}` : '')
}

// Start pickers
const mode = () => document.querySelector('input[name=mode]:checked').value
const budget = () => Number(document.querySelector('input[name=budget]:checked').value)
let here = null // position from "Use my location"; in memory only, gone on reload
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
  $('rowTown').hidden = mode() !== 'town'
  $('rowDist').hidden = mode() !== 'distillery'
  $('rowLoc').hidden = mode() !== 'loc'
}))
$('useLoc').addEventListener('click', () => {
  if (!('geolocation' in navigator)) { $('locState').textContent = 'Location is not available in this browser.'; return }
  $('locState').textContent = 'Asking your browser…'
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      here = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'your location' }
      $('locState').textContent = 'Got it (kept in this page only).'
      render(here, budget())
    },
    () => { $('locState').textContent = 'Location was not shared. Pick a town instead.' },
    { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 },
  )
})

async function townStart() {
  const v = $('town').value.trim()
  if (!v) return null
  const db = await loadPlaces()
  if (/^\d{5}$/.test(v)) { const z = db.zips.find((z) => z[0] === v); return z && { label: `ZIP ${v}`, lat: z[1], lon: z[2] } }
  const n = v.toLowerCase().replace(/,?\s*(ky|kentucky)$/, '').trim()
  const p = db.places.find((p) => p[0].toLowerCase() === n) || db.places.find((p) => p[0].toLowerCase().startsWith(n))
  return p && { label: p[0], lat: p[1], lon: p[2] }
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault()
  let start = null
  if (mode() === 'town') start = await townStart()
  else if (mode() === 'distillery') { const d = data.distilleries[Number($('dist').value)]; start = d && { label: d[0], lat: d[1], lon: d[2] } }
  else start = here
  if (!start) {
    $('status').textContent = mode() === 'loc' ? 'Press “Use my location” first, or pick a town.' : `No Kentucky town or ZIP matched “${$('town').value}”.`
    return
  }
  render(start, budget())
})
document.querySelectorAll('input[name=budget]').forEach((r) => r.addEventListener('change', () => { if (here && mode() === 'loc') render(here, budget()) }))

// Demo default so the page is never empty
const params = new URLSearchParams(location.search)
if (params.get('budget') === '120') document.querySelector('input[name=budget][value="120"]').checked = true
if (params.get('start') === 'distillery') { document.querySelector('input[name=mode][value=distillery]').click(); const i = data.distilleries.findIndex((d) => /buffalo trace/i.test(d[0])); if (i >= 0) $('dist').value = String(i) }
$('form').requestSubmit()
}
main()
