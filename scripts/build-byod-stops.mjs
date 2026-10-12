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
// One predicate for the filter AND the self-check (fail closed).
const ARCH = new Set(), COUNTY = new Set(), ROUNDED = new Set()
for (const f of L('stories')) {
  const p = f.properties, [lon, lat] = f.geometry.coordinates
  if (p.era === 'prehistoric') { ARCH.add(p.id); ARCH.add(p.slug) }
  if (p.mapConfidence === 'county') { COUNTY.add(p.id); COUNTY.add(p.slug) }
}
for (const f of L('history')) if (f.properties.category === 'archaeology') ARCH.add(f.properties.id)
for (const layer of Object.keys(LAYERS)) for (const f of L(layer)) {
  const [lon, lat] = f.geometry.coordinates
  if (dec(lat) < 3 || dec(lon) < 3) { ROUNDED.add(f.properties.id); if (f.properties.slug) ROUNDED.add(f.properties.slug) }
}
const unsafeWhy = (ids, pt) => {
  if (ids.some((i) => prot.has(i))) return 'protected'
  if (ids.some((i) => priv.has(i)) || privPts.some((q) => miles(q, pt) < 0.5)) return 'private'
  if (ids.some((i) => ARCH.has(i))) return 'archaeology'
  if (ids.some((i) => ROUNDED.has(i))) return 'rounded'
  if (ids.some((i) => COUNTY.has(i))) return 'county'
  return null
}
const excluded = { protected: 0, archaeology: 0, rounded: 0, county: 0, private: 0 }
const out = []
const distilleries = []
for (const layer of Object.keys(LAYERS)) {
  for (const f of L(layer)) {
    const p = f.properties
    const [lon, lat] = f.geometry.coordinates
    const ids = [p.id, p.slug].filter(Boolean)
    const why = unsafeWhy(ids, [lon, lat]) || (dec(lat) < 3 || dec(lon) < 3 ? 'rounded' : null)
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

// Self-check (fails closed): re-test every kept stop against the source data with the same predicate.
const bad = []
for (const s of kept) {
  const why = unsafeWhy([s.id, s.slug].filter(Boolean), [s.lon, s.lat])
  if (why) bad.push(`build-your-own: ${s.id} (${why})`)
}
// Staged drive pages: a sensitive stop may appear only as a generalized marker
// (archaeological/protected/county: <= 1 decimal and approx:true; private land: <= 2 decimals and private:true, no directions).
const DP = 'public/drive-preview'
for (const slug of fs.readdirSync(DP)) {
  const file = path.join(DP, slug, 'index.html')
  if (!fs.existsSync(file) || slug === 'build') continue
  const m = fs.readFileSync(file, 'utf8').match(/const STOPS = (\[[\s\S]*?\n\])/)
  if (!m) continue
  const stops = new Function(`return ${m[1]}`)()
  // Raw literals, so precision is judged as written (38.5500 counts as 4 decimals).
  const raw = new Map([...m[1].matchAll(/id:"([^"]+)", name:"[^"]*", lat:(-?[\d.]+), lon:(-?[\d.]+)/g)].map((x) => [x[1], [x[2], x[3]]]))
  for (const s of stops) {
    const [rl, rn] = raw.get(s.id) || [String(s.lat), String(s.lon)]
    const rd = Math.min(dec(rl), dec(rn)), rx = Math.max(dec(rl), dec(rn))
    if (!s.private && !s.approx && (rd < 3 || rx > 4)) bad.push(`drive page ${slug}: ${s.id} public stop must have 3-4 decimals, has ${rl},${rn}`)
    const ids = [s.id, ...String(s.onMap || '').split(';').map((x) => x.trim().split(':')[1]?.split(' ')[0]).filter(Boolean)]
    // Linked story slugs count for protected/archaeology/county (a stop told through an archaeological
    // story is that site), but not for private land (a distillery may link a story set on a nearby farm).
    const storyIds = (s.stories || []).map((x) => x[0])
    const storyWhy = unsafeWhy(storyIds, [0, 0])
    const why = unsafeWhy(ids, [s.lon, s.lat]) || (s.private ? 'private' : null) || (storyWhy && storyWhy !== 'private' && storyWhy !== 'rounded' ? storyWhy : null)
    const d = Math.max(dec(s.lat), dec(s.lon))
    if (!why) continue
    if (why === 'private' ? !(s.private && d <= 2) : !(s.approx && d <= 1)) bad.push(`drive page ${slug}: ${s.id} (${why}) at ${s.lat},${s.lon}`)
  }
}
if (bad.length) { console.error('build-byod-stops: unsafe stops:\n  ' + bad.join('\n  ')); process.exit(1) }
fs.writeFileSync('public/drive-preview/byod-stops.json', JSON.stringify({ schema: 1, kinds: LAYERS, stops: kept, distilleries: distilleries.sort() }))
console.log(`build-byod-stops: ${kept.length} stops; excluded ${JSON.stringify(excluded)}`)
