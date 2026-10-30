/**
 * Drive GPX: public exact waypoints only, GPX 1.1, private and approx omitted.
 * Also checks the print sheet and Visiting line the drive-page build writes.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { renderDriveGpx, stopOmitsDriveGeo, visitingPlain } from './drive-gpx.mjs'
import { parseJsLiteral } from './js-literal.mjs'

const fail = (m) => { console.error('test-drive-gpx:', m); process.exit(1) }

function leaksPair(gpx, rawLat, rawLon) {
  const trim = (raw) => String(raw).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const attr = (axis, raw) => new RegExp(`${axis}="${trim(raw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}0*"`)
  return attr('lat', rawLat).test(gpx) && attr('lon', rawLon).test(gpx)
}

const fixture = [
  { id: 'pub', name: 'Public Museum', lat: 38.2001, lon: -84.8763, access: 'Open daily', when: '1920', flags: ['limited'] },
  { id: 'priv', name: 'Private Farm', lat: 38.4, lon: -84.28, private: true, access: 'Marker only. Private farmland.', flags: ['private'] },
  { id: 'approx', name: 'Mound site', lat: 37.0, lon: -89.1, approx: true, access: 'State historic site' },
  { id: 'both', name: 'Hidden', lat: 37.55, lon: -86.22, private: true, approx: true, access: 'Do not publish' },
]
assert.equal(stopOmitsDriveGeo(fixture[0]), false)
assert.equal(stopOmitsDriveGeo(fixture[1]), true)
assert.equal(stopOmitsDriveGeo(fixture[2]), true)
assert.equal(stopOmitsDriveGeo(fixture[3]), true)
assert.match(visitingPlain(fixture[0]), /Open daily/)
assert.match(visitingPlain(fixture[0]), /Limited hours/)
assert.doesNotMatch(visitingPlain(fixture[1]), /38\.4/)

const sample = renderDriveGpx({
  name: 'Tom & Jerry\'s "Loop"',
  desc: 'A <test> & more',
  url: 'https://kyhistorydrive.com/drives/test/',
  stops: fixture,
})
assert.match(sample, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
assert.match(sample, /<gpx version="1\.1" creator="Kentucky History Drive" xmlns="http:\/\/www\.topografix\.com\/GPX\/1\/1">/)
assert.match(sample, /Tom &amp; Jerry&apos;s &quot;Loop&quot;/)
assert.doesNotMatch(sample, /<test>/)
assert.match(sample, /<wpt lat="38\.2001" lon="-84\.8763">/)
assert.match(sample, /<name>1\. Public Museum<\/name>/)
assert.match(sample, /Visiting: Open daily\. Limited hours/)
assert.equal((sample.match(/<wpt /g) || []).length, 1)
assert.equal((sample.match(/<rtept /g) || []).length, 1)
assert.doesNotMatch(sample, /<trk/)
for (const stop of fixture.slice(1)) {
  assert.equal(leaksPair(sample, stop.lat, stop.lon), false, `${stop.id} leaked`)
  assert.doesNotMatch(sample, new RegExp(`<name>[^<]*${stop.name}`))
}
execFileSync('python3', ['-c', 'import sys,xml.etree.ElementTree as ET; r=ET.parse(sys.stdin); g=r.getroot(); assert g.tag.endswith("gpx"); assert g.attrib.get("version")=="1.1"'], { input: sample })

const DP = 'public/drives'
const slugs = fs.readdirSync(DP).filter((d) => fs.existsSync(path.join(DP, d, 'index.html'))).sort()
assert.ok(slugs.includes('buffalo-trace') && slugs.includes('licking-valley') && slugs.includes('cave-country'))
assert.ok(!slugs.includes('build'), 'BYOD planner is not a curated drive')

const css = fs.readFileSync('src/drive-print.css', 'utf8')
assert.equal(fs.readFileSync(path.join(DP, 'drive-print.css'), 'utf8'), css)
assert.match(css, /@page \{ size: Letter/)
assert.match(css, /\.print-masthead/)
assert.match(css, /\.finder/)
assert.match(css, /google\.com\/maps/)
assert.match(css, /maps\.apple\.com/)

const byod = fs.readFileSync('drives/build/index.html', 'utf8')
assert.doesNotMatch(byod, /drive-print|route\.gpx|stop-visit/)

function routeFile(slug) {
  return [`public/drives/routes/${slug}.json`, `public/drives/${slug}-route.json`].find((f) => fs.existsSync(f))
}

for (const slug of slugs) {
  const html = fs.readFileSync(path.join(DP, slug, 'index.html'), 'utf8')
  const m = html.match(/const STOPS = (\[[\s\S]*?\n\])/)
  if (!m) fail(`${slug} has no STOPS`)
  const stops = parseJsLiteral(m[1])
  const raw = new Map([...m[1].matchAll(/id:["']([^"']+)["'][^\n]*lat:(-?[\d.]+),\s*lon:(-?[\d.]+)/g)].map((x) => [x[1], [x[2], x[3]]]))
  const gpxPath = path.join(DP, slug, 'route.gpx')
  if (!fs.existsSync(gpxPath)) fail(`${slug} is missing route.gpx`)
  const gpx = fs.readFileSync(gpxPath, 'utf8')
  execFileSync('python3', ['-c', 'import sys,xml.etree.ElementTree as ET; r=ET.parse(sys.argv[1]); g=r.getroot(); assert g.tag=="{http://www.topografix.com/GPX/1/1}gpx"; assert g.attrib.get("version")=="1.1"; assert g.attrib.get("creator")=="Kentucky History Drive"', gpxPath])
  assert.match(gpx, /<gpx version="1\.1" creator="Kentucky History Drive"/)
  assert.doesNotMatch(gpx, /<trk/)
  const publicStops = stops.filter((s) => !stopOmitsDriveGeo(s))
  assert.equal((gpx.match(/<wpt /g) || []).length, publicStops.length, `${slug} wpt count`)
  assert.equal((gpx.match(/<rtept /g) || []).length, publicStops.length, `${slug} rtept count`)
  for (const s of stops) {
    const [rawLat, rawLon] = raw.get(s.id) || [String(s.lat), String(s.lon)]
    if (stopOmitsDriveGeo(s)) {
      if (leaksPair(gpx, rawLat, rawLon) || leaksPair(gpx, s.lat, s.lon)) fail(`${slug} GPX includes ${s.id} (${rawLat},${rawLon})`)
    } else if (!gpx.includes(`lat="${s.lat}" lon="${s.lon}"`)) {
      fail(`${slug} GPX missing public stop ${s.id}`)
    }
  }
  const route = JSON.parse(fs.readFileSync(routeFile(slug), 'utf8'))
  const stopPairs = new Set(stops.map((s) => `${s.lat},${s.lon}`))
  const stray = (route.line || []).find(([lon, lat]) => !stopPairs.has(`${lat},${lon}`))
  if (stray && gpx.includes(`lat="${stray[1]}" lon="${stray[0]}"`)) fail(`${slug} GPX includes a road-line point`)
  assert.match(html, /href="\/drives\/drive-print\.css"/)
  assert.match(html, /data-print onclick="window\.print\(\)"/)
  assert.match(html, new RegExp(`href="/drives/${slug}/route\\.gpx"`))
  assert.match(html, /class="print-masthead print-only"/)
  assert.match(html, new RegExp(`About ${Math.round(route.miles)} miles`))
  assert.match(html, /<p class="stop-meta">\$\{esc\(s\.when\)\}<\/p><p class="stop-visit"><b>Visiting:<\/b> \$\{tag\} \$\{esc\(s\.access\)\}<\/p>/)
  const ol = html.match(/<ol class="stops" id="stops">([\s\S]*?)<\/ol>/)?.[1] || ''
  assert.equal((ol.match(/class="stop-visit"/g) || []).length, stops.length, `${slug} visiting lines`)
  assert.doesNotMatch(ol, /lat=|lon=/)
  const mast = html.match(/class="print-masthead print-only">([\s\S]*?)<\/p>/)?.[1] || ''
  assert.doesNotMatch(mast, /-?\d+\.\d+/)
}

const buffalo = fs.readFileSync('public/drives/buffalo-trace/route.gpx', 'utf8')
assert.equal((buffalo.match(/<wpt /g) || []).length, 9)
assert.match(buffalo, /lat="38\.2157" lon="-84\.8691"/)
assert.match(buffalo, /Visiting: Working distillery; visitor tours by reservation\. Reservation needed/)
assert.match(fs.readFileSync('public/drives/buffalo-trace/index.html', 'utf8'), /About 28 miles · About 0 h 55 min/)

const licking = fs.readFileSync('public/drives/licking-valley/route.gpx', 'utf8')
assert.equal(leaksPair(licking, '38.40', '-84.28'), false, "Ruddell's Station")
assert.equal(leaksPair(licking, '38.33', '-84.26'), false, "Martin's Station")
assert.match(licking, /lat="38\.4293" lon="-83\.9939"/)
assert.match(fs.readFileSync('public/drives/licking-valley/index.html', 'utf8'), /Visiting:[\s\S]*Marker only\. The site is on private farmland\./)

const cave = fs.readFileSync('public/drives/cave-country/route.gpx', 'utf8')
assert.equal(leaksPair(cave, '37.0', '-86.5'), false, 'Lost River Cave approx')
assert.match(cave, /lat="37\.187" lon="-86\.1013"/)

console.log(`test-drive-gpx: fixture omits private/approx; ${slugs.length} drives are GPX 1.1 with public exact waypoints only`)
