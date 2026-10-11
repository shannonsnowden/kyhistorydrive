/**
 * One small Kentucky-outline SVG per story that has a public pin.
 * Light and dark files, no county lines and no MapLibre. The outline is the
 * state fill from the homepage strip (Kentucky Bend included). The dot is
 * that story's pin in the same EPSG:3089 fit.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadMapFrame } from './build-history-map-card.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/brand/story-pins')
const STORIES = path.join(ROOT, 'public/content/stories.json')
const LOCATIONS = path.join(ROOT, 'public/content/stories-locations.json')
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const THEMES = {
  light: { paper: '#f4ead6', land: '#e4d3ae', edge: '#6e4214', pin: '#85500f', ring: '#fffdf6' },
  dark: { paper: '#1a241c', land: '#5a3d22', edge: '#e8d5a8', pin: '#c9893a', ring: '#1a241c' },
}

function publicGeo(lat, lon) {
  if (lat == null || lon == null || lat === '' || lon === '') return null
  const la = Number(lat)
  const lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null
  if (la === 0 && lo === 0) return null
  return { lat: la, lon: lo }
}

function svgFor(theme, d, viewBox, x, y) {
  const color = THEMES[theme]
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
    `<rect width="1000" height="431.7" fill="${color.paper}"/>` +
    `<path fill="${color.land}" stroke="${color.edge}" stroke-width="8" stroke-linejoin="round" fill-rule="evenodd" d="${d}"/>` +
    `<circle cx="${x}" cy="${y}" r="32" fill="${color.pin}" stroke="${color.ring}" stroke-width="10"/>` +
    `</svg>\n`
  )
}

function main() {
  const { d, viewBox, frame, project } = loadMapFrame()
  if (!d.includes('Z') && !d.includes('z')) throw new Error('story pin outline is missing the Kentucky Bend subpath')
  const index = JSON.parse(fs.readFileSync(STORIES, 'utf8'))
  const locations = JSON.parse(fs.readFileSync(LOCATIONS, 'utf8')).locations || {}
  fs.mkdirSync(OUT, { recursive: true })
  const keep = new Set()
  let bytes = 0
  let stories = 0
  for (const story of index.stories || []) {
    const slug = story.slug
    if (!SLUG.test(slug || '')) continue
    const loc = locations[slug] || {}
    const geo = publicGeo(loc.lat ?? story.lat, loc.lon ?? story.lon)
    if (!geo) continue
    const [mx, my] = project(geo.lon, geo.lat)
    const x = (frame.xFit.scale * mx + frame.xFit.offset).toFixed(1)
    const y = (frame.yFit.scale * my + frame.yFit.offset).toFixed(1)
    stories += 1
    for (const theme of ['light', 'dark']) {
      const name = `${slug}-${theme}.svg`
      const body = svgFor(theme, d, viewBox, x, y)
      fs.writeFileSync(path.join(OUT, name), body)
      keep.add(name)
      bytes += Buffer.byteLength(body)
    }
  }
  for (const name of fs.readdirSync(OUT)) {
    if (!keep.has(name)) fs.unlinkSync(path.join(OUT, name))
  }
  if (!stories) throw new Error('story pin thumbs: no public pins')
  console.log(`story pin thumbs ${stories} stories, ${keep.size} files, ${bytes} bytes`)
}

main()
