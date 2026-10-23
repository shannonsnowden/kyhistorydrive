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
 * 3. Keyed proximity scan (needs env PROTECTED_COORDS_KEY; missing or wrong key fails the build): every
 *    Kentucky lat/lon pair (either order, incl. bare arrays such as route lines and STOPS) in
 *    dist/** .json/.geojson/.html/.js/.gpx/.kml files finer than 0.1° that lies within 200 m of a point in
 *    scripts/protected-coords.hashes.json fails. Output names only file, JSON path/offset and distance.
 * 4. List completeness: a story, History or marker record within 200 m of a listed point must have its id
 *    in protected-pins.json.
 * Fixtures: scripts/test-protected-coords.mjs (fake key, fake points).
 * Usage: node scripts/check-protected-coords.mjs [--dist dist] [--hashes file]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { extractPairs, keyCheck, proximityMatcher, RADIUS_M } from './lib/coord-pairs.mjs'

const argDist = process.argv.indexOf('--dist')
const dist = path.resolve(argDist > 0 ? process.argv[argDist + 1] : 'dist')
const ids = new Set(JSON.parse(fs.readFileSync(path.join(dist, 'data/web/protected-pins.json'), 'utf8')).ids || [])
if (!ids.size) throw new Error('check-protected-coords: protected-pins.json has no ids')

const fine = (v) => typeof v === 'number' && /\.\d{2,}/.test(String(v))
const fineStr = (s) => /\.\d{2,}/.test(s)
const errors = []

function namesProtected(o) {
  if (o.marker_number != null && ids.has(`marker:${o.marker_number}`)) return `marker:${o.marker_number}`
  const pm = typeof o.id === 'string' && o.id.match(/^place:markers:(\d+)$/)
  if (pm && ids.has(`marker:${pm[1]}`)) return `marker:${pm[1]}`
  for (const k of ['id', 'identifier', 'slug', 'historyId', 'storySlug', 'story_slug', 'history_id']) if (ids.has(o[k])) return o[k]
  for (const k of ['url', '@id']) {
    const m = typeof o[k] === 'string' && o[k].match(/\/stories\/([^/#?]+)/)
    if (m && ids.has(m[1])) return m[1]
  }
  return null
}
// Findings name only the field path, never the value: failure output lands in Amplify build logs.
function coordsIn(o, depth = 0, out = [], at = '') {
  if (!o || typeof o !== 'object' || depth > 4) return out
  for (const [k, v] of Object.entries(o)) {
    if (['lat', 'lon', 'lng', 'latitude', 'longitude'].includes(k) && fine(v)) out.push(at + k)
    else if (k === 'coordinates' && Array.isArray(v)) {
      const flat = v.flat(3).filter((x) => typeof x === 'number')
      if (flat.length <= 3 && flat.some(fine)) out.push(at + 'coordinates')
    } else if (v && typeof v === 'object' && ['geometry', 'geo', 'location', 'position', 'properties'].includes(k)) coordsIn(v, depth + 1, out, `${at}${k}.`)
  }
  return out
}
function walk(o, file, owner = null, at = '$') {
  if (Array.isArray(o)) return o.forEach((x, i) => walk(x, file, owner, `${at}[${i}]`))
  if (!o || typeof o !== 'object') return
  const id = namesProtected(o) || namesProtected(o.properties || {}) || owner
  if (id) for (const c of coordsIn(o)) errors.push(`${file}: ${id} at ${at}.${c}`)
  for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') walk(v, file, ids.has(k) ? k : id, `${at}.${k}`) // keyed maps, e.g. sites["marker:1274"]
}

// Text files: a protected id followed within WINDOW chars (GPX/KML: also 200 before) by a fine KY lat/lon pair.
const WINDOW = 400
const PAIR = /(-?\d{2,3}\.\d+)["']?\s*[,\s]\s*(?:"?lon(?:gitude)?"?\s*[:=]\s*"?|lon=")?(-?\d{2,3}\.\d+)/g
function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}
const idRe = new RegExp(`(?:^|[^a-z0-9-])(${[...ids].sort((x, y) => y.length - x.length).map((x) => escapeRegExp(x)).join('|')})(?![a-z0-9-])`, 'g')
function textScan(text, file) {
  for (const m of text.matchAll(idRe)) {
    const back = /\.(gpx|kml)$/.test(file) ? 200 : 0 // GPX/KML put the name after the coordinates
    const start = Math.max(0, m.index - back)
    const seg = text.slice(Math.max(0, m.index - back), m.index + WINDOW)
    for (const p of seg.matchAll(PAIR)) {
      if (!fineStr(p[1]) && !fineStr(p[2])) continue
      let lat = Number(p[1]), lon = Number(p[2])
      if (lat < 0 && lon > 0) [lat, lon] = [lon, lat]
      if (lat > 36 && lat < 39.5 && lon > -89.7 && lon < -81.8) errors.push(`${file}: ${m[1]} fine coordinate pair at line ${text.slice(0, start + p.index).split('\n').length}`)
    }
  }
}

const TEXT = new Set(['.js', '.mjs', '.cjs', '.gpx', '.kml', '.md', '.txt', '.html', '.xml', '.rss', '.atom', '.svg', '.css', '.vtt'])
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}
for (const f of files(dist)) {
  const ext = path.extname(f)
  const rel = path.relative(dist, f)
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

// ---- 3/4: keyed proximity scan and list completeness ----
const t0 = Date.now()
const argHashes = process.argv.indexOf('--hashes')
const hashFile = argHashes > 0 ? path.resolve(process.argv[argHashes + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), 'protected-coords.hashes.json')
const KEY = process.env.PROTECTED_COORDS_KEY || ''
let list
// JSON.parse errors quote file text; never let hash or key-check values reach the log.
try { list = JSON.parse(fs.readFileSync(hashFile, 'utf8')) } catch (e) {
  console.error(`check-protected-coords: cannot read ${path.basename(hashFile)} (${e.code || e.name}; contents redacted)`)
  process.exit(1)
}
if (!KEY) {
  console.error('check-protected-coords: PROTECTED_COORDS_KEY is not set. Add it under Amplify > Hosting > Environment variables (secret), or export it locally.')
  process.exit(1)
}
if (list.schema !== 3 || list.keyCheck !== keyCheck(KEY)) {
  console.error(`check-protected-coords: PROTECTED_COORDS_KEY does not match ${path.basename(hashFile)} (keyCheck mismatch or old schema). Fix the env var or regenerate with scripts/build-protected-coord-hashes.mjs.`)
  process.exit(1)
}
const near = proximityMatcher(list, KEY)
const SCAN = new Set([
  '.html', '.js', '.mjs', '.cjs',
  '.json', '.geojson',
  '.xml', '.rss', '.atom',
  '.txt', '.md',
  '.svg', '.css',
  '.kml', '.gpx',
  '.webmanifest', '.vtt', '.map',
])
const KNOWN_BINARY = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.pbf',
  '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.m4a',
  '.zip',
])
const fineNum = (s) => /\.\d{2,}/.test(s)
let scanned = 0
for (const f of files(dist)) {
  const ext = path.extname(f).toLowerCase()
  const rel = path.relative(dist, f)
  let text = null
  if (SCAN.has(ext)) {
    text = fs.readFileSync(f, 'utf8')
  } else if (ext === '.pdf') {
    try {
      text = execFileSync('pdftotext', [f, '-'], { encoding: 'utf8' })
      textScan(text, rel)
    } catch (e) {
      errors.push(`${rel}: pdftotext failed (${e.code || e.name})`)
      continue
    }
  } else if (KNOWN_BINARY.has(ext)) {
    continue
  } else {
    errors.push(`${rel}: unknown file extension ${ext || '(none)'} in dist (fail-closed)`)
    continue
  }
  scanned++
  const hits = new Map()
  for (const p of extractPairs(text)) {
    const [la, lo] = p.split(',')
    if (!fineNum(la) && !fineNum(lo)) continue
    const d = near(Number(la), Number(lo))
    if (d != null) hits.set(p, d)
  }
  if (!hits.size) continue
  // Locate each hit by JSON path when the file parses, else by character offset. Values are never printed.
  let where = null
  if (/\.(json|geojson)$/.test(f)) {
    try {
      where = new Map()
      const at = (o, pth) => {
        if (Array.isArray(o)) {
          if (o.length >= 2 && typeof o[0] === 'number' && typeof o[1] === 'number') for (const k of [`${o[1]},${o[0]}`, `${o[0]},${o[1]}`]) if (hits.has(k) && !where.has(k)) where.set(k, pth)
          return o.forEach((x, i) => at(x, `${pth}[${i}]`))
        }
        if (!o || typeof o !== 'object') return
        for (const [a, b] of [['lat', 'lon'], ['lat', 'lng'], ['latitude', 'longitude']]) if (typeof o[a] === 'number' && typeof o[b] === 'number') { const k = `${o[a]},${o[b]}`; if (hits.has(k) && !where.has(k)) where.set(k, pth || '$') }
        for (const [k, v] of Object.entries(o)) at(v, `${pth}.${k}`)
      }
      at(JSON.parse(text), '$')
    } catch { where = null }
  }
  for (const [p, d] of hits) {
    const [la, lo] = p.split(',')
    const off = text.indexOf(la) >= 0 ? text.indexOf(la) : text.indexOf(lo)
    errors.push(`${rel}:${where?.get(p) || `@${off}`} within ${Math.round(d)} m of a protected site`)
  }
}
// List completeness: records with an id within 200 m of a listed point must be protected.
const RECORDS = ['data/layers/stories.geojson', 'data/layers/history.geojson', 'data/markers.geojson', 'data/app/ky-history.json', 'data/app/markers.phase1.json', 'content/stories-locations.json']
function recId(o, key) {
  if (o.marker_number != null) return `marker:${o.marker_number}`
  const pm = typeof o.id === 'string' && o.id.match(/^place:markers:(\d+)$/)
  if (pm) return `marker:${pm[1]}`
  return o.slug || o.historyId || o.id || o.storySlug || key || null
}
for (const f of RECORDS) {
  const p = path.join(dist, f)
  if (!fs.existsSync(p)) continue
  let d
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { continue }
  const visit = (o, pth, key) => {
    if (Array.isArray(o)) return o.forEach((x, i) => visit(x, `${pth}[${i}]`))
    if (!o || typeof o !== 'object') return
    const pr = o.properties || o
    let la, lo
    const g = o.geometry?.coordinates
    if (o.geometry?.type === 'Point' && Array.isArray(g)) [lo, la] = g
    else for (const [a, b] of [['lat', 'lon'], ['lat', 'lng'], ['latitude', 'longitude']]) if (typeof pr[a] === 'number' && typeof pr[b] === 'number') [la, lo] = [pr[a], pr[b]]
    const id = la != null && recId(pr, key)
    if (id && typeof id === 'string' && !ids.has(id) && !ids.has(id.replace(/^(history|story):/, ''))) {
      const dm = near(la, lo)
      if (dm != null) errors.push(`${f}:${pth} record ${id} is within ${Math.round(dm)} m of a protected site but not in protected-pins.json`)
    }
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object' && k !== 'geometry') visit(v, `${pth}.${k}`, k)
  }
  visit(d, '$')
}
const keyedMs = Date.now() - t0
const st = near.stats()

const uniq = [...new Set(errors)]
errors.length = 0
errors.push(...uniq)
if (errors.length) {
  console.error(`check-protected-coords: ${errors.length} protected coordinate problem(s) in dist (values redacted):`)
  for (const e of errors.slice(0, 50)) console.error('  ' + e)
  process.exit(1)
}
console.log(`check-protected-coords: ${ids.size} protected ids, ${list.count} keyed points; no coordinate finer than 0.1° within ${RADIUS_M} m of a protected site in ${scanned} files (${st.pairs} pairs, ${(keyedMs / 1000).toFixed(1)}s); records near protected sites are all listed`)
