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
 * Usage: node scripts/check-protected-coords.mjs [--dist dist]
 */
import fs from 'node:fs'
import path from 'node:path'

const argDist = process.argv.indexOf('--dist')
const dist = path.resolve(argDist > 0 ? process.argv[argDist + 1] : 'dist')
const ids = new Set(JSON.parse(fs.readFileSync(path.join(dist, 'data/web/protected-pins.json'), 'utf8')).ids || [])
if (!ids.size) throw new Error('check-protected-coords: protected-pins.json has no ids')

const fine = (v) => typeof v === 'number' && /\.\d{2,}/.test(String(v))
const fineStr = (s) => /\.\d{2,}/.test(s)
const errors = []

function namesProtected(o) {
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
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, file, id)
}

// Text files: a protected id followed within WINDOW chars (GPX/KML: also 200 before) by a fine KY lat/lon pair.
const WINDOW = 400
const PAIR = /(-?\d{2,3}\.\d+)["']?\s*[,\s]\s*(?:"?lon(?:gitude)?"?\s*[:=]\s*"?|lon=")?(-?\d{2,3}\.\d+)/g
const idRe = new RegExp(`(?:^|[^a-z0-9-])(${[...ids].sort((x, y) => y.length - x.length).map((x) => x.replace(/[-]/g, '\\-')).join('|')})(?![a-z0-9-])`, 'g')
function textScan(text, file) {
  for (const m of text.matchAll(idRe)) {
    const back = /\.(gpx|kml)$/.test(file) ? 200 : 0 // GPX/KML put the name after the coordinates
    const seg = text.slice(Math.max(0, m.index - back), m.index + WINDOW)
    for (const p of seg.matchAll(PAIR)) {
      if (!fineStr(p[1]) && !fineStr(p[2])) continue
      let lat = Number(p[1]), lon = Number(p[2])
      if (lat < 0 && lon > 0) [lat, lon] = [lon, lat]
      if (lat > 36 && lat < 39.5 && lon > -89.7 && lon < -81.8) errors.push(`${file}: ${m[1]} near ${lat},${lon}`)
    }
  }
}

const TEXT = new Set(['.js', '.gpx', '.kml', '.md', '.html', '.xml'])
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
const uniq = [...new Set(errors)]
errors.length = 0
errors.push(...uniq)
if (errors.length) {
  console.error(`check-protected-coords: ${errors.length} protected coordinate(s) finer than 0.1° in dist:`)
  for (const e of errors.slice(0, 50)) console.error('  ' + e)
  process.exit(1)
}
console.log(`check-protected-coords: ${ids.size} protected ids; none carries a coordinate finer than 0.1° in dist`)
