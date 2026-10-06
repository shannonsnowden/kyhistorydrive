#!/usr/bin/env node
/** Unit checks for OTA type rules. Does not read the repo pack. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { canonicalizeHistoryPlace, checkOtaPack, coerceMarkerInt } from './ota-types.mjs'

assert.equal(coerceMarkerInt('1274'), 1274)
assert.equal(coerceMarkerInt(21), 21)
assert.equal(coerceMarkerInt(null), null)
assert.equal(coerceMarkerInt(''), null)
assert.equal(coerceMarkerInt('12.5'), null)

const place = { id: 'x', marker_number: '1274', website: null, marker_title: null }
assert.equal(canonicalizeHistoryPlace(place), true)
assert.equal(place.marker_number, 1274)
assert.equal('website' in place, false)
assert.equal(place.marker_title, null)
assert.equal(canonicalizeHistoryPlace({ id: 'y' }), false)
const dropped = { id: 'z', marker_number: null }
assert.equal(canonicalizeHistoryPlace(dropped), true)
assert.equal('marker_number' in dropped, false)

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-types-'))
const history = [{
  id: 'bad', name: 'Bad', subtitle: 's', history: 'h', marker_number: '1274', website: null,
}]
const cemeteries = [{
  id: 'cem', name: 'C', city: 'Midway', county: 'Woodford', cemetery_type: 'other',
  history: 'h', why_historic_url: 'https://history.ky.gov/markers/example',
  notable_burials: [{ name: 'Edward Dudley Brown', significance: 'jockey', bio_url: null }],
}]
fs.writeFileSync(path.join(dir, 'ky-history.json'), JSON.stringify(history))
fs.writeFileSync(path.join(dir, 'historic-cemeteries.json'), JSON.stringify(cemeteries))
fs.writeFileSync(path.join(dir, 'ky-history-manifest.json'), JSON.stringify({ data_version: 1, entry_count: 1 }))
const issues = checkOtaPack(dir, { requireAll: false })
assert.ok(issues.some((i) => i.includes('marker_number') && i.includes('1274')), issues.join('\n'))
assert.ok(issues.some((i) => i.includes('bio_url')), issues.join('\n'))
assert.ok(issues.some((i) => i.includes('null URL')), issues.join('\n'))

history[0].marker_number = 1274
delete history[0].website
cemeteries[0].notable_burials[0].bio_url = 'https://en.wikipedia.org/wiki/Edward_D._Brown'
fs.writeFileSync(path.join(dir, 'ky-history.json'), JSON.stringify(history))
fs.writeFileSync(path.join(dir, 'historic-cemeteries.json'), JSON.stringify(cemeteries))
const fixed = checkOtaPack(dir, { requireAll: false })
assert.deepEqual(fixed, [], fixed.join('\n'))

console.log('ok - ota type rules reject string marker_number, null bio_url, and null URLs')
