#!/usr/bin/env node
/**
 * Protected KHS markers and protected ids in nearby lists (Security/Design, PR #434).
 * protected-pins.json lists rounded markers as `marker:<number>` (pin-rounding roundMarkerNumbers).
 * 1) Popup: a marker listed as marker:N is protected (approximate note, no Apple/Google directions,
 *    no photo search, no KHS marker-page link); it also fails closed on the 0.1° grid before the list loads.
 * 2) Nearby (story-tools, used by the client and prerender): protected markers and protected stories
 *    are never another page's nearby card (prerender loads the list from protected-pins.json).
 * 3) No /#map/history/<id> deep link in public/, src/ or dist/ points at a protected id.
 * 4) Built output (when dist/ exists): no page's nearby list names a protected id, and no card that
 *    names a protected id carries a distance ("miles", "less than 0.1", "same point").
 * Coordinates are never printed.
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const pins = JSON.parse(fs.readFileSync(path.join(root, 'public/data/web/protected-pins.json'), 'utf8'))
const ids = new Set(pins.ids || [])
const markerNums = [...ids].filter((id) => id.startsWith('marker:')).map((id) => id.slice(7))
assert.ok(markerNums.includes('1309') && markerNums.includes('1274'), 'protected-pins.json must list marker:1309 and marker:1274')
// Nov 20 2026: the Woman from Short Cave (a burial site) and her county-level History pin are protected, so they are never another page's nearby card.
for (const id of ['the-woman-from-short-cave', 'the-woman-from-short-cave-edmonson']) assert.ok(ids.has(id), `protected-pins.json must list ${id}`)

// --- 1) popup protection logic ---
const tools = await import('../src/story-tools.js')
const pp = await import('../src/protected-pins.js')
// Fail closed before the list loads: a marker on the 0.1° grid is protected; an ordinary marker is not.
assert.ok(pp.isProtectedPlace({ marker_number: '99999' }, 37.5, -85.2), 'unloaded: a 0.1° grid marker must fail closed')
assert.ok(!pp.isProtectedPlace({ marker_number: '99998' }, 37.51234, -85.24321), 'control: an exact public marker is not protected')
globalThis.fetch = async () => ({ ok: true, json: async () => pins })
await pp.loadProtectedPins()
assert.ok(pp.protectedPinsLoaded(), 'protected-pins.json did not load')
for (const n of markerNums) {
  assert.ok(pp.protectedPinIdsFor({ marker_number: n }).includes(`marker:${n}`), `marker ${n}: candidate ids miss marker:${n}`)
  assert.ok(pp.isProtectedPlace({ marker_number: n, title: 'x' }), `marker ${n} (listed as marker:${n}) is not treated as protected`)
  assert.ok(pp.protectedPlaceNoteHtml({ marker_number: n }), `marker ${n} popup has no approximate-location note`)
}
assert.ok(!pp.isProtectedPlace({ marker_number: '128' }, 37.1031283, -85.3064101), 'control: marker 128 must stay public')
// #436: Short Cave's county-level pins carry a county-only note, never a distance or radius.
for (const id of ['the-woman-from-short-cave', 'the-woman-from-short-cave-edmonson']) {
  const note = pp.protectedPinNoteHtml(id)
  assert.ok(note.includes('Edmonson County'), `${id}: protected note must name Edmonson County`)
  assert.ok(!/\bmi\b|mile|within|~|km\b/i.test(note), `${id}: protected note must not carry a distance or radius`)
  const place = pp.protectedPlaceNoteHtml({ id })
  assert.ok(place.includes('Edmonson County') && !/within|~/.test(place), `${id}: popup note must be county-only`)
}
// After the list loads the grid fallback is off: the list alone decides.
assert.ok(!pp.isProtectedPlace({ marker_number: '99999' }, 37.5, -85.2), 'loaded: the 0.1° grid fallback must only run before protected-pins.json loads')

// Every marker sitting exactly on the 0.1° grid is a rounded protected marker and must be listed as marker:N.
{
  const onGrid = (v) => Number.isFinite(Number(v)) && Math.abs(Number(v) * 10 - Math.round(Number(v) * 10)) < 1e-9
  const geo = JSON.parse(fs.readFileSync(path.join(root, 'public/data/markers.geojson'), 'utf8'))
  const phase1 = JSON.parse(fs.readFileSync(path.join(root, 'public/data/app/markers.phase1.json'), 'utf8'))
  const rows = [
    ...(geo.features || []).map((f) => ({ n: String(f.properties?.marker_number), lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0] })),
    ...(Array.isArray(phase1) ? phase1 : phase1.markers || []).map((m) => ({ n: String(m.marker_number), lat: m.latitude, lon: m.longitude })),
  ]
  const unlisted = [...new Set(rows.filter((r) => r.lat != null && r.lon != null && onGrid(r.lat) && onGrid(r.lon) && !ids.has(`marker:${r.n}`)).map((r) => r.n))]
  assert.deepEqual(unlisted, [], `markers on the 0.1° grid missing from protected-pins.json: ${unlisted.join(', ')}`)
}

// Code guard: the popup builder checks every id (marker:N included) before directions and withholds the KHS link.
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8')
const dStart = main.indexOf('function detailHtmlFromProps(')
const dBody = main.slice(dStart, main.indexOf('\n}\n', dStart))
assert.match(dBody, /isProtectedPlace\(p, lat, lon\)/, 'detailHtmlFromProps must evaluate isProtectedPlace (marker:N aware)')
assert.match(dBody, /protectedIds: protectedPinIdsFor\(p\)/, 'popup extras must receive marker:N in protectedIds')
assert.match(dBody, /protectedPlace,/, 'popup extras must receive protectedPlace')
assert.match(dBody, /protectedMarker \? null : p\.source_url/, 'protected marker popup must withhold the KHS source_url link')
assert.match(dBody, /Kentucky Historical Society marker/, 'protected marker popup must credit KHS in plain text')
assert.match(dBody, /protectedPlaceNoteHtml\(p, lat, lon\)/, 'popup note must use the marker:N aware check')
const eStart = main.indexOf('function placeDetailExtrasHtml(')
const eBody = main.slice(eStart, main.indexOf('\n}\n', eStart))
assert.match(eBody, /const isProtected = protectedPlace \|\|/, 'directions must be withheld when protectedPlace is true')
assert.match(eBody, /isProtected \|\| lat == null \|\| lon == null \? '' : mapsLinksHtml/, 'mapsLinksHtml must be gated on isProtected')

// --- 2) nearby logic ---
tools.setProtectedMarkerIds([...ids])
const origin = { slug: 'example-public-site', title: 'Example', lat: 37.0123, lon: -89.0456 }
const markers = [
  { id: markerNums[0], title: 'Protected marker', lat: 37.0, lon: -89.1 },
  { id: '90001', title: 'Public A', lat: 37.0201, lon: -89.0502 },
  { id: '90002', title: 'Public B', lat: 37.0301, lon: -89.0602 },
  { id: '90003', title: 'Public C', lat: 37.0401, lon: -89.0702 },
]
const near = tools.nearbyPlaces(origin, [origin], markers, { limit: 5, isProtected: () => false })
assert.ok(!near.some((r) => r.kind === 'marker' && r.id === markerNums[0]), 'nearbyPlaces must exclude a protected marker')
assert.equal(near.filter((r) => r.kind === 'marker').length, 3, 'control: public markers still listed')
assert.ok(!tools.nearbyMarkers(origin, markers).some((r) => r.id === markerNums[0]), 'nearbyMarkers must exclude a protected marker')

// --- 3) History deep links: no /#map/history/<id> link may point at a protected id (shipped or built). ---
{
  const historyLinkHits = (text) => [...String(text).matchAll(/#map\/history\/([A-Za-z0-9%_.:-]+)/g)].map((m) => decodeURIComponent(m[1])).filter((id) => ids.has(id))
  // plant: a protected id in a history deep link must fail; a public one passes
  const prot = [...ids].find((id) => !id.includes(':'))
  assert.ok(historyLinkHits(`<a href="/#map/history/${prot}">x</a>`).length === 1, 'planted protected history deep link must be caught')
  assert.ok(!historyLinkHits('<a href="/#map/history/example-public-pin">x</a>').length, 'control: a public history deep link passes')
  const exts = /\.(html|json|geojson|js|xml|md|txt|gpx)$/
  const scan = (dir, out) => {
    if (!fs.existsSync(dir)) return out
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) { if (ent.name !== 'node_modules') scan(p, out) }
      else if (exts.test(ent.name)) for (const id of historyLinkHits(fs.readFileSync(p, 'utf8'))) out.push(`${path.relative(root, p)}: /#map/history/${id}`)
    }
    return out
  }
  const deep = [...scan(path.join(root, 'public'), []), ...scan(path.join(root, 'dist'), []), ...scan(path.join(root, 'src'), [])]
  assert.deepEqual(deep, [], `protected ids in /#map/history/ deep links:\n${deep.join('\n')}`)
}

// --- 4) built output ---
const dist = path.join(root, 'dist')
const storiesDir = path.join(dist, 'stories')
if (fs.existsSync(storiesDir)) {
  const DIST_RE = /miles?\b|less than 0\.1|same point/i
  const isProtHref = (href) => {
    const m = href.match(/^\/#map\/markers\/([^"/?#]+)/)
    if (m) return ids.has(`marker:${decodeURIComponent(m[1])}`)
    const s = href.match(/^\/stories\/([^"/]+)\//)
    return !!(s && ids.has(s[1]))
  }
  const bad = []
  let pages = 0
  for (const slug of fs.readdirSync(storiesDir)) {
    const f = path.join(storiesDir, slug, 'index.html')
    if (!fs.existsSync(f)) continue
    pages++
    const html = fs.readFileSync(f, 'utf8')
    for (const card of html.match(/<li class="nearby-place">[\s\S]*?<\/li>/g) || []) {
      const href = (card.match(/href="([^"]+)"/) || [])[1] || ''
      if (isProtHref(href)) bad.push(`${slug}: nearby card names protected ${href}`)
    }
    for (const card of html.match(/<li class="(?:related-story|nearby-place)">[\s\S]*?<\/li>/g) || []) {
      const href = (card.match(/href="([^"]+)"/) || [])[1] || ''
      if (isProtHref(href) && DIST_RE.test(card.replace(/<[^>]+>/g, ' '))) bad.push(`${slug}: distance on protected card ${href}`)
    }
  }
  // #436 B9: county-level protected stories never render km, mi, a degree sign or a radius in the
  // location pill, its tooltip, or story.md coordinates_precision.
  const UNIT_RE = /\bkm\b|\bmi\b|mile|°|\bdeg\b|radius|within|~/i
  for (const slug of ['the-woman-from-short-cave']) {
    const county = pp.countyLevelProtectedCounty(slug)
    assert.equal(county, 'Edmonson County', `${slug}: must be county-level`)
    const htmlFile = path.join(storiesDir, slug, 'index.html')
    if (!fs.existsSync(htmlFile)) continue
    const html = fs.readFileSync(htmlFile, 'utf8')
    const pills = html.match(/<span class="[^"]*usp-approx-pill[^"]*"[^>]*>[^<]*<\/span>/g) || []
    assert.ok(pills.length >= 1, `${slug}: location pill missing`)
    for (const pill of pills) {
      assert.ok(pill.includes(`County-level location (${county}) · Protected site`), `${slug}: pill must be county-level`)
      assert.ok(!UNIT_RE.test(pill), `${slug}: pill or tooltip carries a unit or radius`)
    }
    const mdFile = path.join(storiesDir, slug, 'story.md')
    if (fs.existsSync(mdFile)) {
      const line = (fs.readFileSync(mdFile, 'utf8').match(/^coordinates_precision:.*$/m) || [''])[0]
      assert.ok(line.includes(`county-level (${county})`), `${slug}: story.md precision must be county-level`)
      assert.ok(!UNIT_RE.test(line), `${slug}: story.md precision carries a unit or radius`)
      const bullet = (fs.readFileSync(mdFile, 'utf8').match(/^- \*\*Coordinates:\*\*.*$/m) || [''])[0]
      if (bullet) {
        assert.ok(bullet.includes(`(County-level point (${county}) to protect a sensitive archaeological site)`), `${slug}: story.md coordinates bullet must be county-level`)
        assert.ok(!/rounded|0\.1°|\bkm\b|radius/i.test(bullet), `${slug}: story.md coordinates bullet carries rounding or a radius`)
      }
    }
  }
  // #436 B15: only county-level stories use the county-level coordinates bullet; other protected
  // stories keep the 0.1° rounding note.
  const countyBullet = /^- \*\*Coordinates:\*\*.*County-level point/m
  let roundedKept = 0
  for (const slug of fs.readdirSync(storiesDir)) {
    const md = path.join(storiesDir, slug, 'story.md')
    if (!fs.existsSync(md)) continue
    const text = fs.readFileSync(md, 'utf8')
    if (countyBullet.test(text)) assert.ok(pp.countyLevelProtectedCounty(slug), `${slug}: county-level bullet on a story that is not county-level`)
    if (/^- \*\*Coordinates:\*\*.*rounded to 0\.1°/m.test(text)) roundedKept++
  }
  assert.ok(roundedKept > 0, 'other protected stories must keep the 0.1° rounding note')
  assert.ok(pages > 100, 'too few story pages in dist')
  assert.deepEqual(bad, [], `protected ids in nearby lists or with distances:\n${bad.join('\n')}`)
  console.log(`test-protected-markers: OK (${markerNums.length} protected markers; ${pages} built story pages clean)`)
} else {
  console.log(`test-protected-markers: OK (${markerNums.length} protected markers; no dist to scan)`)
}
