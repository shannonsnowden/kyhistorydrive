/**
 * Plot every marker onto the homepage county-map SVGs.
 *
 * The outline and county lines stay the ones in
 * public/brand/ky-map-strip-counties.svg and its light twin (Census
 * cartographic boundaries, Kentucky Bend included). Dots are placed with the
 * same EPSG:3089 fit the strip’s control markers use. Run from `npm run dev`
 * and `npm run build` so a new marker shows up on the next build.
 *
 * Each dot is r=1.25, no stroke, opacity .6. Dark fill is --heading #E8D5A8.
 * Light fill is --accent-deep #6E4214.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DARK_SVG = path.join(ROOT, 'public/brand/ky-map-strip-counties.svg')
const LIGHT_SVG = path.join(ROOT, 'public/brand/ky-map-strip-counties-light.svg')
const MARKERS = path.join(ROOT, 'public/data/markers.geojson')

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

/** Control dots from the strip, kept so a later run can refit after the circles are replaced. */
const CONTROL = [
  { x: 89.6, y: 396.9, title: 'New Madrid Earthquake, Fulton County' },
  { x: 161.5, y: 316.6, title: 'Wilmington, McCracken County' },
  { x: 261.6, y: 368.5, title: 'Upper Donaldson School, Trigg County' },
  { x: 511.1, y: 378.3, title: 'Tompkinsville National Cemetery, Monroe County' },
  { x: 537.2, y: 126.4, title: 'Woodland Farm, Oldham County' },
  { x: 549.0, y: 273.9, title: 'Sanders Tavern, Taylor County' },
  { x: 626.6, y: 35.5, title: 'Crash of AAFlight 383, Boone County' },
  { x: 629.8, y: 338.1, title: 'Local Humanitarian, Metcalfe County' },
  { x: 634.8, y: 223.0, title: "Sawyier's Inspiration, Jessamine County" },
  { x: 703.1, y: 128.4, title: 'Patriot-Pioneer, Nicholas County' },
  { x: 738.6, y: 388.3, title: 'Middlesboro Golf Club, Bell County' },
  { x: 775.1, y: 252.9, title: 'Breathitt County, Breathitt County' },
  { x: 822.0, y: 83.0, title: 'Enterprise Furnace, Greenup County' },
  { x: 831.1, y: 335.8, title: 'Lynch, Harlan County' },
  { x: 854.0, y: 176.5, title: 'Indian Creek Baptist Church, Harrison County' },
  { x: 915.8, y: 257.2, title: 'Frank and Nancy McCoy Phillips, Pike County' },
]

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

function liveControl(svg) {
  const dots = []
  const re = /<circle class="hp-ky-markers" cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+"><title>([^<]*)<\/title>/g
  let m
  while ((m = re.exec(svg))) dots.push({ x: Number(m[1]), y: Number(m[2]), title: m[3] })
  return dots.length >= 8 ? dots : null
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

function assertBend(svg) {
  const fill = svg.match(/class="hp-ky-fill" d="([^"]+)"/)
  if (!fill) throw new Error('map strip SVG is missing the state outline')
  const parts = fill[1].split(/Z/i).filter((part) => part.trim())
  if (parts.length < 2) throw new Error('Kentucky Bend outline is missing from the map strip')
  const bend = parts[parts.length - 1].match(/-?\d+(?:\.\d+)?/g) || []
  let minX = Infinity
  let maxX = -Infinity
  for (let i = 0; i + 1 < bend.length; i += 2) {
    const x = Number(bend[i])
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  if (!(maxX - minX < 40)) throw new Error('Kentucky Bend outline is missing from the map strip')
}

function markerDots(geo, frame) {
  const dots = []
  for (const feature of geo.features || []) {
    const pair = feature.geometry?.coordinates
    if (!pair || pair.length < 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) continue
    if (feature.geometry?.type && feature.geometry.type !== 'Point') continue
    const [mx, my] = project(pair[0], pair[1])
    const x = frame.xFit.scale * mx + frame.xFit.offset
    const y = frame.yFit.scale * my + frame.yFit.offset
    dots.push([x, y])
  }
  return dots
}

function circles(dots) {
  const lines = dots.map(
    ([x, y]) => `  <circle class="hp-ky-markers" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.25"/>`,
  )
  return `  <!-- Marker dots from public/data/markers.geojson. Generated by scripts/build-history-map-card.mjs. -->\n${lines.join('\n')}\n`
}

function rewrite(svg, markerRule, dotMarkup) {
  const stripped = svg
    .replace(/\s*<!-- Marker dots from public\/data\/markers\.geojson\. Generated by scripts\/build-history-map-card\.mjs\. -->\s*/g, '\n')
    .replace(/<circle class="hp-ky-markers"[\s\S]*?\/>\s*/g, '')
    .replace(/<circle class="hp-ky-markers"[\s\S]*?<\/circle>\s*/g, '')
  if (!stripped.includes('.hp-ky-markers')) throw new Error('map strip SVG is missing the marker style')
  const styled = stripped.replace(/\.hp-ky-markers\s*\{[^}]*\}/, markerRule)
  if (!styled.includes('</svg>')) throw new Error('map strip SVG is missing a closing tag')
  return styled.replace('</svg>', `${dotMarkup}</svg>`)
}

/** Outline path plus the EPSG:3089 fit, for the per-story pin thumbnails. */
export function loadMapFrame() {
  assertProjection()
  const dark = fs.readFileSync(DARK_SVG, 'utf8')
  assertBend(dark)
  const fill = dark.match(/class="hp-ky-fill" d="([^"]+)"/)
  if (!fill) throw new Error('map strip SVG is missing the state outline')
  const geo = JSON.parse(fs.readFileSync(MARKERS, 'utf8'))
  const control = liveControl(dark) || CONTROL
  const frame = mapFrame(control, markerIndex(geo))
  return { d: fill[1], viewBox: '0 0 1000 431.7', frame, project }
}

function main() {
  assertProjection()
  const dark = fs.readFileSync(DARK_SVG, 'utf8')
  const light = fs.readFileSync(LIGHT_SVG, 'utf8')
  assertBend(dark)
  assertBend(light)
  const geo = JSON.parse(fs.readFileSync(MARKERS, 'utf8'))
  const control = liveControl(dark) || CONTROL
  const frame = mapFrame(control, markerIndex(geo))
  const dots = markerDots(geo, frame)
  if (dots.length < 1900) throw new Error(`only ${dots.length} markers were plotted; expected about 1,921`)
  const markup = circles(dots)
  const darkOut = rewrite(dark, '.hp-ky-markers { fill: #E8D5A8; stroke: none; opacity: .6; }', markup)
  const lightOut = rewrite(light, '.hp-ky-markers { fill: #6E4214; stroke: none; opacity: .6; }', markup)
  fs.writeFileSync(DARK_SVG, darkOut)
  fs.writeFileSync(LIGHT_SVG, lightOut)
  console.log(
    `history map dots ${dots.length}, fit ${frame.max.toFixed(3)} px, dark ${Buffer.byteLength(darkOut)} bytes, light ${Buffer.byteLength(lightOut)} bytes`,
  )
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) main()
