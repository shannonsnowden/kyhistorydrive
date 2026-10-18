/**
 * Build your own drive: writes public/drives/byod-stops.json, the only
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
// Caves are blocked by default (show caves included). Named exceptions need Security Watch sign-off,
// with the pin on the visitor center / parking entrance, never a cave opening.
const CAVE_ALLOW = new Set([
  'pilot-knob-snp', // Security Watch OK 2026-10-18: public KNP trailhead on Brush Creek Rd, 37.9121,-83.9450; linked to the protected Finley story for narrative only, not that site
  'diamond-caverns-decorated-limestone', // Security Watch OK 2026-10-12: visitor center on Mammoth Cave Pkwy, 37.1166,-86.0630 (ISCA listing; OSM road frontage)
  'mammoth-cave-np', // Security Watch OK 2026-10-12: NPS visitor center building, 37.1870,-86.1013 (OSM way 856343907)
  'mammoth-cave-saltpeter', 'mammoth-cave-saltpeter-war-of-1812', // same park; re-pinned at the visitor center (source pins sit at the Historic Entrance)
  'hidden-river-cave-under-horse-cave', 'hidden-river-cave-horse-cave-1890-1943', 'american-cave-museum', // Security Watch OK 2026-10-12: museum, 119 E Main St, Horse Cave, 37.1793,-85.9057 (OSM way 463719733)
])
const CAVE_PIN = { 'diamond-caverns-decorated-limestone': [37.1166, -86.063], 'mammoth-cave-np': [37.187, -86.1013], 'mammoth-cave-saltpeter': [37.187, -86.1013], 'mammoth-cave-saltpeter-war-of-1812': [37.187, -86.1013], 'hidden-river-cave-horse-cave-1890-1943': [37.1793, -85.9057], 'hidden-river-cave-under-horse-cave': [37.1793, -85.9057], 'american-cave-museum': [37.1793, -85.9057] } // visitor center, not the story pin
const isCave = (name) => /\bcave(s|rns?)?\b|\bcavern/i.test(name || '') && !/cave hill/i.test(name || '')
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
const unsafeWhy = (ids, pt, name) => {
  if (ids.some((i) => CAVE_ALLOW.has(i)) && !ids.some((i) => prot.has(i))) return null
  if (isCave(name)) return 'cave'
  if (ids.some((i) => prot.has(i))) return 'protected'
  if (ids.some((i) => priv.has(i)) || privPts.some((q) => miles(q, pt) < 0.5)) return 'private'
  if (ids.some((i) => ARCH.has(i))) return 'archaeology'
  if (ids.some((i) => ROUNDED.has(i))) return 'rounded'
  if (ids.some((i) => COUNTY.has(i))) return 'county'
  return null
}
const excluded = { cave: 0, protected: 0, archaeology: 0, rounded: 0, county: 0, private: 0 }
const out = []
const distilleries = []
for (const layer of Object.keys(LAYERS)) {
  for (const f of L(layer)) {
    const p = f.properties
    const [lon, lat] = f.geometry.coordinates
    const ids = [p.id, p.slug].filter(Boolean)
    const why = unsafeWhy(ids, [lon, lat], p.title || p.name) || (dec(lat) < 3 || dec(lon) < 3 ? 'rounded' : null)
    if (why) { excluded[why]++; continue }
    const pin = CAVE_PIN[p.id] || [lat, lon]
    const s = { id: p.id, n: p.title || p.name, k: layer, lat: +pin[0].toFixed(4), lon: +pin[1].toFixed(4), w: WEIGHT[layer] }
    if (layer === 'stories') s.slug = p.slug
    if (p.city) s.c = p.city
    out.push(s)
    if (layer === 'distilleries') distilleries.push([s.n, s.lat, s.lon])
  }
}
// Drop near-duplicates (same place on two layers): keep the higher weight.
out.sort((a, b) => b.w - a.w)
const kept = []
const STOPW = new Set(['state', 'park', 'historic', 'site', 'museum', 'house', 'county', 'kentucky', 'national', 'the', 'and', 'of'])
const toks = (n) => new Set(String(n).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOPW.has(w)))
const samePlace = (a, b) => {
  if (Math.abs(a.lat - b.lat) < 0.002 && Math.abs(a.lon - b.lon) < 0.002) return true
  const d = miles([a.lon, a.lat], [b.lon, b.lat])
  if (d < 3 && a.n.trim().toLowerCase() === b.n.trim().toLowerCase()) return true
  if (d > 1) return false
  const ta = toks(a.n), tb = toks(b.n)
  return [...ta].filter((w) => tb.has(w)).length >= Math.min(2, ta.size, tb.size) && ta.size && tb.size
}
for (const s of out) if (!kept.some((k) => samePlace(k, s))) kept.push(s)
// A story pinned on a physical site is the same stop: fold it into the site (keep the site's name
// and pin, carry the story link and the higher weight). Plus named pairs that are one visit.
const SAME_VISIT = [['churchill-downs', 'kentucky-derby-museum']]
for (const [a, b] of SAME_VISIT) {
  const A = kept.find((k) => k.id === a), B = kept.find((k) => k.id === b)
  if (A && B) { A.w = Math.max(A.w, B.w); kept.splice(kept.indexOf(B), 1) }
}
for (const st of kept.filter((k) => k.k === 'stories')) {
  const stT = toks(st.n + ' ' + st.slug.replace(/-/g, ' '))
  const site = kept.filter((k) => {
    if (k.k === 'stories' || k.slug) return false
    const d = miles([k.lon, k.lat], [st.lon, st.lat])
    return d < 0.2 || (d < 0.3 && [...toks(k.n + ' ' + k.id.replace(/-/g, ' '))].some((w) => stT.has(w)))
  })
    .sort((x, y) => miles([x.lon, x.lat], [st.lon, st.lat]) - miles([y.lon, y.lat], [st.lon, st.lat]))[0]
  if (!site) continue
  site.slug = st.slug
  site.w = Math.max(site.w, st.w)
  kept.splice(kept.indexOf(st), 1)
}

// Self-check (fails closed): re-test every kept stop against the source data with the same predicate.
const bad = []
for (const s of kept) {
  const why = unsafeWhy([s.id, s.slug].filter(Boolean), [s.lon, s.lat], s.n)
  if (why) bad.push(`build-your-own: ${s.id} (${why})`)
}
// Drive pages: a sensitive stop may appear only as a generalized marker
// (archaeological/protected/county: <= 1 decimal and approx:true; private land: <= 2 decimals and private:true, no directions).
const DP = 'public/drives'
for (const slug of fs.readdirSync(DP)) {
  const file = path.join(DP, slug, 'index.html')
  if (!fs.existsSync(file) || slug === 'build') continue
  const m = fs.readFileSync(file, 'utf8').match(/const STOPS = (\[[\s\S]*?\n\])/)
  if (!m) continue
  const stops = new Function(`return ${m[1]}`)()
  // JSON-LD: Place.geo by stop identifier. A sensitive, private or approximate stop may carry no geo
  // finer than 0.1° (build-drive-pages emits none); a public stop's geo must match its STOPS entry.
  const ldGeo = new Map()
  for (const b of fs.readFileSync(file, 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const j = JSON.parse(b[1])
    for (const li of j?.itinerary?.itemListElement || []) if (li.item?.identifier) ldGeo.set(li.item.identifier, li.item.geo || null)
  }
  if (!ldGeo.size) bad.push(`drive page ${slug}: no TouristTrip JSON-LD itinerary`)
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
    const storyWhy = ids.some((i) => CAVE_ALLOW.has(i)) ? null : unsafeWhy(storyIds, [0, 0])
    const why = unsafeWhy(ids, [s.lon, s.lat], s.name) || (s.private ? 'private' : null) || (storyWhy && storyWhy !== 'private' && storyWhy !== 'rounded' ? storyWhy : null)
    const d = Math.max(dec(s.lat), dec(s.lon))
    const g = ldGeo.get(s.id)
    if (!ldGeo.has(s.id)) bad.push(`drive page ${slug}: ${s.id} missing from JSON-LD itinerary`)
    else if (g && (why || s.private || s.approx) && (dec(g.latitude) > 1 || dec(g.longitude) > 1)) bad.push(`drive page ${slug}: ${s.id} (${why || (s.private ? 'private' : 'approx')}) has exact JSON-LD geo ${g.latitude},${g.longitude}`)
    else if (g && !(why || s.private || s.approx) && (g.latitude !== s.lat || g.longitude !== s.lon)) bad.push(`drive page ${slug}: ${s.id} JSON-LD geo does not match the stop`)
    if (!why) continue
    if (why === 'private' ? !(s.private && d <= 2) : !(s.approx && d <= 1)) bad.push(`drive page ${slug}: ${s.id} (${why}) at ${s.lat},${s.lon}`)
  }
}
if (bad.length) { console.error('build-byod-stops: unsafe stops:\n  ' + bad.join('\n  ')); process.exit(1) }
fs.writeFileSync('public/drives/byod-stops.json', JSON.stringify({ schema: 1, kinds: LAYERS, stops: kept, distilleries: distilleries.sort() }))
console.log(`build-byod-stops: ${kept.length} stops; excluded ${JSON.stringify(excluded)}`)
