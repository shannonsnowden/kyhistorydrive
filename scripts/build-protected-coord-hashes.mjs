#!/usr/bin/env node
/**
 * Regenerates scripts/protected-coords.hashes.json (schema 3) from the CURRENT protected set:
 * for every id in public/data/web/protected-pins.json, its newest exact pre-rounding (≥3-decimal) pin in git history
 * (stories/history layers, ky-history.json, stories-locations.json, markers.geojson), i.e. the value
 * that was live when it was rounded. Older, retired pins (e.g. a site later re-pinned) are NOT listed,
 * so they cannot false-match public places. 2-decimal values are tier-B generalizations, not site points, and are
 * skipped. A candidate within PUBLIC_ANCHOR_M of a public place (any non-protected KHS marker ever in markers.geojson,
 * or a park / cave / museum / county-centre point in the other public layers or county-centroids.json) was a marker, park-centre or
 * visitor-area geocode, not the site (KY History, 2026-10-18), and is skipped too; the next older clean value is used,
 * else the id is guarded by id only (checks 1-2). Optionally merge authoritative extra points from a local,
 * never-committed file: EXTRA_POINTS_FILE=/path.json  ({ "<id>": [lat, lon], ... }).
 * Only keyed hashes are written; no coordinate is printed or stored.
 *   PROTECTED_COORDS_KEY=... node scripts/build-protected-coord-hashes.mjs
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { buildProximityFile, metres, extractPairs } from './lib/coord-pairs.mjs'

const KEY = process.env.PROTECTED_COORDS_KEY
if (!KEY) { console.error('build-protected-coord-hashes: set PROTECTED_COORDS_KEY (same value as the Amplify secret)'); process.exit(1) }
const FILES = ['public/data/layers/stories.geojson', 'public/data/layers/history.geojson', 'public/data/app/ky-history.json', 'public/content/stories-locations.json', 'public/data/markers.geojson']
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] })
const show = (rev, f) => { try { return git('show', `${rev}:${f}`) } catch { return '' } }
const dec = (v) => (String(v).split('.')[1] || '').length
const ids = new Set(JSON.parse(fs.readFileSync('public/data/web/protected-pins.json', 'utf8')).ids)
// Ids whose newest pre-rounding pin was a town-centre geocode, not the site (Peter Village: downtown
// Lexington, which false-matched public markers and museums). Their authoritative point comes from KY History
// via EXTRA_POINTS_FILE; until then they are listed by id only (checks 1-2 still guard them).
const PLACEHOLDER_IDS = new Set(['peter-village-early-woodland-enclosure-near-lexington', 'peter-village-enclosure-15fa166', 'peter-village-enclosure-15fa166-fayette-county'])
const PUBLIC_ANCHOR_M = 300
const anchors = []
const addAnchors = (fc) => { for (const x of fc?.features || []) { const p = x.properties || {}; const g = x.geometry?.coordinates
  if (!Array.isArray(g) || typeof g[0] !== 'number') continue
  const pid = p.id || (p.marker_number != null ? `marker:${p.marker_number}` : '')
  if (pid && !ids.has(pid) && !PLACEHOLDER_IDS.has(pid)) anchors.push([g[1], g[0]]) } }
for (const rev of git('log', '--format=%H', '--', 'public/data/markers.geojson').split('\n').filter(Boolean)) { try { addAnchors(JSON.parse(show(rev, 'public/data/markers.geojson'))) } catch {} }
for (const l of fs.readdirSync('public/data/layers')) if (!/^(stories|history)\./.test(l)) { try { addAnchors(JSON.parse(fs.readFileSync(`public/data/layers/${l}`, 'utf8'))) } catch {} }
// A protected KHS marker's own position is a marker, not a site point: treat every marker:<n> position as an anchor too.
for (const rev of git('log', '--format=%H', '--', 'public/data/markers.geojson').split('\n').filter(Boolean)) { try { for (const x of JSON.parse(show(rev, 'public/data/markers.geojson')).features || []) { const n = x.properties?.marker_number; const g = x.geometry?.coordinates
  if (n != null && ids.has(`marker:${n}`) && Array.isArray(g) && typeof g[0] === 'number' && (dec(g[0]) >= 2 || dec(g[1]) >= 2)) anchors.push([g[1], g[0]]) } } catch {} }
// County centroids are public town/county-centre geocodes, not site points.
for (const pr of extractPairs(fs.readFileSync('public/data/county-centroids.json', 'utf8'))) anchors.push(pr.split(',').map(Number))
const inKy = (la, lo) => la > 36 && la < 39.5 && lo < -81.5 && lo > -89.8
const nearPublic = (la, lo) => anchors.some(([a, o]) => metres(la, lo, a, o) < PUBLIC_ANCHOR_M)
const skippedPublic = new Set()
const source = new Map()
const newest = new Map() // id -> "lat,lon"; files' logs are walked newest first, so first hit wins

for (const f of FILES) for (const rev of git('log', '--format=%H', '--', f).split('\n').filter(Boolean)) {
  let d
  try { d = JSON.parse(show(rev, f)) } catch { continue }
  const visit = (o, key) => {
    if (Array.isArray(o)) return o.forEach((x) => visit(x))
    if (!o || typeof o !== 'object') return
    const p = o.properties || o
    let id = [p.id, p.historyId, p.slug].find((x) => ids.has(x))
    if (!id && p.marker_number != null && ids.has(`marker:${p.marker_number}`)) id = `marker:${p.marker_number}`
    if (!id && key && ids.has(key)) id = key
    if (id && !newest.has(id) && !PLACEHOLDER_IDS.has(id)) {
      let la, lo
      const g = o.geometry?.coordinates
      if (Array.isArray(g) && typeof g[0] === 'number') [lo, la] = g
      else for (const [a, b] of [['lat', 'lon'], ['latitude', 'longitude'], ['lat', 'lng']]) if (typeof p[a] === 'number') [la, lo] = [p[a], p[b]]
      if (la != null && inKy(la, lo) && (dec(la) >= 3 || dec(lo) >= 3)) { if (nearPublic(la, lo)) skippedPublic.add(id); else { newest.set(id, `${la},${lo}`); source.set(id, { file: f, commit: rev }) } }
    }
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') visit(v, k)
  }
  visit(d)
}
// EXTRA_POINTS_FILE holds real points: errors name only the entry id/index, never the file text or values.
if (process.env.EXTRA_POINTS_FILE) {
  let extra
  try { extra = JSON.parse(fs.readFileSync(process.env.EXTRA_POINTS_FILE, 'utf8')) } catch (e) {
    console.error(`build-protected-coord-hashes: cannot read EXTRA_POINTS_FILE (${e.code || e.name}; contents redacted)`)
    process.exit(1)
  }
  for (const [id, v] of Object.entries(extra || {})) {
    const ok = Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) && inKy(v[0], v[1])
    if (!ok) { console.error(`build-protected-coord-hashes: EXTRA_POINTS_FILE entry "${ids.has(id) ? id : '(unlisted id)'}" is not a [lat, lon] Kentucky pair (value redacted)`); process.exit(1) }
    newest.set(id, `${v[0]},${v[1]}`)
  }
}
const noExact = [...ids].filter((i) => !newest.has(i) && !PLACEHOLDER_IDS.has(i))
const out = buildProximityFile([...newest.values()], KEY, 'Schema 3: keyed HMAC-SHA256 (32 hex) of each current protected point on the 4-decimal grid ("p:") and of the 0.01° cells its 200 m box touches ("c:"). Key: env PROTECTED_COORDS_KEY (Amplify secret, not in the repo). Generated by scripts/build-protected-coord-hashes.mjs; matching in scripts/lib/coord-pairs.mjs.')
// Optional private audit dump (outside the repo, never committed): POINTS_OUT=/path.json
if (process.env.POINTS_OUT) {
  const rec = Object.fromEntries([...newest].map(([id, v]) => [id, { point: v.split(',').map(Number), ...(source.get(id) || { file: 'EXTRA_POINTS_FILE' }) }]))
  fs.writeFileSync(process.env.POINTS_OUT, JSON.stringify({ generated: new Date().toISOString(), idOnly: [...ids].filter((i) => !newest.has(i)), points: rec }, null, 1), { mode: 0o600 })
  fs.chmodSync(process.env.POINTS_OUT, 0o600)
}
fs.writeFileSync('scripts/protected-coords.hashes.json', JSON.stringify(out, null, 1) + '\n')
console.log(`protected-coords hashes: ${out.count} points from ${newest.size}/${ids.size} ids; ids never published with an exact pin: ${noExact.join(', ') || 'none'}; ids with only marker/park-centre candidates (id-only): ${[...skippedPublic].filter((i) => !newest.has(i)).join(', ') || 'none'}; placeholder pins skipped: ${[...PLACEHOLDER_IDS].filter((i) => !newest.has(i)).length}`)
