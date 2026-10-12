#!/usr/bin/env node
/**
 * check-protected-coords: fail the build if a looting-sensitive (protected) pin shows up in dist/
 * with a coordinate finer than 0.1° (more than 1 decimal). Self-contained; ids come from
 * dist/data/web/protected-pins.json.
 *
 * 1. JSON / GeoJSON (and JSON-LD blocks in HTML): any object whose id, slug, historyId, storySlug or
 *    url names a protected id may not carry lat/lon/latitude/longitude/coordinates with >1 decimal.
 * 2. Text (JS, GPX, KML, MD, HTML): a protected id followed within 400 chars (GPX/KML: also 200 before) by a Kentucky lat/lon
 *    pair with >1 decimal fails.
 * 3. Known exact pairs: every file in dist is scanned for number pairs (either lat/lon order); any pair
 *    whose keyed hash (HMAC-SHA256, key in env PROTECTED_COORDS_KEY) is in scripts/protected-coords.hashes.json
 *    (known exact coordinates of the protected sites from git history; scripts/build-protected-coord-hashes.mjs)
 *    fails, whatever its label. Without the key the list cannot be reversed. No key: this step is skipped
 *    with a warning locally/CI, and fails closed in Amplify (AWS_APP_ID set).
 * Records are matched by id/slug/historyId/storySlug(s), story URL, or a protected display name
 * (name/title/label, taken from the stories/history layers).
 * Fixtures: scripts/test-protected-coords.mjs.
 * Usage: node scripts/check-protected-coords.mjs [--dist dist] [--hashes file]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractPairs, hashPair, keyCheck } from './lib/coord-pairs.mjs'

const argDist = process.argv.indexOf('--dist')
const dist = path.resolve(argDist > 0 ? process.argv[argDist + 1] : 'dist')
const argHashes = process.argv.indexOf('--hashes')
const hashFile = argHashes > 0 ? process.argv[argHashes + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), 'protected-coords.hashes.json')
// Keyed known-pair list: needs PROTECTED_COORDS_KEY. Missing key: skip this part with a warning,
// except in Amplify (AWS_APP_ID set), where it fails closed. A key that does not match the list fails.
const KEY = process.env.PROTECTED_COORDS_KEY || ''
const inAmplify = Boolean(process.env.AWS_APP_ID)
const hashData = JSON.parse(fs.readFileSync(hashFile, 'utf8'))
let knownHashes = new Set()
if (!KEY) {
  if (inAmplify) {
    console.error('check-protected-coords: PROTECTED_COORDS_KEY is not set in this Amplify build. Failing closed; add it under Amplify > Hosting > Environment variables (as a secret).')
    process.exit(1)
  }
  console.warn('check-protected-coords: WARNING PROTECTED_COORDS_KEY not set; skipping the keyed known-exact-pair scan (id/name checks still run). Amplify builds fail without it.')
} else if (hashData.schema !== 2 || hashData.keyCheck !== keyCheck(KEY)) {
  console.error('check-protected-coords: PROTECTED_COORDS_KEY does not match ' + path.basename(hashFile) + ' (keyCheck mismatch, or old unkeyed list). Fix the env var or regenerate the list with scripts/build-protected-coord-hashes.mjs.')
  process.exit(1)
} else knownHashes = new Set(hashData.hashes || [])
const ids = new Set(JSON.parse(fs.readFileSync(path.join(dist, 'data/web/protected-pins.json'), 'utf8')).ids || [])
if (!ids.size) throw new Error('check-protected-coords: protected-pins.json has no ids')

const fine = (v) => typeof v === 'number' && /\.\d{2,}/.test(String(v))
const fineStr = (s) => /\.\d{2,}/.test(s)
const errors = []

// Protected display names (lower-case) from the published layers.
const names = new Map()
const norm = (x) => String(x).toLowerCase().replace(/\s+/g, ' ').trim()
for (const f of ['data/layers/stories.geojson', 'data/layers/history.geojson']) {
  const p = path.join(dist, f)
  if (!fs.existsSync(p)) continue
  for (const ft of JSON.parse(fs.readFileSync(p, 'utf8')).features || []) {
    const pr = ft.properties || {}
    const id = [pr.id, pr.historyId, pr.slug].find((x) => ids.has(x))
    if (id) for (const n of [pr.name, pr.title, pr.matchedPlace]) if (n && String(n).length > 5) names.set(norm(n), id)
  }
}
function namesProtected(o) {
  for (const k of ['storySlugs', 'stories', 'slugs']) if (Array.isArray(o[k])) { const h = o[k].find((x) => ids.has(x)); if (h) return h }
  for (const k of ['name', 'title', 'label']) if (typeof o[k] === 'string' && names.has(norm(o[k]))) return names.get(norm(o[k]))
  for (const k of ['id', 'slug', 'historyId', 'storySlug', 'story_slug', 'history_id']) if (ids.has(o[k])) return o[k]
  for (const k of ['url', '@id']) {
    const m = typeof o[k] === 'string' && o[k].match(/\/stories\/([^/#?]+)/)
    if (m && ids.has(m[1])) return m[1]
  }
  return null
}
function coordsIn(o, depth = 0, out = []) {
  if (!o || typeof o !== 'object' || depth > 4) return out
  for (const [k, v] of Object.entries(o)) {
    if (['lat', 'lon', 'lng', 'latitude', 'longitude'].includes(k) && fine(v)) out.push(`${k}=${v}`)
    else if (k === 'coordinates' && Array.isArray(v)) {
      const flat = v.flat(3).filter((x) => typeof x === 'number')
      if (flat.length <= 3 && flat.some(fine)) out.push(`coordinates=[${flat}]`)
    } else if (v && typeof v === 'object' && ['geometry', 'geo', 'location', 'position', 'properties'].includes(k)) coordsIn(v, depth + 1, out)
  }
  return out
}
function walk(o, file, owner = null) {
  if (Array.isArray(o)) return o.forEach((x) => walk(x, file, owner))
  if (!o || typeof o !== 'object') return
  const id = namesProtected(o) || namesProtected(o.properties || {}) || owner
  if (id) for (const c of coordsIn(o)) errors.push(`${file}: ${id} ${c}`)
  for (const [k, v] of Object.entries(o)) {
    if (!v || typeof v !== 'object') continue
    // Keyed indexes ("history:<id>": {...}) name the record in the key.
    const keyId = ids.has(k.split(':').pop()) ? k.split(':').pop() : null
    walk(v, file, keyId || id)
  }
}

// Text files: a protected id followed within WINDOW chars (GPX/KML: also 200 before) by a fine KY lat/lon pair.
const WINDOW = 400
const PAIR = /(-?\d{2,3}\.\d+)["']?\s*[,\s]\s*(?:"?lon(?:gitude)?"?\s*[:=]\s*"?|lon=")?(-?\d{2,3}\.\d+)/g
const idRe = new RegExp(`(?:^|[^a-z0-9-])(${[...ids, ...names.keys()].sort((x, y) => y.length - x.length).map((x) => x.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|')})(?![a-z0-9-])`, 'g')
function textScan(text, file) {
  const gk = /\.(gpx|kml)$/.test(file)
  const gpx = file.endsWith('.gpx') // GPX puts <name> after the wpt lat/lon
  const report = (name, p) => {
    if (!p || (!fineStr(p[1]) && !fineStr(p[2]))) return
    let lat = Number(p[1]), lon = Number(p[2])
    if (lat < 0 && lon > 0) [lat, lon] = [lon, lat]
    if (lat > 36 && lat < 39.5 && lon > -89.7 && lon < -81.8) errors.push(`${file}: ${name} near ${lat},${lon}`)
  }
  for (const m of text.toLowerCase().matchAll(idRe)) {
    const isName = !ids.has(m[1])
    if (!isName) {
      // Slug ids: any pair in the same record (next WINDOW chars; GPX/KML also 200 before).
      for (const p of text.slice(Math.max(0, m.index - (gk ? 200 : 0)), m.index + WINDOW).matchAll(PAIR)) report(m[1], p)
      continue
    }
    // Display names recur in route prose, so only the pair that belongs to the name counts:
    // the first one right after it on the same line, or in GPX the last one right before it.
    const after = text.slice(m.index, m.index + 120).split('\n')[0]
    if (!gpx) report(m[1], [...after.matchAll(PAIR)][0])
    if (gpx) report(m[1], [...text.slice(Math.max(0, m.index - 200), m.index).matchAll(PAIR)].pop())
  }
}

const TEXT = new Set(['.js', '.gpx', '.kml', '.md', '.html', '.xml', '.txt'])
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}
const SCAN = /\.(json|geojson|js|mjs|gpx|kml|md|html|xml|txt|csv|webmanifest)$/
for (const f of files(dist)) {
  const ext = path.extname(f)
  const rel = path.relative(dist, f)
  if (SCAN.test(f) && fs.statSync(f).size < 50e6) {
    if (knownHashes.size) for (const pair of extractPairs(fs.readFileSync(f, 'utf8'))) {
      if (knownHashes.size && knownHashes.has(hashPair(pair, KEY))) errors.push(`${rel}: known exact coordinate of a protected site (hash ${hashPair(pair, KEY).slice(0, 8)}…)`)
    }
  }
  if (ext === '.json' || ext === '.geojson') {
    try { walk(JSON.parse(fs.readFileSync(f, 'utf8')), rel) } catch { /* not JSON */ }
  } else if (TEXT.has(ext)) {
    const t = fs.readFileSync(f, 'utf8')
    textScan(t, rel)
    if (ext === '.html') for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { walk(JSON.parse(m[1]), rel + ' (JSON-LD)') } catch { /* ignore */ }
    }
  }
}
const uniq = [...new Set(errors)]
errors.length = 0
errors.push(...uniq)
if (errors.length) {
  console.error(`check-protected-coords: ${errors.length} protected coordinate(s) finer than 0.1° in dist:`)
  const byFile = new Map()
  for (const e of errors) { const f = e.split(':')[0]; byFile.set(f, (byFile.get(f) || 0) + 1) }
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.error(`  ${n}\t${f}`)
  console.error('  first findings:')
  for (const e of errors.slice(0, 30)) console.error('  ' + e)
  process.exit(1)
}
console.log(`check-protected-coords: ${ids.size} protected ids, ${names.size} names, ${knownHashes.size ? knownHashes.size + ' known exact pairs (keyed)' : 'keyed pair scan SKIPPED (no key)'}; none found in dist`)
