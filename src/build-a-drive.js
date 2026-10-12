/**
 * Build your own drive (/drives/build/).
 *
 * Privacy: everything runs in this browser. The page fetches only static files from this site
 * (byod-stops.json, ky-places.json) plus basemap tiles. navigator.geolocation runs only when the
 * visitor presses "Use my location"; the position lives in a local variable and is never written to
 * storage, a URL, a cookie or a request. Maps links (buildLegs/googleUrl/appleUrl) are built from
 * STOP coordinates only: the visitor's start (typed place or position) is never passed to them.
 *
 * Safety: byod-stops.json is pre-filtered and self-checked at build time (scripts/build-byod-stops.mjs).
 */
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(maplibreWorkerUrl)
import THEME_ICONS from '../scripts/drive-theme-icons.json'
// Mockup: existing layer icon for each stop kind (no new icons).
const kindIcon = (k) => {
  const v = THEME_ICONS.stopKinds[k]
  if (!v) return ''
  return v.startsWith('/') ? `<img class="kicon" src="${v}" alt="" width="16" height="16">` : `<span class="kicon" aria-hidden="true">${v}</span>`
}
import { legSize, googleUrl, appleUrl, buildLegs } from './drive-links.js'

const ROAD_FACTOR = 1.3
const MPH = 40
// Longer trips mean longer visits: dwell per stop scales with the time budget, and a full day
// reserves a 45-minute meal break. Caps keep a day realistic (~12 stops) rather than a checklist.
const DWELL_BY = { 60: 10, 120: 15, 240: 20, 480: 25 }
const BREAK_BY = { 60: 0, 120: 0, 240: 0, 480: 45 }
const MAX_STOPS = { 60: 3, 120: 5, 240: 7, 480: 12 }
// Stops closer than this are one visit (you'd walk, not drive): never suggest two of them.
const SAME_VISIT_MI = 0.4
let DWELL = 10
const BUDGET_LABEL = { 60: 'about 1 hour', 120: 'about 2 hours', 240: 'a half day (~4 hrs)', 480: 'a full day (~8 hrs)' }

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const root = document.documentElement
const UA = navigator.userAgent
const IS_APPLE = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1)
const PHONE_MQ = matchMedia('(max-width: 860px)')
const isPhone = () => PHONE_MQ.matches || /Mobi|Android|iPhone/.test(UA)
// Waypoint caps: Google allows 3 waypoints + destination in phone browsers, 9 + destination elsewhere.
// Apple's multistop limit is undocumented, so Apple uses 4 stops per leg until it is device-tested.

// ---------- theme (this visit only; nothing stored) ----------
const styleFor = (t) => `https://basemaps.cartocdn.com/gl/${t === 'dark' ? 'dark-matter' : 'voyager'}-gl-style/style.json`
const hashParams = new URLSearchParams(location.hash.slice(1))
const qTheme = new URLSearchParams(location.search).get('theme') || hashParams.get('theme')
function setTheme(t) {
  root.dataset.hpTheme = t
  $('themeBtn').setAttribute('aria-pressed', String(t === 'dark'))
  $('themeBtn').setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
  $('themeBtn').firstElementChild.textContent = t === 'dark' ? '☀' : '☾'
}
setTheme(qTheme === 'dark' || qTheme === 'light' ? qTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

// ---------- geometry / planning ----------
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
/** Cheapest insertion: add the stop with the best value per added minute while the loop fits the budget. */
export function planLoop(start, stops, budget) {
  DWELL = DWELL_BY[budget] || 10
  const usable = budget - (BREAK_BY[budget] || 0)
  const reach = ((budget / 2 / 60) * MPH) / ROAD_FACTOR
  let pool = stops.filter((s) => { const d = miles(start, s); return d <= reach && d > 0.3 })
  let order = []
  let cur = 0 // current loop minutes (drive + dwell)
  const max = MAX_STOPS[budget] || 4
  while (order.length < max && pool.length) {
    const pts = [start, ...order, start]
    let best = null
    for (const s of pool) {
      for (let i = 0; i < pts.length - 1; i++) {
        const add = driveMin(roadMi(pts[i], s) + roadMi(s, pts[i + 1]) - roadMi(pts[i], pts[i + 1])) + DWELL
        if (cur + add > usable) continue
        const score = s.w / (add + 1)
        if (!best || score > best.score) best = { score, s, i, add }
      }
    }
    if (!best) break
    order.splice(best.i, 0, best.s)
    cur += best.add
    pool = pool.filter((p) => p !== best.s && miles(p, best.s) > SAME_VISIT_MI)
  }
  order = twoOpt(start, order)
  const c = loopCost(start, order)
  return { order, mi: c.mi, min: c.min + (order.length ? BREAK_BY[budget] || 0 : 0) }
}
/** 2-opt on the closed loop start → stops → start: reverse segments while that shortens it, so the loop doesn't cross itself. */
export function twoOpt(start, order) {
  const r = [start, ...order, start]
  const d = (a, b) => miles(a, b)
  let improved = true, guard = 0
  while (improved && guard++ < 200) {
    improved = false
    for (let i = 1; i < r.length - 2; i++) {
      for (let k = i + 1; k < r.length - 1; k++) {
        const delta = d(r[i - 1], r[k]) + d(r[i], r[k + 1]) - d(r[i - 1], r[i]) - d(r[k], r[k + 1])
        if (delta < -1e-9) { const seg = r.slice(i, k + 1).reverse(); r.splice(i, seg.length, ...seg); improved = true }
      }
    }
  }
  return r.slice(1, -1)
}
const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min` : `${Math.max(1, Math.round(m))} min`)
const legText = (mi) => (mi < 0.5 ? 'Under half a mile, about 1 min' : `About ${mi < 1.5 ? 1 : Math.round(mi)} mi, ${fmt(driveMin(mi))}`)

const stopUrl = (s) => (IS_APPLE ? appleUrl(null, [s]) : googleUrl(null, [s]))

async function main() {
  const data = await fetch('/drives/byod-stops.json').then((r) => r.json())
  let places = null
  const loadPlaces = async () => {
    if (!places) {
      places = await fetch('/drives/ky-places.json').then((r) => r.json())
      $('qList').innerHTML = data.distilleries.map(([n]) => `<option value="${esc(n)}">`).join('') + places.places.map((p) => `<option value="${esc(p[0])}">`).join('')
    }
    return places
  }
  $('q').addEventListener('focus', loadPlaces, { once: true })

  // ---------- map ----------
  const mapCard = $('mapCard')
  const placeMap = () => { if (PHONE_MQ.matches) $('miniSlot').append(mapCard); else $('layout').append(mapCard) }
  placeMap()
  const map = new maplibregl.Map({ container: 'map', style: styleFor(root.dataset.hpTheme), center: [-85.3, 37.8], zoom: 6, attributionControl: false, cooperativeGestures: PHONE_MQ.matches })
  map.on('styledata', () => { for (const id of Object.keys(map.getStyle()?.sources || {})) { const s = map.getSource(id); if (s && s.attribution) s.attribution = '' } })
  map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>' }))
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  PHONE_MQ.addEventListener('change', () => { placeMap(); map.resize() })
  let ready = new Promise((res) => map.once('load', res))
  let markers = []
  let last = null
  const dotsData = { type: 'FeatureCollection', features: data.stops.map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: {} })) }
  function addLayers() {
    map.addSource('dots', { type: 'geojson', data: dotsData })
    map.addLayer({ id: 'dots', type: 'circle', source: 'dots', paint: { 'circle-radius': 2.5, 'circle-color': '#7fae7a', 'circle-opacity': 0.55 } })
    map.addSource('loop', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'loop', type: 'line', source: 'loop', paint: { 'line-color': '#c9893a', 'line-width': 3.5, 'line-dasharray': [2, 1.5] } })
  }
  ready = ready.then(addLayers)
  $('themeBtn').addEventListener('click', () => {
    setTheme(root.dataset.hpTheme === 'dark' ? 'light' : 'dark')
    map.setStyle(styleFor(root.dataset.hpTheme))
    map.once('style.load', () => { addLayers(); if (last) draw(...last) })
  })

  async function draw(start, order) {
    last = [start, order]
    await ready
    markers.forEach((m) => m.remove())
    markers = []
    map.setLayoutProperty('dots', 'visibility', order.length ? 'none' : 'visible')
    const line = order.length ? [[start.lon, start.lat], ...order.map((s) => [s.lon, s.lat]), [start.lon, start.lat]] : []
    map.getSource('loop').setData({ type: 'FeatureCollection', features: line.length ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} }] : [] })
    if (!order.length) return
    // Spread pins that sit on top of each other (and of the start) so every number is visible.
    const placed = []
    const offsetFor = (pt) => {
      const c = placed.filter((q) => miles(q, pt) < 0.25).length
      placed.push(pt)
      return c ? [16 * c, -16 * c] : [0, 0]
    }
    const el = document.createElement('div')
    el.className = 'pin start'; el.textContent = '★'; el.setAttribute('aria-hidden', 'true')
    const near = order.some((s) => miles(s, start) < 0.25)
    placed.push(start)
    markers.push(new maplibregl.Marker({ element: el, offset: near ? [-20, 18] : [0, 0] }).setLngLat([start.lon, start.lat]).addTo(map))
    order.forEach((s, i) => {
      const m = document.createElement('div')
      m.className = 'pin'; m.textContent = String(i + 1); m.title = `${i + 1}. ${s.n}`; m.dataset.i = String(i)
      m.setAttribute('aria-hidden', 'true')
      m.addEventListener('click', () => { const row = document.querySelector(`#stops li[data-i="${i}"]`); if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); hl(i) } })
      markers.push(new maplibregl.Marker({ element: m, offset: offsetFor(s) }).setLngLat([s.lon, s.lat]).addTo(map))
    })
    const b = new maplibregl.LngLatBounds()
    line.forEach((c) => b.extend(c))
    map.fitBounds(b, { padding: PHONE_MQ.matches ? 24 : 50, maxZoom: 12, duration: 0 })
  }
  function hl(i) {
    document.querySelectorAll('#stops li.on, .pin.on').forEach((e) => e.classList.remove('on'))
    if (i == null) return
    document.querySelector(`#stops li[data-i="${i}"]`)?.classList.add('on')
    document.querySelector(`.pin[data-i="${i}"]`)?.classList.add('on')
  }

  // ---------- states ----------
  const say = (html) => { $('qMsg').innerHTML = html }
  function pre() {
    $('status').textContent = ''
    $('facts').innerHTML = ''
    $('stops').innerHTML = '<p class="note">Enter a town, ZIP or distillery, or use your location, to see nearby history stops. The faint dots on the map are every stop we can suggest.</p>'
    $('stickyBar').hidden = true
    document.body.classList.remove('has-bar')
    draw(null, [])
  }
  const budget = () => Number(document.querySelector('input[name=budget]:checked').value)
  const nextBudget = (b) => ({ 60: 120, 120: 240, 240: 480 })[b]

  function render(start, b) {
    say('')
    const { order, mi, min } = planLoop(start, data.stops, b)
    if (!order.length) {
      const nb = nextBudget(b)
      $('status').innerHTML = `No stops fit in ${BUDGET_LABEL[b]} from ${esc(start.label)}.` + (nb ? ` <button type="button" id="tryMore">Try ${esc(BUDGET_LABEL[nb])}</button>` : '')
      $('tryMore')?.addEventListener('click', () => { document.querySelector(`input[name=budget][value="${nb}"]`).checked = true; render(start, nb) })
      $('facts').innerHTML = ''
      $('stops').innerHTML = ''
      $('stickyBar').hidden = true
      draw(null, [])
      return
    }
    $('status').textContent = `${order.length} stops from ${start.label}: about ${fmt(min)} with stops (estimate).`
    $('facts').innerHTML = `<span>About <b>${Math.round(mi)} miles</b> round trip</span><span><b>${fmt(min)}</b> with stops${BREAK_BY[b] ? ' and a meal break' : ''}</span>`
    // One leg split for the list and both apps: 4 stops per leg (Apple's untested cap; within Google's
    // phone cap). Leg k>1 starts at leg k-1's last stop. Links carry stops only, never the start.
    const n = legSize()
    const apps = IS_APPLE ? ['apple', 'google'] : ['google', 'apple']
    const name = { apple: 'Apple Maps', google: 'Google Maps' }
    const links = { google: buildLegs(order, n, 'google'), apple: buildLegs(order, n, 'apple') }
    const N = links.google.length
    let prev = start
    let html = ''
    legsInfo = []
    for (let k = 0; k < N; k++) {
      const stops = order.slice(k * n, k * n + n)
      let legMi = 0, p = prev
      for (const s of stops) { legMi += roadMi(p, s); p = s }
      const legMin = driveMin(legMi) + stops.length * DWELL
      const first = k * n + 1, lastNo = k * n + stops.length
      const btns = apps.map((a) => `<a class="btn btn-maps" href="${links[a][k].url}" target="_blank" rel="noopener noreferrer" aria-label="Open leg ${k + 1} in ${name[a]}">${name[a]}</a>`).join('')
      legsInfo.push(apps.map((a) => links[a][k].url))
      const rows = stops.map((s, j) => {
        const i = k * n + j
        const d = roadMi(prev, s); prev = s
        const story = s.slug ? `<a href="/stories/${encodeURIComponent(s.slug)}/">Read the story</a>` : ''
        return `<li data-i="${i}" tabindex="-1"><span class="num" aria-hidden="true">${i + 1}</span>
          <div><p class="stop-name"><span class="vh">Stop ${i + 1}: </span>${esc(s.n)}</p>
          <p class="stop-meta"><span class="tag">${kindIcon(s.k)}${esc(data.kinds[s.k])}</span>${s.c ? esc(s.c) + ' · ' : ''}${legText(d)} from the ${i ? 'last stop' : 'start'}</p></div>
          <div class="row-links">${story}<a href="${stopUrl(s)}" target="_blank" rel="noopener noreferrer" aria-label="Directions to ${esc(s.n)}">Directions</a></div></li>`
      }).join('')
      const label = N > 1 ? `Leg ${k + 1} · ${first === lastNo ? `stop ${first}` : `stops ${first}–${lastNo}`} · about ${fmt(legMin)}` : `Stops 1–${lastNo} · about ${fmt(legMin)}`
      const sub = k ? `<span class="leg-sub">Starts at stop ${first - 1}</span>` : ''
      html += `<details class="legbox" data-k="${k}"${k === 0 ? ' open' : ''}><summary class="leg-head"><span class="leg-label">${label}${sub}</span><span class="leg-btns">${btns}</span></summary><ol class="stops">${rows}</ol></details>`
    }
    html += `<ol class="stops"><li><span class="num end" aria-hidden="true">↩</span><div><p class="stop-name">Back to ${esc(start.label)}</p><p class="stop-meta">${legText(roadMi(prev, start))}</p></div></li></ol>`
    html += `<details class="how legs-how"><summary>How legs work</summary><p>Your maps app starts from wherever you are; we never send it your starting point.${N > 1 ? ' Each leg after the first starts at the last stop of the leg before.' : ''} Legs are 4 stops so Apple Maps and Google Maps open the same stops.</p></details>`
    $('stops').innerHTML = html
    // Buttons inside <summary> must not toggle the leg.
    document.querySelectorAll('.leg-btns a').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()))
    document.querySelectorAll('#stops li[data-i]').forEach((li) => {
      const i = Number(li.dataset.i)
      li.addEventListener('mouseenter', () => hl(i)); li.addEventListener('focusin', () => hl(i))
    })
    // Phone sticky bar follows the leg in view.
    const setBar = (k) => {
      $('stickyBar').innerHTML = `<p class="bar-label">${N > 1 ? `Leg ${k + 1} of ${N}` : 'Your drive'}</p><div class="pair">${apps.map((a, j) => `<a class="btn btn-maps" href="${legsInfo[k][j]}" target="_blank" rel="noopener noreferrer" aria-label="Open ${N > 1 ? `leg ${k + 1} ` : ''}in ${name[a]}">${name[a]}</a>`).join('')}</div>`
    }
    setBar(0)
    io?.disconnect()
    io = new IntersectionObserver((ents) => {
      const vis = ents.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0]
      if (vis) setBar(Number(vis.target.dataset.k))
    }, { rootMargin: '-30% 0px -50% 0px' })
    document.querySelectorAll('.legbox').forEach((d) => io.observe(d))
    $('stickyBar').hidden = false
    document.body.classList.add('has-bar')
    draw(start, order)
  }
  let legsInfo = []
  let io = null

  // ---------- inputs ----------
  let here = null // in memory only
  $('useLoc').addEventListener('click', () => {
    if (!('geolocation' in navigator)) { say('Location isn’t available in this browser. Type a town or ZIP instead.'); $('q').focus(); return }
    say('Asking your browser for your location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => { here = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'your location' }; $('q').value = ''; render(here, budget()) },
      () => { say('Couldn’t get your location. Type a town or ZIP instead.'); $('q').focus() },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 },
    )
  })
  async function resolve(v) {
    const db = await loadPlaces()
    if (/^\d{5}$/.test(v)) { const z = db.zips.find((z) => z[0] === v); return z ? { label: `ZIP ${v}`, lat: z[1], lon: z[2] } : null }
    const n = v.toLowerCase().replace(/,?\s*(ky|kentucky)$/, '').trim()
    const d = data.distilleries.find((d) => d[0].toLowerCase() === n) || (n.length > 3 && data.distilleries.find((d) => d[0].toLowerCase().includes(n)))
    if (d && (d[0].toLowerCase() === n || /distill|trace|turkey|roses|beam|mark|forester|reserve|hill|key|barton/.test(n))) return { label: d[0], lat: d[1], lon: d[2] }
    const p = db.places.find((p) => p[0].toLowerCase() === n) || db.places.find((p) => p[0].toLowerCase().startsWith(n))
    if (p) return { label: p[0], lat: p[1], lon: p[2] }
    if (d) return { label: d[0], lat: d[1], lon: d[2] }
    return null
  }
  async function suggest(v) {
    const db = await loadPlaces()
    const n = v.toLowerCase().slice(0, 2)
    const hits = [...data.distilleries.map((d) => d[0]), ...db.places.map((p) => p[0])].filter((x) => x.toLowerCase().startsWith(n)).slice(0, 5)
    say(`We couldn’t find “${esc(v)}” in Kentucky.` + (hits.length ? ` Did you mean: ${hits.map((h) => `<button type="button" class="sugg">${esc(h)}</button>`).join('')}` : ' Try a town name or a 5-digit ZIP.'))
    document.querySelectorAll('.sugg').forEach((b) => b.addEventListener('click', () => { $('q').value = b.textContent; $('form').requestSubmit() }))
  }
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const v = $('q').value.trim()
    if (!v) {
      if (here) return render(here, budget())
      say('Type a town, ZIP or distillery, or press “Use my location”.'); $('q').focus(); return
    }
    here = null
    const start = await resolve(v)
    if (!start) { pre(); return suggest(v) }
    render(start, budget())
  })
  document.querySelectorAll('input[name=budget]').forEach((r) => r.addEventListener('change', () => { if ($('stops').querySelector('li[data-i]')) $('form').requestSubmit() }))

  // QA/deep link via the URL fragment only (never sent to a server): #q=Bardstown&t=480
  const hq = hashParams.get('q'), ht = hashParams.get('t')
  if (ht && MAX_STOPS[ht]) document.querySelector(`input[name=budget][value="${ht}"]`).checked = true
  pre()
  if (hq) { $('q').value = hq; $('form').requestSubmit() }
}
main()
