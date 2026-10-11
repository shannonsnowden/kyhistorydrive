/**
 * Checks for the no-login story tools: citations, nearby miles, photo credits,
 * correction links, and NOTES.md waypoint parsing.
 */
import assert from 'node:assert/strict'
import { parseRouteNotes, parseSingleCoordinate } from './route-notes.mjs'
import {
  SITE_NAME,
  accessedPhrase,
  buildCitation,
  citeBoxHtml,
  correctionUrl,
  formatMiles,
  haversineMiles,
  markerMapHref,
  nearbyHtml,
  nearbyMarkers,
  nearbyPlaces,
  nearbyStories,
  photoCreditHtml,
  photoCreditModel,
  resolveArticleDates,
} from '../src/story-tools.js'

function coord(cell, expect) {
  const got = parseSingleCoordinate(cell)
  if (expect == null) {
    assert.equal(got, null, cell)
    return
  }
  assert.ok(got, cell)
  assert.equal(got.lat, expect[0], cell)
  assert.equal(got.lon, expect[1], cell)
}

coord('38.72, -77.48', [38.72, -77.48])
coord('≈38.08, -78.45', [38.08, -78.45])
coord('~37.84, -84.02', [37.84, -84.02])
coord('38.137, -83.566 (bend)', [38.137, -83.566])
coord('38.00, -79.83', [38, -79.83])
coord('≈36.72, -82.6 to -83.08', null)
coord('≈37.5–37.6, -84.26', null)
coord('40.45, -80.00; 40.60, -80.24', null)
coord('38.03, -78.86 → 38.08, -78.24', null)
coord('≈38.1 → 37.15, -84.45 to -82.6', null)
coord('', null)

const notes = `# Title

## Waypoints – WGS84, approximate
| # | stop | modern town / area | county, state | lat, lon | confidence |
|---|---|---|---|---|---|
| 1 | Castle Hill | near Cismont | Albemarle Co., VA | 38.08, -78.24 | high |
| 2 | a range | Rockfish valley | VA | ≈37.8, -78.75 to -78.97 | low |
| 3 | a guess | disputed | KY | ≈38.55, -84.70 | conjectural |

## Uncertainty notes
- The outbound route is approximate.
`
const parsed = parseRouteNotes(notes)
assert.equal(parsed.approximate, true)
assert.equal(parsed.points.length, 2)
assert.equal(parsed.points[0].name, 'Castle Hill')
assert.equal(parsed.points[0].approximate, true)
assert.equal(parsed.points[1].conjectural, true)
assert.equal(parsed.points[1].latText, '38.55')

const fields = {
  title: 'Battle of Blue Licks',
  published: '2026-08-30',
  modified: '2026-10-05',
  url: 'https://kyhistorydrive.com/stories/battle-of-blue-licks/',
}
const chicago = buildCitation('chicago', fields)
const mla = buildCitation('mla', fields)
for (const citation of [chicago, mla]) {
  assert.match(citation.plain, /Battle of Blue Licks/)
  assert.match(citation.plain, new RegExp(SITE_NAME))
  assert.match(citation.plain, /https:\/\/kyhistorydrive\.com\/stories\/battle-of-blue-licks\//)
  assert.doesNotMatch(citation.plain, /Accessed/)
}
assert.match(chicago.plain, /Published August 30, 2026/)
assert.match(chicago.plain, /Last modified October 5, 2026/)
assert.match(mla.plain, /published 30 Aug\. 2026/)
assert.match(mla.plain, /last modified 5 Oct\. 2026/)
assert.match(mla.html, /<em>Kentucky History Drive<\/em>/)

const same = buildCitation('chicago', { ...fields, modified: fields.published })
assert.doesNotMatch(same.plain, /Last modified/)
assert.match(same.plain, /August 30, 2026/)

const box = citeBoxHtml(fields)
assert.match(box, /Cite this story/)
assert.match(box, /data-cite-copy="chicago"/)
assert.match(box, /data-cite-copy="mla"/)
assert.match(box, /datetime="2026-08-30"/)
assert.match(box, /datetime="2026-10-05"/)
assert.doesNotMatch(box, /Accessed/)
assert.equal(accessedPhrase('chicago', new Date(2026, 9, 11)), 'Accessed October 11, 2026.')
assert.equal(accessedPhrase('mla', new Date(2026, 9, 11)), 'Accessed 11 Oct. 2026.')

const emptyDates = resolveArticleDates({ title: 'No dates' }, {})
assert.equal(emptyDates.published, '')
assert.equal(emptyDates.modified, '')
const fromStory = resolveArticleDates(
  { publishedDate: '2026-08-30', modifiedDate: '2026-09-01' },
  { published: '2020-01-01', modified: '2020-01-02' },
)
assert.deepEqual(fromStory, { published: '2026-08-30', modified: '2026-09-01' })
const fromGit = resolveArticleDates({ title: 'Git only' }, { published: '2026-08-01', modified: '2026-08-02' })
assert.deepEqual(fromGit, { published: '2026-08-01', modified: '2026-08-02' })

const href = correctionUrl({ title: 'Battle of Blue Licks', url: fields.url })
const issue = new URL(href)
assert.equal(issue.origin + issue.pathname, 'https://github.com/shannonsnowden/kyhistorydrive/issues/new')
assert.equal(issue.searchParams.get('labels'), 'correction')
assert.match(issue.searchParams.get('title'), /Battle of Blue Licks/)
assert.match(issue.searchParams.get('body'), /https:\/\/kyhistorydrive\.com\/stories\/battle-of-blue-licks\//)
assert.doesNotMatch(href, /contact@|mailto:/i)

const credit = photoCreditModel({
  image_url: '/photo.jpg',
  source_url: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
  source_label: 'Wikimedia Commons',
  attribution: 'Coasterlover1994 · Wikimedia Commons · CC BY-SA 4.0',
})
assert.equal(credit.photographer, 'Coasterlover1994')
assert.equal(credit.source, 'Wikimedia Commons')
assert.equal(credit.license, 'CC BY-SA 4.0')
const creditHtml = photoCreditHtml({
  image_url: '/photo.jpg',
  source_url: 'https://commons.wikimedia.org/wiki/File:Chickamauga_Towns.jpg',
  source_label: 'Wikimedia Commons',
  attribution: 'Chuck Hamilton · Wikimedia Commons · GFDL 1.2 or later / CC BY-SA 4.0',
  credit: 'Chuck Hamilton',
  license: 'GFDL 1.2 or later; CC BY-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0',
})
assert.match(creditHtml, /Chuck Hamilton/)
assert.match(creditHtml, /commons\.wikimedia\.org/)
assert.match(creditHtml, /License:/)
assert.match(creditHtml, /creativecommons\.org/)
assert.match(creditHtml, /target="_blank"/)

const sourceOnly = photoCreditModel({
  image_url: '/photo.jpg',
  source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg',
  source_label: 'Wikimedia Commons',
  attribution: 'Wikimedia Commons',
})
assert.equal(sourceOnly.photographer, '')
assert.equal(sourceOnly.license, '')

const miles = haversineMiles(38.2527, -85.7585, 38.0406, -84.5037)
assert.ok(miles > 60 && miles < 90, `Louisville–Lexington should be about 75 miles, got ${miles}`)
const near = nearbyStories(
  { slug: 'a', title: 'A', lat: 38, lon: -85 },
  [
    { slug: 'a', title: 'A', lat: 38, lon: -85 },
    { slug: 'b', title: 'B', lat: 38.01, lon: -85 },
    { slug: 'c', title: 'C', lat: 38.2, lon: -85 },
    { slug: 'd', title: 'D', lat: 39, lon: -85 },
    { slug: 'e', title: 'E', lat: 40, lon: -85 },
    { slug: 'f', title: 'F', lat: 41, lon: -85 },
    { slug: 'g', title: 'G', lat: null, lon: null },
  ],
)
assert.equal(near.length, 5)
assert.deepEqual(near.map((row) => row.slug), ['b', 'c', 'd', 'e', 'f'])
assert.match(formatMiles(near[0].miles), /miles/)
assert.equal(nearbyStories({ slug: 'x', title: 'X' }, near).length, 0)
assert.equal(nearbyStories({ slug: 'null-pin', title: 'Null', lat: null, lon: null }, near).length, 0)
assert.equal(nearbyStories({ slug: 'zero-pin', title: 'Zero', lat: 0, lon: 0 }, near).length, 0)

const origin = { slug: 'here', title: 'Here', lat: 38, lon: -85 }
const storyRows = [
  origin,
  { slug: 'near-story', title: 'Near story', lat: 38.02, lon: -85 },
  { slug: 'mid-story', title: 'Mid story', lat: 38.05, lon: -85 },
  { slug: 'far-story', title: 'Far story', lat: 38.2, lon: -85 },
]
const markerRows = [
  { id: '1', title: 'Close marker', lat: 38.005, lon: -85 },
  { id: '2', title: 'Mid marker', lat: 38.04, lon: -85 },
  { id: '3', title: 'Far marker', lat: 38.3, lon: -85 },
  { id: 'skip', title: 'No pin', lat: null, lon: null },
  { id: 'zero', title: 'Zero', lat: 0, lon: 0 },
]
const places = nearbyPlaces(origin, storyRows, markerRows)
assert.deepEqual(places.map((row) => row.title), [
  'Close marker',
  'Near story',
  'Mid marker',
  'Mid story',
  'Far story',
  'Far marker',
])
assert.equal(markerMapHref('1610'), '/#map/markers/1610')
assert.equal(nearbyMarkers({ slug: 'x', title: 'X' }, markerRows).length, 0)
const nearby = nearbyHtml(origin, storyRows, { markers: markerRows })
assert.match(nearby, /href="\/stories\/near-story\/"/)
assert.match(nearby, /href="\/#map\/markers\/1"/)
assert.match(nearby, /Historical marker,/)
assert.doesNotMatch(nearby, /href="\/#timeline\/|href="\/#map\/stories\//)
assert.ok(nearby.indexOf('Close marker') < nearby.indexOf('Near story'))
assert.ok(nearby.indexOf('Near story') < nearby.indexOf('Mid marker'))
assert.equal(nearbyHtml({ slug: 'none', title: 'None' }, storyRows, { markers: markerRows }), '')

console.log('story quick wins: ok')
