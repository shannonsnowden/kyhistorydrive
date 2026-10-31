#!/usr/bin/env node
/**
 * build-drive-pages: keeps the static drive pages in public/drives/ crawlable without JS.
 * Idempotent; rewrites each page in place from its own STOPS array and routes/<slug>.json:
 *  - <title> and meta description (from TITLES/DESCS below when the page's own text is too long),
 *  - the prerendered stop list inside <ol id="stops"> (the page script re-renders the same list),
 *    with a Visiting line from each stop's access text and flags,
 *  - JSON-LD: TouristTrip (itinerary = ordered ItemList of Place) + BreadcrumbList on each drive,
 *    CollectionPage + ItemList on /drives/.
 *  - optional card and page photo from scripts/drive-photos.json (image, credit, alt).
 *    An empty image leaves the theme icon (scripts/apply-drive-theme-icons.mjs).
 *  - print sheet (src/drive-print.css), Print control, print masthead (name, miles, time),
 *    and public/drives/<slug>/route.gpx.
 * Geo is emitted only for public, exact stops (not private, not approx). Sensitive stops get no geo;
 * build-byod-stops re-checks that against the protected/archaeology/private data.
 * GPX uses that same gate (scripts/drive-gpx.mjs).
 */
import fs from 'node:fs'
import path from 'node:path'

const SITE = 'https://kyhistorydrive.com'
import { parseJsLiteral } from './js-literal.mjs'
import { applyDriveIndexPhotos, applyDrivePagePhoto, applyDrivesIndexOg, loadDrivePhotos, touristTripImage } from './drive-photos.mjs'
import { renderDriveGpx } from './drive-gpx.mjs'
import { applyCuratedMapLinks, syncDriveLinksModule } from './drive-map-links.mjs'
const DP = 'public/drives'
const SUFFIX = ' · Kentucky History Drive'

// Short <title> text (the page h1 keeps the full name). Each must fit 60 chars with SUFFIX.
export const TITLES = {
  'barton-1792': 'Barton 1792: Bardstown to Loretto',
  'big-sandy-pine-mountain': 'Big Sandy and Pine Mountain drive',
  'bluegrass-forts': 'Bluegrass Forts and Stations drive',
  'boones-trail': "Boone's Trail and Wilderness Road",
  'bourbon-heritage': 'Rolling Fork bourbon heritage drive',
  'buffalo-trace': 'Buffalo Trace Loop 1: Frankfort',
  'buffalo-trace-loop-2': "Buffalo Trace Loop 2: Glenn's Creek",
  'capital-and-shakers': 'Capital, Shakers and Commonwealth',
  'castle-and-key': 'Castle & Key: Frankfort and Elkhorn',
  'cave-country': 'Cave Country history drive',
  'civil-war-bluegrass': 'Civil War in the Bluegrass drive',
  'civil-war-south-central': 'Civil War in South Central Kentucky',
  'four-roses': 'Four Roses: McAfee and Fort Harrod',
  'heaven-hill': 'Heaven Hill: Bardstown to Lincoln',
  'jim-beam': 'Jim Beam: Salt River, Fort Duffield',
  'licking-valley': 'Licking Valley history drive',
  'makers-mark': "Maker's Mark: Holy Cross to Lebanon",
  'northern-kentucky': 'Northern Kentucky history drive',
  'old-forester': 'Old Forester: Whiskey Row drive',
  pennyrile: 'Pennyrile towns and Civil War drive',
  'western-rivers': 'Western Rivers history drive',
  'wild-turkey': 'Wild Turkey Loop 1: Versailles',
  'wild-turkey-loop-2': 'Wild Turkey Loop 2: Pleasant Hill',
  'woodford-reserve': 'Woodford Reserve: Versailles drive',
  '': 'Kentucky history drives',
}
// Descriptions (<= 160 chars). Pages not listed use their intro paragraph when it fits.
export const DESCS = {
  '': '12 Kentucky history drives and 12 loops from 10 distilleries, each with ordered stops, a route map, stories and directions. Or build your own drive.',
}
// Own intro for loops whose intro repeated Loop 1 word for word.
const INTROS = {
  'buffalo-trace-loop-2': "Glenn's Creek distilling history just south of Frankfort: Buffalo Trace, a National Historic Landmark; Col. E.H. Taylor Jr.'s 1887 Old Taylor Distillery; the former Old Crow Distillery; and the Oscar Pepper Distillery, where James C. Crow worked on sour mash and barrel-aging methods.",
  'wild-turkey-loop-2': "From the Ripy family's 1891 distillery at Tyrone to Lawrenceburg's beginnings as Kaufman's Station in the early 1780s, then south to Pleasant Hill, where Shakers signed their first family covenant in 1806 and kept a community until 1910.",
}
Object.assign(DESCS, {
  'cave-country': "From Bowling Green's Lost River Cave to Mammoth Cave and Horse Cave: karst country where saltpetre was mined for the War of 1812 and show caves opened by 1816.",
  'buffalo-trace-loop-2': "Glenn's Creek distilling history near Frankfort: Buffalo Trace, the 1887 Old Taylor Distillery, the former Old Crow Distillery and the Oscar Pepper Distillery.",
  'boones-trail': "From Cumberland Gap along Thomas Walker's 1750 Indian road to Logan's and Whitley's stations, Boone's fort and Pilot Knob, where Boone first saw Kentucky.",
  'wild-turkey-loop-2': "From the Ripys' 1891 distillery at Tyrone to Lawrenceburg's Kaufman's Station and Shaker Village of Pleasant Hill, home to a Shaker community from 1806 to 1910.",
})

// Page text -> plain text. Entities are decoded in one pass (so "&amp;lt;" stays "&lt;"), then tags are
// stripped repeatedly until nothing changes, so no tag can survive by being split across a strip.
// Every result is re-escaped with esc() / escText() or serialized by ld() before it reaches HTML.
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" }
function decode(s) {
  let out = String(s).replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (m) => ENT[m])
  for (let prev; prev !== out;) { prev = out; out = out.replace(/<[^<>]*>/g, '') }
  return out.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]))
const escText = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`

/** Trim a sentence to <= max chars at a clause boundary. */
function fit(text, max = 160) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const at = Math.max(cut.lastIndexOf('; '), cut.lastIndexOf(', '), cut.lastIndexOf(': '))
  return (at > 80 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(' '))).replace(/[,;:]$/, '') + '.'
}

function setHead(html, title, desc) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  return html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(desc)}" />`)
}
function setLd(html, blocks) {
  html = html.replace(/<!-- khd-drive-jsonld -->[\s\S]*?<!-- \/khd-drive-jsonld -->\n?/, '')
  const block = `<!-- khd-drive-jsonld -->\n${blocks.map(ld).join('\n')}\n<!-- /khd-drive-jsonld -->\n`
  // Keep JSON-LD before the drive photo <style>. Anchoring at </head> drops it after that
  // style; the next applyDriveIndexPhotos pass then swaps them, so a second build drifts.
  const photo = '<!-- khd-drive-photo-style -->'
  const headEnd = html.indexOf('</head>')
  const photoAt = html.indexOf(photo)
  if (photoAt !== -1 && (headEnd === -1 || photoAt < headEnd)) return html.replace(photo, block + photo)
  return html.replace('</head>', `${block}</head>`)
}
const crumbs = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
})

const FL = { private: 'Private land', marker: 'Marker only', paid: 'Paid admission', limited: 'Limited hours', reservation: 'Reservation needed' }
const fmtMin = (m) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`
const VISIT_TPL = '<p class="stop-meta">${esc(s.when)}</p><p class="stop-visit"><b>Visiting:</b> ${tag} ${esc(s.access)}</p>'
function applyDrivePrint(html, { slug, h1, route }) {
  const oldTpl = '<p class="stop-meta">${tag}${esc(s.when)}. ${esc(s.access)}</p>'
  if (html.includes(oldTpl)) html = html.replaceAll(oldTpl, VISIT_TPL)
  else if (!html.includes(VISIT_TPL)) throw new Error(`build-drive-pages: ${slug} stop template has no visiting line`)
  const link = `<!-- khd-drive-print -->\n<link rel="stylesheet" href="/drives/drive-print.css" />\n<!-- /khd-drive-print -->`
  html = html.replace(/<!-- khd-drive-print -->[\s\S]*?<!-- \/khd-drive-print -->\n?/, '')
  html = html.replace('</head>', `${link}\n</head>`)
  const mast = `<!-- khd-drive-masthead -->\n<p class="print-masthead print-only">${esc(h1)} · About ${Math.round(route.miles)} miles · About ${fmtMin(route.minutes)} · Kentucky History Drive · ${SITE}/drives/${slug}/</p>\n<!-- /khd-drive-masthead -->`
  html = html.replace(/<!-- khd-drive-masthead -->[\s\S]*?<!-- \/khd-drive-masthead -->\n?/, '')
  if (!html.includes('<main>')) throw new Error(`build-drive-pages: ${slug} has no <main>`)
  html = html.replace('<main>', `<main>\n${mast}`)
  const tools = `<!-- khd-drive-tools -->\n<div class="drive-tools" role="group" aria-label="Print and GPS">\n  <button type="button" class="btn btn-quiet" data-print onclick="window.print()">Print</button>\n  <a class="btn btn-quiet" href="/drives/${slug}/route.gpx" download="${slug}.gpx">Download GPX</a>\n</div>\n<!-- /khd-drive-tools -->`
  html = html.replace(/<!-- khd-drive-tools -->[\s\S]*?<!-- \/khd-drive-tools -->\n?/, '')
  if (!html.includes('<h2 id="stops-h">Stops</h2>')) throw new Error(`build-drive-pages: ${slug} has no stops heading`)
  html = html.replace('<h2 id="stops-h">Stops</h2>', `<h2 id="stops-h">Stops</h2>\n${tools}`)
  return html
}
function stopLi(s, i, leg, anchorIds) {
  const tag = (s.private ? '<span class="tag warn">Private land: marker only</span>' : '<span class="tag">Public</span>') +
    (s.flags || []).filter((f) => !(s.private && f === 'private')).map((f) => `<span class="tag${f === 'private' ? ' warn' : ''}">${FL[f] || escText(f)}</span>`).join('')
  const src = (s.sources || []).length
    ? `<p class="stop-meta">${escText(s.note)} <span class="note">Sources: ${s.sources.map(([t, u]) => `<a href="${escText(u)}" rel="noopener noreferrer" target="_blank">${escText(t)}</a>`).join('; ')}</span></p>`
    : s.note ? `<p class="stop-meta">${escText(s.note)}</p>` : ''
  const links = (s.stories || []).length
    ? s.stories.map(([slug, t]) => `<a class="story"${anchorIds && !anchorIds.has(slug) && anchorIds.add(slug) ? ` id="stop-${escText(slug)}"` : ''} href="/stories/${encodeURIComponent(slug)}/">${escText(t)} →</a>`).join('')
    : '<span class="note">No story yet for this stop.</span>'
  return `<li class="${s.private ? 'private' : ''}"><span class="num" aria-hidden="true">${i + 1}</span>
    <div><p class="stop-name">${i + 1}. ${escText(s.name)}</p><p class="stop-meta">${escText(s.when)}</p><p class="stop-visit"><b>Visiting:</b> ${tag} ${escText(s.access || '')}</p>${src}</div>
    ${leg ? `<span class="leg">${leg[0]} mi, about ${leg[1]} min from stop ${i}</span>` : ''}
    <div class="links">${links}</div></li>`
}

const printCss = fs.readFileSync(new URL('../src/drive-print.css', import.meta.url), 'utf8')
const printCssOut = path.join(DP, 'drive-print.css')
if (!fs.existsSync(printCssOut) || fs.readFileSync(printCssOut, 'utf8') !== printCss) fs.writeFileSync(printCssOut, printCss)
syncDriveLinksModule(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'))
const slugs = fs.readdirSync(DP).filter((d) => fs.existsSync(path.join(DP, d, 'index.html'))).sort()
const drivePhotos = loadDrivePhotos()
for (const slug of drivePhotos.keys()) {
  if (!slugs.includes(slug)) throw new Error(`build-drive-pages: scripts/drive-photos.json lists ${slug}, which has no drive page`)
}
const cards = []
let changed = 0
for (const slug of slugs) {
  const file = path.join(DP, slug, 'index.html')
  let html = fs.readFileSync(file, 'utf8')
  const before = html
  const m = html.match(/const STOPS = (\[[\s\S]*?\n\])/)
  if (!m) throw new Error(`build-drive-pages: ${slug} has no STOPS`)
  const stops = parseJsLiteral(m[1])
  const routeFile = [path.join(DP, 'routes', `${slug}.json`), path.join(DP, `${slug}-route.json`)].find((f) => fs.existsSync(f))
  if (!routeFile) throw new Error(`build-drive-pages: ${slug} has no route file`)
  const route = JSON.parse(fs.readFileSync(routeFile, 'utf8'))
  const h1 = decode(html.match(/<h1>([\s\S]*?)<\/h1>/)[1])
  if (INTROS[slug]) html = html.replace(/(<\/h1>\s*<p class="muted" style="margin:0">)[\s\S]*?(<\/p>)/, `$1${esc(INTROS[slug])}$2`)
  const intro = decode(html.match(/<\/h1>\s*<p class="muted"[^>]*>([\s\S]*?)<\/p>/)[1])
  const title = (TITLES[slug] || h1) + SUFFIX
  const desc = DESCS[slug] || fit(intro)
  html = setHead(html, title, desc)
  html = html.replace(/<ol class="stops" id="stops">[\s\S]*?<\/ol>/, `<ol class="stops" id="stops">${((ids) => stops.map((s, i) => stopLi(s, i, i ? route.legs?.[i - 1] : null, ids)))(new Set()).join('\n')}</ol>`)
  const url = `${SITE}/drives/${slug}/`
  if (!drivePhotos.has(slug)) throw new Error(`build-drive-pages: ${slug} is missing from scripts/drive-photos.json`)
  const photo = drivePhotos.get(slug)
  const trip = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': `${url}#trip`,
    name: h1,
    description: desc,
    url,
    ...touristTripImage(photo),
    inLanguage: 'en-US',
    isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${SITE}/` },
    itinerary: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: stops.length,
      itemListElement: stops.map((s, i) => {
        const place = { '@type': 'Place', name: s.name, identifier: s.id }
        if (s.stories?.length) place.url = `${SITE}/stories/${s.stories[0][0]}/`
        if (!s.private && !s.approx) place.geo = { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lon }
        return { '@type': 'ListItem', position: i + 1, item: place }
      }),
    },
  }
  html = setLd(html, [trip, crumbs([['Home', `${SITE}/`], ['Drives', `${SITE}/drives/`], [h1, url]])])
  // Print link goes in before the photo block. applyDrivePagePhoto rewrites </head>,
  // and the photo test requires that rewrite to leave the page unchanged.
  html = applyDrivePrint(html, { slug, h1, route })
  html = applyCuratedMapLinks(html, slug)
  html = applyDrivePagePhoto(html, photo)
  const gpx = renderDriveGpx({ name: h1, desc: intro, url, stops })
  const gpxFile = path.join(DP, slug, 'route.gpx')
  if (!fs.existsSync(gpxFile) || fs.readFileSync(gpxFile, 'utf8') !== gpx) fs.writeFileSync(gpxFile, gpx)
  cards.push({ slug, name: h1, url, intro, stops: stops.length, miles: route.miles, minutes: route.minutes })
  if (html !== before) { fs.writeFileSync(file, html); changed++ }
}

// Index: CollectionPage + ItemList of the drives, in the page's own order.
const idxFile = path.join(DP, 'index.html')
let idx = fs.readFileSync(idxFile, 'utf8')
const before = idx
const order = [...idx.matchAll(/href="\/drives\/([a-z0-9-]+)\/"/g)].map((x) => x[1]).filter((s, i, a) => s !== 'build' && a.indexOf(s) === i)
const bySlug = new Map(cards.map((c) => [c.slug, c]))
if (order.length !== cards.length || order.some((s) => !bySlug.has(s))) throw new Error(`build-drive-pages: index links ${order.length} drives, pages ${cards.length}`)
const idxDesc = DESCS['']
idx = setHead(idx, TITLES[''] + SUFFIX, idxDesc)
idx = setLd(idx, [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE}/drives/#page`,
    name: 'Kentucky history drives',
    description: idxDesc,
    url: `${SITE}/drives/`,
    isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${SITE}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: order.length,
      itemListElement: order.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: bySlug.get(s).name, url: bySlug.get(s).url })),
    },
  },
  crumbs([['Home', `${SITE}/`], ['Drives', `${SITE}/drives/`]]),
])
// Card facts: when a page's STOPS count no longer matches its /drives/ card, rewrite that card's
// blurb, stop count, miles and minutes from the page intro and route file. Other cards are left as written.
for (const c of cards) {
  const re = new RegExp(`(<a href="/drives/${c.slug}/">[\\s\\S]*?<p class="muted">)([\\s\\S]*?)(</p>\\s*<p class="facts"><span><b>)(\\d+)(</b> stops</span><span>About <b>)\\d+( mi</b></span><span>About <b>)[^<]*(</b>)`)
  idx = idx.replace(re, (all, a, blurb, b, n, d, e, f) => Number(n) === c.stops ? all
    : `${a}${esc(c.intro)}${b}${c.stops}${d}${Math.round(c.miles)}${e}${fmtMin(c.minutes)}${f}`)
}
idx = applyDriveIndexPhotos(idx, drivePhotos)
idx = applyDrivesIndexOg(idx)
if (idx !== before) { fs.writeFileSync(idxFile, idx); changed++ }
console.log(`build-drive-pages: ${cards.length} drive pages + index (JSON-LD, prerendered stops, print, GPX); ${changed} file(s) updated`)
