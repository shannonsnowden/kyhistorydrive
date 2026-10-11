/**
 * Homepage "Open the history map" card.
 *
 * Reuses the Kentucky outline and county paths from the map strip SVGs
 * (Census cartographic boundaries, Kentucky Bend included) and plots every
 * marker in public/data/markers.geojson with the same EPSG:3089 projection
 * the strip uses. Writes a light and a dark file. SVG when the drawing is
 * about 60KB or under; WebP otherwise. Run from `npm run build` so a new
 * marker shows up on the next build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRIP_SVG = path.join(ROOT, 'public/brand/ky-map-strip-counties.svg')
const MARKERS = path.join(ROOT, 'public/data/markers.geojson')
const OUT_DIR = path.join(ROOT, 'public/brand')
const META_PATH = path.join(ROOT, 'src/history-map-card.generated.js')
const SVG_LIMIT = 60 * 1024
const CARD_W = 640
const CARD_H = 400
const SRC_W = 1000

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

function parsePath(d) {
  const rings = []
  for (const part of d.split(/Z/i)) {
    const nums = part.match(/-?\d+(?:\.\d+)?/g)
    if (!nums || nums.length < 6) continue
    const pts = []
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])])
    if (pts.length >= 3) rings.push(pts)
  }
  return rings
}

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

function nearRings(x, y, rings, pad) {
  if (inRings(x, y, rings)) return true
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2
    if (inRings(x + Math.cos(t) * pad, y + Math.sin(t) * pad, rings)) return true
  }
  return false
}

function fitAxis(src, dst) {
  const n = src.length
  let s1 = 0
  let s2 = 0
  let d1 = 0
  let sd = 0
  for (let i = 0; i < n; i++) {
    s1 += src[i]
    s2 += src[i] * src[i]
    d1 += dst[i]
    sd += src[i] * dst[i]
  }
  const det = n * s2 - s1 * s1
  if (Math.abs(det) < 1e-6) throw new Error('marker control points do not span the map')
  const scale = (n * sd - s1 * d1) / det
  const offset = (d1 - scale * s1) / n
  return { scale, offset }
}

function stripGeometry(svg) {
  const fill = svg.match(/class="hp-ky-fill" d="([^"]+)"/)
  const counties = svg.match(/class="hp-ky-counties" d="([^"]+)"/)
  const view = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!fill || !counties || !view) throw new Error('map strip SVG is missing the state or county paths')
  const srcW = Number(view[1])
  const srcH = Number(view[2])
  if (srcW !== SRC_W) throw new Error(`map strip width ${srcW} is not ${SRC_W}`)
  const dots = []
  const re = /<circle class="hp-ky-markers" cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+"><title>([^<]*)<\/title>/g
  let m
  while ((m = re.exec(svg))) dots.push({ x: Number(m[1]), y: Number(m[2]), title: m[3] })
  if (dots.length < 8) throw new Error(`map strip has ${dots.length} control markers; need at least 8`)
  return { fill: fill[1], counties: counties[1], srcW, srcH, dots }
}

function markerIndex(geo) {
  const byLabel = new Map()
  for (const feature of geo.features || []) {
    const title = feature.properties?.title
    const county = feature.properties?.county
    const pair = feature.geometry?.coordinates
    if (!title || !pair || pair.length < 2) continue
    byLabel.set(`${title}, ${county || ''} County`, pair)
  }
  return byLabel
}

function mapFrame(control, byLabel) {
  const projX = []
  const projY = []
  const svgX = []
  const svgY = []
  for (const dot of control) {
    const pair = byLabel.get(dot.title)
    if (!pair) throw new Error(`strip marker is not in markers.geojson: ${dot.title}`)
    const [x, y] = project(pair[0], pair[1])
    projX.push(x)
    projY.push(y)
    svgX.push(dot.x)
    svgY.push(dot.y)
  }
  const xFit = fitAxis(projX, svgX)
  const yFit = fitAxis(projY, svgY)
  let max = 0
  for (let i = 0; i < projX.length; i++) {
    const dx = xFit.scale * projX[i] + xFit.offset - svgX[i]
    const dy = yFit.scale * projY[i] + yFit.offset - svgY[i]
    max = Math.max(max, Math.hypot(dx, dy))
  }
  if (max > 0.6) throw new Error(`strip projection fit is off by ${max.toFixed(2)} px`)
  return { xFit, yFit, max }
}

function toCard(x, y, place) {
  return [x * place.scale + place.tx, y * place.scale + place.ty]
}

/** Path commands are M/L/Z with x y pairs. Rewrite every coordinate into the card. */
function scalePath(d, place) {
  return d.replace(/(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/g, (_, xs, ys) => {
    const [x, y] = toCard(Number(xs), Number(ys), place)
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
}

const PALETTES = {
  dark: { paper: '#1a241c', land: '#5a3d22', ink: '#e8d5a8', dot: '#e8d5a8' },
  light: { paper: '#f4ead6', land: '#e4d3ae', ink: '#6e4214', dot: '#6e4214' },
}

function cardSvg({ fill, counties, dots, palette }) {
  const circles = dots
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7" fill="${palette.dot}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">
  <rect width="${CARD_W}" height="${CARD_H}" fill="${palette.paper}"/>
  <path fill="${palette.land}" d="${fill}"/>
  <path fill="none" stroke="${palette.ink}" stroke-width="0.7" stroke-linejoin="round" stroke-linecap="round" opacity="0.55" d="${counties}"/>
  <path fill="none" stroke="${palette.ink}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" d="${fill}"/>
  ${circles}
</svg>
`
}

function writeMeta(type) {
  const ext = type === 'image/svg+xml' ? 'svg' : 'webp'
  const body = `/** Generated by scripts/build-history-map-card.mjs. Do not edit. */
export const HISTORY_MAP_CARD = {
  light: '/brand/ky-history-map-card-light.${ext}',
  dark: '/brand/ky-history-map-card-dark.${ext}',
  type: '${type}',
  width: ${CARD_W},
  height: ${CARD_H},
}
`
  fs.writeFileSync(META_PATH, body)
}

function removeStale(ext) {
  for (const theme of ['light', 'dark']) {
    const other = ext === 'svg' ? 'webp' : 'svg'
    const file = path.join(OUT_DIR, `ky-history-map-card-${theme}.${other}`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
}

async function emit(theme, svg) {
  const bytes = Buffer.byteLength(svg)
  return { theme, bytes, svg }
}

async function main() {
  assertProjection()
  const svgText = fs.readFileSync(STRIP_SVG, 'utf8')
  const geo = JSON.parse(fs.readFileSync(MARKERS, 'utf8'))
  const strip = stripGeometry(svgText)
  const byLabel = markerIndex(geo)
  const frame = mapFrame(strip.dots, byLabel)
  const pad = 12
  const scale = Math.min((CARD_W - pad * 2) / strip.srcW, (CARD_H - pad * 2) / strip.srcH)
  const place = {
    scale,
    tx: (CARD_W - strip.srcW * scale) / 2,
    ty: (CARD_H - strip.srcH * scale) / 2,
  }
  const fill = scalePath(strip.fill, place)
  const counties = scalePath(strip.counties, place)
  const stateRings = parsePath(fill)
  const bend = stateRings.filter((ring) => {
    let minX = Infinity
    let maxX = -Infinity
    for (const [x] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    return maxX - minX < 40
  })
  if (!bend.length) throw new Error('Kentucky Bend outline is missing from the card')
  const dots = []
  let outside = 0
  for (const feature of geo.features || []) {
    const pair = feature.geometry?.coordinates
    if (!pair || pair.length < 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) continue
    const [mx, my] = project(pair[0], pair[1])
    const sx = frame.xFit.scale * mx + frame.xFit.offset
    const sy = frame.yFit.scale * my + frame.yFit.offset
    const [x, y] = toCard(sx, sy, place)
    // A few Ohio-river markers sit just outside the simplified shore. 8px on the card brings them back onto land.
    if (nearRings(x, y, stateRings, 8)) dots.push([x, y])
    else outside += 1
  }
  if (dots.length < 1000) throw new Error(`only ${dots.length} markers landed on Kentucky`)
  const drawn = []
  for (const theme of ['dark', 'light']) {
    drawn.push(await emit(theme, cardSvg({ fill, counties, dots, palette: PALETTES[theme] })))
  }
  const largest = Math.max(...drawn.map((item) => item.bytes))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  let type = 'image/svg+xml'
  let ext = 'svg'
  if (largest > SVG_LIMIT) {
    type = 'image/webp'
    ext = 'webp'
    for (const item of drawn) {
      const webp = await sharp(Buffer.from(item.svg), { density: 144 })
        .webp({ quality: 70, effort: 6, smartSubsample: true })
        .toBuffer()
      const meta = await sharp(webp).metadata()
      if (meta.width !== CARD_W * 2 || meta.height !== CARD_H * 2) {
        throw new Error(`card raster is ${meta.width}x${meta.height}, expected ${CARD_W * 2}x${CARD_H * 2}`)
      }
      fs.writeFileSync(path.join(OUT_DIR, `ky-history-map-card-${item.theme}.webp`), webp)
      item.outBytes = webp.length
    }
  } else {
    for (const item of drawn) {
      fs.writeFileSync(path.join(OUT_DIR, `ky-history-map-card-${item.theme}.svg`), item.svg)
      item.outBytes = item.bytes
    }
  }
  removeStale(ext)
  writeMeta(type)
  console.log(`history map card ${ext} (${type}), svg ${largest} bytes, fit ${frame.max.toFixed(3)} px`)
  console.log(`markers on Kentucky ${dots.length}, off the outline ${outside}, bend rings ${bend.length}`)
  for (const item of drawn) console.log(`  ${item.theme} ${item.outBytes} bytes`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
