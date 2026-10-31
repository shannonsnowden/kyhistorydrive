/**
 * Plan a Drive start text: exact ZIP / town / distillery, a KY ZIP or town read
 * out of a pasted address, then a business or attraction already on the map.
 * Local gazetteer only.
 */
import fs from 'node:fs'
import { PLACE_MISS, collectNamedPlaces, resolveStart } from '../src/drive-start.js'

const root = new URL('..', import.meta.url)
const db = JSON.parse(fs.readFileSync(new URL('public/drives/ky-places.json', root), 'utf8'))
const byod = JSON.parse(fs.readFileSync(new URL('public/drives/byod-stops.json', root), 'utf8'))
const distilleries = byod.distilleries
const locals = JSON.parse(fs.readFileSync(new URL('public/data/app/locals.json', root), 'utf8'))
const pageSrc = fs.readFileSync(new URL('src/build-a-drive.js', root), 'utf8')
const startSrc = fs.readFileSync(new URL('src/drive-start.js', root), 'utf8')
const htmlSrc = fs.readFileSync(new URL('drives/build/index.html', root), 'utf8')
const cssSrc = fs.readFileSync(new URL('src/build-a-drive.css', root), 'utf8')
const names = collectNamedPlaces(locals, byod.stops)

const errors = []
const fail = (m) => errors.push(m)
let cases = 0

const place = (name) => {
  const row = db.places.find((p) => p[0] === name)
  if (!row) fail(`fixture missing place ${name}`)
  return row
}
const zip = (code) => {
  const row = db.zips.find((z) => z[0] === code)
  if (!row) fail(`fixture missing ZIP ${code}`)
  return row
}
const still = (name) => {
  const row = distilleries.find((d) => d[0] === name)
  if (!row) fail(`fixture missing distillery ${name}`)
  return row
}

function check(input, expect) {
  cases++
  let got
  try {
    got = resolveStart(input, db, distilleries, names)
  } catch (err) {
    fail(`${JSON.stringify(input)} threw ${err && err.message}`)
    return
  }
  if (got instanceof Promise) {
    fail(`${JSON.stringify(input)} returned a promise`)
    return
  }
  if (expect && expect.ambiguous) {
    if (!got || !got.ambiguous) {
      fail(`${JSON.stringify(input)} should ask for a more specific name, got ${got && (got.label || JSON.stringify(got))}`)
    }
    if (got && (got.label || got.lat != null || got.lon != null)) {
      fail(`${JSON.stringify(input)} ambiguous result picked a pin`)
    }
    return
  }
  if (!expect) {
    if (got) fail(`${JSON.stringify(input)} should miss, got ${got.label} ${got.lat},${got.lon}`)
    return
  }
  if (!got) {
    fail(`${JSON.stringify(input)} missed, expected ${expect.label}`)
    return
  }
  if (got.label !== expect.label || got.lat !== expect.lat || got.lon !== expect.lon) {
    fail(`${JSON.stringify(input)} → ${got.label} ${got.lat},${got.lon}; expected ${expect.label} ${expect.lat},${expect.lon}`)
  }
  const keys = Object.keys(got).sort().join(',')
  if (keys !== 'label,lat,lon') fail(`${JSON.stringify(input)} keys ${keys}`)
}

const atZip = (code, fromAddress) => {
  const row = zip(code)
  return { label: fromAddress ? `ZIP ${code} (from address)` : `ZIP ${code}`, lat: row[1], lon: row[2] }
}
const atPlace = (name) => {
  const row = place(name)
  return { label: name, lat: row[1], lon: row[2] }
}
const atStill = (name) => {
  const row = still(name)
  return { label: name, lat: row[1], lon: row[2] }
}
const atLocal = (id) => {
  const row = locals.find((r) => r.id === id)
  if (!row) fail(`fixture missing local ${id}`)
  return { label: row.name, lat: row.latitude, lon: row.longitude }
}
const atStop = (id) => {
  const row = byod.stops.find((s) => s.id === id)
  if (!row) fail(`fixture missing stop ${id}`)
  return { label: row.n, lat: row.lat, lon: row.lon }
}

// Unchanged whole-string matches.
check('40258', atZip('40258', false))
check('Louisville', atPlace('Louisville'))
check('Louisville, KY', atPlace('Louisville'))
check('Buffalo Trace', atStill('Buffalo Trace Distillery'))
check("Maker's Mark", atStill("Maker's Mark Distillery"))

// ZIP wins when one is present, and the label says it came from the address.
check('9308 Cane Run Rd Louisville, KY 40258 United States', atZip('40258', true))
check('9308 Cane Run Rd, Louisville, Kentucky 40258', atZip('40258', true))
check('Louisville KY 40258', atZip('40258', true))
check('40258 Louisville', atZip('40258', true))
check('Louisville, KY 40258', atZip('40258', true))
check('Louisville 40258', atZip('40258', true))
check('40258, Louisville', atZip('40258', true))
check('9308 CANE RUN RD, LOUISVILLE, Ky. 40258', atZip('40258', true))
check('9308 Cane Run Rd, Louisville, KY 40258-1234', atZip('40258', true))
check('9308 Cane Run Rd,, Louisville, Jefferson County, Kentucky 40258, United States', atZip('40258', true))
check('40258-1234', atZip('40258', false))

// No ZIP: town (or distillery) from whatever piece of the paste names one.
check('123 Main St, Bardstown, KY', atPlace('Bardstown'))
check('123 Main St Apt 2, Bardstown, KY', atPlace('Bardstown'))
check('123 Main St #2, Bardstown, KY', atPlace('Bardstown'))
check('123 Main St, Bardstown, Kentucky', atPlace('Bardstown'))
check('Bardstown, KY.', atPlace('Bardstown'))
check('Bardstown, Ky', atPlace('Bardstown'))
check('bardstown, kentucky', atPlace('Bardstown'))
check('Louisville, Kentucky, United States', atPlace('Louisville'))
check('Louisville, KY, USA', atPlace('Louisville'))
check('Louisville, KY, U.S.A.', atPlace('Louisville'))
check('9308 Cane Run Rd, Louisville, KY', atPlace('Louisville'))
check('9308 Cane Run Rd Louisville KY', atPlace('Louisville'))
check('9308 Cane Run Rd Louisville Kentucky', atPlace('Louisville'))
check('9308 Cane Run Rd,, Louisville,, Jefferson County,, Kentucky,, United States', atPlace('Louisville'))
check('123 Main St, Bardstown, Nelson County, KY', atPlace('Bardstown'))
check('100 Main St, St. Matthews, KY', atPlace('St. Matthews'))
check('100 Main St, St Matthews, KY', atPlace('St. Matthews'))
check('123 Bardstown Rd, Louisville, KY', atPlace('Louisville'))
check('123 Bardstown Road Louisville', atPlace('Louisville'))
check('Bardstown Rd, Bardstown, KY', atPlace('Bardstown'))
check('123 Boston Rd, Bardstown, KY', atPlace('Bardstown'))
check('Buffalo, KY', atPlace('Buffalo'))
check('near Buffalo Trace, Frankfort, KY', atPlace('Frankfort'))
check('113 Great Buffalo Trace, KY', atStill('Buffalo Trace Distillery'))
check('Makers Mark', atStill("Maker's Mark Distillery"))
check('Castle and Key', atStill('Castle & Key Distillery'))

// Business and attraction names already on the map. ZIP still wins when the paste has one.
const linnig = atLocal('mike-linnigs')
cases++
if (linnig.label !== "Mike Linnig's" || linnig.lat !== 38.1190825 || linnig.lon !== -85.8972682) {
  fail(`mike-linnigs fixture is ${linnig.label} ${linnig.lat},${linnig.lon}`)
}
check("Mike Linnig's", linnig)
check('Mike Linnigs', linnig)
check('mike linnigs restaurant', linnig)
check("Mike Linning's", linnig)
check('Mike Linnig', linnig)
check("Mike Linnig's, 9308 Cane Run Rd, Louisville, KY 40258", atZip('40258', true))
check('Boone Tavern', atLocal('boone-tavern'))
check('Boone Tavern Restaurant', atLocal('boone-tavern'))
check('Muhammad Ali', atStop('muhammad-ali-center'))
check('Muhammad Ali Center', atStop('muhammad-ali-center'))
check('David Snowden homeplace', atStop('david-snowden-jr-homestead-st-helens'))
check('Big Bone Lick State Historic Site', atStop('big-bone-lick-state-historic-site'))
check('Keeneland', { ambiguous: true })
check('lost river', { ambiguous: true })

// Still a miss: out-of-state ZIP, or a street with no KY town or ZIP.
check('', null)
check('   ', null)
check('United States', null)
check('10001 Louisville', atPlace('Louisville'))
check('10001', null)
check('Cane Run', null)
check('Cane Run Rd', null)
check('123 Main St', null)
check('123 Main St Apt 2', null)
check('123 Bardstown Rd', null)
check('123 Boston Rd', null)
check('123 Buffalo Trace Rd', null)
check('123 Main St, New York, NY 10001', null)
check('10001-0001', null)

cases++
if (PLACE_MISS !== 'We can’t place street addresses yet. Try a town, a 5-digit ZIP, or a place on our map.') {
  fail(`PLACE_MISS is ${JSON.stringify(PLACE_MISS)}`)
}
const ambiguousExport = startSrc.match(/export const PLACE_AMBIGUOUS = '([^']*)'/)
if (!ambiguousExport || !/be more specific/i.test(ambiguousExport[1])) {
  fail(`PLACE_AMBIGUOUS missing or unclear: ${ambiguousExport && ambiguousExport[1]}`)
}
if (!pageSrc.includes('PLACE_AMBIGUOUS')) fail('ambiguous copy is not wired into the page')
if (!pageSrc.includes('/data/app/locals.json')) fail('page does not load locals for name match')
if (!pageSrc.includes('place on our map')) fail('empty-state hint does not mention a place on our map')
if (!htmlSrc.includes('place on our map')) fail('start field hint does not mention a place on our map')
if (!pageSrc.includes('namedPlaces')) fail('typeahead does not take place names from the name index')
if (!startSrc.includes('collectNamedPlaces')) fail('name index helper missing from the resolver')
cases++
const indexedLinnig = names.find((row) => row[0] === "Mike Linnig's")
if (!indexedLinnig || indexedLinnig[1] !== 38.1190825 || indexedLinnig[2] !== -85.8972682) {
  fail('name index dropped Mike Linnig\'s')
}
if (/\bfetch\s*\(|\bXMLHttpRequest\b|nominatim|mapbox|opencage|photon\.komoot|maps\.googleapis/i.test(startSrc)) {
  fail('drive-start.js reaches the network or a geocoder')
}
if (/from\s+['"]/.test(startSrc)) fail('drive-start.js should not import another module')
if (/nominatim|mapbox|opencage|photon\.komoot|maps\.googleapis/i.test(pageSrc)) {
  fail('build-a-drive.js adds a geocoder')
}
if (!pageSrc.includes('PLACE_MISS')) fail('miss copy is not wired into the page')
if (!startSrc.includes(PLACE_MISS)) fail('PLACE_MISS missing from the resolver module')
if (pageSrc.includes('We couldn’t find')) fail('old miss copy still in the page')
if (!/return resolveStart\(/.test(pageSrc)) fail('resolve() does not call resolveStart')

// Go sits beside the start field and uses the same form submit as Enter.
// Enter has no key handler: a text field in #form submits, and the one
// submit listener calls resolve() → resolveStart. Go is type="submit"
// in that form, so it must not grow its own click path.
cases++
const form = htmlSrc.match(/<form\b[^>]*\bid="form"[^>]*>([\s\S]*?)<\/form>/)
if (!form) fail('planner form #form missing')
else {
  const formHtml = form[1]
  const grouped = formHtml.match(/<div class="ask-start">([\s\S]*?)<\/div>/)
  if (!grouped) fail('start field and Go are not grouped beside each other')
  else {
    const block = grouped[1]
    const qAt = block.search(/\bid="q"/)
    const go = block.match(/<button\b([^>]*)>\s*Go\s*<\/button>/)
    if (qAt < 0) fail('start field #q is not in the Go group')
    if (!go) fail('visible Go control is missing beside the start field')
    else {
      if (block.indexOf(go[0]) < qAt) fail('Go is not after the start field')
      if (!/\btype="submit"/.test(go[1])) fail('Go does not submit the form the way Enter does')
      if (!/\bbtn-primary\b/.test(go[1])) fail('Go does not reuse the Suggest a drive primary style')
      if (/\btype="button"/.test(go[1])) fail('Go is a separate button instead of the form submit')
    }
  }
  if (!/<button type="submit" class="btn-primary">Suggest a drive<\/button>/.test(formHtml)) {
    fail('Suggest a drive submit control was removed or restyled')
  }
  if (!/id="useLoc"[\s\S]*type="button"|type="button"[\s\S]*id="useLoc"/.test(formHtml)) {
    fail('Use my location must stay a non-submit control')
  }
}
const submitListeners = pageSrc.match(/addEventListener\(\s*'submit'/g) || []
if (submitListeners.length !== 1) fail(`expected one form submit handler, found ${submitListeners.length}`)
if (/\$\(\s*'goStart'\s*\)|getElementById\(\s*'goStart'\s*\)|querySelector\(\s*['"][^'"]*goStart/.test(pageSrc)) {
  fail('Go has its own script handler instead of the form submit path')
}
if (/nominatim|mapbox|opencage|photon\.komoot|maps\.googleapis/i.test(htmlSrc + cssSrc)) {
  fail('planner markup adds a geocoder')
}
if (!/\.ask-row\s*\{[^}]*min-width:\s*0/.test(cssSrc)) fail('ask row can force the page wider than the screen')
if (!/\.ask-start\s*\{[^}]*min-width:\s*0/.test(cssSrc)) fail('Go group can force the page wider than the screen')
if (!/\.ask-start\s*\{[^}]*display:\s*flex/.test(cssSrc)) fail('start field and Go are not a flex row')
if (!/\.ask-start\s*\{[^}]*flex-wrap:\s*nowrap/.test(cssSrc)) fail('Go can wrap away from the start field')
if (!/\.ask-start\s+\.btn-primary\s*\{[^}]*width:\s*auto/.test(cssSrc)) {
  fail('Go uses the full-width primary rule and will not sit beside the field')
}

if (errors.length) {
  for (const e of errors) console.error('test-drive-start:', e)
  console.error(`test-drive-start: ${errors.length} failure(s) in ${cases} cases`)
  process.exit(1)
}
console.log(`test-drive-start: ${cases} cases; pasted addresses use the local gazetteer only`)
