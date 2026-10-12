/**
 * Proves the visitor's start never appears in a Maps link: plans loops from many starts with the
 * real stop list, builds every leg for both apps at phone and desktop caps, and checks that
 * (1) no URL has an origin/source on leg 1, (2) every coordinate in every URL is a stop's,
 * (3) the start's coordinates (any precision down to 2 decimals) appear in no URL, (4) caps hold.
 */
import fs from 'node:fs'
import { legSize, buildLegs } from '../src/drive-links.js'

const data = JSON.parse(fs.readFileSync('public/drive-preview/byod-stops.json', 'utf8'))
const stopSet = new Set(data.stops.map((s) => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`))
const fail = (m) => { console.error('test-drive-links:', m); process.exit(1) }
const miles = (a, b) => { const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 7917.6 * Math.asin(Math.sqrt(h)) }
let urls = 0
for (let t = 0; t < 200; t++) {
  const start = { lat: 36.6 + Math.random() * 2.4, lon: -89.3 + Math.random() * 7.4 }
  const order = data.stops.filter((s) => miles(start, s) < 120).sort((a, b) => miles(start, a) - miles(start, b)).slice(0, 30)
  if (!order.length) continue
  for (const app of ['google', 'apple']) for (const phone of [true, false]) {
    const n = legSize(app, phone)
    const legs = buildLegs(order, n, app)
    legs.forEach((l, k) => {
      const u = new URL(l.url); urls++
      const p = u.searchParams
      const origin = p.get('origin') || p.get('source') || p.get('saddr')
      if (k === 0 && origin) fail(`leg 1 carries an origin: ${l.url}`)
      if (k > 0 && origin !== `${order[k * n - 1].lat.toFixed(4)},${order[k * n - 1].lon.toFixed(4)}`) fail(`leg ${k + 1} does not start at the previous leg's last stop`)
      const coords = [...decodeURIComponent(l.url).matchAll(/-?\d+\.\d+,-?\d+\.\d+/g)].map((m) => m[0])
      for (const c of coords) if (!stopSet.has(c)) fail(`non-stop coordinate ${c} in ${l.url}`)
      const newStops = coords.length - (k > 0 ? 1 : 0)
      if (newStops > n) fail(`leg has ${newStops} stops, cap ${n}`)
      for (const d of [4, 3, 2]) { const sc = `${start.lat.toFixed(d)},${start.lon.toFixed(d)}`; if (decodeURIComponent(l.url).includes(sc)) fail(`start ${sc} leaked into ${l.url}`) }
    })
  }
}
console.log(`test-drive-links: ${urls} leg URLs checked; no origin on leg 1, only stop coordinates, caps hold`)
