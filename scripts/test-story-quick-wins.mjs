/**
 * Checks for the no-login story tools: citations, nearby miles, photo credits,
 * correction links, and NOTES.md waypoint parsing.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRouteNotes, parseSingleCoordinate } from './route-notes.mjs'
import { isProtectedWaypoint, roundProtectedWaypoint } from './protected-waypoints.mjs'
import { modifiedFromProseHistory, textRevisionForFile } from './story-dates.mjs'
import {
  CITE_AUTHOR_FALLBACK,
  SITE_NAME,
  accessedPhrase,
  buildCitation,
  citeBoxHtml,
  correctionHtml,
  correctionUrl,
  formatMiles,
  haversineMiles,
  markerMapHref,
  nearbyHtml,
  nearbyMarkers,
  nearbyPlaces,
  nearbyStories,
  compactYearRange,
  learnMoreBlockHtml,
  learnMoreItemsFromMarkdown,
  learnMoreLinkText,
  pickRelatedStories,
  relatedAndNearbyHtml,
  storyThumbSrc,
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
coord('38.7, -83.1 (rounded to 0.1°, protected site)', [38.7, -83.1])
coord('38.7, -83.0 (rounded to 0.1°, protected site)', [38.7, -83])
coord('', null)

const protectedNames = ['Lower Shawneetown', 'Eskippakithiki', 'Indian Old Fields']
const shawnee = roundProtectedWaypoint(
  { name: 'Lower Shawneetown (Ohio crossing)', place: 'South Portsmouth', lat: 38.7, lon: -83.1, latText: '38.7', lonText: '-83.1' },
  protectedNames,
)
assert.equal(shawnee.latText, '38.7')
assert.equal(shawnee.lonText, '-83.1')
const eski = roundProtectedWaypoint(
  { name: 'Eskippakithiki (Indian Old Fields)', place: 'Indian Fields', lat: 37.946, lon: -84, latText: '37.946', lonText: '-84.000' },
  protectedNames,
)
assert.equal(eski.latText, '37.9')
assert.equal(eski.lonText, '-84.0')
const gap = roundProtectedWaypoint(
  { name: 'Cumberland Gap', place: 'Middlesboro', lat: 36.604, lon: -83.674, latText: '36.604', lonText: '-83.674' },
  protectedNames,
)
assert.equal(gap.latText, '36.604')
assert.equal(isProtectedWaypoint(gap, protectedNames), false)

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
assert.match(chicago.plain, /Snowden, Shannon/)
assert.match(chicago.plain, /Published August 30, 2026/)
assert.match(chicago.plain, /Last revised October 5, 2026/)
assert.match(mla.plain, /published 30 Aug\. 2026/)
assert.match(mla.plain, /last revised 5 Oct\. 2026/)
assert.match(mla.html, /<em>Kentucky History Drive<\/em>/)

const same = buildCitation('chicago', { ...fields, modified: fields.published })
assert.match(same.plain, /Published August 30, 2026/)
assert.match(same.plain, /Last revised August 30, 2026/)

const revisedOnly = buildCitation('chicago', { ...fields, published: '' })
assert.match(revisedOnly.plain, /Last revised October 5, 2026/)
assert.doesNotMatch(revisedOnly.plain, /Published/)
const revisedMla = buildCitation('mla', { ...fields, published: '' })
assert.match(revisedMla.plain, /last revised 5 Oct\. 2026/)
assert.doesNotMatch(revisedMla.plain, /published/)

const org = buildCitation('chicago', { ...fields, author: '' })
assert.match(org.plain, new RegExp(`^${CITE_AUTHOR_FALLBACK}\\.`))
assert.doesNotMatch(org.plain, /Drive, KY/)

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
const storyFieldLoses = resolveArticleDates(
  { publishedDate: '2026-08-30', briefDate: '2026-08-30', modifiedDate: '2026-09-01' },
  { published: '2020-01-01', modified: '2020-01-02' },
)
assert.deepEqual(storyFieldLoses, { published: '2020-01-01', modified: '2020-01-02' })
const fromGit = resolveArticleDates({ title: 'Git only' }, { published: '2026-08-01', modified: '2026-08-02' })
assert.deepEqual(fromGit, { published: '2026-08-01', modified: '2026-08-02' })
const revisedGitOnly = resolveArticleDates({ publishedDate: '2026-08-30' }, { modified: '2026-10-05' })
assert.deepEqual(revisedGitOnly, { published: '', modified: '2026-10-05' })

const href = correctionUrl({ title: 'Battle of Blue Licks', url: fields.url })
const issue = new URL(href)
assert.equal(issue.origin + issue.pathname, 'https://github.com/shannonsnowden/kyhistorydrive/issues/new')
assert.equal(issue.searchParams.get('labels'), 'correction')
assert.match(issue.searchParams.get('title'), /Battle of Blue Licks/)
assert.match(issue.searchParams.get('body'), /https:\/\/kyhistorydrive\.com\/stories\/battle-of-blue-licks\//)
assert.doesNotMatch(href, /contact@|mailto:/i)
const correction = correctionHtml({ title: 'Battle of Blue Licks', url: fields.url })
assert.match(correction, /rel="noopener noreferrer nofollow"/)
assert.match(correction, /target="_blank"/)
assert.doesNotMatch(correction, /mailto:|contact@/i)

assert.equal(
  modifiedFromProseHistory([
    { date: '2026-10-11', prose: 'Same words.' },
    { date: '2026-10-04', prose: 'Same words.' },
  ]).modified,
  '2026-10-04',
)
assert.equal(
  modifiedFromProseHistory([
    { date: '2026-10-11', prose: 'New sentence.' },
    { date: '2026-10-04', prose: 'Old sentence.' },
  ]).modified,
  '2026-10-11',
)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const camp = textRevisionForFile(root, 'public/content/stories/camp-nelson-jessamine-county.json')
assert.equal(camp.published, '2026-10-04')
assert.equal(camp.modified, '2026-10-04')
const mantle = textRevisionForFile(root, 'public/content/stories/mantle-rock-and-the-trail-of-tears.json')
assert.equal(mantle.published, '2026-10-09')
assert.equal(mantle.modified, '2026-10-09')

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
assert.match(nearby, /<span class="nearby-kind">Historical marker<\/span>/)
assert.match(nearby, /<span class="nearby-kind">Story<\/span>/)
assert.match(nearby, /<span class="nearby-miles">/)
assert.doesNotMatch(nearby, /Historical marker,/)
assert.doesNotMatch(nearby, /href="\/#timeline\/|href="\/#map\/stories\//)
assert.ok(nearby.indexOf('Close marker') < nearby.indexOf('Near story'))
assert.ok(nearby.indexOf('Near story') < nearby.indexOf('Mid marker'))
assert.equal(nearbyHtml({ slug: 'none', title: 'None' }, storyRows, { markers: markerRows }), '')

const moreMarkers = [...markerRows, { id: '4', title: 'Extra marker', lat: 38.5, lon: -85 }]
const moreStories = [...storyRows, { slug: 'extra-story', title: 'Extra story', lat: 38.8, lon: -85 }]
const excluded = nearbyPlaces(origin, moreStories, moreMarkers, { excludeMarkerIds: ['1'], excludeSlugs: ['near-story'] })
assert.equal(excluded.some((row) => row.id === '1' || row.slug === 'near-story'), false)
assert.equal(excluded.some((row) => row.id === '4'), true)
assert.ok(excluded.findIndex((row) => row.kind === 'marker') < excluded.findIndex((row) => row.slug === 'mid-story'))

const merged = relatedAndNearbyHtml(
  [{ kind: 'story', related: true, slug: 'rel', title: 'Related one', detail: 'Jessamine County' }],
  [{ kind: 'marker', id: '9', title: 'A marker', miles: 1.2 }],
)
assert.match(merged, /Related and nearby/)
assert.match(merged, /class="related-card"/)
assert.match(merged, /class="related-story"/)
assert.match(merged, /related-card-title">Related one</)
assert.match(merged, /nearby-kind">Story</)
assert.match(merged, /Jessamine County/)
assert.match(merged, /nearby-kind">Historical marker</)
assert.match(merged, /nearby-miles">1.2 miles</)
assert.match(merged, /related-card-chevron/)
assert.match(merged, /aria-hidden="true"/)
assert.ok(merged.indexOf('Related one') < merged.indexOf('A marker'))

assert.equal(compactYearRange(1812, 1815), '1812\u20131815')
assert.equal(compactYearRange(-800, 700), '800 BCE\u2013700 CE')
assert.equal(compactYearRange(1812, 1812), '1812')
assert.equal(
  learnMoreLinkText('https://en.wikipedia.org/wiki/Great_Saltpetre_Cave'),
  'Great Saltpetre Cave on Wikipedia',
)
assert.equal(
  learnMoreLinkText('https://en.wikipedia.org/wiki/Bird%27s_invasion_of_Kentucky'),
  "Bird's invasion of Kentucky on Wikipedia",
)
assert.equal(
  learnMoreLinkText('https://en.wikipedia.org/wiki/Falmouth,_Kentucky', 'https://en.wikipedia.org/wiki/Falmouth,_Kentucky'),
  'Falmouth, Kentucky on Wikipedia',
)
assert.equal(
  learnMoreLinkText('https://www.nps.gov/maca/learn/historyculture/index.htm', 'Mammoth Cave'),
  'Mammoth Cave on NPS.gov',
)
assert.equal(learnMoreLinkText('https://www.example.com/places/foo', ''), 'foo on example.com')
assert.equal(
  learnMoreLinkText(
    'https://npgallery.nps.gov/AssetDetail/NRIS/85002975',
    'Croley-Evans Site (15KX24), National Register of Historic Places (NPGallery)',
  ),
  'Croley-Evans Site (15KX24), National Register of Historic Places (NPGallery) on NPS.gov',
)
assert.equal(
  learnMoreLinkText('https://www.nps.gov/articles/000/paleontology-of-ohio-coral-reef-nnl.htm', 'https://www.nps.gov/articles/000/paleontology-of-ohio-coral-reef-nnl.htm'),
  'paleontology of ohio coral reef nnl on NPS.gov',
)
const learn = learnMoreBlockHtml(
  learnMoreItemsFromMarkdown(
    'Source: [https://en.wikipedia.org/wiki/Great_Saltpetre_Cave](https://en.wikipedia.org/wiki/Great_Saltpetre_Cave)',
  ),
  { storyTitle: 'Great Saltpetre Cave' },
)
assert.match(learn, /Learn more/)
assert.match(learn, /Great Saltpetre Cave on Wikipedia/)
assert.match(learn, /class="external-icon"/)
assert.match(learn, /opens in a new tab/)
assert.match(learn, /learn-more-list/)
assert.doesNotMatch(learn, /<li>[^<]*•/)

const rankedHere = {
  slug: 'here',
  title: 'Here',
  era: 'other',
  tags: ['other', 'kentucky', 'civil-war', 'usct'],
  yearStart: 1863,
  yearEnd: 1865,
  county: 'Jessamine',
  lat: 37.79,
  lon: -84.6,
}
const ranked = pickRelatedStories(rankedHere, [
  rankedHere,
  {
    slug: 'two-tags',
    title: 'Zebra two tags',
    era: 'frontier',
    tags: ['frontier', 'civil-war', 'usct'],
    yearStart: 1700,
    yearEnd: 1701,
    county: 'Fayette',
    lat: 40,
    lon: -88,
  },
  {
    slug: 'one-tag',
    title: 'Alpha one tag',
    era: 'other',
    tags: ['other', 'kentucky', 'civil-war'],
    yearStart: 1863,
    yearEnd: 1865,
    county: 'Madison',
    lat: 37.8,
    lon: -84.61,
  },
  {
    slug: 'broad-years',
    title: 'Alpha long span',
    era: 'other',
    tags: ['other', 'kentucky', 'frontier', 'native-history'],
    yearStart: 1800,
    yearEnd: 1900,
    county: 'Fayette',
    lat: 37.791,
    lon: -84.6,
  },
  {
    slug: 'county',
    title: 'County mate',
    era: 'native',
    tags: ['native'],
    yearStart: 1800,
    yearEnd: 1810,
    county: 'Jessamine County',
    lat: 39,
    lon: -86,
  },
  {
    slug: 'close',
    title: 'Zebra close',
    era: 'frontier',
    tags: ['frontier'],
    yearStart: 1864,
    yearEnd: 1864,
    county: 'Boone',
    lat: 37.791,
    lon: -84.6,
  },
])
assert.deepEqual(
  ranked.map((story) => story.slug),
  ['two-tags', 'county', 'broad-years', 'close', 'one-tag'],
)
const thinMuir = {
  slug: 'muir-site-15js86',
  title: 'Muir Site (15Js86)',
  matchedPlace: 'Muir Site (15Js86)',
  historyId: 'muir-site-15js86-jessamine-county',
  county: 'Jessamine',
  lat: 37.9,
  lon: -84.6,
  bodyMarkdown: 'short ridge note',
  tags: ['archaeology'],
}
const richMuir = {
  slug: 'muir-long',
  title: 'Muir Site: Early Fort Ancient on a Jessamine Ridge',
  matchedPlace: 'Muir Site (15Js86)',
  historyId: 'muir-site-15js86-jessamine-county',
  county: 'Jessamine',
  lat: 37.9,
  lon: -84.6,
  bodyMarkdown: 'a much longer article about the same Jessamine ridge and its houses',
  tags: ['archaeology'],
  photo: { image_url: '/content/photos/stories/muir.jpg', cardThumb: false, title: 'Main Street, Nicholasville' },
}
const deduped = pickRelatedStories(
  { slug: 'camp', title: 'Camp Nelson', county: 'Jessamine', lat: 37.79, lon: -84.6, era: 'other', tags: ['other'] },
  [
    { slug: 'camp', title: 'Camp Nelson', county: 'Jessamine', lat: 37.79, lon: -84.6 },
    thinMuir,
    richMuir,
    { slug: 'town', title: 'Nicholasville Takes Shape', county: 'Jessamine', lat: 37.8, lon: -84.58, bodyMarkdown: 'town' },
  ],
)
assert.deepEqual(
  deduped.map((story) => story.slug),
  ['town', 'muir-long'],
)
assert.equal(storyThumbSrc(richMuir), '')
assert.equal(storyThumbSrc({ slug: 'x', title: 'X', photo: { image_url: '/content/photos/stories/x.jpg' } }), '/content/photos/opt/stories/x-112.webp')
const sharedPin = pickRelatedStories(
  { slug: 'here', title: 'Here', lat: 38, lon: -85, tags: [] },
  [
    { slug: 'here', title: 'Here', lat: 38, lon: -85 },
    {
      slug: 'lincoln',
      title: 'Capt. Abraham Lincoln on Long Run',
      historyId: 'shared-pin',
      lat: 38.2,
      lon: -85.4,
      bodyMarkdown: 'lincoln',
    },
    {
      slug: 'painted',
      title: "Squire Boone's Painted Stone",
      historyId: 'shared-pin',
      lat: 38.2,
      lon: -85.4,
      bodyMarkdown: 'painted stone station',
    },
  ],
)
assert.deepEqual(
  sharedPin.map((story) => story.slug).sort(),
  ['lincoln', 'painted'],
)
const beamKept = pickRelatedStories(
  { slug: 'origin', title: 'Origin', lat: 37, lon: -85 },
  [
    { slug: 'origin', title: 'Origin', lat: 37, lon: -85 },
    {
      slug: 'beam-a',
      title: 'Jacob Beam on Hardin Creek',
      historyId: 'beam',
      lat: 37.76,
      lon: -85.33,
      bodyMarkdown: 'longer beam story text',
    },
    {
      slug: 'beam-b',
      title: "Jacob Beam sells Old Jake's first barrel",
      historyId: 'beam',
      lat: 37.76,
      lon: -85.33,
      bodyMarkdown: 'short',
    },
  ],
)
assert.deepEqual(
  beamKept.map((story) => story.slug),
  ['beam-a'],
)
const springfieldKept = pickRelatedStories(
  { slug: 'o', title: 'O', lat: 38, lon: -84 },
  [
    { slug: 'o', title: 'O', lat: 38, lon: -84 },
    {
      slug: 's1',
      title: 'Springfield Founding and Washington County Seat',
      lat: 37.6853413,
      lon: -85.2221819,
      bodyMarkdown: 'the longer founding story',
    },
    {
      slug: 's2',
      title: 'Springfield, first county seat after statehood',
      lat: 37.6853,
      lon: -85.2222,
      bodyMarkdown: 'short',
    },
  ],
)
assert.deepEqual(
  springfieldKept.map((story) => story.slug),
  ['s1'],
)
const byDistance = pickRelatedStories(
  { slug: 'h', title: 'H', era: 'x', tags: [], yearStart: 1, yearEnd: 1, county: 'A', lat: 38, lon: -85 },
  [
    { slug: 'h', title: 'H', era: 'x', tags: [], yearStart: 1, yearEnd: 1, county: 'A', lat: 38, lon: -85 },
    { slug: 'far', title: 'Alpha far', era: 'y', tags: ['y'], yearStart: 9, yearEnd: 9, county: 'B', lat: 39, lon: -86 },
    { slug: 'close', title: 'Zebra close', era: 'y', tags: ['y'], yearStart: 9, yearEnd: 9, county: 'B', lat: 38.01, lon: -85 },
  ],
)
assert.deepEqual(
  byDistance.map((story) => story.slug),
  ['close', 'far'],
)
const byTitle = pickRelatedStories(
  { slug: 'h', title: 'H', era: 'x', tags: [], lat: null, lon: null },
  [
    { slug: 'h', title: 'H', era: 'x', tags: [], lat: null, lon: null },
    { slug: 'z', title: 'Zebra tie', era: 'y', tags: ['y'], yearStart: 2, yearEnd: 2, county: 'B', lat: 38, lon: -85 },
    { slug: 'a', title: 'Alpha tie', era: 'y', tags: ['y'], yearStart: 2, yearEnd: 2, county: 'B', lat: 38, lon: -85 },
  ],
)
assert.deepEqual(
  byTitle.map((story) => story.slug),
  ['a', 'z'],
)
assert.deepEqual(
  pickRelatedStories(rankedHere, [rankedHere, { slug: 'skip', title: 'Skip', tags: ['battle'] }, { slug: 'keep', title: 'Keep' }], ['skip']).map(
    (story) => story.slug,
  ),
  ['keep'],
)

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/styles.css'), 'utf8')
assert.match(css, /\.route-downloads a\.btn \{[^}]*min-height:\s*44px/)
assert.match(css, /\.story-photo-credit a \{[^}]*min-height:\s*44px/)

console.log('story quick wins: ok')
