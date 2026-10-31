/**
 * Plan a Drive start text: exact ZIP / town / distillery, plus a KY ZIP or town
 * read out of a pasted address. Local gazetteer only.
 */
import fs from 'node:fs'
import { PLACE_MISS, resolveStart } from '../src/drive-start.js'

const root = new URL('..', import.meta.url)
const db = JSON.parse(fs.readFileSync(new URL('public/drives/ky-places.json', root), 'utf8'))
const distilleries = JSON.parse(fs.readFileSync(new URL('public/drives/byod-stops.json', root), 'utf8')).distilleries
const pageSrc = fs.readFileSync(new URL('src/build-a-drive.js', root), 'utf8')
const startSrc = fs.readFileSync(new URL('src/drive-start.js', root), 'utf8')

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
    got = resolveStart(input, db, distilleries)
  } catch (err) {
    fail(`${JSON.stringify(input)} threw ${err && err.message}`)
    return
  }
  if (got instanceof Promise) {
    fail(`${JSON.stringify(input)} returned a promise`)
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
if (PLACE_MISS !== 'We can’t place street addresses yet. Try a town or a 5-digit ZIP.') {
  fail(`PLACE_MISS is ${JSON.stringify(PLACE_MISS)}`)
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

if (errors.length) {
  for (const e of errors) console.error('test-drive-start:', e)
  console.error(`test-drive-start: ${errors.length} failure(s) in ${cases} cases`)
  process.exit(1)
}
console.log(`test-drive-start: ${cases} cases; pasted addresses use the local gazetteer only`)
