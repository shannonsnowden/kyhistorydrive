/**
 * Build your own drive (mockup): writes public/drive-preview/byod-stops.json, the only
 * stop list the page loads. Unsafe stops are dropped HERE, so their coordinates never
 * ship to the page at all:
 *   - any id/slug in public/data/web/protected-pins.json (looting-sensitive, rounded)
 *   - story era "prehistoric", History category "archaeology"
 *   - any point stored with < 3 decimals in either axis (rounded / generalized pins)
 *   - story mapConfidence "county" (county-level placement, not a real stop)
 *   - private-land stops in scripts/drive-private-land.json, and any stop within 0.5 mi of one
 *   - whole layers: caves, cemeteries, locals (not offered as drive stops)
 * The script then re-checks its own output and exits 1 if anything slipped through.
 */
import fs from 'node:fs'
import path from 'node:path'

const L = (f) => JSON.parse(fs.readFileSync(path.resolve('public/data/layers', f + '.geojson'), 'utf8')).features
const prot = new Set(JSON.parse(fs.readFileSync('public/data/web/protected-pins.json', 'utf8')).ids || [])
const priv = new Set(JSON.parse(fs.readFileSync('scripts/drive-private-land.json', 'utf8')).ids)
const dec = (n) => { const s = String(n); return s.includes('.') ? s.split('.')[1].length : 0 }
const LAYERS = { stories: 'Story', history: 'History', war: 'War site', national: 'National site', parks: 'State park', museums: 'Museum', bridges: 'Covered bridge', distilleries: 'Distillery' }
const WEIGHT = { stories: 3, history: 2, war: 2, national: 2, bridges: 2, parks: 1, museums: 1, distilleries: 1 }

const miles = (a, b) => { const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(h)) }
const privPts = []
for (const layer of ['stories', 'history', 'war']) for (const f of L(layer)) if ([f.properties.id, f.properties.slug].some((i) => priv.has(i))) privPts.push(f.geometry.coordinates)
const excluded = { protected: 0, archaeology: 0, rounded: 0, county: 0, private: 0 }
const out = []
const distilleries = []
for (const layer of Object.keys(LAYERS)) {
  for (const f of L(layer)) {
    const p = f.properties
    const [lon, lat] = f.geometry.coordinates
    const ids = [p.id, p.slug].filter(Boolean)
    let why = null
    if (ids.some((i) => prot.has(i))) why = 'protected'
    else if (ids.some((i) => priv.has(i))) why = 'private'
    else if (privPts.some((q) => miles(q, [lon, lat]) < 0.5)) why = 'private'
    else if ((layer === 'stories' && p.era === 'prehistoric') || (layer === 'history' && p.category === 'archaeology')) why = 'archaeology'
    else if (dec(lat) < 3 || dec(lon) < 3) why = 'rounded'
    else if (p.mapConfidence === 'county') why = 'county'
    if (why) { excluded[why]++; continue }
    const s = { id: p.id, n: p.title || p.name, k: layer, lat: +lat.toFixed(4), lon: +lon.toFixed(4), w: WEIGHT[layer] }
    if (layer === 'stories') s.slug = p.slug
    if (p.city) s.c = p.city
    out.push(s)
    if (layer === 'distilleries') distilleries.push([s.n, s.lat, s.lon])
  }
}
// Drop near-duplicates (same place on two layers): keep the higher weight.
out.sort((a, b) => b.w - a.w)
const kept = []
for (const s of out) if (!kept.some((k) => Math.abs(k.lat - s.lat) < 0.002 && Math.abs(k.lon - s.lon) < 0.002)) kept.push(s)

// Self-check
for (const s of kept) {
  if (privPts.some((q) => miles(q, [s.lon, s.lat]) < 0.5) || prot.has(s.id) || prot.has(s.slug) || priv.has(s.id) || priv.has(s.slug)) { console.error('build-byod-stops: unsafe stop leaked', s.id); process.exit(1) }
}
fs.writeFileSync('public/drive-preview/byod-stops.json', JSON.stringify({ schema: 1, kinds: LAYERS, stops: kept, distilleries: distilleries.sort() }))
console.log(`build-byod-stops: ${kept.length} stops; excluded ${JSON.stringify(excluded)}`)
