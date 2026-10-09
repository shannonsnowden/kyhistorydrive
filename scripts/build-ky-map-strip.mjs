/**
 * Homepage Kentucky map strip.
 *
 * U.S. Census Bureau 2025 Cartographic Boundary Files cb_2025_us_state_500k and
 * cb_2025_us_county_500k, public domain; drawn in NAD83 / Kentucky Single Zone (EPSG:3089).
 *
 * Downloads the shapefiles, projects them (not raw longitude/latitude), simplifies
 * the rings, and writes public/brand/ky-map-strip-counties.svg (dark) plus
 * public/brand/ky-map-strip-counties-light.svg. The homepage loads the dark
 * file as the one homepage image; the page swaps that image's src for the
 * light file. An img cannot use the
 * page's theme variables, so each file bakes in its palette.
 * A short set of Historical Society marker dots is drawn on land the homepage
 * seal leaves open, from public/data/markers.geojson, in the same projection.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE_URL = 'https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip'
const COUNTY_URL = 'https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_county_500k.zip'
const SOURCE_LINE =
  'U.S. Census Bureau 2025 Cartographic Boundary Files cb_2025_us_state_500k and cb_2025_us_county_500k, public domain; drawn in NAD83 / Kentucky Single Zone (EPSG:3089).'

const KY = '21'
const VB_W = 1000
const PAD = 0.072
let MAIN_TOL_M = 1400
let SMALL_TOL_M = 70
const SMALL_AREA_M2 = 150e6
const MIN_AREA_M2 = 2e6

const A = 6378137
const F = 1 / 298.257222101
const E2 = F * (2 - F)
const E = Math.sqrt(E2)
const DEG = Math.PI / 180
const PHI1 = 37.08333333333334 * DEG
const PHI2 = 38.66666666666666 * DEG
const PHI0 = 36.33333333333334 * DEG
const LAM0 = -85.75 * DEG

function coneM(phi) {
  return Math.cos(phi) / Math.sqrt(1 - E2 * Math.sin(phi) ** 2)
}
function coneT(phi) {
  const s = Math.sin(phi)
  return Math.tan(Math.PI / 4 - phi / 2) / ((1 - E * s) / (1 + E * s)) ** (E / 2)
}
const M1 = coneM(PHI1)
const M2 = coneM(PHI2)
const T1 = coneT(PHI1)
const T2 = coneT(PHI2)
const N = Math.log(M1 / M2) / Math.log(T1 / T2)
const FCON = M1 / (N * T1 ** N)
const RHO0 = A * FCON * coneT(PHI0) ** N

function project(lon, lat) {
  const phi = lat * DEG
  const rho = A * FCON * coneT(phi) ** N
  const theta = N * (lon * DEG - LAM0)
  return [rho * Math.sin(theta) + 1500000, RHO0 - rho * Math.cos(theta) + 1000000]
}

function assertProjection() {
  const [x, y] = project(-84.8733, 38.2006)
  const drift = Math.hypot(x - 1576785.288, y - 1207595.937)
  if (drift > 1) throw new Error(`EPSG:3089 check failed (${drift.toFixed(2)} m)`)
}

function readShp(file) {
  const buf = fs.readFileSync(file)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const shapes = []
  let off = 100
  while (off + 8 <= buf.length) {
    const words = dv.getInt32(off + 4, false)
    const start = off + 8
    const end = start + words * 2
    const kind = dv.getInt32(start, true)
    if (kind === 0) shapes.push([])
    else if (kind === 5 || kind === 15 || kind === 25) {
      const numParts = dv.getInt32(start + 36, true)
      const numPoints = dv.getInt32(start + 40, true)
      let p = start + 44
      const parts = []
      for (let i = 0; i < numParts; i++) {
        parts.push(dv.getInt32(p, true))
        p += 4
      }
      const points = []
      for (let i = 0; i < numPoints; i++) {
        points.push([dv.getFloat64(p, true), dv.getFloat64(p + 8, true)])
        p += 16
      }
      shapes.push(parts.map((from, i) => points.slice(from, i + 1 < parts.length ? parts[i + 1] : numPoints)))
    } else shapes.push([])
    off = end
  }
  return shapes
}

function readDbf(file) {
  const buf = fs.readFileSync(file)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const n = dv.getUint32(4, true)
  const headerSize = dv.getUint16(8, true)
  const recordSize = dv.getUint16(10, true)
  const fields = []
  let o = 32
  while (o < headerSize - 1 && buf[o] !== 0x0d) {
    fields.push({
      name: buf.subarray(o, o + 11).toString('utf8').replace(/\0.*/, ''),
      len: buf[o + 16],
    })
    o += 32
  }
  const rows = []
  for (let i = 0; i < n; i++) {
    let c = headerSize + i * recordSize + 1
    const row = {}
    for (const field of fields) {
      row[field.name] = buf.subarray(c, c + field.len).toString('latin1').trim()
      c += field.len
    }
    rows.push(row)
  }
  return rows
}

async function cachedZip(url, name) {
  const dir = path.join(os.tmpdir(), 'ky-map-strip-cache')
  fs.mkdirSync(dir, { recursive: true })
  const zip = path.join(dir, name)
  if (!fs.existsSync(zip) || fs.statSync(zip).size < 1000) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download ${url} failed: ${res.status}`)
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  }
  const out = path.join(dir, name.replace(/\.zip$/, ''))
  fs.mkdirSync(out, { recursive: true })
  if (!fs.readdirSync(out).some((f) => f.endsWith('.shp'))) {
    execFileSync('unzip', ['-o', '-q', zip, '-d', out])
  }
  const shp = fs.readdirSync(out).find((f) => f.endsWith('.shp'))
  return path.join(out, shp)
}

function kyRings(shpPath) {
  const base = shpPath.replace(/\.shp$/, '')
  const rows = readDbf(`${base}.dbf`)
  const shapes = readShp(shpPath)
  if (rows.length !== shapes.length) {
    throw new Error(`dbf/shp mismatch for ${path.basename(shpPath)}: ${rows.length} rows, ${shapes.length} shapes`)
  }
  const rings = []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].STATEFP !== KY && rows[i].GEOID?.slice(0, 2) !== KY) continue
    for (const ring of shapes[i]) rings.push(ring)
  }
  if (!rings.length) throw new Error(`no Kentucky rings in ${path.basename(shpPath)}`)
  return rings
}

function signedArea(pts) {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  }
  return a / 2
}

function distToSeg(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

function simplifyOpen(pts, tol) {
  if (pts.length < 3) return pts.slice()
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()
    let max = 0
    let at = -1
    for (let i = s + 1; i < e; i++) {
      const d = distToSeg(pts[i], pts[s], pts[e])
      if (d > max) {
        max = d
        at = i
      }
    }
    if (at !== -1 && max > tol) {
      keep[at] = 1
      stack.push([s, at], [at, e])
    }
  }
  return pts.filter((_, i) => keep[i])
}

function simplifyRing(lonLat, tol) {
  const proj = lonLat.map(([x, y]) => project(x, y))
  const closed = proj.length > 2 && Math.hypot(proj[0][0] - proj.at(-1)[0], proj[0][1] - proj.at(-1)[1]) < 1
  const ring = closed ? proj.slice(0, -1) : proj
  if (ring.length < 4) return ring.concat([ring[0]])
  let anchor = 0
  for (let i = 1; i < ring.length; i++) {
    if (ring[i][0] < ring[anchor][0] || (ring[i][0] === ring[anchor][0] && ring[i][1] < ring[anchor][1])) anchor = i
  }
  const rot = ring.slice(anchor).concat(ring.slice(0, anchor))
  let far = 1
  let farD = -1
  for (let i = 1; i < rot.length; i++) {
    const d = Math.hypot(rot[i][0] - rot[0][0], rot[i][1] - rot[0][1])
    if (d > farD) {
      farD = d
      far = i
    }
  }
  const left = simplifyOpen(rot.slice(0, far + 1), tol)
  const right = simplifyOpen(rot.slice(far).concat([rot[0]]), tol)
  const out = left.concat(right.slice(1))
  if (out.length >= 4) return out
  const mid = rot[Math.floor(rot.length / 2)]
  return [rot[0], rot[far], mid, rot[0]]
}

function prepare(lonLatRings) {
  const prepared = []
  for (const ring of lonLatRings) {
    if (ring.length < 4) continue
    const area = Math.abs(signedArea(ring.map(([x, y]) => project(x, y))))
    if (area < MIN_AREA_M2) continue
    const tol = area < SMALL_AREA_M2 ? SMALL_TOL_M : MAIN_TOL_M
    const simplified = simplifyRing(ring, tol)
    prepared.push({ pts: simplified, area })
  }
  prepared.sort((a, b) => b.area - a.area)
  return prepared
}

function boundsOf(prepared) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const ring of prepared) {
    for (const [x, y] of ring.pts) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const padX = (maxX - minX) * PAD
  const padY = (maxY - minY) * PAD
  return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
}

function scaler(bounds) {
  const worldW = bounds.maxX - bounds.minX
  const worldH = bounds.maxY - bounds.minY
  const vbH = VB_W * (worldH / worldW)
  return {
    vbH,
    xy([x, y]) {
      return [(x - bounds.minX) / worldW * VB_W, (bounds.maxY - y) / worldH * vbH]
    },
  }
}

function fmt(n) {
  return (Math.round(n * 10) / 10).toFixed(1)
}

function pathD(rings, scale) {
  return rings.map((ring) => {
    const pts = ring.pts || ring
    return pts.map((p, i) => {
      const [x, y] = scale.xy(p)
      return `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`
    }).join('') + 'Z'
  }).join('')
}

const PALETTES = {
  dark: { paper: '#1a241c', land: '#5a3d22', ink: '#e8d5a8' },
  light: { paper: '#f4ead6', land: '#e4d3ae', ink: '#6e4214' },
}

function styleBlock(theme) {
  const p = PALETTES[theme]
  if (!p) throw new Error(`unknown map theme ${theme}`)
  return `<style>
    .hp-ky-paper { fill: ${p.paper}; }
    .hp-ky-fill { fill: ${p.land}; stroke: none; }
    .hp-ky-edge { fill: none; stroke: ${p.ink}; stroke-width: 1.75px; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .hp-ky-counties { fill: none; stroke: ${p.ink}; stroke-width: 1px; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; opacity: 0.5; }
    .hp-ky-markers { fill: ${p.ink}; stroke: ${p.paper}; stroke-width: 1.25px; }
  </style>`
}

function svgDoc({ vbH, title, desc, body, labelledBy, theme }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${SOURCE_LINE} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${fmt(vbH)}" width="${VB_W}" height="${fmt(vbH)}" role="img" aria-labelledby="${labelledBy}" fill-rule="evenodd">
  ${styleBlock(theme)}
  <title id="${labelledBy.split(' ')[0]}">${title}</title>
  <desc id="${labelledBy.split(' ')[1]}">${desc}</desc>
  ${body}
</svg>
`
}

/** Seal center is left 37% and 80% of the strip height, matching .hp-map-seal. */
const SEAL_CX_FRAC = 0.37
const SEAL_R_FRAC = 0.4
const SEAL_MARGIN = 10
const DOT_COUNT = 16
const DOT_R = 4.6

function pointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function inRings(x, y, rings) {
  let hits = 0
  for (const ring of rings) {
    if (pointInRing(x, y, ring)) hits += 1
  }
  return hits % 2 === 1
}

/**
 * 12–20 real Historical Society markers on land the seal does not cover.
 * Coordinates come from the site marker file and use the same EPSG:3089
 * projection and viewBox scale as the county shapes.
 */
function selectMarkerDots(scale, stateRings, markersPath) {
  const geo = JSON.parse(fs.readFileSync(markersPath, 'utf8'))
  const main = stateRings.filter((ring) => ring.area >= SMALL_AREA_M2).map((ring) => ring.pts)
  const cx = SEAL_CX_FRAC * VB_W
  const cy = scale.vbH / 2
  const radius = scale.vbH * SEAL_R_FRAC + SEAL_MARGIN
  const seen = new Set()
  const candidates = []
  for (const feature of geo.features || []) {
    const pair = feature.geometry?.coordinates
    if (!pair || pair.length < 2) continue
    const projected = project(pair[0], pair[1])
    if (!inRings(projected[0], projected[1], main)) continue
    const [x, y] = scale.xy(projected)
    if (x < 8 || y < 8 || x > VB_W - 8 || y > scale.vbH - 8) continue
    if (Math.hypot(x - cx, y - cy) < radius) continue
    const key = `${Math.round(x)}:${Math.round(y)}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({
      x,
      y,
      title: feature.properties?.title || 'Marker',
      county: feature.properties?.county || '',
    })
  }
  if (candidates.length < 12) {
    throw new Error(`only ${candidates.length} markers sit on visible land; need at least 12`)
  }
  const count = Math.min(DOT_COUNT, 20, candidates.length)
  let start = candidates[0]
  for (const dot of candidates) {
    if (dot.x > start.x) start = dot
  }
  const picked = [start]
  const used = new Set([start])
  while (picked.length < count) {
    let best = null
    let bestD = -1
    for (const dot of candidates) {
      if (used.has(dot)) continue
      let near = Infinity
      for (const have of picked) near = Math.min(near, Math.hypot(dot.x - have.x, dot.y - have.y))
      if (near > bestD) {
        bestD = near
        best = dot
      }
    }
    if (!best || bestD < 28) break
    used.add(best)
    picked.push(best)
  }
  if (picked.length < 12) {
    throw new Error(`spread only ${picked.length} marker dots; need at least 12`)
  }
  picked.sort((a, b) => a.x - b.x || a.y - b.y)
  return picked
}

function markerMarkup(dots) {
  return dots
    .map(
      (dot) =>
        `<circle class="hp-ky-markers" cx="${fmt(dot.x)}" cy="${fmt(dot.y)}" r="${DOT_R}"><title>${escapeXml(dot.title)}${dot.county ? `, ${escapeXml(dot.county)} County` : ''}</title></circle>`,
    )
    .join('\n  ')
}

function escapeXml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function parseArgs(argv) {
  const out = { outDir: path.join(ROOT, 'public/brand'), markers: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.outDir = path.resolve(argv[++i])
    else if (argv[i] === '--markers') out.markers = path.resolve(argv[++i] || path.join(ROOT, 'public/data/markers.geojson'))
    else if (argv[i] === '--main-tol') MAIN_TOL_M = Number(argv[++i])
    else if (argv[i] === '--small-tol') SMALL_TOL_M = Number(argv[++i])
    else throw new Error(`unknown arg ${argv[i]}`)
  }
  return out
}

async function main() {
  assertProjection()
  const args = parseArgs(process.argv.slice(2))
  const stateShp = await cachedZip(STATE_URL, 'cb_2025_us_state_500k.zip')
  const countyShp = await cachedZip(COUNTY_URL, 'cb_2025_us_county_500k.zip')
  const state = prepare(kyRings(stateShp))
  const counties = prepare(kyRings(countyShp))
  const bend = state.filter((ring) => ring.area < SMALL_AREA_M2)
  if (!bend.length) throw new Error('Kentucky Bend ring missing after simplify')
  const bounds = boundsOf(state)
  const scale = scaler(bounds)
  const stateD = pathD(state, scale)
  const countyD = pathD(counties, scale)
  const paper = `<rect class="hp-ky-paper" x="0" y="0" width="${VB_W}" height="${fmt(scale.vbH)}"/>`
  const fill = `<path class="hp-ky-fill" d="${stateD}"/>`
  const edge = `<path class="hp-ky-edge" d="${stateD}"/>`
  const countyPath = `<path class="hp-ky-counties" d="${countyD}"/>`
  const countyBody = `${paper}\n  ${fill}\n  ${countyPath}\n  ${edge}`

  fs.mkdirSync(args.outDir, { recursive: true })
  const markersPath = args.markers || path.join(ROOT, 'public/data/markers.geojson')
  const dots = selectMarkerDots(scale, state, markersPath)
  const dotMarkup = markerMarkup(dots)
  const countyTitle = 'Kentucky counties'
  const countyDesc = 'Kentucky with county lines and historical marker dots, including the Kentucky Bend exclave of Fulton County. Static picture, not the interactive marker map.'
  for (const theme of ['dark', 'light']) {
    const file = theme === 'dark' ? 'ky-map-strip-counties.svg' : 'ky-map-strip-counties-light.svg'
    fs.writeFileSync(path.join(args.outDir, file), svgDoc({
      vbH: scale.vbH,
      title: countyTitle,
      desc: countyDesc,
      body: `${countyBody}\n  ${dotMarkup}`,
      labelledBy: 'kyMapCountyTitle kyMapCountyDesc',
      theme,
    }))
  }
  fs.writeFileSync(path.join(args.outDir, 'ky-map-strip-source.txt'), `${SOURCE_LINE}\n`)

  const pts = (rings) => rings.reduce((n, ring) => n + ring.pts.length, 0)
  console.log(`state rings ${state.length} (${pts(state)} pts), counties ${counties.length} (${pts(counties)} pts), bend ${bend.length} ring(s)`)
  console.log(`viewBox 0 0 ${VB_W} ${fmt(scale.vbH)}`)
  console.log(`marker dots ${dots.length} (visible land, seal at ${SEAL_CX_FRAC * 100}% )`)
  for (const dot of dots) console.log(`  ${dot.title} (${dot.county}) ${fmt(dot.x)},${fmt(dot.y)}`)
  for (const ring of state) console.log(`  ring area ${(ring.area / 1e6).toFixed(1)} km2, ${ring.pts.length} pts`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
