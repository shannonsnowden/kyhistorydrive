/**
 * GPX and KML for the six route maps, from the waypoint tables in NOTES.md.
 * Only rows with one coordinate pair are written. Approximate is copied from the notes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRouteNotes } from './route-notes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const routesRoot = path.join(root, 'public/maps/routes')

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pointName(point, index) {
  const name = String(point.name || '').trim()
  return name || point.place || `Waypoint ${index + 1}`
}

function pointDesc(point) {
  const bits = [point.place, point.county].map((bit) => String(bit || '').trim()).filter(Boolean)
  let text = bits.join('. ')
  if (point.approximate) text = text ? `${text}. Approximate.` : 'Approximate.'
  if (point.conjectural) text = `${text} Conjectural.`.trim()
  return text
}

function gpxDocument({ title, url, approximate, points }) {
  const name = approximate ? `${title} (approximate)` : title
  const desc = approximate
    ? `Approximate waypoints for ${title}. Positions are taken from the story notes and are not a survey. ${url}`
    : `Waypoints for ${title}. ${url}`
  const marks = points
    .map((point, index) => {
      const label = xml(pointName(point, index))
      const detail = xml(pointDesc(point))
      return `  <wpt lat="${point.latText}" lon="${point.lonText}">
    <name>${label}</name>
    <desc>${detail}</desc>
  </wpt>`
    })
    .join('\n')
  const routePts = points
    .map((point, index) => {
      const label = xml(pointName(point, index))
      const detail = xml(pointDesc(point))
      return `    <rtept lat="${point.latText}" lon="${point.lonText}">
      <name>${label}</name>
      <desc>${detail}</desc>
    </rtept>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Kentucky History Drive" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${xml(name)}</name>
    <desc>${xml(desc)}</desc>
    <link href="${xml(url)}"><text>${xml(title)}</text></link>
  </metadata>
${marks}
  <rte>
    <name>${xml(name)}</name>
    <desc>${xml(desc)}</desc>
${routePts}
  </rte>
</gpx>
`
}

function kmlDocument({ title, url, approximate, points }) {
  const name = approximate ? `${title} (approximate)` : title
  const desc = approximate
    ? `Approximate waypoints for ${title}. Positions are taken from the story notes and are not a survey. ${url}`
    : `Waypoints for ${title}. ${url}`
  const placemarks = points
    .map((point, index) => {
      return `    <Placemark>
      <name>${xml(pointName(point, index))}</name>
      <description>${xml(pointDesc(point))}</description>
      <Point><coordinates>${point.lonText},${point.latText},0</coordinates></Point>
    </Placemark>`
    })
    .join('\n')
  const line = points.map((point) => `${point.lonText},${point.latText},0`).join(' ')
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xml(name)}</name>
    <description>${xml(desc)}</description>
${placemarks}
    <Placemark>
      <name>${xml(name)}</name>
      <description>${xml(desc)}</description>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${line}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
`
}

function storyTitle(slug) {
  const file = path.join(root, 'public/content/stories', `${slug}.json`)
  if (!fs.existsSync(file)) throw new Error(`route tracks: no story file for ${slug}`)
  const story = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!story.title) throw new Error(`route tracks: ${slug} has no title`)
  return story.title
}

function main() {
  const slugs = fs
    .readdirSync(routesRoot, { withFileTypes: true })
    .filter((ent) => ent.isDirectory() && fs.existsSync(path.join(routesRoot, ent.name, 'NOTES.md')))
    .map((ent) => ent.name)
    .sort()
  if (slugs.length !== 6) {
    throw new Error(`route tracks: expected 6 NOTES.md routes, found ${slugs.length}`)
  }
  const meta = {}
  for (const slug of slugs) {
    const notes = fs.readFileSync(path.join(routesRoot, slug, 'NOTES.md'), 'utf8')
    const parsed = parseRouteNotes(notes)
    if (!parsed.points.length) throw new Error(`route tracks: ${slug} has no single-coordinate waypoints`)
    if (!parsed.approximate) {
      throw new Error(`route tracks: ${slug} waypoint heading does not say approximate`)
    }
    for (const point of parsed.points) {
      if (!point.approximate) throw new Error(`route tracks: ${slug} point is not marked approximate`)
      if (/-?\d+\.\d{5,}/.test(`${point.latText},${point.lonText}`)) {
        throw new Error(`route tracks: ${slug} coordinate is tighter than the notes table`)
      }
    }
    const title = storyTitle(slug)
    const url = `https://kyhistorydrive.com/stories/${slug}/`
    const gpxName = `${slug}.gpx`
    const kmlName = `${slug}.kml`
    const dir = path.join(routesRoot, slug)
    fs.writeFileSync(path.join(dir, gpxName), gpxDocument({ title, url, approximate: true, points: parsed.points }))
    fs.writeFileSync(path.join(dir, kmlName), kmlDocument({ title, url, approximate: true, points: parsed.points }))
    meta[slug] = {
      gpx: `/maps/routes/${slug}/${gpxName}`,
      kml: `/maps/routes/${slug}/${kmlName}`,
      approximate: true,
      points: parsed.points.length,
    }
    console.log(`route tracks: ${slug} ${parsed.points.length} waypoints`)
  }
  const lines = [
    '/** Generated by scripts/build-route-tracks.mjs from NOTES.md waypoint tables. */',
    `export const ROUTE_TRACKS = ${JSON.stringify(meta, null, 2)}`,
    '',
  ]
  fs.writeFileSync(path.join(root, 'src/route-track-meta.js'), lines.join('\n'))
  console.log(`route tracks: ${slugs.length} routes`)
}

main()
