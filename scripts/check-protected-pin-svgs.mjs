#!/usr/bin/env node
/**
 * check-protected-pin-svgs: each protected story's pin thumbnail (dist/brand/story-pins/<slug>-{light,dark}.svg,
 * added by #222) must put its dot (circle cx/cy) at the projection of the ROUNDED (0.1°) coordinate,
 * within 1px, so a thumbnail can't show the exact spot. Uses the same projection as the thumbnail
 * builder (loadMapFrame in scripts/build-history-map-card.mjs).
 * Skips (exit 0) when there are no pin SVGs yet.
 * Usage: node scripts/check-protected-pin-svgs.mjs [--dist dist] [--frame-module path]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null }
const dist = path.resolve(arg('--dist') || 'dist')
const pinsDir = path.join(dist, 'brand/story-pins')
const TOL = 1

const svgs = fs.existsSync(pinsDir) ? fs.readdirSync(pinsDir).filter((f) => f.endsWith('.svg')) : []
if (!svgs.length) {
  console.log('check-protected-pin-svgs: no story pin SVGs in dist (brand/story-pins), skipped')
  process.exit(0)
}
const ids = new Set(JSON.parse(fs.readFileSync(path.join(dist, 'data/web/protected-pins.json'), 'utf8')).ids || [])
const frameModule = path.resolve(arg('--frame-module') || path.join(here, 'build-history-map-card.mjs'))
if (!fs.existsSync(frameModule)) {
  console.error(`check-protected-pin-svgs: pin SVGs exist but ${frameModule} (loadMapFrame) is missing`)
  process.exit(1)
}
const { loadMapFrame } = await import(pathToFileURL(frameModule).href)
const { frame, project } = loadMapFrame()

// Rounded coordinate per slug: stories-locations.json, falling back to the stories layer.
const coords = new Map()
const locFile = path.join(dist, 'content/stories-locations.json')
if (fs.existsSync(locFile)) {
  for (const [slug, l] of Object.entries(JSON.parse(fs.readFileSync(locFile, 'utf8')).locations || {})) {
    if (l && l.lat != null && l.lon != null) coords.set(slug, [Number(l.lat), Number(l.lon)])
  }
}
const layer = path.join(dist, 'data/layers/stories.geojson')
if (fs.existsSync(layer)) {
  for (const f of JSON.parse(fs.readFileSync(layer, 'utf8')).features || []) {
    const id = f.properties?.id
    if (id && !coords.has(id) && f.geometry?.type === 'Point') coords.set(id, [f.geometry.coordinates[1], f.geometry.coordinates[0]])
  }
}
const r1 = (v) => Math.round(v * 10) / 10

const errors = []
let checked = 0
for (const file of svgs) {
  const m = file.match(/^(.+)-(light|dark)\.svg$/)
  if (!m || !ids.has(m[1])) continue
  const slug = m[1]
  const c = coords.get(slug)
  if (!c) { errors.push(`${file}: protected story has a pin SVG but no published coordinate`); continue }
  const [mx, my] = project(r1(c[1]), r1(c[0]))
  const ex = frame.xFit.scale * mx + frame.xFit.offset
  const ey = frame.yFit.scale * my + frame.yFit.offset
  const svg = fs.readFileSync(path.join(pinsDir, file), 'utf8')
  const circles = [...svg.matchAll(/<circle\b[^>]*>/g)].map((t) => ({
    cx: Number((t[0].match(/\bcx="([-\d.]+)"/) || [])[1]),
    cy: Number((t[0].match(/\bcy="([-\d.]+)"/) || [])[1]),
  }))
  if (!circles.length) { errors.push(`${file}: no <circle> pin`); continue }
  for (const { cx, cy } of circles) {
    if (!(Math.abs(cx - ex) <= TOL && Math.abs(cy - ey) <= TOL)) {
      errors.push(`${file}: dot at ${cx},${cy}; rounded coordinate projects to ${ex.toFixed(1)},${ey.toFixed(1)}`)
    }
  }
  checked++
}
if (errors.length) {
  console.error(`check-protected-pin-svgs: ${errors.length} protected pin thumbnail(s) off the rounded point:`)
  for (const e of errors.slice(0, 30)) console.error('  ' + e)
  process.exit(1)
}
console.log(`check-protected-pin-svgs: ${checked} protected pin SVGs match their 0.1° point within ${TOL}px`)
